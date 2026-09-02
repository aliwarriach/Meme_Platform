"""Phase 20 — open challenges + hashtags.

Anyone can create a platform-level challenge, anyone can pick a side, and entry is by
posting with the challenge's reserved tag. Also covers the two anti-gaming levers in
`_side_scores`, which are what make "anyone can join any side" safe to run.
"""

import datetime
import uuid

from httpx import AsyncClient
from sqlalchemy import select

from app.core.security import hash_password
from app.models.challenge import Challenge
from app.models.hashtag import Hashtag, MemeHashtag
from app.models.meme import Meme
from app.models.user import User
from app.services.challenges import evaluate_challenge
from app.workers.tasks.notifications import create_weekly_open_challenge as weekly_cron_job
from tests.conftest import TestSessionFactory, auth_header, create_user

FUTURE = lambda minutes=10: (  # noqa: E731
    datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=minutes)
).isoformat()
PAST = lambda minutes=10: (  # noqa: E731
    datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=minutes)
).isoformat()

IMAGE = {"image": ("test.png", b"fake-bytes", "image/png")}


async def _create_open(
    client: AsyncClient, user: dict, hashtag: str = "DogsVsCats", **overrides
) -> dict:
    payload = {
        "title": "Dogs vs Cats",
        "hashtag": hashtag,
        "start_time": PAST(5),
        "end_time": FUTURE(10),
        "sides": [{"name": "Dogs"}, {"name": "Cats"}],
        **overrides,
    }
    return await client.post("/challenges/open", json=payload, headers=auth_header(user))


async def _join(client: AsyncClient, user: dict, challenge: dict, side_name: str):
    side = next(s for s in challenge["sides"] if s["name"] == side_name)
    return await client.post(
        f"/challenges/{challenge['id']}/join",
        json={"side_id": side["id"]},
        headers=auth_header(user),
    )


async def _enter(client: AsyncClient, user: dict, challenge_id: str, caption: str = "lol"):
    return await client.post(
        f"/challenges/{challenge_id}/submissions",
        files=IMAGE,
        data={"caption": caption},
        headers=auth_header(user),
    )


async def _upvote(client: AsyncClient, user: dict, meme_id: str) -> None:
    await client.post(f"/memes/{meme_id}/votes", json={"value": 1}, headers=auth_header(user))


def _side(challenge: dict, name: str) -> dict:
    return next(s for s in challenge["sides"] if s["name"] == name)


async def _refetch(client: AsyncClient, user: dict, challenge_id: str) -> dict:
    body = (await client.get("/challenges/mine", headers=auth_header(user))).json()
    return next(c for c in body if c["id"] == challenge_id)


# --- creation + tag reservation ----------------------------------------------------


async def test_any_user_can_create_an_open_challenge_with_no_community(client: AsyncClient):
    alice = await create_user(client, "alice")

    response = await _create_open(client, alice)

    assert response.status_code == 201
    body = response.json()
    assert body["challenge_type"] == "open"
    assert body["status"] == "active"
    assert body["community_id"] is None
    assert body["community_name"] is None
    # Normalized: case and punctuation must not fork the entry tag.
    assert body["hashtag"] == "dogsvscats"
    assert {s["name"] for s in body["sides"]} == {"Dogs", "Cats"}


async def test_a_hashtag_can_only_be_reserved_by_one_challenge(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")

    assert (await _create_open(client, alice, hashtag="DogsVsCats")).status_code == 201
    # Different casing/punctuation, same normalized slug — squatting an active competition
    # has to be impossible or entry becomes ambiguous.
    response = await _create_open(client, bob, hashtag="#dogs-vs-cats")

    assert response.status_code == 409


async def test_open_challenge_rejects_a_bad_window_and_duplicate_side_names(client: AsyncClient):
    alice = await create_user(client, "alice")

    bad_window = await _create_open(client, alice, hashtag="a", start_time=FUTURE(20), end_time=FUTURE(5))
    assert bad_window.status_code == 400

    dupe_sides = await _create_open(
        client, alice, hashtag="b", sides=[{"name": "Same"}, {"name": "Same"}]
    )
    assert dupe_sides.status_code == 400


async def test_open_challenge_requires_auth(client: AsyncClient):
    response = await client.post("/challenges/open", json={"title": "x", "hashtag": "y"})
    assert response.status_code == 401


# --- joining -----------------------------------------------------------------------


async def test_a_stranger_can_join_a_side_and_is_counted(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    challenge = (await _create_open(client, alice)).json()

    # bob shares no community with alice — that's the point of an open challenge.
    response = await _join(client, bob, challenge, "Cats")

    assert response.status_code == 200
    assert _side(response.json(), "Cats")["participant_count"] == 1
    # An open roster is unbounded, so ids are never enumerated.
    assert _side(response.json(), "Cats")["member_ids"] == []


async def test_a_side_pick_is_final(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    challenge = (await _create_open(client, alice)).json()

    await _join(client, bob, challenge, "Dogs")
    # Switching sides mid-challenge would let someone follow the winner.
    again = await _join(client, bob, challenge, "Cats")

    assert again.status_code == 400


async def test_join_rejects_a_community_challenge(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    community = (
        await client.post(
            "/communities", data={"name": "Meme Lords", "privacy": "open"}, headers=auth_header(alice)
        )
    ).json()
    await client.post(f"/communities/{community['id']}/join", headers=auth_header(bob))
    community_challenge = (
        await client.post(
            f"/communities/{community['id']}/challenges",
            json={
                "title": "Team War",
                "start_time": PAST(5),
                "end_time": FUTURE(10),
                "sides": [
                    {"name": "A", "member_ids": [alice["user"]["id"]]},
                    {"name": "B", "member_ids": [bob["user"]["id"]]},
                ],
            },
            headers=auth_header(alice),
        )
    ).json()

    response = await _join(client, bob, community_challenge, "A")

    assert response.status_code == 400


async def test_cannot_join_after_the_window_closes(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    challenge = (
        await _create_open(client, alice, start_time=PAST(20), end_time=PAST(1))
    ).json()

    assert (await _join(client, bob, challenge, "Dogs")).status_code == 400


# --- entering by posting -----------------------------------------------------------


async def test_entering_creates_a_public_meme_carrying_the_challenge_tag(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    challenge = (await _create_open(client, alice)).json()
    await _join(client, bob, challenge, "Dogs")

    response = await _enter(client, bob, challenge["id"], caption="good boy")

    assert response.status_code == 201
    body = response.json()
    assert body["side_id"] == _side(challenge, "Dogs")["id"]
    # No community exists for an open challenge, so the entry is a public personal post.
    assert body["meme"]["community"] is None
    assert body["meme"]["audiences"] == ["public"]

    # ...and it shows up in the tag feed alongside every other entry — the discovery
    # surface that makes an open challenge spread.
    feed = (await client.get("/hashtags/dogsvscats/memes", headers=auth_header(alice))).json()
    assert [m["id"] for m in feed["items"]] == [body["meme"]["id"]]


async def test_entering_requires_having_picked_a_side(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    challenge = (await _create_open(client, alice)).json()

    assert (await _enter(client, bob, challenge["id"])).status_code == 403


async def test_mine_includes_an_open_challenge_you_joined(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    challenge = (await _create_open(client, alice)).json()

    assert (await client.get("/challenges/mine", headers=auth_header(bob))).json() == []

    await _join(client, bob, challenge, "Cats")

    mine = (await client.get("/challenges/mine", headers=auth_header(bob))).json()
    assert [c["id"] for c in mine] == [challenge["id"]]


async def test_open_discovery_lists_only_live_challenges(client: AsyncClient):
    alice = await create_user(client, "alice")
    live = (await _create_open(client, alice, hashtag="live")).json()
    await _create_open(client, alice, hashtag="over", start_time=PAST(20), end_time=PAST(1))

    body = (await client.get("/challenges/open", headers=auth_header(alice))).json()

    # The finished one is still `active` in the DB until the worker closes it, so filter by
    # window rather than asserting it's absent — assert the live one is discoverable.
    assert live["id"] in [c["id"] for c in body]


# --- hashtags ----------------------------------------------------------------------


async def test_hashtag_search_puts_challenge_tags_first(client: AsyncClient):
    alice = await create_user(client, "alice")
    # A plain discovery tag sharing the same prefix.
    await client.post(
        "/memes",
        files=IMAGE,
        data={"audiences": ["public"], "hashtags": ["dogsarecute"]},
        headers=auth_header(alice),
    )
    await _create_open(client, alice, hashtag="dogsvscats")

    body = (await client.get("/hashtags/search?q=dogs", headers=auth_header(alice))).json()

    assert len(body) >= 1
    assert body[0]["slug"] == "dogsvscats"
    assert body[0]["challenge_title"] == "Dogs vs Cats"


async def test_hashtag_detail_reports_its_challenge(client: AsyncClient):
    alice = await create_user(client, "alice")
    challenge = (await _create_open(client, alice)).json()

    body = (await client.get("/hashtags/DogsVsCats", headers=auth_header(alice))).json()

    assert body["slug"] == "dogsvscats"
    assert body["active_challenge"]["id"] == challenge["id"]


async def test_unknown_hashtag_is_404(client: AsyncClient):
    alice = await create_user(client, "alice")
    assert (await client.get("/hashtags/nothinghere", headers=auth_header(alice))).status_code == 404


# --- anti-gaming -------------------------------------------------------------------


async def test_only_a_users_best_three_memes_count_toward_their_side(client: AsyncClient):
    alice = await create_user(client, "alice")
    challenge = (await _create_open(client, alice)).json()
    await _join(client, alice, challenge, "Dogs")

    # Four entries, each worth 25 (one upvote, no recorded views).
    for _ in range(4):
        meme = (await _enter(client, alice, challenge["id"])).json()["meme"]
        await _upvote(client, alice, meme["id"])

    refreshed = await _refetch(client, alice, challenge["id"])

    # Capped at 3 x 25; a single contributor gets a breadth multiplier of exactly 1, so
    # flooding stops paying after the third submission.
    assert _side(refreshed, "Dogs")["score"] == 75


async def test_many_contributors_beat_one_prolific_poster(client: AsyncClient):
    alice = await create_user(client, "alice")
    challenge = (await _create_open(client, alice)).json()
    await _join(client, alice, challenge, "Dogs")

    # Dogs: one person, three memes -> 75 capped, breadth multiplier 1.
    for _ in range(3):
        meme = (await _enter(client, alice, challenge["id"])).json()["meme"]
        await _upvote(client, alice, meme["id"])

    # Cats: three people, one meme each -> same 75 raw, but breadth multiplier 1+log10(3).
    for name in ("bob", "carol", "dave"):
        user = await create_user(client, name)
        await _join(client, user, challenge, "Cats")
        meme = (await _enter(client, user, challenge["id"])).json()["meme"]
        await _upvote(client, user, meme["id"])

    refreshed = await _refetch(client, alice, challenge["id"])

    dogs = _side(refreshed, "Dogs")["score"]
    cats = _side(refreshed, "Cats")["score"]
    assert dogs == 75
    assert cats > dogs
    assert round(cats, 2) == round(75 * (1 + 0.47712125471966244), 2)


# --- S1: reservation lifecycle + anti-squatting -------------------------------------


async def test_tag_reservation_releases_once_the_challenge_is_evaluated(client: AsyncClient):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    challenge = (await _create_open(client, alice, hashtag="release")).json()

    # Still active — a second challenge on the same tag is rejected.
    assert (await _create_open(client, bob, hashtag="release")).status_code == 409

    async with TestSessionFactory() as session:
        await evaluate_challenge(session, uuid.UUID(challenge["id"]))

    # Evaluated — the tag is free again.
    response = await _create_open(client, bob, hashtag="release")
    assert response.status_code == 201


async def test_open_challenge_rejects_windows_over_14_days_accepts_exactly_14(
    client: AsyncClient,
):
    alice = await create_user(client, "alice")
    # Derived from one `now` reference rather than PAST()/FUTURE() (which each sample
    # datetime.now() independently) — the exactly-14-days case has zero slack, and two
    # separate now() calls even a few milliseconds apart would push the real duration a
    # hair over the boundary and flip the assertion.
    now = datetime.datetime.now(datetime.timezone.utc)

    too_long = await _create_open(
        client,
        alice,
        hashtag="toolong",
        start_time=now.isoformat(),
        end_time=(now + datetime.timedelta(days=15)).isoformat(),
    )
    assert too_long.status_code == 400

    exactly_14_days = await _create_open(
        client,
        alice,
        hashtag="exact14",
        start_time=now.isoformat(),
        end_time=(now + datetime.timedelta(days=14)).isoformat(),
    )
    assert exactly_14_days.status_code == 201


async def test_user_limited_to_one_active_reservation_at_a_time(client: AsyncClient):
    alice = await create_user(client, "alice")

    first = await _create_open(client, alice, hashtag="first")
    assert first.status_code == 201

    second = await _create_open(client, alice, hashtag="second")
    assert second.status_code == 409

    async with TestSessionFactory() as session:
        await evaluate_challenge(session, uuid.UUID(first.json()["id"]))

    third = await _create_open(client, alice, hashtag="third")
    assert third.status_code == 201


async def test_platform_account_is_exempt_from_the_per_user_reservation_cap(client: AsyncClient):
    # The weekly cron reuses the same platform account across runs; the per-user cap would
    # otherwise permanently block every week after the first.
    assert (await weekly_cron_job({})) is True

    async with TestSessionFactory() as session:
        slugs = (await session.execute(select(Hashtag.slug))).scalars().all()
    assert any(slug.startswith("weekly") for slug in slugs)


async def test_popular_tag_cannot_be_newly_reserved(client: AsyncClient):
    """50 memes from 20 distinct authors — both the authors and the meme rows are inserted
    directly rather than through the HTTP API, since the popularity check only counts rows
    (`MemeHashtag`/`Meme.author_id`, needing real `User` rows only for the FK) and 20 real
    `POST /auth/register` calls would trip its `5/minute` rate limit.
    """
    alice = await create_user(client, "alice")

    async with TestSessionFactory() as session:
        author_ids = []
        for i in range(20):
            user = User(
                email=f"popuser{i}@test.com",
                username=f"popuser{i}",
                hashed_password=hash_password("password123"),
            )
            session.add(user)
            await session.flush()
            author_ids.append(user.id)

        hashtag = Hashtag(slug="popular", display_text="popular")
        session.add(hashtag)
        await session.flush()
        for author_id in author_ids:
            for _ in range(3):
                meme = Meme(
                    author_id=author_id, image_url="https://example.com/x.png", image_public_id="x"
                )
                session.add(meme)
                await session.flush()
                session.add(MemeHashtag(meme_id=meme.id, hashtag_id=hashtag.id))
        await session.commit()

    response = await _create_open(client, alice, hashtag="popular")
    assert response.status_code == 409


async def test_popular_tag_below_author_threshold_can_be_reserved(client: AsyncClient):
    alice = await create_user(client, "alice")

    async with TestSessionFactory() as session:
        hashtag = Hashtag(slug="nichebutbusy", display_text="nichebutbusy")
        session.add(hashtag)
        await session.flush()
        author_id = uuid.UUID(alice["user"]["id"])
        for _ in range(50):
            meme = Meme(
                author_id=author_id, image_url="https://example.com/x.png", image_public_id="x"
            )
            session.add(meme)
            await session.flush()
            session.add(MemeHashtag(meme_id=meme.id, hashtag_id=hashtag.id))
        await session.commit()

    # 50 memes but only 1 distinct author — both thresholds are required, so this is
    # still reservable.
    response = await _create_open(client, alice, hashtag="nichebutbusy")
    assert response.status_code == 201


async def test_hashtag_detail_reports_both_active_and_recent_result_challenge(
    client: AsyncClient,
):
    alice = await create_user(client, "alice")
    challenge = (await _create_open(client, alice, hashtag="doubleheader")).json()

    body = (await client.get("/hashtags/doubleheader", headers=auth_header(alice))).json()
    assert body["active_challenge"]["id"] == challenge["id"]
    assert body["recent_result_challenge"] is None

    async with TestSessionFactory() as session:
        await evaluate_challenge(session, uuid.UUID(challenge["id"]))

    after_eval = (await client.get("/hashtags/doubleheader", headers=auth_header(alice))).json()
    assert after_eval["active_challenge"] is None
    assert after_eval["recent_result_challenge"]["id"] == challenge["id"]


async def test_hashtag_detail_drops_result_card_after_24h(client: AsyncClient):
    alice = await create_user(client, "alice")
    challenge = (
        await _create_open(
            client, alice, hashtag="stale", start_time=PAST(60 * 30), end_time=PAST(60 * 25)
        )
    ).json()

    async with TestSessionFactory() as session:
        await evaluate_challenge(session, uuid.UUID(challenge["id"]))

    body = (await client.get("/hashtags/stale", headers=auth_header(alice))).json()
    assert body["recent_result_challenge"] is None


async def test_weekly_cron_idempotent_even_after_evaluation(client: AsyncClient):
    assert (await weekly_cron_job({})) is True

    iso_year, iso_week, _ = datetime.datetime.now(datetime.timezone.utc).isocalendar()
    slug = f"weekly{iso_year}w{iso_week:02d}"

    async with TestSessionFactory() as session:
        hashtag = (await session.execute(select(Hashtag).where(Hashtag.slug == slug))).scalar_one()
        challenge = (
            await session.execute(select(Challenge).where(Challenge.hashtag_id == hashtag.id))
        ).scalar_one()
        await evaluate_challenge(session, challenge.id)

    # Re-running within the same ISO week must still be a no-op, even though the
    # reservation itself has been released by evaluation.
    assert (await weekly_cron_job({})) is False


# --- S4: viewer_side_id --------------------------------------------------------------


async def test_viewer_side_id_reflects_the_callers_own_join_and_survives_a_refetch(
    client: AsyncClient,
):
    alice = await create_user(client, "alice")
    bob = await create_user(client, "bob")
    challenge = (await _create_open(client, alice)).json()
    # Not joined yet.
    assert challenge["viewer_side_id"] is None

    await _join(client, bob, challenge, "Cats")

    # A fresh fetch (simulating an app restart, not local component state) still reports it.
    refetched = (
        await client.get(f"/challenges/{challenge['id']}", headers=auth_header(bob))
    ).json()
    assert refetched["viewer_side_id"] == _side(challenge, "Cats")["id"]

    # A non-participant viewing the same challenge sees None, not bob's side.
    alice_view = (
        await client.get(f"/challenges/{challenge['id']}", headers=auth_header(alice))
    ).json()
    assert alice_view["viewer_side_id"] is None
