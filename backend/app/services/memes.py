import uuid

from fastapi import UploadFile
from sqlalchemy import ColumnElement, and_, exists, func, or_, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import InvalidAudienceSelectionError, MemeNotFoundError
from app.core.pagination import decode_cursor, encode_cursor
from app.models.community import Community, CommunityPrivacy
from app.models.community_membership import CommunityMembership, MembershipStatus
from app.models.friendship import Friendship, FriendshipStatus
from app.models.meme import Meme
from app.models.meme_view import MemeView
from app.models.meme_vote import MemeVote
from app.models.post_audience import AudienceType, PostAudience
from app.models.comment import Comment
from app.models.user import User
from app.schemas.auth import UserOut
from app.schemas.memes import CommunityBadge, FeedPage, HotFeedPage, MemeOut, MemeViewOut
from app.services.communities import require_active_membership
from app.services.media import validate_and_upload_image
from app.services.scoring import hot_score_expr


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


def _can_view_meme_view_count(meme: Meme, community_row: PostAudience | None, viewer_id: uuid.UUID) -> bool:
    """View counts are private engagement data, not a public vanity metric — visible only
    to the meme's author, plus (for a community post) that community's owner ("admin";
    `MembershipRole` has no separate admin tier, so the community owner is the only
    privileged party that exists). Everyone else gets `view_count=None` in `MemeOut`."""
    if meme.author_id == viewer_id:
        return True
    if community_row is not None and community_row.community.owner_id == viewer_id:
        return True
    return False


def build_meme_out(
    meme: Meme,
    upvote_count: int,
    downvote_count: int,
    comment_count: int,
    viewer_vote: int | None,
    viewer_id: uuid.UUID | None = None,
) -> MemeOut:
    """`viewer_id=None` (challenge submissions, competition standings — viewer-agnostic
    contexts) always yields `view_count=None`: those surfaces have no single "current
    viewer" to authorize against, so they never leak the count."""
    community_row = next((a for a in meme.audiences if a.community_id is not None), None)
    can_see_views = viewer_id is not None and _can_view_meme_view_count(meme, community_row, viewer_id)
    return MemeOut(
        id=meme.id,
        author=UserOut.model_validate(meme.author),
        image_url=meme.image_url,
        caption=meme.caption,
        audiences=list(dict.fromkeys(a.audience_type for a in meme.audiences)),
        community=CommunityBadge.model_validate(community_row.community) if community_row else None,
        upvote_count=upvote_count,
        downvote_count=downvote_count,
        score=upvote_count - downvote_count,
        comment_count=comment_count,
        view_count=meme.view_count if can_see_views else None,
        viewer_vote=viewer_vote,
        created_at=meme.created_at,
    )


async def stage_personal_meme(
    db: AsyncSession,
    author_id: uuid.UUID,
    caption: str | None,
    audiences: set[AudienceType],
    image: UploadFile,
) -> Meme:
    """Uploads the image and stages the `Meme` + its `PostAudience` rows **without
    committing** — the caller owns the transaction. Counterpart to `stage_community_meme`,
    split out so an open challenge (which has no community) can create its public entry
    meme and its `ChallengeSubmission` atomically.

    Audience validity must already be checked by the caller.
    """
    image_url, image_public_id = await validate_and_upload_image(image, folder="memes")

    meme = Meme(
        author_id=author_id,
        image_url=image_url,
        image_public_id=image_public_id,
        caption=caption,
    )
    db.add(meme)
    await db.flush()

    for audience_type in audiences:
        db.add(PostAudience(meme_id=meme.id, audience_type=audience_type))

    return meme


async def create_meme(
    db: AsyncSession,
    current_user: User,
    caption: str | None,
    audiences: list[AudienceType],
    image: UploadFile,
    hashtags: list[str] | None = None,
) -> MemeOut:
    if AudienceType.community in audiences:
        raise InvalidAudienceSelectionError(
            "Community posts are made from inside the community (POST /communities/{id}/memes),"
            " not via 'community' in audiences"
        )

    unique_audiences = set(audiences)
    if not unique_audiences:
        raise InvalidAudienceSelectionError("Choose at least one audience")

    meme = await stage_personal_meme(db, current_user.id, caption, unique_audiences, image)

    if hashtags:
        # Imported lazily to keep the dependency one-directional — services.hashtags reads
        # this module's feed helpers, so a module-scope import here would be a cycle.
        from app.services.hashtags import attach_hashtags

        await attach_hashtags(db, meme.id, hashtags)

    await db.commit()
    # meme is already identity-mapped in this session — db.get() would return it as-is
    # without loading relationships, so refresh() is required to populate author/audiences.
    await db.refresh(meme)
    return build_meme_out(
        meme, upvote_count=0, downvote_count=0, comment_count=0, viewer_vote=None,
        viewer_id=current_user.id,
    )


async def stage_community_meme(
    db: AsyncSession,
    community: Community,
    author_id: uuid.UUID,
    caption: str | None,
    image: UploadFile,
) -> Meme:
    """Uploads the image and stages the `Meme` + its derived `PostAudience` rows **without
    committing** — the caller owns the transaction. Split out of `create_community_meme` so
    the challenge create-and-submit flow can attach a `ChallengeSubmission` in the same
    transaction; a two-call client chain would strand memes as "posted but not submitted"
    whenever the second call failed on a flaky mobile network.

    Membership must already be verified by the caller (it's what produces `community`).
    """
    image_url, image_public_id = await validate_and_upload_image(image, folder="memes")

    meme = Meme(
        author_id=author_id,
        image_url=image_url,
        image_public_id=image_public_id,
        caption=caption,
    )
    db.add(meme)
    await db.flush()

    db.add(
        PostAudience(
            meme_id=meme.id, audience_type=AudienceType.community, community_id=community.id
        )
    )
    if community.privacy == CommunityPrivacy.open:
        db.add(PostAudience(meme_id=meme.id, audience_type=AudienceType.public))

    return meme


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
    meme = await stage_community_meme(db, community, current_user.id, caption, image)

    await db.commit()
    await db.refresh(meme)
    return build_meme_out(
        meme, upvote_count=0, downvote_count=0, comment_count=0, viewer_vote=None,
        viewer_id=current_user.id,
    )


async def get_meme_out_for_viewer(
    db: AsyncSession, meme_id: uuid.UUID, viewer_id: uuid.UUID
) -> MemeOut | None:
    """Builds a MemeOut for a single meme with real vote/comment counts — the shared
    query behind both the feed and meme-sending, so a send's embedded meme is never a
    stale/zeroed-out snapshot."""
    meme = await db.get(Meme, meme_id)
    if meme is None:
        return None

    upvote_count = await db.scalar(
        select(func.count(MemeVote.id)).where(MemeVote.meme_id == meme_id, MemeVote.value == 1)
    )
    downvote_count = await db.scalar(
        select(func.count(MemeVote.id)).where(MemeVote.meme_id == meme_id, MemeVote.value == -1)
    )
    comment_count = await db.scalar(
        select(func.count(Comment.id)).where(Comment.meme_id == meme_id)
    )
    viewer_vote = await db.scalar(
        select(MemeVote.value).where(MemeVote.meme_id == meme_id, MemeVote.user_id == viewer_id)
    )
    return build_meme_out(
        meme,
        upvote_count=upvote_count or 0,
        downvote_count=downvote_count or 0,
        comment_count=comment_count or 0,
        viewer_vote=viewer_vote,
        viewer_id=viewer_id,
    )


async def _paginated_feed(
    db: AsyncSession,
    current_user: User,
    visibility_clause: ColumnElement[bool],
    cursor: str | None,
    limit: int,
) -> FeedPage:
    upvote_count_subq = (
        select(func.count(MemeVote.id))
        .where(MemeVote.meme_id == Meme.id, MemeVote.value == 1)
        .correlate(Meme)
        .scalar_subquery()
    )
    downvote_count_subq = (
        select(func.count(MemeVote.id))
        .where(MemeVote.meme_id == Meme.id, MemeVote.value == -1)
        .correlate(Meme)
        .scalar_subquery()
    )
    comment_count_subq = (
        select(func.count(Comment.id))
        .where(Comment.meme_id == Meme.id)
        .correlate(Meme)
        .scalar_subquery()
    )
    viewer_vote_subq = (
        select(MemeVote.value)
        .where(MemeVote.meme_id == Meme.id, MemeVote.user_id == current_user.id)
        .correlate(Meme)
        .scalar_subquery()
    )

    stmt = (
        select(Meme, upvote_count_subq, downvote_count_subq, comment_count_subq, viewer_vote_subq)
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
        build_meme_out(
            meme, upvote_count, downvote_count, comment_count, viewer_vote,
            viewer_id=current_user.id,
        )
        for meme, upvote_count, downvote_count, comment_count, viewer_vote in rows
    ]
    next_cursor = encode_cursor(rows[-1][0].created_at, rows[-1][0].id) if has_more and rows else None

    return FeedPage(items=items, next_cursor=next_cursor)


async def get_hot_ranked_memes(
    db: AsyncSession,
    current_user: User,
    visibility_clause: ColumnElement[bool],
    offset: int,
    limit: int,
) -> HotFeedPage:
    """Main-feed ranking: Reddit's "Hot" algorithm (vote score vs. age), not recency.
    Offset-paginated rather than keyset — a Hot score drifts continuously with time
    (the age term ticks every second) so it has no stable cursor to page against,
    unlike the plain `created_at DESC` feeds `_paginated_feed` still serves.
    """
    upvote_count_subq = (
        select(func.count(MemeVote.id))
        .where(MemeVote.meme_id == Meme.id, MemeVote.value == 1)
        .correlate(Meme)
        .scalar_subquery()
    )
    downvote_count_subq = (
        select(func.count(MemeVote.id))
        .where(MemeVote.meme_id == Meme.id, MemeVote.value == -1)
        .correlate(Meme)
        .scalar_subquery()
    )
    comment_count_subq = (
        select(func.count(Comment.id))
        .where(Comment.meme_id == Meme.id)
        .correlate(Meme)
        .scalar_subquery()
    )
    viewer_vote_subq = (
        select(MemeVote.value)
        .where(MemeVote.meme_id == Meme.id, MemeVote.user_id == current_user.id)
        .correlate(Meme)
        .scalar_subquery()
    )
    net_score_subq = (
        select(func.coalesce(func.sum(MemeVote.value), 0))
        .where(MemeVote.meme_id == Meme.id)
        .correlate(Meme)
        .scalar_subquery()
    )
    hot_score = hot_score_expr(Meme.created_at, net_score_subq)

    stmt = (
        select(Meme, upvote_count_subq, downvote_count_subq, comment_count_subq, viewer_vote_subq)
        .where(visibility_clause)
        .order_by(hot_score.desc(), Meme.created_at.desc(), Meme.id.desc())
        .offset(offset)
        .limit(limit + 1)
    )

    result = await db.execute(stmt)
    rows = result.all()

    has_more = len(rows) > limit
    rows = rows[:limit]

    items = [
        build_meme_out(
            meme, upvote_count, downvote_count, comment_count, viewer_vote,
            viewer_id=current_user.id,
        )
        for meme, upvote_count, downvote_count, comment_count, viewer_vote in rows
    ]
    return HotFeedPage(items=items, has_more=has_more)


async def get_feed(
    db: AsyncSession, current_user: User, offset: int, limit: int
) -> HotFeedPage:
    return await get_hot_ranked_memes(
        db, current_user, meme_visibility_clause(current_user.id), offset, limit
    )


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


async def record_meme_view(
    db: AsyncSession, current_user: User, meme_id: uuid.UUID
) -> MemeViewOut:
    """Registers one impression from this user on this meme — **at most once per (meme,
    user), ever** (per-user dedup, confirmed with user): a repeat view from the same viewer
    doesn't move the counter. Gated by `get_visible_meme` — you can't inflate views on
    content you can't even see (404, not 403, same as votes/comments).

    `ON CONFLICT DO NOTHING` on the `meme_views` unique constraint makes the dedup check and
    insert a single atomic statement (no separate SELECT-then-INSERT race window between
    concurrent requests from the same user); `Meme.view_count` is only bumped when a row was
    actually inserted (`rowcount == 1`), keeping the denormalized counter exactly in sync
    with the ledger without a recount aggregation on every call.
    """
    meme = await get_visible_meme(db, current_user, meme_id)

    insert_stmt = (
        pg_insert(MemeView)
        .values(meme_id=meme.id, user_id=current_user.id)
        .on_conflict_do_nothing(index_elements=["meme_id", "user_id"])
    )
    result = await db.execute(insert_stmt)
    if result.rowcount:
        await db.execute(
            update(Meme).where(Meme.id == meme.id).values(view_count=Meme.view_count + 1)
        )
    await db.commit()

    new_count = await db.scalar(select(Meme.view_count).where(Meme.id == meme.id))
    return MemeViewOut(meme_id=meme.id, view_count=new_count or 0)
