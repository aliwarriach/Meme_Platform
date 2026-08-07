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


async def _befriend(client: AsyncClient, alice: dict, bob: dict) -> None:
    request_response = await client.post(
        "/friends/requests", json={"username": bob["user"]["username"]}, headers=auth_header(alice)
    )
    friendship_id = request_response.json()["id"]
    await client.post(f"/friends/requests/{friendship_id}/accept", headers=auth_header(bob))


async def _propose_duel(
    client: AsyncClient,
    challenger: dict,
    opponent: dict,
    start_time: str | None = None,
    end_time: str | None = None,
):
    return await client.post(
        f"/challenges/duels/{opponent['user']['id']}",
        json={
            "title": "Meme Duel",
            "start_time": start_time or PAST(1),
            "end_time": end_time or FUTURE(10),
        },
        headers=auth_header(challenger),
    )


async def _create_and_submit(client: AsyncClient, user: dict, challenge_id: str):
    files = {"image": ("test.png", b"fake-bytes", "image/png")}
    return await client.post(
        f"/challenges/{challenge_id}/submissions",
        files=files,
        data={"caption": "my entry"},
        headers=auth_header(user),
    )


async def test_propose_requires_friendship(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")

    response = await _propose_duel(client, alice, bob)
    assert response.status_code == 403


async def test_propose_rejects_duelling_self(client: AsyncClient):
    alice = await create_user(client, "alice")

    response = await _propose_duel(client, alice, alice)
    assert response.status_code == 400


async def test_propose_creates_pending_duel_with_two_sides(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    await _befriend(client, alice, bob)

    response = await _propose_duel(client, alice, bob)
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "setup"
    assert body["challenge_type"] == "duel"
    assert body["invitee_id"] == bob["user"]["id"]
    assert len(body["sides"]) == 2


async def test_non_invitee_cannot_accept_or_decline(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    outsider = await create_user(client, "outsider")
    await _befriend(client, alice, bob)
    duel = (await _propose_duel(client, alice, bob)).json()

    # The challenger themselves can't accept their own invite.
    response = await client.post(
        f"/challenges/duels/{duel['id']}/accept", headers=auth_header(alice)
    )
    assert response.status_code == 403

    response = await client.post(
        f"/challenges/duels/{duel['id']}/accept", headers=auth_header(outsider)
    )
    assert response.status_code == 403


async def test_invitee_accepts_duel_goes_active(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    await _befriend(client, alice, bob)
    duel = (await _propose_duel(client, alice, bob)).json()

    response = await client.post(
        f"/challenges/duels/{duel['id']}/accept", headers=auth_header(bob)
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "active"
    member_ids = {uid for side in body["sides"] for uid in side["member_ids"]}
    assert member_ids == {alice["user"]["id"], bob["user"]["id"]}


async def test_invitee_declines_duel_is_removed(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    await _befriend(client, alice, bob)
    duel = (await _propose_duel(client, alice, bob)).json()

    response = await client.delete(
        f"/challenges/duels/{duel['id']}/decline", headers=auth_header(bob)
    )
    assert response.status_code == 204

    get_response = await client.get(f"/challenges/{duel['id']}", headers=auth_header(alice))
    assert get_response.status_code == 404


async def test_full_duel_lifecycle_evaluates_and_awards_winner_only(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    await _befriend(client, alice, bob)
    duel = (await _propose_duel(client, alice, bob)).json()
    await client.post(f"/challenges/duels/{duel['id']}/accept", headers=auth_header(bob))

    alice_side_id = next(
        s["id"] for s in duel["sides"] if s["name"] == alice["user"]["username"]
    )

    submit = await _create_and_submit(client, alice, duel["id"])
    assert submit.status_code == 201
    assert submit.json()["side_id"] == alice_side_id
    alice_meme_id = submit.json()["meme"]["id"]

    await client.post(f"/memes/{alice_meme_id}/votes", json={"value": 1}, headers=auth_header(bob))

    await _create_and_submit(client, bob, duel["id"])

    async with TestSessionFactory() as session:
        evaluated = await evaluate_challenge(session, uuid.UUID(duel["id"]))
    assert evaluated.status.value == "evaluated"
    assert evaluated.winning_side_id == uuid.UUID(alice_side_id)

    alice_badges = await client.get("/auth/me/badges", headers=auth_header(alice))
    bob_badges = await client.get("/auth/me/badges", headers=auth_header(bob))
    assert len(alice_badges.json()) == 1
    assert bob_badges.json() == []


async def test_duel_notifications_fire_on_invite_accept_and_results(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    await _befriend(client, alice, bob)

    duel = (await _propose_duel(client, alice, bob)).json()
    bob_notifications = (await client.get("/notifications", headers=auth_header(bob))).json()
    assert any(n["type"] == "challenge_invite" for n in bob_notifications["items"])

    await client.post(f"/challenges/duels/{duel['id']}/accept", headers=auth_header(bob))
    alice_notifications = (await client.get("/notifications", headers=auth_header(alice))).json()
    assert any(n["type"] == "challenge_invite_accepted" for n in alice_notifications["items"])
    bob_notifications = (await client.get("/notifications", headers=auth_header(bob))).json()
    assert any(n["type"] == "challenge_starting" for n in bob_notifications["items"])

    async with TestSessionFactory() as session:
        await evaluate_challenge(session, uuid.UUID(duel["id"]))

    alice_notifications = (await client.get("/notifications", headers=auth_header(alice))).json()
    bob_notifications = (await client.get("/notifications", headers=auth_header(bob))).json()
    assert any(n["type"] == "challenge_results" for n in alice_notifications["items"])
    assert any(n["type"] == "challenge_results" for n in bob_notifications["items"])
