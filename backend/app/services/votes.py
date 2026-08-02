"""Reddit-style upvote/downvote on native memes — replaces the old like-only `Reaction`.

Casting the same value again removes the vote (un-vote); casting the opposite value
flips it. There is never more than one row per (user, meme) — DB-enforced via
`uq_meme_votes_meme_user`.
"""

import uuid

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
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


async def _upsert_vote(
    db: AsyncSession, meme_id: uuid.UUID, user_id: uuid.UUID, value: int, *, retried: bool = False
) -> int | None:
    result = await db.execute(
        select(MemeVote).where(MemeVote.meme_id == meme_id, MemeVote.user_id == user_id)
    )
    existing = result.scalar_one_or_none()

    if existing is None:
        db.add(MemeVote(meme_id=meme_id, user_id=user_id, value=value))
        try:
            await db.commit()
        except IntegrityError:
            if retried:
                raise
            # Two concurrent first-votes from the same user raced the insert; the loser
            # falls back to updating the row the winner just created.
            await db.rollback()
            return await _upsert_vote(db, meme_id, user_id, value, retried=True)
        return value

    if existing.value == value:
        await db.delete(existing)
        await db.commit()
        return None

    existing.value = value
    await db.commit()
    return value


async def cast_vote(
    db: AsyncSession, current_user: User, meme_id: uuid.UUID, value: int
) -> VoteOut:
    # `get_visible_meme`'s only job here is the 404/visibility gate — its return value is
    # intentionally unused below. `_upsert_vote`'s race-retry path does a `db.rollback()`,
    # which expires every ORM object in the session (unlike commit, rollback always
    # expires); touching a stale `meme.id` attribute afterward would need an implicit
    # lazy-load that AsyncSession can't do outside its own greenlet context
    # (`MissingGreenlet`). Using the already-known plain `meme_id` param sidesteps that
    # entirely, since `get_visible_meme` guarantees it matches the fetched row's id.
    await get_visible_meme(db, current_user, meme_id)

    viewer_vote = await _upsert_vote(db, meme_id, current_user.id, value)

    upvotes, downvotes = await _vote_counts(db, meme_id)
    return VoteOut(
        meme_id=meme_id,
        upvote_count=upvotes,
        downvote_count=downvotes,
        score=upvotes - downvotes,
        viewer_vote=viewer_vote,
    )
