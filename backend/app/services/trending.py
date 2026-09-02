"""Trending hashtags (Roadmap_Search.md S2) — the search screen's first impression, and
the only discovery surface open challenges have ever had.

Distinct authors in a rolling 24h window is the primary term deliberately, not raw meme/
vote counts: the same anti-gaming lever `services/challenges.py::_side_scores` already uses
for challenge scoring — 20 people each landing one meme must outrank one account posting
50, or a single prolific/bot account could "trend" any tag it wants.
"""

import datetime
import math
import uuid

from sqlalchemy import exists, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.leaderboard_cache import cached_or_compute
from app.models.challenge import Challenge, ChallengeStatus
from app.models.hashtag import Hashtag, MemeHashtag
from app.models.meme import Meme
from app.models.meme_vote import MemeVote
from app.models.post_audience import AudienceType, PostAudience
from app.schemas.trending import TrendingChallengeRef, TrendingHashtagOut, TrendingResponse

TRENDING_CACHE_KEY = "trending:hashtags:v1"
TRENDING_CACHE_TTL_SECONDS = 300
TRENDING_WINDOW_HOURS = 24
MIN_TRENDING_ITEMS = 5
CHALLENGE_BOOST = 1.5
DEFAULT_LIMIT = 10
MAX_LIMIT = 25


async def _active_challenge_by_hashtag_id(
    db: AsyncSession, hashtag_ids: list[uuid.UUID]
) -> dict[uuid.UUID, Challenge]:
    if not hashtag_ids:
        return {}
    rows = (
        await db.execute(
            select(Challenge).where(
                Challenge.hashtag_id.in_(hashtag_ids), Challenge.status == ChallengeStatus.active
            )
        )
    ).scalars().all()
    return {c.hashtag_id: c for c in rows}


async def _organic_trending(db: AsyncSession) -> list[TrendingHashtagOut]:
    """Tags used on publicly-visible memes created in the last 24h. A friends-only or
    community-private post must never surface here — this is a single page cached and
    served to every user, so it cannot be visibility-filtered per viewer; restricting to
    memes carrying a `public` audience row is what keeps private activity from leaking
    through the aggregate.
    """
    cutoff = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(
        hours=TRENDING_WINDOW_HOURS
    )
    is_public = exists().where(
        PostAudience.meme_id == Meme.id, PostAudience.audience_type == AudienceType.public
    )
    qualifying = (
        select(
            MemeHashtag.hashtag_id.label("hashtag_id"),
            Meme.id.label("meme_id"),
            Meme.author_id.label("author_id"),
        )
        .join(Meme, Meme.id == MemeHashtag.meme_id)
        .where(Meme.created_at >= cutoff, Meme.deleted_at.is_(None), is_public)
        .subquery()
    )
    net_votes = (
        select(MemeVote.meme_id.label("meme_id"), func.sum(MemeVote.value).label("net"))
        .group_by(MemeVote.meme_id)
        .subquery()
    )

    rows = (
        await db.execute(
            select(
                qualifying.c.hashtag_id,
                Hashtag.slug,
                Hashtag.display_text,
                func.count(func.distinct(qualifying.c.meme_id)).label("meme_count"),
                func.count(func.distinct(qualifying.c.author_id)).label("author_count"),
                func.coalesce(func.sum(func.coalesce(net_votes.c.net, 0)), 0).label("net_votes"),
            )
            .select_from(qualifying)
            .join(Hashtag, Hashtag.id == qualifying.c.hashtag_id)
            .outerjoin(net_votes, net_votes.c.meme_id == qualifying.c.meme_id)
            .group_by(qualifying.c.hashtag_id, Hashtag.slug, Hashtag.display_text)
        )
    ).all()
    if not rows:
        return []

    active_by_hashtag = await _active_challenge_by_hashtag_id(db, [r.hashtag_id for r in rows])

    scored = []
    for row in rows:
        challenge = active_by_hashtag.get(row.hashtag_id)
        boost = CHALLENGE_BOOST if challenge is not None else 1.0
        score = row.author_count * (1 + math.log10(1 + max(row.net_votes, 0))) * boost
        scored.append((score, row, challenge))

    # Rank descending by score, tie-break on distinct authors then slug for a stable order.
    scored.sort(key=lambda t: (-t[0], -t[1].author_count, t[1].slug))

    return [
        TrendingHashtagOut(
            slug=row.slug,
            display_text=row.display_text,
            meme_count_24h=row.meme_count,
            author_count_24h=row.author_count,
            reason="trending",
            challenge=TrendingChallengeRef.model_validate(challenge) if challenge else None,
        )
        for _score, row, challenge in scored
    ]


async def _live_challenge_fallback(
    db: AsyncSession, exclude_slugs: set[str], limit: int
) -> list[TrendingHashtagOut]:
    rows = (
        await db.execute(
            select(Challenge, Hashtag)
            .join(Hashtag, Hashtag.id == Challenge.hashtag_id)
            .where(Challenge.status == ChallengeStatus.active, Challenge.hashtag_id.isnot(None))
            .order_by(Challenge.end_time.asc())
        )
    ).all()
    items = []
    for challenge, hashtag in rows:
        if hashtag.slug in exclude_slugs:
            continue
        items.append(
            TrendingHashtagOut(
                slug=hashtag.slug,
                display_text=hashtag.display_text,
                meme_count_24h=0,
                author_count_24h=0,
                reason="live_challenge",
                challenge=TrendingChallengeRef.model_validate(challenge),
            )
        )
        exclude_slugs.add(hashtag.slug)
        if len(items) >= limit:
            break
    return items


async def _popular_fallback(
    db: AsyncSession, exclude_slugs: set[str], limit: int
) -> list[TrendingHashtagOut]:
    rows = (
        await db.execute(
            select(
                Hashtag.slug,
                Hashtag.display_text,
                func.count(MemeHashtag.id).label("meme_count"),
            )
            .join(MemeHashtag, MemeHashtag.hashtag_id == Hashtag.id)
            .group_by(Hashtag.id, Hashtag.slug, Hashtag.display_text)
            .order_by(func.count(MemeHashtag.id).desc())
            .limit(limit + len(exclude_slugs))
        )
    ).all()
    items = []
    for slug, display_text, meme_count in rows:
        if slug in exclude_slugs:
            continue
        items.append(
            TrendingHashtagOut(
                slug=slug,
                display_text=display_text,
                meme_count_24h=0,
                author_count_24h=0,
                reason="popular",
            )
        )
        if len(items) >= limit:
            break
    return items


async def _compute_trending(db: AsyncSession, limit: int) -> TrendingResponse:
    items = (await _organic_trending(db))[:limit]

    if len(items) < MIN_TRENDING_ITEMS:
        seen = {item.slug for item in items}
        remaining = limit - len(items)
        items += await _live_challenge_fallback(db, seen, remaining)
        remaining = limit - len(items)
        if remaining > 0:
            items += await _popular_fallback(db, seen, remaining)

    return TrendingResponse(
        items=items, generated_at=datetime.datetime.now(datetime.timezone.utc)
    )


async def get_trending_hashtags(db: AsyncSession, limit: int = DEFAULT_LIMIT) -> TrendingResponse:
    """Cache-then-compute, read-through — the arq cron (`refresh_trending_hashtags`) keeps
    the cache warm so a user is almost never the one paying for the aggregation. `limit`
    isn't part of the cache key: the cron always computes at `MAX_LIMIT` and callers slice,
    so every `limit` value is served from the same cached page.
    """
    cached = await cached_or_compute(
        TRENDING_CACHE_KEY,
        TrendingResponse,
        lambda: _compute_trending(db, MAX_LIMIT),
        ttl=TRENDING_CACHE_TTL_SECONDS,
    )
    return TrendingResponse(items=cached.items[:limit], generated_at=cached.generated_at)
