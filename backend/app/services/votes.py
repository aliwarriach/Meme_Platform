"""Reddit-style upvote/downvote on native memes — replaces the old like-only `Reaction`.

Casting the same value again removes the vote (un-vote); casting the opposite value
flips it. There is never more than one row per (user, meme) — DB-enforced via
`uq_meme_votes_meme_user`.
"""

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.meme_vote import MemeVote
from app.models.user import User
from app.schemas.votes import VoteOut
from app.services.memes import get_visible_meme


async def _vote_counts(db: AsyncSession, meme_id: uuid.UUID) -> tuple[int, int]:
    upvotes = await db.scalar(
        select(func.count(MemeVote.id)).where(MemeVote.meme_id == meme_id, MemeVote.value == 1)
    )
    downvotes = await db.scalar(
        select(func.count(MemeVote.id)).where(MemeVote.meme_id == meme_id, MemeVote.value == -1)
    )
    return upvotes or 0, downvotes or 0


async def cast_vote(
    db: AsyncSession, current_user: User, meme_id: uuid.UUID, value: int
) -> VoteOut:
    meme = await get_visible_meme(db, current_user, meme_id)

    result = await db.execute(
        select(MemeVote).where(MemeVote.meme_id == meme.id, MemeVote.user_id == current_user.id)
    )
    existing = result.scalar_one_or_none()

    if existing is None:
        db.add(MemeVote(meme_id=meme.id, user_id=current_user.id, value=value))
        viewer_vote: int | None = value
    elif existing.value == value:
        await db.delete(existing)
        viewer_vote = None
    else:
        existing.value = value
        viewer_vote = value

    await db.commit()

    upvotes, downvotes = await _vote_counts(db, meme.id)
    return VoteOut(
        meme_id=meme.id,
        upvote_count=upvotes,
        downvote_count=downvotes,
        score=upvotes - downvotes,
        viewer_vote=viewer_vote,
    )
