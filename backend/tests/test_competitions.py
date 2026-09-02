import datetime
import uuid

from httpx import AsyncClient
from sqlalchemy import update

from app.models.meme import Meme
from app.models.meme_vote import MemeVote
from tests.conftest import TestSessionFactory, auth_header, create_user


async def _post_meme(client: AsyncClient, user: dict, audiences: list[str] = ["public"]) -> dict:
    files = {"image": ("test.png", b"fake-bytes", "image/png")}
    response = await client.post(
        "/memes", files=files, data={"audiences": audiences}, headers=auth_header(user)
    )
    return response.json()


async def _vote(client: AsyncClient, user: dict, meme_id: str, value: int) -> object:
    return await client.post(
        f"/memes/{meme_id}/votes", json={"value": value}, headers=auth_header(user)
    )


async def test_current_standings_ranks_by_atom_score(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    carol = await create_user(client, "carol")
    dave = await create_user(client, "dave")

    popular = await _post_meme(client, bob)
    unpopular = await _post_meme(client, bob)

    # popular: 3 up, 1 down -> atom = round((log10(4) * (0.4+0.6*(9/13)))*100) = 49
    await _vote(client, alice, popular["id"], 1)
    await _vote(client, carol, popular["id"], 1)
    await _vote(client, dave, popular["id"], 1)
    await _vote(client, bob, popular["id"], -1)

    # unpopular: 1 up -> atom = round((log10(2)*0.82)*100) = 25
    await _vote(client, alice, unpopular["id"], 1)

    response = await client.get("/competitions/day/current", headers=auth_header(alice))
    assert response.status_code == 200
    body = response.json()
    assert body["is_closed"] is False
    assert body["items"][0]["content"]["kind"] == "meme"
    assert body["items"][0]["content"]["meme"]["id"] == popular["id"]
    assert body["items"][0]["score"] == 49
    assert body["items"][1]["content"]["meme"]["id"] == unpopular["id"]
    assert body["items"][1]["score"] == 25


async def test_current_standings_ranks_downvoted_meme_last(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    carol = await create_user(client, "carol")

    liked = await _post_meme(client, bob)
    disliked = await _post_meme(client, bob)

    await _vote(client, alice, liked["id"], 1)

    await _vote(client, alice, disliked["id"], -1)
    await _vote(client, carol, disliked["id"], -1)

    response = await client.get("/competitions/day/current", headers=auth_header(alice))
    assert response.status_code == 200
    body = response.json()
    ids_in_order = [item["content"]["meme"]["id"] for item in body["items"]]
    assert ids_in_order.index(liked["id"]) < ids_in_order.index(disliked["id"])

    # The atom is never negative: downvotes only *lower* quality and are excluded from the
    # reach floor, so a purely-downvoted meme with no views/upvotes bottoms out at 0 reach
    # -> score 0 (not -2). It ranks last, which is the point.
    disliked_entry = next(i for i in body["items"] if i["content"]["meme"]["id"] == disliked["id"])
    assert disliked_entry["score"] == 0


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
    assert body["content"] is None
    assert body["score"] == 0


async def test_winner_surfaced_for_closed_period_with_votes(client: AsyncClient):
    # Competitions rank memes *created within* the period by their score atom. The API always
    # creates a meme "now", so to test a closed (yesterday) period the memes' created_at is
    # backdated directly at the DB layer here; votes can be seeded whenever, since the atom
    # uses a meme's all-time votes (only the meme's own created_at decides period membership).
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    carol = await create_user(client, "carol")
    winning_meme = await _post_meme(client, bob)
    losing_meme = await _post_meme(client, bob)

    yesterday_start = (
        datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=1)
    ).replace(hour=12, minute=0, second=0, microsecond=0)
    yesterday_key = yesterday_start.strftime("%Y-%m-%d")

    async with TestSessionFactory() as session:
        await session.execute(
            update(Meme)
            .where(Meme.id.in_([uuid.UUID(winning_meme["id"]), uuid.UUID(losing_meme["id"])]))
            .values(created_at=yesterday_start)
        )
        session.add_all(
            [
                # winning_meme: 2 up -> atom 40
                MemeVote(
                    id=uuid.uuid4(),
                    user_id=uuid.UUID(alice["user"]["id"]),
                    meme_id=uuid.UUID(winning_meme["id"]),
                    value=1,
                ),
                MemeVote(
                    id=uuid.uuid4(),
                    user_id=uuid.UUID(carol["user"]["id"]),
                    meme_id=uuid.UUID(winning_meme["id"]),
                    value=1,
                ),
                # losing_meme: 1 up, 1 down -> atom 24
                MemeVote(
                    id=uuid.uuid4(),
                    user_id=uuid.UUID(bob["user"]["id"]),
                    meme_id=uuid.UUID(losing_meme["id"]),
                    value=1,
                ),
                MemeVote(
                    id=uuid.uuid4(),
                    user_id=uuid.UUID(alice["user"]["id"]),
                    meme_id=uuid.UUID(losing_meme["id"]),
                    value=-1,
                ),
            ]
        )
        await session.commit()

    response = await client.get(
        f"/competitions/day/winner?period_key={yesterday_key}", headers=auth_header(alice)
    )
    assert response.status_code == 200
    body = response.json()
    assert body["content"]["kind"] == "meme"
    assert body["content"]["meme"]["id"] == winning_meme["id"]
    assert body["score"] == 40


async def test_winner_shows_deleted_post_placeholder_when_deleted_after_period_closed(
    client: AsyncClient,
):
    """A post that already won a closed period stays the winner even after deletion —
    deleting it must never retroactively promote the runner-up, that would rewrite
    history based on an unrelated moderation action. Its content degrades to a null/
    'Deleted Post' placeholder for display (the underlying Cloudinary asset is gone),
    but the rank/score stand."""
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    carol = await create_user(client, "carol")
    winning_meme = await _post_meme(client, bob)
    losing_meme = await _post_meme(client, bob)

    yesterday_start = (
        datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=1)
    ).replace(hour=12, minute=0, second=0, microsecond=0)
    yesterday_key = yesterday_start.strftime("%Y-%m-%d")

    async with TestSessionFactory() as session:
        await session.execute(
            update(Meme)
            .where(Meme.id.in_([uuid.UUID(winning_meme["id"]), uuid.UUID(losing_meme["id"])]))
            .values(created_at=yesterday_start)
        )
        session.add_all(
            [
                MemeVote(
                    id=uuid.uuid4(),
                    user_id=uuid.UUID(alice["user"]["id"]),
                    meme_id=uuid.UUID(winning_meme["id"]),
                    value=1,
                ),
                MemeVote(
                    id=uuid.uuid4(),
                    user_id=uuid.UUID(carol["user"]["id"]),
                    meme_id=uuid.UUID(winning_meme["id"]),
                    value=1,
                ),
            ]
        )
        await session.commit()

    # Deleted "today" — well after yesterday's period already closed.
    delete_response = await client.delete(f"/memes/{winning_meme['id']}", headers=auth_header(bob))
    assert delete_response.status_code == 204

    response = await client.get(
        f"/competitions/day/winner?period_key={yesterday_key}", headers=auth_header(alice)
    )
    assert response.status_code == 200
    body = response.json()
    assert body["content"]["kind"] == "meme"
    assert body["content"]["meme"] is None
    assert body["content"]["is_deleted"] is True
    assert body["score"] == 40


async def test_winner_excludes_a_meme_deleted_before_its_period_closed(client: AsyncClient):
    """A meme deleted *while* its period was still live/ongoing was never actually
    eligible the whole time (matches get_current_standings's exclusion) — the period
    later closing doesn't retroactively un-exclude it, even though it would otherwise
    have scored highest."""
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    carol = await create_user(client, "carol")
    would_be_winner = await _post_meme(client, bob)
    actual_winner = await _post_meme(client, bob)

    yesterday_start = (
        datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=1)
    ).replace(hour=8, minute=0, second=0, microsecond=0)
    deleted_mid_period = yesterday_start.replace(hour=14)
    yesterday_key = yesterday_start.strftime("%Y-%m-%d")

    async with TestSessionFactory() as session:
        await session.execute(
            update(Meme)
            .where(Meme.id.in_([uuid.UUID(would_be_winner["id"]), uuid.UUID(actual_winner["id"])]))
            .values(created_at=yesterday_start)
        )
        session.add_all(
            [
                # would_be_winner: 3 up -> higher atom than actual_winner's 1 up, but
                # deleted mid-period, before the day even closed.
                MemeVote(
                    id=uuid.uuid4(),
                    user_id=uuid.UUID(alice["user"]["id"]),
                    meme_id=uuid.UUID(would_be_winner["id"]),
                    value=1,
                ),
                MemeVote(
                    id=uuid.uuid4(),
                    user_id=uuid.UUID(bob["user"]["id"]),
                    meme_id=uuid.UUID(would_be_winner["id"]),
                    value=1,
                ),
                MemeVote(
                    id=uuid.uuid4(),
                    user_id=uuid.UUID(carol["user"]["id"]),
                    meme_id=uuid.UUID(would_be_winner["id"]),
                    value=1,
                ),
                MemeVote(
                    id=uuid.uuid4(),
                    user_id=uuid.UUID(alice["user"]["id"]),
                    meme_id=uuid.UUID(actual_winner["id"]),
                    value=1,
                ),
            ]
        )
        await session.execute(
            update(Meme)
            .where(Meme.id == uuid.UUID(would_be_winner["id"]))
            .values(deleted_at=deleted_mid_period)
        )
        await session.commit()

    response = await client.get(
        f"/competitions/day/winner?period_key={yesterday_key}", headers=auth_header(alice)
    )
    assert response.status_code == 200
    body = response.json()
    assert body["content"]["kind"] == "meme"
    assert body["content"]["meme"]["id"] == actual_winner["id"]
    assert body["content"]["is_deleted"] is False


async def test_winner_malformed_period_key_rejected(client: AsyncClient):
    alice = await create_user(client, "alice")
    response = await client.get(
        "/competitions/day/winner?period_key=not-a-date", headers=auth_header(alice)
    )
    assert response.status_code == 400


async def test_deleted_meme_excluded_from_standings(client: AsyncClient):
    """A deleted post can never be nominated for Meme of the Day/Week/Month, even though
    its score keeps counting toward the author's leaderboard/profile total (see
    test_scoring.py/test_leaderboards.py) and toward any challenge it was already
    submitted to (see test_open_challenges.py) — competitions are the one surface a
    deletion actually removes a post from."""
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")

    deleted_meme = await _post_meme(client, bob)
    surviving_meme = await _post_meme(client, bob)

    # Give the deleted one the higher score so it would win if it weren't excluded.
    await _vote(client, alice, deleted_meme["id"], 1)

    delete_response = await client.delete(f"/memes/{deleted_meme['id']}", headers=auth_header(bob))
    assert delete_response.status_code == 204

    response = await client.get("/competitions/day/current", headers=auth_header(alice))
    assert response.status_code == 200
    ids = [item["content"]["meme"]["id"] for item in response.json()["items"]]
    assert deleted_meme["id"] not in ids
    assert surviving_meme["id"] in ids
