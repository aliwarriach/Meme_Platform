import datetime
import uuid

from httpx import AsyncClient

from app.services.challenges import evaluate_challenge
from tests.conftest import TestSessionFactory, auth_header, create_user

FUTURE = lambda minutes=10: (  # noqa: E731
    datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=minutes)
).isoformat()
PAST = lambda minutes=10: (  # noqa: E731
    datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=minutes)
).isoformat()


async def _create_community(client: AsyncClient, owner: dict, name: str, privacy: str = "open") -> dict:
    response = await client.post(
        "/communities", data={"name": name, "privacy": privacy}, headers=auth_header(owner)
    )
    return response.json()


async def _join(client: AsyncClient, user: dict, community_id: str) -> None:
    await client.post(f"/communities/{community_id}/join", headers=auth_header(user))


async def _post_community_meme(client: AsyncClient, user: dict, community_id: str) -> dict:
    files = {"image": ("test.png", b"fake-bytes", "image/png")}
    response = await client.post(
        f"/communities/{community_id}/memes", files=files, headers=auth_header(user)
    )
    return response.json()


async def _propose(
    client: AsyncClient,
    proposer_owner: dict,
    home_community_id: str,
    opponent_community_id: str,
    start_time: str | None = None,
    end_time: str | None = None,
):
    return await client.post(
        f"/communities/{home_community_id}/challenges/vs/{opponent_community_id}",
        json={
            "title": "Community Showdown",
            "start_time": start_time or PAST(1),
            "end_time": end_time or FUTURE(10),
        },
        headers=auth_header(proposer_owner),
    )


async def test_propose_requires_home_community_owner(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    home = await _create_community(client, alice, "Home")
    opponent = await _create_community(client, bob, "Opponent")
    await _join(client, bob, home["id"])

    response = await _propose(client, bob, home["id"], opponent["id"])
    assert response.status_code == 403


async def test_propose_rejects_challenging_self(client: AsyncClient):
    alice = await create_user(client, "alice")
    home = await _create_community(client, alice, "Home")

    response = await _propose(client, alice, home["id"], home["id"])
    assert response.status_code == 400


async def test_propose_creates_setup_status_challenge_with_two_sides(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    home = await _create_community(client, alice, "Home")
    opponent = await _create_community(client, bob, "Opponent")

    response = await _propose(client, alice, home["id"], opponent["id"])
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "setup"
    assert body["challenge_type"] == "community_vs_community"
    assert body["community_id"] == home["id"]
    assert body["opponent_community_id"] == opponent["id"]
    assert len(body["sides"]) == 2
    side_community_ids = {s["community_id"] for s in body["sides"]}
    assert side_community_ids == {home["id"], opponent["id"]}


async def test_non_opponent_owner_cannot_accept_or_decline(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    home = await _create_community(client, alice, "Home")
    opponent = await _create_community(client, bob, "Opponent")
    challenge = (await _propose(client, alice, home["id"], opponent["id"])).json()

    # Proposer (alice, home owner) tries to accept their own proposal — only the
    # opponent's owner may respond.
    response = await client.post(
        f"/communities/{home['id']}/challenges/{challenge['id']}/accept", headers=auth_header(alice)
    )
    assert response.status_code == 403


async def test_opponent_owner_accepts_challenge_goes_active(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    home = await _create_community(client, alice, "Home")
    opponent = await _create_community(client, bob, "Opponent")
    challenge = (await _propose(client, alice, home["id"], opponent["id"])).json()

    response = await client.post(
        f"/communities/{opponent['id']}/challenges/{challenge['id']}/accept",
        headers=auth_header(bob),
    )
    assert response.status_code == 200
    assert response.json()["status"] == "active"


async def test_opponent_owner_declines_challenge_is_removed(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    home = await _create_community(client, alice, "Home")
    opponent = await _create_community(client, bob, "Opponent")
    challenge = (await _propose(client, alice, home["id"], opponent["id"])).json()

    response = await client.delete(
        f"/communities/{opponent['id']}/challenges/{challenge['id']}/decline",
        headers=auth_header(bob),
    )
    assert response.status_code == 204

    get_response = await client.get(
        f"/communities/{home['id']}/challenges/{challenge['id']}", headers=auth_header(alice)
    )
    assert get_response.status_code == 404


async def test_cannot_accept_already_active_challenge_twice(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    home = await _create_community(client, alice, "Home")
    opponent = await _create_community(client, bob, "Opponent")
    challenge = (await _propose(client, alice, home["id"], opponent["id"])).json()
    await client.post(
        f"/communities/{opponent['id']}/challenges/{challenge['id']}/accept",
        headers=auth_header(bob),
    )

    response = await client.post(
        f"/communities/{opponent['id']}/challenges/{challenge['id']}/accept",
        headers=auth_header(bob),
    )
    assert response.status_code == 400


async def test_both_communities_see_challenge_in_their_list(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    home = await _create_community(client, alice, "Home")
    opponent = await _create_community(client, bob, "Opponent")
    await _propose(client, alice, home["id"], opponent["id"])

    home_list = await client.get(f"/communities/{home['id']}/challenges", headers=auth_header(alice))
    opponent_list = await client.get(
        f"/communities/{opponent['id']}/challenges", headers=auth_header(bob)
    )
    assert len(home_list.json()) == 1
    assert len(opponent_list.json()) == 1
    assert home_list.json()[0]["id"] == opponent_list.json()[0]["id"]


async def test_submission_requires_membership_in_one_participating_community(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    outsider = await create_user(client, "outsider")
    home = await _create_community(client, alice, "Home")
    opponent = await _create_community(client, bob, "Opponent")
    challenge = (await _propose(client, alice, home["id"], opponent["id"])).json()
    await client.post(
        f"/communities/{opponent['id']}/challenges/{challenge['id']}/accept",
        headers=auth_header(bob),
    )

    meme = await _post_community_meme(client, alice, home["id"])
    response = await client.post(
        f"/communities/{home['id']}/challenges/{challenge['id']}/submissions",
        params={"meme_id": meme["id"]},
        headers=auth_header(outsider),
    )
    assert response.status_code == 403


async def test_submission_requires_meme_posted_to_the_submitters_side_community(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    home = await _create_community(client, alice, "Home")
    opponent = await _create_community(client, bob, "Opponent")
    challenge = (await _propose(client, alice, home["id"], opponent["id"])).json()
    await client.post(
        f"/communities/{opponent['id']}/challenges/{challenge['id']}/accept",
        headers=auth_header(bob),
    )

    # alice posts to her own personal feed (not a community post) — not eligible.
    files = {"image": ("test.png", b"fake-bytes", "image/png")}
    personal_meme = (
        await client.post(
            "/memes", files=files, data={"audiences": ["public"]}, headers=auth_header(alice)
        )
    ).json()

    response = await client.post(
        f"/communities/{home['id']}/challenges/{challenge['id']}/submissions",
        params={"meme_id": personal_meme["id"]},
        headers=auth_header(alice),
    )
    assert response.status_code == 400


async def test_full_vs_lifecycle_evaluates_and_awards_both_communities_members(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    carol = await create_user(client, "carol")
    home = await _create_community(client, alice, "Home")
    opponent = await _create_community(client, bob, "Opponent")
    await _join(client, carol, home["id"])

    challenge = (await _propose(client, alice, home["id"], opponent["id"])).json()
    await client.post(
        f"/communities/{opponent['id']}/challenges/{challenge['id']}/accept",
        headers=auth_header(bob),
    )

    # Home community submits a meme and gets an extra reaction to out-score Opponent.
    home_meme = await _post_community_meme(client, alice, home["id"])
    await client.post(
        f"/communities/{home['id']}/challenges/{challenge['id']}/submissions",
        params={"meme_id": home_meme["id"]},
        headers=auth_header(alice),
    )
    await client.post(f"/memes/{home_meme['id']}/reactions", headers=auth_header(bob))

    opponent_meme = await _post_community_meme(client, bob, opponent["id"])
    await client.post(
        f"/communities/{opponent['id']}/challenges/{challenge['id']}/submissions",
        params={"meme_id": opponent_meme["id"]},
        headers=auth_header(bob),
    )

    async with TestSessionFactory() as session:
        evaluated = await evaluate_challenge(session, uuid.UUID(challenge["id"]))
    assert evaluated.status.value == "evaluated"
    assert evaluated.winning_side_id is not None

    # Both alice (posted) and carol (just an active Home member) should be awarded,
    # since community_vs_community winners are the whole winning community's roster.
    alice_badges = await client.get("/auth/me/badges", headers=auth_header(alice))
    carol_badges = await client.get("/auth/me/badges", headers=auth_header(carol))
    bob_badges = await client.get("/auth/me/badges", headers=auth_header(bob))
    assert len(alice_badges.json()) == 1
    assert len(carol_badges.json()) == 1
    assert bob_badges.json() == []
