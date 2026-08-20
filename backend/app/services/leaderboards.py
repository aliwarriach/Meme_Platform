"""Three read-only leaderboard surfaces (Project_Requirements §8) plus the per-user profile
score, all built on the `services/scoring.py` MemeScore atom. Never a write/submission path:
no service function here mutates a score, meme, or membership row (writing to `meme_scores`
happens only in the arq recompute job, `app/workers/tasks/scoring.py`).

**Fairness by structure, not by nerfing reach** (the atom is deliberately reach-heavy):
  * **30-day rolling window** on all three leaderboards — a past champion can't sit on top
    forever; recent work is what ranks. All-time lives on the profile score below, which is
    the vanity number that only grows.
  * **Community leaderboard = breadth-weighted average, not raw sum** — `avg(meme score) *
    log10(distinct_posters + 1)`. A big community can't win just by volume; a community
    where *many members post decent memes* beats one carried by a single star. This is the
    community-first lever: it rewards participation breadth, exactly what we want to grow.
  * The atom's own `log10` reach compression (services/scoring.py) already keeps a handful
    of mega-viral creators from running away with every board.

Pagination is **offset-based** (`page`/`limit`), not the keyset cursor scheme used by
[[meme-feed]]/[[communities]] — a leaderboard's ordering key is an aggregate score, not a
monotonic `created_at`, so there's no stable "cursor row" to resume from. Don't reuse
`core/pagination.py`'s cursor helpers here.

Reads `meme_scores` (populated by the periodic recompute job) with a `coalesce()` fallback
to the live `meme_score_expr()` for any meme the cron hasn't scored yet — a brand-new meme
never silently scores 0. Each page is additionally cached whole in Redis with a short TTL
(`_cached_or_compute`), refreshed by that TTL rather than invalidated on write.
"""

import datetime
import uuid

from sqlalchemy import Integer, and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import UserNotFoundError
from app.core.leaderboard_cache import cached_or_compute
from app.models.community import Community
from app.models.community_membership import CommunityMembership, MembershipStatus
from app.models.meme import Meme
from app.models.meme_score import MemeScore
from app.models.post_audience import AudienceType, PostAudience
from app.models.user import User
from app.schemas.auth import PublicUserOut
from app.schemas.leaderboards import (
    CommunityLeaderboardEntry,
    CommunityLeaderboardPage,
    IndividualLeaderboardEntry,
    IndividualLeaderboardPage,
    ProfileScoreOut,
)
from app.services.communities import require_active_membership
from app.services.scoring import meme_score_expr

_stored_or_live_score = func.coalesce(MemeScore.score, meme_score_expr())

# Competitive leaderboards reflect the last 30 days, so newcomers can climb and last
# month's winner doesn't own the board forever. Lifetime totals live on the profile score.
LEADERBOARD_WINDOW_DAYS = 30


def _window_start() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(
        days=LEADERBOARD_WINDOW_DAYS
    )


async def get_individual_leaderboard(
    db: AsyncSession, page: int, limit: int
) -> IndividualLeaderboardPage:
    """All users, ranked by the sum of their memes' atom scores over the last 30 days (all
    audiences — a user's own standing isn't audience-gated, unlike reading someone else's
    individual feed). Users with no recent memes still appear, at score 0."""

    async def _compute() -> IndividualLeaderboardPage:
        total_score = func.coalesce(func.sum(_stored_or_live_score), 0)
        offset = (page - 1) * limit
        window_start = _window_start()

        stmt = (
            select(User, total_score)
            .outerjoin(
                Meme, and_(Meme.author_id == User.id, Meme.created_at >= window_start)
            )
            .outerjoin(MemeScore, MemeScore.meme_id == Meme.id)
            .group_by(User.id)
            .order_by(total_score.desc(), User.id)
            .offset(offset)
            .limit(limit + 1)
        )
        result = await db.execute(stmt)
        rows = result.all()

        has_more = len(rows) > limit
        rows = rows[:limit]

        items = [
            IndividualLeaderboardEntry(
                rank=offset + i + 1, user=PublicUserOut.model_validate(user), score=score
            )
            for i, (user, score) in enumerate(rows)
        ]
        return IndividualLeaderboardPage(
            items=items, next_cursor=str(page + 1) if has_more else None
        )

    return await cached_or_compute(
        f"leaderboard:individual:{page}:{limit}", IndividualLeaderboardPage, _compute
    )


async def get_global_community_leaderboard(
    db: AsyncSession, page: int, limit: int
) -> CommunityLeaderboardPage:
    """All communities platform-wide, ranked by a **breadth-weighted** score over the last
    30 days: `avg(member meme atom) * log10(distinct_posters + 1)`. Averaging (not summing)
    stops big communities auto-winning on volume; the `log10(posters)` factor rewards having
    *many* contributors — a community carried by one star scores below a broadly-active one.
    Visible to everyone (Project_Requirements §8), distinct from the member-gated internal
    leaderboard below."""

    async def _compute() -> CommunityLeaderboardPage:
        community_score = func.round(
            func.coalesce(func.avg(_stored_or_live_score), 0.0)
            * func.log(10, func.count(func.distinct(Meme.author_id)) + 1)
        ).cast(Integer)
        offset = (page - 1) * limit
        window_start = _window_start()

        community_memes = (
            select(PostAudience.community_id, PostAudience.meme_id)
            .where(PostAudience.audience_type == AudienceType.community)
            .subquery()
        )

        stmt = (
            select(Community, community_score)
            .outerjoin(community_memes, community_memes.c.community_id == Community.id)
            .outerjoin(
                Meme,
                and_(Meme.id == community_memes.c.meme_id, Meme.created_at >= window_start),
            )
            .outerjoin(MemeScore, MemeScore.meme_id == Meme.id)
            .group_by(Community.id)
            .order_by(community_score.desc(), Community.id)
            .offset(offset)
            .limit(limit + 1)
        )
        result = await db.execute(stmt)
        rows = result.all()

        has_more = len(rows) > limit
        rows = rows[:limit]

        items = [
            CommunityLeaderboardEntry(
                rank=offset + i + 1,
                community_id=community.id,
                community_name=community.name,
                score=score,
            )
            for i, (community, score) in enumerate(rows)
        ]
        return CommunityLeaderboardPage(
            items=items, next_cursor=str(page + 1) if has_more else None
        )

    return await cached_or_compute(
        f"leaderboard:communities:{page}:{limit}", CommunityLeaderboardPage, _compute
    )


async def get_internal_community_leaderboard(
    db: AsyncSession, current_user: User, community_id: uuid.UUID, page: int, limit: int
) -> IndividualLeaderboardPage:
    """A single community's own members, ranked by their **community-post-only** score
    within that community over the last 30 days (not their platform-wide individual score) —
    member-gated, no open-community exception, matching every other community-scoped read
    ([[communities]]'s `require_active_membership`). Membership is checked before the cache
    is consulted, so a non-member never gets a cached response either."""
    await require_active_membership(db, community_id, current_user.id)

    async def _compute() -> IndividualLeaderboardPage:
        member_score = func.coalesce(func.sum(_stored_or_live_score), 0)
        offset = (page - 1) * limit
        window_start = _window_start()

        member_memes_in_community = (
            select(Meme.author_id, Meme.id.label("meme_id"))
            .join(
                PostAudience,
                (PostAudience.meme_id == Meme.id)
                & (PostAudience.audience_type == AudienceType.community)
                & (PostAudience.community_id == community_id),
            )
            .where(Meme.created_at >= window_start)
            .subquery()
        )

        stmt = (
            select(User, member_score)
            .join(CommunityMembership, CommunityMembership.user_id == User.id)
            .outerjoin(
                member_memes_in_community, member_memes_in_community.c.author_id == User.id
            )
            .outerjoin(Meme, Meme.id == member_memes_in_community.c.meme_id)
            .outerjoin(MemeScore, MemeScore.meme_id == Meme.id)
            .where(
                CommunityMembership.community_id == community_id,
                CommunityMembership.status == MembershipStatus.active,
            )
            .group_by(User.id)
            .order_by(member_score.desc(), User.id)
            .offset(offset)
            .limit(limit + 1)
        )
        result = await db.execute(stmt)
        rows = result.all()

        has_more = len(rows) > limit
        rows = rows[:limit]

        items = [
            IndividualLeaderboardEntry(
                rank=offset + i + 1, user=PublicUserOut.model_validate(user), score=score
            )
            for i, (user, score) in enumerate(rows)
        ]
        return IndividualLeaderboardPage(
            items=items, next_cursor=str(page + 1) if has_more else None
        )

    return await cached_or_compute(
        f"leaderboard:community:{community_id}:{page}:{limit}",
        IndividualLeaderboardPage,
        _compute,
    )


async def get_profile_score(db: AsyncSession, user_id: uuid.UUID) -> ProfileScoreOut:
    """A user's lifetime cumulative MemeScore (the "Snapchat Score") — the sum of every meme
    they've ever posted, all-time, no window. This is the number that only ever grows; the
    30-day leaderboards above are the competitive surfaces. Not cached (a single-user
    aggregate, cheap, and mostly served from the `meme_scores` cache via `coalesce`)."""
    user = await db.get(User, user_id)
    if user is None:
        raise UserNotFoundError("User not found")

    total = await db.scalar(
        select(func.coalesce(func.sum(_stored_or_live_score), 0))
        .select_from(Meme)
        .outerjoin(MemeScore, MemeScore.meme_id == Meme.id)
        .where(Meme.author_id == user_id)
    )
    return ProfileScoreOut(user=PublicUserOut.model_validate(user), score=int(total or 0))
