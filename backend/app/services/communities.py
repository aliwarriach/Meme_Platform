import uuid

from fastapi import UploadFile
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    AlreadyMemberOrRequestedError,
    CannotLeaveAsOwnerError,
    CommunityAccessDeniedError,
    CommunityMembershipNotFoundError,
    CommunityNotFoundError,
    NotCommunityOwnerError,
)
from app.core.pagination import decode_cursor, encode_cursor
from app.models.community import Community, CommunityPrivacy
from app.models.community_membership import CommunityMembership, MembershipRole, MembershipStatus
from app.models.user import User
from app.schemas.auth import UserOut
from app.schemas.communities import CommunityOut, CommunityPage, MembershipOut
from app.services.media import validate_and_upload_image


async def _get_community_or_404(db: AsyncSession, community_id: uuid.UUID) -> Community:
    community = await db.get(Community, community_id)
    if community is None:
        raise CommunityNotFoundError("Community not found")
    return community


async def _get_membership(
    db: AsyncSession, community_id: uuid.UUID, user_id: uuid.UUID
) -> CommunityMembership | None:
    stmt = select(CommunityMembership).where(
        CommunityMembership.community_id == community_id,
        CommunityMembership.user_id == user_id,
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


def _require_owner(community: Community, current_user: User) -> None:
    if community.owner_id != current_user.id:
        raise NotCommunityOwnerError("Only the community owner can do this")


async def require_active_membership(
    db: AsyncSession, community_id: uuid.UUID, user_id: uuid.UUID
) -> None:
    """Shared gate for any community-scoped resource (templates, and future feed/challenge
    scoping) — always member-only, with no open-community carve-out like the member *list*
    has. Raises 404 if the community doesn't exist, 403 if the caller isn't an active member.
    """
    await _get_community_or_404(db, community_id)
    membership = await _get_membership(db, community_id, user_id)
    if membership is None or membership.status != MembershipStatus.active:
        raise CommunityAccessDeniedError("Only members of this community can do this")


def _build_community_out(
    community: Community, member_count: int, viewer_status: MembershipStatus | None
) -> CommunityOut:
    return CommunityOut(
        id=community.id,
        owner=UserOut.model_validate(community.owner),
        name=community.name,
        description=community.description,
        icon_url=community.icon_url,
        banner_url=community.banner_url,
        privacy=community.privacy,
        member_count=member_count,
        viewer_membership_status=viewer_status,
        created_at=community.created_at,
    )


async def create_community(
    db: AsyncSession,
    current_user: User,
    name: str,
    description: str | None,
    privacy: CommunityPrivacy,
    icon: UploadFile | None,
    banner: UploadFile | None,
) -> CommunityOut:
    icon_url = icon_public_id = None
    if icon is not None:
        icon_url, icon_public_id = await validate_and_upload_image(icon, folder="communities")

    banner_url = banner_public_id = None
    if banner is not None:
        banner_url, banner_public_id = await validate_and_upload_image(banner, folder="communities")

    community = Community(
        owner_id=current_user.id,
        name=name,
        description=description,
        privacy=privacy,
        icon_url=icon_url,
        icon_public_id=icon_public_id,
        banner_url=banner_url,
        banner_public_id=banner_public_id,
    )
    db.add(community)
    await db.flush()

    db.add(
        CommunityMembership(
            community_id=community.id,
            user_id=current_user.id,
            role=MembershipRole.owner,
            status=MembershipStatus.active,
        )
    )

    await db.commit()
    await db.refresh(community)
    return _build_community_out(community, member_count=1, viewer_status=MembershipStatus.active)


async def list_communities(
    db: AsyncSession, current_user: User, cursor: str | None, limit: int
) -> CommunityPage:
    member_count_subq = (
        select(func.count(CommunityMembership.id))
        .where(
            CommunityMembership.community_id == Community.id,
            CommunityMembership.status == MembershipStatus.active,
        )
        .correlate(Community)
        .scalar_subquery()
    )
    viewer_status_subq = (
        select(CommunityMembership.status)
        .where(
            CommunityMembership.community_id == Community.id,
            CommunityMembership.user_id == current_user.id,
        )
        .correlate(Community)
        .scalar_subquery()
    )

    stmt = (
        select(Community, member_count_subq, viewer_status_subq)
        .order_by(Community.created_at.desc(), Community.id.desc())
        .limit(limit + 1)
    )

    if cursor:
        cursor_created_at, cursor_id = decode_cursor(cursor)
        stmt = stmt.where(
            or_(
                Community.created_at < cursor_created_at,
                and_(Community.created_at == cursor_created_at, Community.id < cursor_id),
            )
        )

    result = await db.execute(stmt)
    rows = result.all()

    has_more = len(rows) > limit
    rows = rows[:limit]

    items = [
        _build_community_out(community, member_count, viewer_status)
        for community, member_count, viewer_status in rows
    ]
    next_cursor = encode_cursor(rows[-1][0].created_at, rows[-1][0].id) if has_more and rows else None

    return CommunityPage(items=items, next_cursor=next_cursor)


async def list_my_communities(db: AsyncSession, current_user: User) -> list[CommunityOut]:
    member_count_subq = (
        select(func.count(CommunityMembership.id))
        .where(
            CommunityMembership.community_id == Community.id,
            CommunityMembership.status == MembershipStatus.active,
        )
        .correlate(Community)
        .scalar_subquery()
    )

    stmt = (
        select(Community, member_count_subq)
        .join(CommunityMembership, CommunityMembership.community_id == Community.id)
        .where(
            CommunityMembership.user_id == current_user.id,
            CommunityMembership.status == MembershipStatus.active,
        )
        .order_by(Community.created_at.desc())
    )

    result = await db.execute(stmt)
    rows = result.all()

    return [
        _build_community_out(community, member_count, MembershipStatus.active)
        for community, member_count in rows
    ]


async def get_community(
    db: AsyncSession, current_user: User, community_id: uuid.UUID
) -> CommunityOut:
    community = await _get_community_or_404(db, community_id)

    member_count_result = await db.execute(
        select(func.count(CommunityMembership.id)).where(
            CommunityMembership.community_id == community_id,
            CommunityMembership.status == MembershipStatus.active,
        )
    )
    member_count = member_count_result.scalar_one()

    viewer_membership = await _get_membership(db, community_id, current_user.id)
    viewer_status = viewer_membership.status if viewer_membership is not None else None

    return _build_community_out(community, member_count, viewer_status)


async def join_community(
    db: AsyncSession, current_user: User, community_id: uuid.UUID
) -> MembershipOut:
    community = await _get_community_or_404(db, community_id)

    existing = await _get_membership(db, community_id, current_user.id)
    if existing is not None:
        raise AlreadyMemberOrRequestedError("Already a member or a pending request exists")

    status_ = (
        MembershipStatus.active
        if community.privacy == CommunityPrivacy.open
        else MembershipStatus.pending
    )
    membership = CommunityMembership(
        community_id=community_id,
        user_id=current_user.id,
        role=MembershipRole.member,
        status=status_,
    )
    db.add(membership)
    await db.commit()
    await db.refresh(membership)
    return MembershipOut.model_validate(membership)


async def leave_community(db: AsyncSession, current_user: User, community_id: uuid.UUID) -> None:
    community = await _get_community_or_404(db, community_id)
    if community.owner_id == current_user.id:
        raise CannotLeaveAsOwnerError("The owner cannot leave their own community")

    membership = await _get_membership(db, community_id, current_user.id)
    if membership is None or membership.status != MembershipStatus.active:
        raise CommunityMembershipNotFoundError("You are not a member of this community")

    await db.delete(membership)
    await db.commit()


async def list_members(
    db: AsyncSession, current_user: User, community_id: uuid.UUID
) -> list[MembershipOut]:
    community = await _get_community_or_404(db, community_id)

    if community.privacy == CommunityPrivacy.invite_only:
        viewer_membership = await _get_membership(db, community_id, current_user.id)
        if viewer_membership is None or viewer_membership.status != MembershipStatus.active:
            raise CommunityAccessDeniedError("Only members can view this community's members")

    stmt = (
        select(CommunityMembership)
        .where(
            CommunityMembership.community_id == community_id,
            CommunityMembership.status == MembershipStatus.active,
        )
        .order_by(CommunityMembership.created_at)
    )
    result = await db.execute(stmt)
    return [MembershipOut.model_validate(m) for m in result.scalars().all()]


async def list_join_requests(
    db: AsyncSession, current_user: User, community_id: uuid.UUID
) -> list[MembershipOut]:
    community = await _get_community_or_404(db, community_id)
    _require_owner(community, current_user)

    stmt = (
        select(CommunityMembership)
        .where(
            CommunityMembership.community_id == community_id,
            CommunityMembership.status == MembershipStatus.pending,
        )
        .order_by(CommunityMembership.created_at)
    )
    result = await db.execute(stmt)
    return [MembershipOut.model_validate(m) for m in result.scalars().all()]


async def _get_pending_request_or_404(
    db: AsyncSession, current_user: User, community_id: uuid.UUID, membership_id: uuid.UUID
) -> CommunityMembership:
    community = await _get_community_or_404(db, community_id)
    _require_owner(community, current_user)

    membership = await db.get(CommunityMembership, membership_id)
    if (
        membership is None
        or membership.community_id != community_id
        or membership.status != MembershipStatus.pending
    ):
        raise CommunityMembershipNotFoundError("Join request not found")
    return membership


async def approve_join_request(
    db: AsyncSession,
    current_user: User,
    community_id: uuid.UUID,
    membership_id: uuid.UUID,
) -> MembershipOut:
    membership = await _get_pending_request_or_404(db, current_user, community_id, membership_id)
    membership.status = MembershipStatus.active
    await db.commit()
    await db.refresh(membership)
    return MembershipOut.model_validate(membership)


async def reject_join_request(
    db: AsyncSession,
    current_user: User,
    community_id: uuid.UUID,
    membership_id: uuid.UUID,
) -> None:
    membership = await _get_pending_request_or_404(db, current_user, community_id, membership_id)
    await db.delete(membership)
    await db.commit()
