import datetime
import uuid

from httpx import AsyncClient

from app.models.vote import CompetitionPeriod, Vote
from tests.conftest import TestSessionFactory, auth_header, create_user


async def _post_meme(client: AsyncClient, user: dict, audiences: list[str] = ["public"]) -> dict:
    files = {"image": ("test.png", b"fake-bytes", "image/png")}
    response = await client.post(
        "/memes", files=files, data={"audiences": audiences}, headers=auth_header(user)
    )
    return response.json()


async def _create_community(
    client: AsyncClient, owner: dict, privacy: str = "invite_only", name: str = "Meme Lords"
) -> dict:
    response = await client.post(
        "/communities", data={"name": name, "privacy": privacy}, headers=auth_header(owner)
    )
    return response.json()


async def _post_community_meme(client: AsyncClient, user: dict, community_id: str) -> dict:
    files = {"image": ("test.png", b"fake-bytes", "image/png")}
    response = await client.post(
        f"/communities/{community_id}/memes", files=files, headers=auth_header(user)
    )
    return response.json()


async def test_vote_succeeds_and_second_vote_for_same_meme_rejected(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    meme = await _post_meme(client, bob)

    response = await client.post(f"/competitions/day/votes/{meme['id']}", headers=auth_header(alice))
    assert response.status_code == 201
    body = response.json()
    assert body["meme_id"] == meme["id"]
    assert body["period_type"] == "day"

    response = await client.post(f"/competitions/day/votes/{meme['id']}", headers=auth_header(alice))
    assert response.status_code == 409


async def test_vote_for_different_memes_same_period_both_allowed(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    meme_1 = await _post_meme(client, bob)
    meme_2 = await _post_meme(client, bob)

    r1 = await client.post(f"/competitions/day/votes/{meme_1['id']}", headers=auth_header(alice))
    r2 = await client.post(f"/competitions/day/votes/{meme_2['id']}", headers=auth_header(alice))
    assert r1.status_code == 201
    assert r2.status_code == 201


async def test_vote_rejected_for_own_meme(client: AsyncClient):
    alice = await create_user(client, "alice")
    meme = await _post_meme(client, alice)

    response = await client.post(f"/competitions/day/votes/{meme['id']}", headers=auth_header(alice))
    assert response.status_code == 400


async def test_vote_nonexistent_meme_404(client: AsyncClient):
    alice = await create_user(client, "alice")
    response = await client.post(
        "/competitions/day/votes/00000000-0000-0000-0000-000000000000",
        headers=auth_header(alice),
    )
    assert response.status_code == 404


async def test_vote_requires_auth(client: AsyncClient):
    bob = await create_user(client, "bob")
    meme = await _post_meme(client, bob)
    response = await client.post(f"/competitions/day/votes/{meme['id']}")
    assert response.status_code == 401


async def test_vote_rejected_on_non_public_meme(client: AsyncClient):
    alice = await create_user(client, "alice")
    community = await _create_community(client, alice, privacy="invite_only")
    meme = await _post_community_meme(client, alice, community["id"])

    response = await client.post(f"/competitions/day/votes/{meme['id']}", headers=auth_header(alice))
    assert response.status_code == 400


async def test_current_standings_ranks_by_vote_count(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    carol = await create_user(client, "carol")
    dave = await create_user(client, "dave")

    popular = await _post_meme(client, bob)
    unpopular = await _post_meme(client, bob)

    await client.post(f"/competitions/day/votes/{popular['id']}", headers=auth_header(alice))
    await client.post(f"/competitions/day/votes/{popular['id']}", headers=auth_header(carol))
    await client.post(f"/competitions/day/votes/{popular['id']}", headers=auth_header(dave))
    await client.post(f"/competitions/day/votes/{unpopular['id']}", headers=auth_header(alice))

    response = await client.get("/competitions/day/current", headers=auth_header(alice))
    assert response.status_code == 200
    body = response.json()
    assert body["is_closed"] is False
    assert body["items"][0]["meme"]["id"] == popular["id"]
    assert body["items"][0]["vote_count"] == 3
    assert body["items"][1]["vote_count"] == 1


async def test_winner_rejected_for_period_still_in_progress(client: AsyncClient):
    alice = await create_user(client, "alice")
    today = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")

    response = await client.get(
        f"/competitions/day/winner?period_key={today}", headers=auth_header(alice)
    )
    assert response.status_code == 400


async def test_winner_surfaced_for_closed_period_with_no_votes(client: AsyncClient):
    alice = await create_user(client, "alice")
    yesterday = (
        datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=1)
    ).strftime("%Y-%m-%d")

    response = await client.get(
        f"/competitions/day/winner?period_key={yesterday}", headers=auth_header(alice)
    )
    assert response.status_code == 200
    body = response.json()
    assert body["meme"] is None
    assert body["vote_count"] == 0


async def test_winner_surfaced_for_closed_period_with_votes(client: AsyncClient):
    # The vote endpoint always votes in the *current* period (by design — you can't vote in
    # the past), so a closed period with real votes is seeded directly at the DB layer here,
    # bypassing the API, to prove the winner-determination query itself picks the top meme.
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    carol = await create_user(client, "carol")
    winning_meme = await _post_meme(client, bob)
    losing_meme = await _post_meme(client, bob)

    yesterday = (
        datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=1)
    ).strftime("%Y-%m-%d")

    async with TestSessionFactory() as session:
        session.add_all(
            [
                Vote(
                    id=uuid.uuid4(),
                    user_id=uuid.UUID(alice["user"]["id"]),
                    meme_id=uuid.UUID(winning_meme["id"]),
                    period_type=CompetitionPeriod.day,
                    period_key=yesterday,
                ),
                Vote(
                    id=uuid.uuid4(),
                    user_id=uuid.UUID(carol["user"]["id"]),
                    meme_id=uuid.UUID(winning_meme["id"]),
                    period_type=CompetitionPeriod.day,
                    period_key=yesterday,
                ),
                Vote(
                    id=uuid.uuid4(),
                    user_id=uuid.UUID(bob["user"]["id"]),
                    meme_id=uuid.UUID(losing_meme["id"]),
                    period_type=CompetitionPeriod.day,
                    period_key=yesterday,
                ),
            ]
        )
        await session.commit()

    response = await client.get(
        f"/competitions/day/winner?period_key={yesterday}", headers=auth_header(alice)
    )
    assert response.status_code == 200
    body = response.json()
    assert body["meme"]["id"] == winning_meme["id"]
    assert body["vote_count"] == 2


async def test_winner_malformed_period_key_rejected(client: AsyncClient):
    alice = await create_user(client, "alice")
    response = await client.get(
        "/competitions/day/winner?period_key=not-a-date", headers=auth_header(alice)
    )
    assert response.status_code == 400
