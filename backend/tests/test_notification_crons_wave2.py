"""The two new arq cron jobs from the second notification wave (2026-08-31): competition
wins (no service-layer hook exists — standings are computed live on read, see
services/competitions.py) and batched meme upvotes (deliberately a periodic summary, not a
per-vote notification — see .claude/memory/notifications.md). Called directly against
seeded data, same convention as test_challenge_notification_crons.py.
"""

import datetime
import uuid

from httpx import AsyncClient
from sqlalchemy import update

from app.models.meme import Meme
from app.workers.tasks.notifications import (
    notify_batched_meme_upvotes,
    notify_competition_winners,
)
from tests.conftest import TestSessionFactory, auth_header, create_user

IMAGE = {"image": ("test.png", b"fake-bytes", "image/png")}


async def _post_meme(client: AsyncClient, user: dict) -> dict:
    response = await client.post(
        "/memes", files=IMAGE, data={"audiences": ["public"]}, headers=auth_header(user)
    )
    return response.json()


async def _backdate_to_yesterday(meme_id: str) -> datetime.datetime:
    yesterday_start = (
        datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=1)
    ).replace(hour=12, minute=0, second=0, microsecond=0)
    async with TestSessionFactory() as session:
        await session.execute(
            update(Meme).where(Meme.id == uuid.UUID(meme_id)).values(created_at=yesterday_start)
        )
        await session.commit()
    return yesterday_start


async def test_competition_winner_cron_notifies_yesterdays_day_winner_once(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    meme = await _post_meme(client, bob)
    await _backdate_to_yesterday(meme["id"])

    await client.post(f"/memes/{meme['id']}/votes", json={"value": 1}, headers=auth_header(alice))

    notified = await notify_competition_winners({})
    assert notified >= 1

    notifications = (await client.get("/notifications", headers=auth_header(bob))).json()
    day_wins = [
        n
        for n in notifications["items"]
        if n["type"] == "competition_won" and n["data"]["period_type"] == "day"
    ]
    assert len(day_wins) == 1
    assert day_wins[0]["data"]["period_key"]

    # A second poll must not re-notify the same (already-claimed) period.
    notified_again = await notify_competition_winners({})
    notifications = (await client.get("/notifications", headers=auth_header(bob))).json()
    day_wins_again = [
        n
        for n in notifications["items"]
        if n["type"] == "competition_won" and n["data"]["period_type"] == "day"
    ]
    assert len(day_wins_again) == 1
    # Every period type's dedup row is claimed on its first check regardless of outcome, so
    # a second poll within the same real-world day/week/month has nothing left to process.
    assert notified_again == 0


async def test_competition_winner_cron_still_notifies_after_the_winning_post_is_deleted(
    client: AsyncClient, mock_media_delete
):
    """The winner is resolved off the raw Meme row (author_id), bypassing the public API's
    soft-delete degradation — so deleting the winning post between period-close and the
    cron's next run must not silently drop the notification."""
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    meme = await _post_meme(client, bob)
    await _backdate_to_yesterday(meme["id"])
    await client.post(f"/memes/{meme['id']}/votes", json={"value": 1}, headers=auth_header(alice))

    await client.delete(f"/memes/{meme['id']}", headers=auth_header(bob))

    await notify_competition_winners({})

    notifications = (await client.get("/notifications", headers=auth_header(bob))).json()
    day_wins = [
        n
        for n in notifications["items"]
        if n["type"] == "competition_won" and n["data"]["period_type"] == "day"
    ]
    assert len(day_wins) == 1


async def test_batched_upvotes_summarizes_into_one_notification_and_excludes_self_votes(
    client: AsyncClient,
):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    carol = await create_user(client, "carol")
    meme = await _post_meme(client, alice)

    # Self-upvote must not count.
    await client.post(f"/memes/{meme['id']}/votes", json={"value": 1}, headers=auth_header(alice))
    await client.post(f"/memes/{meme['id']}/votes", json={"value": 1}, headers=auth_header(bob))
    await client.post(f"/memes/{meme['id']}/votes", json={"value": 1}, headers=auth_header(carol))

    processed = await notify_batched_meme_upvotes({})
    assert processed == 1

    notifications = (await client.get("/notifications", headers=auth_header(alice))).json()
    upvote_notifs = [n for n in notifications["items"] if n["type"] == "meme_upvotes_received"]
    assert len(upvote_notifs) == 1
    assert "+2" in upvote_notifs[0]["body"]

    # A second run's window starts at the first run's cursor — no new votes since, so
    # nothing new to summarize.
    processed_again = await notify_batched_meme_upvotes({})
    assert processed_again == 0


async def test_batched_upvotes_ignores_votes_on_a_deleted_meme(
    client: AsyncClient, mock_media_delete
):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    meme = await _post_meme(client, alice)
    await client.post(f"/memes/{meme['id']}/votes", json={"value": 1}, headers=auth_header(bob))
    await client.delete(f"/memes/{meme['id']}", headers=auth_header(alice))

    processed = await notify_batched_meme_upvotes({})
    assert processed == 0
