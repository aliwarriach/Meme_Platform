import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AlreadyReactedError, ReactionNotFoundError
from app.models.reaction import Reaction
from app.models.user import User
from app.schemas.reactions import ReactionOut
from app.services.memes import get_visible_meme


async def add_reaction(db: AsyncSession, current_user: User, meme_id: uuid.UUID) -> ReactionOut:
    meme = await get_visible_meme(db, current_user, meme_id)

    result = await db.execute(
        select(Reaction).where(Reaction.meme_id == meme.id, Reaction.user_id == current_user.id)
    )
    if result.scalar_one_or_none() is not None:
        raise AlreadyReactedError("You already reacted to this meme")

    reaction = Reaction(meme_id=meme.id, user_id=current_user.id)
    db.add(reaction)
    await db.commit()
    await db.refresh(reaction)
    return ReactionOut.model_validate(reaction)


async def remove_reaction(db: AsyncSession, current_user: User, meme_id: uuid.UUID) -> None:
    meme = await get_visible_meme(db, current_user, meme_id)

    result = await db.execute(
        select(Reaction).where(Reaction.meme_id == meme.id, Reaction.user_id == current_user.id)
    )
    reaction = result.scalar_one_or_none()
    if reaction is None:
        raise ReactionNotFoundError("You haven't reacted to this meme")

    await db.delete(reaction)
    await db.commit()
