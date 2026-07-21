import uuid

from fastapi import UploadFile
from sqlalchemy import and_, exists, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import MemeNotFoundError
from app.core.pagination import decode_cursor, encode_cursor
from app.models.friendship import Friendship, FriendshipStatus
from app.models.meme import Meme
from app.models.post_audience import AudienceType, PostAudience
from app.models.reaction import Reaction
from app.models.comment import Comment
from app.models.user import User
from app.schemas.auth import UserOut
from app.schemas.memes import FeedPage, MemeOut
from app.services.media import validate_and_upload_image


def _visibility_clause(viewer_id: uuid.UUID):
    is_public = exists().where(
        PostAudience.meme_id == Meme.id, PostAudience.audience_type == AudienceType.public
    )
    is_friend_of_author = or_(
        exists().where(
            Friendship.status == FriendshipStatus.accepted,
            Friendship.requester_id == viewer_id,
            Friendship.addressee_id == Meme.author_id,
        ),
        exists().where(
            Friendship.status == FriendshipStatus.accepted,
            Friendship.addressee_id == viewer_id,
            Friendship.requester_id == Meme.author_id,
        ),
    )
    is_friends_only_visible = exists().where(
        PostAudience.meme_id == Meme.id,
        PostAudience.audience_type == AudienceType.friends,
        is_friend_of_author,
    )
    return or_(Meme.author_id == viewer_id, is_public, is_friends_only_visible)


def _build_meme_out(
    meme: Meme, reaction_count: int, comment_count: int, viewer_has_reacted: bool
) -> MemeOut:
    return MemeOut(
        id=meme.id,
        author=UserOut.model_validate(meme.author),
        image_url=meme.image_url,
        caption=meme.caption,
        audiences=[a.audience_type for a in meme.audiences],
        reaction_count=reaction_count,
        comment_count=comment_count,
        viewer_has_reacted=viewer_has_reacted,
        created_at=meme.created_at,
    )


async def create_meme(
    db: AsyncSession,
    current_user: User,
    caption: str | None,
    audiences: list[AudienceType],
    image: UploadFile,
) -> MemeOut:
    image_url, image_public_id = await validate_and_upload_image(image, folder="memes")

    meme = Meme(
        author_id=current_user.id,
        image_url=image_url,
        image_public_id=image_public_id,
        caption=caption,
    )
    db.add(meme)
    await db.flush()

    for audience_type in set(audiences):
        db.add(PostAudience(meme_id=meme.id, audience_type=audience_type))

    await db.commit()
    # meme is already identity-mapped in this session — db.get() would return it as-is
    # without loading relationships, so refresh() is required to populate author/audiences.
    await db.refresh(meme)
    return _build_meme_out(meme, reaction_count=0, comment_count=0, viewer_has_reacted=False)


async def get_feed(
    db: AsyncSession, current_user: User, cursor: str | None, limit: int
) -> FeedPage:
    reaction_count_subq = (
        select(func.count(Reaction.id))
        .where(Reaction.meme_id == Meme.id)
        .correlate(Meme)
        .scalar_subquery()
    )
    comment_count_subq = (
        select(func.count(Comment.id))
        .where(Comment.meme_id == Meme.id)
        .correlate(Meme)
        .scalar_subquery()
    )
    viewer_reacted_subq = (
        select(func.count(Reaction.id))
        .where(Reaction.meme_id == Meme.id, Reaction.user_id == current_user.id)
        .correlate(Meme)
        .scalar_subquery()
    )

    stmt = (
        select(Meme, reaction_count_subq, comment_count_subq, viewer_reacted_subq)
        .where(_visibility_clause(current_user.id))
        .order_by(Meme.created_at.desc(), Meme.id.desc())
        .limit(limit + 1)
    )

    if cursor:
        cursor_created_at, cursor_id = decode_cursor(cursor)
        stmt = stmt.where(
            or_(
                Meme.created_at < cursor_created_at,
                and_(Meme.created_at == cursor_created_at, Meme.id < cursor_id),
            )
        )

    result = await db.execute(stmt)
    rows = result.all()

    has_more = len(rows) > limit
    rows = rows[:limit]

    items = [
        _build_meme_out(meme, reaction_count, comment_count, viewer_reacted_count > 0)
        for meme, reaction_count, comment_count, viewer_reacted_count in rows
    ]
    next_cursor = encode_cursor(rows[-1][0].created_at, rows[-1][0].id) if has_more and rows else None

    return FeedPage(items=items, next_cursor=next_cursor)


async def get_visible_meme(db: AsyncSession, current_user: User, meme_id: uuid.UUID) -> Meme:
    stmt = select(Meme).where(Meme.id == meme_id, _visibility_clause(current_user.id))
    result = await db.execute(stmt)
    meme = result.scalar_one_or_none()
    if meme is None:
        raise MemeNotFoundError("Meme not found")
    return meme
