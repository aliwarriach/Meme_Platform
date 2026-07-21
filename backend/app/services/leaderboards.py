"""Three read-only leaderboard surfaces (Project_Requirements §8) — all built on the
`services/scoring.py` stub via `meme_score_expr()`. Never a write/submission path: no
service function here mutates a score, meme, or membership row.

Pagination here is **offset-based** (`page`/`limit`), not the keyset cursor scheme used
by [[meme-feed]]/[[communities]] — a leaderboard's ordering key is an aggregate score,
not a monotonic `created_at`, so there's no stable "cursor row" to resume from once ties
and score changes are involved; a simple page number is the right tool for a bounded,
re-orderable ranked list. Don't reuse `core/pagination.py`'s cursor helpers here.
"""

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.community import Community
from app.models.community_membership import CommunityMembership, MembershipStatus
from app.models.meme import Meme
from app.models.post_audience import AudienceType, PostAudience
from app.models.user import User
from app.schemas.auth import UserOut
from app.schemas.leaderboards import (
    CommunityLeaderboardEntry,
    CommunityLeaderboardPage,
    IndividualLeaderboardEntry,
    IndividualLeaderboardPage,
)
from app.services.communities import require_active_membership
from app.services.scoring import meme_score_expr


async def get_individual_leaderboard(
    db: AsyncSession, page: int, limit: int
) -> IndividualLeaderboardPage:
    """All users, ranked by the sum of their memes' stub scores (all-time, all memes
    regardless of audience — a user's own leaderboard standing isn't audience-gated,
    unlike reading someone else's individual meme feed).
    """
    total_score = func.coalesce(func.sum(meme_score_expr()), 0)
    offset = (page - 1) * limit

    stmt = (
        select(User, total_score)
        .outerjoin(Meme, Meme.author_id == User.id)
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
        IndividualLeaderboardEntry(rank=offset + i + 1, user=UserOut.model_validate(user), score=score)
        for i, (user, score) in enumerate(rows)
    ]
    return IndividualLeaderboardPage(items=items, next_cursor=str(page + 1) if has_more else None)


async def get_global_community_leaderboard(
    db: AsyncSession, page: int, limit: int
) -> CommunityLeaderboardPage:
    """All communities platform-wide, ranked by the aggregate stub score of memes posted
    *into* them (via a `community`-typed `PostAudience` row) — "which communities are
    best," visible to everyone (Project_Requirements §8), distinct from the member-gated
    internal leaderboard below.
    """
    total_score = func.coalesce(func.sum(meme_score_expr()), 0)
    offset = (page - 1) * limit

    community_memes = (
        select(PostAudience.community_id, PostAudience.meme_id)
        .where(PostAudience.audience_type == AudienceType.community)
        .subquery()
    )

    stmt = (
        select(Community, total_score)
        .outerjoin(community_memes, community_memes.c.community_id == Community.id)
        .outerjoin(Meme, Meme.id == community_memes.c.meme_id)
        .group_by(Community.id)
        .order_by(total_score.desc(), Community.id)
        .offset(offset)
        .limit(limit + 1)
    )
    result = await db.execute(stmt)
    rows = result.all()

    has_more = len(rows) > limit
    rows = rows[:limit]

    items = [
        CommunityLeaderboardEntry(
            rank=offset + i + 1, community_id=community.id, community_name=community.name, score=score
        )
        for i, (community, score) in enumerate(rows)
    ]
    return CommunityLeaderboardPage(items=items, next_cursor=str(page + 1) if has_more else None)


async def get_internal_community_leaderboard(
    db: AsyncSession, current_user: User, community_id: uuid.UUID, page: int, limit: int
) -> IndividualLeaderboardPage:
    """A single community's own members, ranked by their **community-post-only** score
    within that community (not their platform-wide individual score) — member-gated, no
    open-community exception, matching every other community-scoped read
    ([[communities]]'s `require_active_membership`).
    """
    await require_active_membership(db, community_id, current_user.id)

    member_score = func.coalesce(func.sum(meme_score_expr()), 0)
    offset = (page - 1) * limit

    member_memes_in_community = (
        select(Meme.author_id, Meme.id.label("meme_id"))
        .join(
            PostAudience,
            (PostAudience.meme_id == Meme.id)
            & (PostAudience.audience_type == AudienceType.community)
            & (PostAudience.community_id == community_id),
        )
        .subquery()
    )

    stmt = (
        select(User, member_score)
        .join(CommunityMembership, CommunityMembership.user_id == User.id)
        .outerjoin(member_memes_in_community, member_memes_in_community.c.author_id == User.id)
        .outerjoin(Meme, Meme.id == member_memes_in_community.c.meme_id)
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
        IndividualLeaderboardEntry(rank=offset + i + 1, user=UserOut.model_validate(user), score=score)
        for i, (user, score) in enumerate(rows)
    ]
    return IndividualLeaderboardPage(items=items, next_cursor=str(page + 1) if has_more else None)
