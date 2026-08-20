import uuid

from sqlalchemy import exists, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BlockNotFoundError, CannotBlockSelfError, UserNotFoundError
from app.models.block import Block
from app.models.user import User
from app.services import users as users_service


def is_blocked_clause(user_a_id: uuid.UUID, user_b_id):
    """SQLAlchemy boolean expression, true if either direction has blocked the other.
    `user_b_id` may be a bound value or a correlated column (e.g. `Meme.author_id`) —
    composable directly into a caller's own query, same pattern as
    `services/memes.py::meme_visibility_clause`."""
    return or_(
        exists().where(Block.blocker_id == user_a_id, Block.blocked_id == user_b_id),
        exists().where(Block.blocker_id == user_b_id, Block.blocked_id == user_a_id),
    )


async def is_blocked(db: AsyncSession, user_a_id: uuid.UUID, user_b_id: uuid.UUID) -> bool:
    return bool(await db.scalar(select(is_blocked_clause(user_a_id, user_b_id))))


async def block_user(db: AsyncSession, current_user: User, target_id: uuid.UUID) -> Block:
    if target_id == current_user.id:
        raise CannotBlockSelfError("You can't block yourself")
    if await users_service.get_user_by_id(db, target_id) is None:
        raise UserNotFoundError("User not found")

    # Idempotent — blocking someone already blocked just returns the existing row, same
    # "get-or-create, client can't know which case it's in" precedent as
    # messaging.py's POST /messaging/conversations.
    existing = await db.scalar(
        select(Block).where(Block.blocker_id == current_user.id, Block.blocked_id == target_id)
    )
    if existing is not None:
        return existing

    block = Block(blocker_id=current_user.id, blocked_id=target_id)
    db.add(block)
    try:
        await db.commit()
    except IntegrityError:
        # Two concurrent block requests for the same pair.
        await db.rollback()
        existing = await db.scalar(
            select(Block).where(Block.blocker_id == current_user.id, Block.blocked_id == target_id)
        )
        if existing is None:
            raise
        return existing
    await db.refresh(block)
    return block


async def unblock_user(db: AsyncSession, current_user: User, target_id: uuid.UUID) -> None:
    block = await db.scalar(
        select(Block).where(Block.blocker_id == current_user.id, Block.blocked_id == target_id)
    )
    if block is None:
        raise BlockNotFoundError("You haven't blocked this user")
    await db.delete(block)
    await db.commit()


async def list_blocked(db: AsyncSession, current_user: User) -> list[Block]:
    result = await db.execute(
        select(Block)
        .where(Block.blocker_id == current_user.id)
        .order_by(Block.created_at.desc())
    )
    return list(result.scalars().all())
