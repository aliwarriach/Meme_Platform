import datetime
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import CommentNotFoundError, NotCommentAuthorError
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
        select(Comment)
        .where(Comment.meme_id == meme_id, Comment.deleted_at.is_(None))
        .order_by(Comment.created_at.asc())
    )
    comments = result.scalars().all()
    return [CommentOut.model_validate(c) for c in comments]


async def delete_comment(
    db: AsyncSession, current_user: User, meme_id: uuid.UUID, comment_id: uuid.UUID
) -> None:
    """Author-only soft delete (SecurityFeatures.md F-4). The meme itself must still be
    visible to the caller (get_visible_meme), then the comment must belong to it and be
    live — matching the 404-not-403 "don't confirm existence" convention used elsewhere."""
    await get_visible_meme(db, current_user, meme_id)

    comment = await db.scalar(
        select(Comment).where(
            Comment.id == comment_id, Comment.meme_id == meme_id, Comment.deleted_at.is_(None)
        )
    )
    if comment is None:
        raise CommentNotFoundError("Comment not found")
    if comment.author_id != current_user.id:
        raise NotCommentAuthorError("Only the author can delete this comment")

    comment.deleted_at = datetime.datetime.now(datetime.timezone.utc)
    await db.commit()
