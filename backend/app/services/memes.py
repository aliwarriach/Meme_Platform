import uuid

from fastapi import UploadFile
from sqlalchemy import ColumnElement, and_, exists, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import InvalidAudienceSelectionError, MemeNotFoundError
from app.core.pagination import decode_cursor, encode_cursor
from app.models.community import CommunityPrivacy
from app.models.community_membership import CommunityMembership, MembershipStatus
from app.models.friendship import Friendship, FriendshipStatus
from app.models.meme import Meme
from app.models.post_audience import AudienceType, PostAudience
from app.models.reaction import Reaction
from app.models.comment import Comment
from app.models.user import User
from app.schemas.auth import UserOut
from app.schemas.memes import CommunityBadge, FeedPage, MemeOut
from app.services.communities import require_active_membership
from app.services.media import validate_and_upload_image


def meme_visibility_clause(viewer_id: uuid.UUID):
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
    is_visible_via_community = exists().where(
        PostAudience.meme_id == Meme.id,
        PostAudience.audience_type == AudienceType.community,
        CommunityMembership.community_id == PostAudience.community_id,
        CommunityMembership.user_id == viewer_id,
        CommunityMembership.status == MembershipStatus.active,
    )
    return or_(
        Meme.author_id == viewer_id, is_public, is_friends_only_visible, is_visible_via_community
    )


def build_meme_out(
    meme: Meme, reaction_count: int, comment_count: int, viewer_has_reacted: bool
) -> MemeOut:
    community_row = next((a for a in meme.audiences if a.community_id is not None), None)
    return MemeOut(
        id=meme.id,
        author=UserOut.model_validate(meme.author),
        image_url=meme.image_url,
        caption=meme.caption,
        audiences=list(dict.fromkeys(a.audience_type for a in meme.audiences)),
        community=CommunityBadge.model_validate(community_row.community) if community_row else None,
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
    if AudienceType.community in audiences:
        raise InvalidAudienceSelectionError(
            "Community posts are made from inside the community (POST /communities/{id}/memes),"
            " not via 'community' in audiences"
        )

    unique_audiences = set(audiences)
    if not unique_audiences:
        raise InvalidAudienceSelectionError("Choose at least one audience")

    image_url, image_public_id = await validate_and_upload_image(image, folder="memes")

    meme = Meme(
        author_id=current_user.id,
        image_url=image_url,
        image_public_id=image_public_id,
        caption=caption,
    )
    db.add(meme)
    await db.flush()

    for audience_type in unique_audiences:
        db.add(PostAudience(meme_id=meme.id, audience_type=audience_type))

    await db.commit()
    # meme is already identity-mapped in this session — db.get() would return it as-is
    # without loading relationships, so refresh() is required to populate author/audiences.
    await db.refresh(meme)
    return build_meme_out(meme, reaction_count=0, comment_count=0, viewer_has_reacted=False)


async def create_community_meme(
    db: AsyncSession,
    current_user: User,
    community_id: uuid.UUID,
    caption: str | None,
    image: UploadFile,
) -> MemeOut:
    """Community posts are only created from inside a community — there's no client-chosen
    audience here. Visibility is entirely derived from the community's privacy: every
    community post gets a `community` audience row, and an **open** community additionally
    gets a `public` row so the post surfaces in the global feed (with this meme's `community`
    badge) — an **invite-only** community's posts stay community-only.
    """
    community = await require_active_membership(db, community_id, current_user.id)

    image_url, image_public_id = await validate_and_upload_image(image, folder="memes")

    meme = Meme(
        author_id=current_user.id,
        image_url=image_url,
        image_public_id=image_public_id,
        caption=caption,
    )
    db.add(meme)
    await db.flush()

    db.add(
        PostAudience(
            meme_id=meme.id, audience_type=AudienceType.community, community_id=community_id
        )
    )
    if community.privacy == CommunityPrivacy.open:
        db.add(PostAudience(meme_id=meme.id, audience_type=AudienceType.public))

    await db.commit()
    await db.refresh(meme)
    return build_meme_out(meme, reaction_count=0, comment_count=0, viewer_has_reacted=False)


async def get_meme_out_for_viewer(
    db: AsyncSession, meme_id: uuid.UUID, viewer_id: uuid.UUID
) -> MemeOut | None:
    """Builds a MemeOut for a single meme with real reaction/comment counts — the shared
    query behind both the feed and meme-sending, so a send's embedded meme is never a
    stale/zeroed-out snapshot."""
    meme = await db.get(Meme, meme_id)
    if meme is None:
        return None

    reaction_count = await db.scalar(
        select(func.count(Reaction.id)).where(Reaction.meme_id == meme_id)
    )
    comment_count = await db.scalar(
        select(func.count(Comment.id)).where(Comment.meme_id == meme_id)
    )
    viewer_reacted_count = await db.scalar(
        select(func.count(Reaction.id)).where(
            Reaction.meme_id == meme_id, Reaction.user_id == viewer_id
        )
    )
    return build_meme_out(
        meme,
        reaction_count=reaction_count or 0,
        comment_count=comment_count or 0,
        viewer_has_reacted=(viewer_reacted_count or 0) > 0,
    )


async def _paginated_feed(
    db: AsyncSession,
    current_user: User,
    visibility_clause: ColumnElement[bool],
    cursor: str | None,
    limit: int,
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
        .where(visibility_clause)
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
        build_meme_out(meme, reaction_count, comment_count, viewer_reacted_count > 0)
        for meme, reaction_count, comment_count, viewer_reacted_count in rows
    ]
    next_cursor = encode_cursor(rows[-1][0].created_at, rows[-1][0].id) if has_more and rows else None

    return FeedPage(items=items, next_cursor=next_cursor)


async def get_feed(
    db: AsyncSession, current_user: User, cursor: str | None, limit: int
) -> FeedPage:
    return await _paginated_feed(db, current_user, meme_visibility_clause(current_user.id), cursor, limit)


async def get_community_feed(
    db: AsyncSession,
    current_user: User,
    community_id: uuid.UUID,
    cursor: str | None,
    limit: int,
) -> FeedPage:
    await require_active_membership(db, community_id, current_user.id)
    is_targeting_community = exists().where(
        PostAudience.meme_id == Meme.id,
        PostAudience.audience_type == AudienceType.community,
        PostAudience.community_id == community_id,
    )
    return await _paginated_feed(db, current_user, is_targeting_community, cursor, limit)


async def get_visible_meme(db: AsyncSession, current_user: User, meme_id: uuid.UUID) -> Meme:
    stmt = select(Meme).where(Meme.id == meme_id, meme_visibility_clause(current_user.id))
    result = await db.execute(stmt)
    meme = result.scalar_one_or_none()
    if meme is None:
        raise MemeNotFoundError("Meme not found")
    return meme
