"""Roadmap_Search.md S2 — trending hashtags: distinct-author-weighted score over a rolling
24h window, a boost for tags owned by a currently-active challenge, and the cold-start
fallback ladder (live challenges -> all-time popular) when organic activity is thin.

Meme/user rows are seeded directly via `TestSessionFactory` rather than through the HTTP
API — this needs precise control over `created_at` (for the 24h-window test) and dozens of
distinct authors (which would trip `POST /auth/register`'s 5/minute rate limit), same
precedent as `test_open_challenges.py`'s popular-tag reservation tests.
"""

import datetime
import json
import uuid

import pytest_asyncio
from httpx import AsyncClient
from redis.asyncio import Redis

from app.core.config import settings
from app.core.security import hash_password
from app.models.hashtag import Hashtag, MemeHashtag
from app.models.meme import Meme
from app.models.post_audience import AudienceType, PostAudience
from app.models.user import User
from app.services.trending import TRENDING_CACHE_KEY
from app.workers.tasks.trending import refresh_trending_hashtags
from tests.conftest import TestSessionFactory, auth_header, create_user

FUTURE = lambda minutes=10: (  # noqa: E731
    datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=minutes)
).isoformat()
PAST = lambda minutes=10: (  # noqa: E731
    datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=minutes)
).isoformat()


@pytest_asyncio.fixture(autouse=True)
async def _flush_trending_cache():
    """`conftest.py`'s `_reset_leaderboard_cache` only flushes `leaderboard:*` — the
    trending cache lives under a different key namespace and would otherwise leak a
    previous test's cached page into this one."""
    redis = Redis.from_url(settings.redis_url, decode_responses=True)
    await redis.delete(TRENDING_CACHE_KEY)
    yield
    await redis.delete(TRENDING_CACHE_KEY)
    await redis.aclose()


async def _make_user(session, username: str) -> uuid.UUID:
    user = User(
        email=f"{username}@test.com", username=username, hashed_password=hash_password("pw")
    )
    session.add(user)
    await session.flush()
    return user.id


async def _make_hashtag(session, slug: str) -> uuid.UUID:
    hashtag = Hashtag(slug=slug, display_text=slug)
    session.add(hashtag)
    await session.flush()
    return hashtag.id


async def _seed_meme(
    session,
    author_id: uuid.UUID,
    hashtag_id: uuid.UUID,
    *,
    audience: AudienceType = AudienceType.public,
    created_at: datetime.datetime | None = None,
) -> uuid.UUID:
    meme = Meme(author_id=author_id, image_url="https://example.com/x.png", image_public_id="x")
    if created_at is not None:
        meme.created_at = created_at
    session.add(meme)
    await session.flush()
    session.add(PostAudience(meme_id=meme.id, audience_type=audience))
    session.add(MemeHashtag(meme_id=meme.id, hashtag_id=hashtag_id))
    return meme.id


async def _seed_filler_tags(session, count: int = 5) -> None:
    """Enough organic, qualifying tags to clear `MIN_TRENDING_ITEMS` so the cold-start
    fallback never interferes with assertions in tests that aren't about the fallback
    itself."""
    for i in range(count):
        author_id = await _make_user(session, f"filler{i}")
        hashtag_id = await _make_hashtag(session, f"filler{i}")
        await _seed_meme(session, author_id, hashtag_id)


async def test_many_authors_beats_one_prolific_poster(client: AsyncClient):
    async with TestSessionFactory() as session:
        await _seed_filler_tags(session)

        many_id = await _make_hashtag(session, "manyauthors")
        for i in range(20):
            author_id = await _make_user(session, f"many{i}")
            await _seed_meme(session, author_id, many_id)

        one_id = await _make_hashtag(session, "oneauthor")
        one_author = await _make_user(session, "prolific")
        for _ in range(50):
            await _seed_meme(session, one_author, one_id)

        await session.commit()

    alice = await create_user(client, "alice")
    body = (await client.get("/hashtags/trending?limit=25", headers=auth_header(alice))).json()

    slugs = [item["slug"] for item in body["items"]]
    assert slugs.index("manyauthors") < slugs.index("oneauthor")


async def test_meme_older_than_24h_does_not_contribute(client: AsyncClient):
    async with TestSessionFactory() as session:
        await _seed_filler_tags(session)

        stale_id = await _make_hashtag(session, "stalehashtag")
        author_id = await _make_user(session, "stalewriter")
        old = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=25)
        await _seed_meme(session, author_id, stale_id, created_at=old)

        await session.commit()

    alice = await create_user(client, "alice")
    body = (await client.get("/hashtags/trending?limit=25", headers=auth_header(alice))).json()

    assert "stalehashtag" not in [item["slug"] for item in body["items"]]


async def test_friends_only_post_does_not_leak_into_trending(client: AsyncClient):
    async with TestSessionFactory() as session:
        await _seed_filler_tags(session)

        private_id = await _make_hashtag(session, "privatetag")
        author_id = await _make_user(session, "privatewriter")
        await _seed_meme(session, author_id, private_id, audience=AudienceType.friends)

        public_id = await _make_hashtag(session, "publictag")
        public_author = await _make_user(session, "publicwriter")
        await _seed_meme(session, public_author, public_id, audience=AudienceType.public)

        await session.commit()

    alice = await create_user(client, "alice")
    body = (await client.get("/hashtags/trending?limit=25", headers=auth_header(alice))).json()

    slugs = [item["slug"] for item in body["items"]]
    assert "privatetag" not in slugs
    assert "publictag" in slugs


async def test_active_challenges_tag_outranks_identical_organic_tag(client: AsyncClient):
    alice = await create_user(client, "alice")

    async with TestSessionFactory() as session:
        await _seed_filler_tags(session)

        plain_id = await _make_hashtag(session, "plaintag")
        for i in range(3):
            author_id = await _make_user(session, f"plainauthor{i}")
            await _seed_meme(session, author_id, plain_id)

        # Identical raw numbers for the boosted tag's organic activity — the challenge
        # created below reserves this same pre-existing tag for the boost.
        boosted_id = await _make_hashtag(session, "boostedtag")
        for i in range(3):
            author_id = await _make_user(session, f"boostedauthor{i}")
            await _seed_meme(session, author_id, boosted_id)

        await session.commit()

    open_challenge = await client.post(
        "/challenges/open",
        json={
            "title": "Boosted Challenge",
            "hashtag": "boostedtag",
            "start_time": PAST(5),
            "end_time": FUTURE(60),
            "sides": [{"name": "A"}, {"name": "B"}],
        },
        headers=auth_header(alice),
    )
    assert open_challenge.status_code == 201

    body = (await client.get("/hashtags/trending?limit=25", headers=auth_header(alice))).json()
    slugs = [item["slug"] for item in body["items"]]
    assert slugs.index("boostedtag") < slugs.index("plaintag")
    boosted_item = next(item for item in body["items"] if item["slug"] == "boostedtag")
    assert boosted_item["challenge"] is not None
    assert boosted_item["challenge"]["title"] == "Boosted Challenge"


async def test_cold_start_fallback_returns_live_challenges_then_popular(client: AsyncClient):
    alice = await create_user(client, "alice")

    async with TestSessionFactory() as session:
        # An all-time-popular tag with no recent activity — should surface only via the
        # "popular" fallback bucket, never mislabelled as "trending".
        popular_id = await _make_hashtag(session, "popfallback")
        old = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=30)
        for i in range(3):
            author_id = await _make_user(session, f"popfallbackauthor{i}")
            await _seed_meme(session, author_id, popular_id, created_at=old)
        await session.commit()

    open_challenge = await client.post(
        "/challenges/open",
        json={
            "title": "Fallback Challenge",
            "hashtag": "livefallback",
            "start_time": PAST(5),
            "end_time": FUTURE(60),
            "sides": [{"name": "A"}, {"name": "B"}],
        },
        headers=auth_header(alice),
    )
    assert open_challenge.status_code == 201

    body = (await client.get("/hashtags/trending?limit=25", headers=auth_header(alice))).json()
    by_slug = {item["slug"]: item for item in body["items"]}

    assert by_slug["livefallback"]["reason"] == "live_challenge"
    assert by_slug["popfallback"]["reason"] == "popular"
    # The live challenge bucket is backfilled before the all-time-popular one.
    slugs = [item["slug"] for item in body["items"]]
    assert slugs.index("livefallback") < slugs.index("popfallback")


async def test_cron_warms_the_cache_and_a_request_is_served_from_it(client: AsyncClient):
    async with TestSessionFactory() as session:
        await _seed_filler_tags(session)
        await session.commit()

    count = await refresh_trending_hashtags({})
    assert count >= 5

    redis = Redis.from_url(settings.redis_url, decode_responses=True)
    cached_raw = await redis.get(TRENDING_CACHE_KEY)
    await redis.aclose()
    assert cached_raw is not None

    alice = await create_user(client, "alice")
    body = (await client.get("/hashtags/trending", headers=auth_header(alice))).json()

    cached = json.loads(cached_raw)
    # Same `generated_at` as what the cron wrote — proof the request was served from the
    # warm cache rather than recomputing.
    assert body["generated_at"] == cached["generated_at"]
