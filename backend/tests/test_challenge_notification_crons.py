"""Phase 21 — the three new arq cron jobs behind challenge notifications and cold start.
Called directly against seeded data (same pattern as the existing `close_expired_challenges`
coverage) rather than through a live arq worker, matching backend/CLAUDE.md's convention that
scheduled work is tested by invoking the job function, not by running the scheduler.
"""

import datetime

from httpx import AsyncClient

from app.workers.tasks.notifications import (
    create_weekly_open_challenge,
    notify_challenges_ending_soon,
    notify_side_overtaken,
)
from tests.conftest import auth_header, create_user

FUTURE = lambda minutes=10: (  # noqa: E731
    datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=minutes)
).isoformat()
PAST = lambda minutes=10: (  # noqa: E731
    datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=minutes)
).isoformat()

IMAGE = {"image": ("test.png", b"fake-bytes", "image/png")}


async def _create_open(client: AsyncClient, user: dict, hashtag: str, end_minutes: int) -> dict:
    payload = {
        "title": "Dogs vs Cats",
        "hashtag": hashtag,
        "start_time": PAST(5),
        "end_time": FUTURE(end_minutes),
        "sides": [{"name": "Dogs"}, {"name": "Cats"}],
    }
    return (await client.post("/challenges/open", json=payload, headers=auth_header(user))).json()


async def _join(client: AsyncClient, user: dict, challenge: dict, side_name: str):
    side = next(s for s in challenge["sides"] if s["name"] == side_name)
    await client.post(
        f"/challenges/{challenge['id']}/join",
        json={"side_id": side["id"]},
        headers=auth_header(user),
    )


async def _enter(client: AsyncClient, user: dict, challenge_id: str) -> dict:
    response = await client.post(
        f"/challenges/{challenge_id}/submissions",
        files=IMAGE,
        data={"caption": "lol"},
        headers=auth_header(user),
    )
    return response.json()


async def test_ending_soon_notifies_once_and_stamps_flag(client: AsyncClient):
    alice = await create_user(client, "alice")
    challenge = await _create_open(client, alice, "endingsoon", end_minutes=30)
    await _join(client, alice, challenge, "Dogs")

    notified = await notify_challenges_ending_soon({})
    assert notified == 1

    notifications = (await client.get("/notifications", headers=auth_header(alice))).json()
    ending_soon = [n for n in notifications["items"] if n["type"] == "challenge_ending_soon"]
    assert len(ending_soon) == 1

    # Second poll must not re-notify — the flag is already stamped.
    notified_again = await notify_challenges_ending_soon({})
    assert notified_again == 0
    notifications = (await client.get("/notifications", headers=auth_header(alice))).json()
    ending_soon = [n for n in notifications["items"] if n["type"] == "challenge_ending_soon"]
    assert len(ending_soon) == 1


async def test_ending_soon_ignores_challenges_outside_the_window(client: AsyncClient):
    alice = await create_user(client, "alice")
    challenge = await _create_open(client, alice, "notyet", end_minutes=180)
    await _join(client, alice, challenge, "Dogs")

    notified = await notify_challenges_ending_soon({})
    assert notified == 0


async def test_side_overtaken_only_fires_on_a_genuine_lead_change(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    challenge = await _create_open(client, alice, "overtake", end_minutes=60)
    await _join(client, alice, challenge, "Dogs")
    await _join(client, bob, challenge, "Cats")

    # 0-0 tie: no leader established yet.
    changed = await notify_side_overtaken({})
    assert changed == 0

    # Dogs takes the lead for the first time — establishing a leader isn't an "overtake".
    dogs_meme = await _enter(client, alice, challenge["id"])
    await client.post(
        f"/memes/{dogs_meme['meme']['id']}/votes", json={"value": 1}, headers=auth_header(bob)
    )
    changed = await notify_side_overtaken({})
    assert changed == 0
    alice_notifications = (await client.get("/notifications", headers=auth_header(alice))).json()
    assert not [n for n in alice_notifications["items"] if n["type"] == "challenge_side_overtaken"]

    # Cats overtakes Dogs — a genuine lead change, participants should be notified.
    cats_meme = await _enter(client, bob, challenge["id"])
    await client.post(
        f"/memes/{cats_meme['meme']['id']}/votes", json={"value": 1}, headers=auth_header(alice)
    )
    await client.post(
        f"/memes/{cats_meme['meme']['id']}/votes", json={"value": 1}, headers=auth_header(bob)
    )
    changed = await notify_side_overtaken({})
    assert changed == 1
    alice_notifications = (await client.get("/notifications", headers=auth_header(alice))).json()
    assert [n for n in alice_notifications["items"] if n["type"] == "challenge_side_overtaken"]


async def test_weekly_open_challenge_is_idempotent_within_the_same_week():
    created_first = await create_weekly_open_challenge({})
    assert created_first is True

    created_second = await create_weekly_open_challenge({})
    assert created_second is False
