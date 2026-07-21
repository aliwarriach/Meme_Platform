import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.comment import Comment
from app.models.user import User
from app.schemas.comments import CommentCreate, CommentOut
from app.services.memes import get_visible_meme


async def add_comment(
    db: AsyncSession, current_user: User, meme_id: uuid.UUID, data: CommentCreate
) -> CommentOut:
    meme = await get_visible_meme(db, current_user, meme_id)

    comment = Comment(meme_id=meme.id, author_id=current_user.id, body=data.body)
    db.add(comment)
    await db.commit()
    # comment is already identity-mapped in this session — db.get() would return it
    # as-is without loading relationships, so refresh() is required to populate author.
    await db.refresh(comment)
    return CommentOut.model_validate(comment)


async def list_comments(
    db: AsyncSession, current_user: User, meme_id: uuid.UUID
) -> list[CommentOut]:
    await get_visible_meme(db, current_user, meme_id)

    result = await db.execute(
        select(Comment).where(Comment.meme_id == meme_id).order_by(Comment.created_at.asc())
    )
    comments = result.scalars().all()
    return [CommentOut.model_validate(c) for c in comments]
