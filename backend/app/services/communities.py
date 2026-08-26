import uuid

from fastapi import UploadFile
from sqlalchemy import and_, exists, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    AlreadyMemberOrRequestedError,
    CannotLeaveAsOwnerError,
    CommunityAccessDeniedError,
    CommunityMembershipNotFoundError,
    CommunityNotFoundError,
    InvalidAvatarPresetError,
    InvalidImageSourceError,
    NotCommunityOwnerError,
    UserNotFoundError,
)
from app.core.pagination import decode_cursor, encode_cursor
from app.models.challenge import Challenge, ChallengeStatus
from app.models.community import Community, CommunityPrivacy
from app.models.community_membership import CommunityMembership, MembershipRole, MembershipStatus
from app.models.user import User
from app.schemas.auth import PublicUserOut
from app.schemas.communities import CommunityOut, CommunityPage, MembershipOut
from app.services.media import confirm_pending_upload, delete_uploaded_image, validate_and_upload_image
from app.services.users import ALLOWED_AVATAR_PRESETS, get_user_by_username


async def _resolve_optional_image(
    user_id: uuid.UUID,
    file: UploadFile | None,
    public_id: str | None,
    field_name: str,
) -> tuple[str | None, str | None]:
    """Shared optional-image resolution for community icon/banner — each is independently
    optional, but if given, `file` and `public_id` are mutually exclusive (Roadmap_Scaling.md
    A4). Returns `(url, public_id)`, both `None` when neither source was given."""
    if public_id is not None:
        if file is not None:
            raise InvalidImageSourceError(
                f"Provide either a {field_name} file or {field_name}_public_id, not both"
            )
        return await confirm_pending_upload(user_id, public_id)
    if file is not None:
        return await validate_and_upload_image(file, folder="communities")
    return None, None


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


async def require_membership_or_open_community(
    db: AsyncSession, community_id: uuid.UUID, user_id: uuid.UUID
) -> Community:
    """Same as `require_active_membership` below, except an **open** community also accepts
    a non-member. Used specifically for a non-member submitting a challenge entry to back an
    open community's side in a community_vs_community challenge (2026-08-27 product
    decision — see `services/challenges.py::create_and_submit_to_challenge`). Every other
    community-post path (the generic `POST /communities/{id}/memes`, templates, etc.) stays
    on `require_active_membership` alone, unchanged — this carve-out is deliberately narrow."""
    community = await _get_community_or_404(db, community_id)
    if community.privacy == CommunityPrivacy.open:
        return community
    membership = await _get_membership(db, community_id, user_id)
    if membership is None or membership.status != MembershipStatus.active:
        raise CommunityAccessDeniedError("Only members of this community can do this")
    return community


async def require_active_membership(
    db: AsyncSession, community_id: uuid.UUID, user_id: uuid.UUID
) -> Community:
    """Shared gate for any community-scoped resource (templates, feed, community posting) —
    always member-only, with no open-community carve-out like the member *list* has. Raises
    404 if the community doesn't exist, 403 if the caller isn't an active member. Returns the
    community itself since several callers (e.g. community-post creation) need its `privacy`
    right after checking membership.
    """
    community = await _get_community_or_404(db, community_id)
    membership = await _get_membership(db, community_id, user_id)
    if membership is None or membership.status != MembershipStatus.active:
        raise CommunityAccessDeniedError("Only members of this community can do this")
    return community


def _active_challenge_exists_subq():
    """Correlated EXISTS for 'this community has a currently-active challenge' — true whether
    the community is the proposer (`community_id`) or the challenged side in a
    community_vs_community challenge (`opponent_community_id`). Used to surface a live-challenge
    signal on community list/detail views without an N+1 fetch per community."""
    return (
        exists()
        .where(
            or_(
                Challenge.community_id == Community.id,
                Challenge.opponent_community_id == Community.id,
            ),
            Challenge.status == ChallengeStatus.active,
        )
        .correlate(Community)
    )


def _build_community_out(
    community: Community,
    member_count: int,
    viewer_status: MembershipStatus | None,
    has_active_challenge: bool,
) -> CommunityOut:
    return CommunityOut(
        id=community.id,
        owner=PublicUserOut.model_validate(community.owner),
        name=community.name,
        description=community.description,
        icon_url=community.icon_url,
        icon_preset=community.icon_preset,
        banner_url=community.banner_url,
        privacy=community.privacy,
        member_count=member_count,
        viewer_membership_status=viewer_status,
        has_active_challenge=has_active_challenge,
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
    icon_public_id: str | None = None,
    banner_public_id: str | None = None,
) -> CommunityOut:
    """`icon`/`banner` (legacy multipart upload) and `icon_public_id`/`banner_public_id`
    (Roadmap_Scaling.md A4's direct-to-Cloudinary flow) are each independently optional,
    but mutually exclusive with their own file when given."""
    icon_url, icon_public_id = await _resolve_optional_image(
        current_user.id, icon, icon_public_id, "icon"
    )
    banner_url, banner_public_id = await _resolve_optional_image(
        current_user.id, banner, banner_public_id, "banner"
    )

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
    return _build_community_out(
        community, member_count=1, viewer_status=MembershipStatus.active, has_active_challenge=False
    )


async def list_communities(
    db: AsyncSession, current_user: User, cursor: str | None, limit: int, query: str | None = None
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
    active_challenge_subq = _active_challenge_exists_subq()

    stmt = (
        select(Community, member_count_subq, viewer_status_subq, active_challenge_subq)
        .order_by(Community.created_at.desc(), Community.id.desc())
        .limit(limit + 1)
    )

    if query and query.strip():
        stmt = stmt.where(Community.name.ilike(f"%{query.strip()}%"))

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
        _build_community_out(community, member_count, viewer_status, has_active_challenge)
        for community, member_count, viewer_status, has_active_challenge in rows
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

    active_challenge_subq = _active_challenge_exists_subq()

    stmt = (
        select(Community, member_count_subq, active_challenge_subq)
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
        _build_community_out(community, member_count, MembershipStatus.active, has_active_challenge)
        for community, member_count, has_active_challenge in rows
    ]


async def list_invited_communities(db: AsyncSession, current_user: User) -> list[CommunityOut]:
    """Communities that invited the caller (`services/communities.py::invite_to_community`)
    who hasn't yet accepted (`join_community`) or declined (`leave_community`) — the
    "Pending" tab on the communities list screen. Mirrors `list_my_communities`'s shape
    exactly, just filtered to `invited` instead of `active`."""
    member_count_subq = (
        select(func.count(CommunityMembership.id))
        .where(
            CommunityMembership.community_id == Community.id,
            CommunityMembership.status == MembershipStatus.active,
        )
        .correlate(Community)
        .scalar_subquery()
    )

    active_challenge_subq = _active_challenge_exists_subq()

    stmt = (
        select(Community, member_count_subq, active_challenge_subq)
        .join(CommunityMembership, CommunityMembership.community_id == Community.id)
        .where(
            CommunityMembership.user_id == current_user.id,
            CommunityMembership.status == MembershipStatus.invited,
        )
        .order_by(Community.created_at.desc())
    )

    result = await db.execute(stmt)
    rows = result.all()

    return [
        _build_community_out(community, member_count, MembershipStatus.invited, has_active_challenge)
        for community, member_count, has_active_challenge in rows
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

    active_challenge_result = await db.execute(
        select(
            exists().where(
                or_(
                    Challenge.community_id == community_id,
                    Challenge.opponent_community_id == community_id,
                ),
                Challenge.status == ChallengeStatus.active,
            )
        )
    )
    has_active_challenge = active_challenge_result.scalar_one()

    return _build_community_out(community, member_count, viewer_status, has_active_challenge)


async def update_community_media(
    db: AsyncSession,
    current_user: User,
    community_id: uuid.UUID,
    icon: UploadFile | None = None,
    icon_public_id: str | None = None,
    icon_preset: str | None = None,
    clear_icon: bool = False,
    banner: UploadFile | None = None,
    banner_public_id: str | None = None,
    clear_banner: bool = False,
) -> CommunityOut:
    """Owner-only. Icon and banner are each updated independently — a call can touch one,
    both, or neither. Icon has four mutually exclusive inputs (`icon`/`icon_public_id`/
    `icon_preset`/`clear_icon`), mirroring `services/users.py::update_profile`'s avatar
    handling exactly (same `ALLOWED_AVATAR_PRESETS`). Banner has no preset system — just
    upload or `clear_banner`, per product scope (a cover photo isn't a "pick one of five
    built-ins" surface the way a small profile picture is)."""
    community = await _get_community_or_404(db, community_id)
    _require_owner(community, current_user)

    if icon_preset is not None and icon_preset not in ALLOWED_AVATAR_PRESETS:
        raise InvalidAvatarPresetError(f"Unknown avatar preset: {icon_preset}")

    icon_given = icon is not None or icon_public_id is not None
    old_icon_public_id = community.icon_public_id
    icon_changed = icon_given or icon_preset is not None or clear_icon

    if clear_icon:
        community.icon_url = None
        community.icon_public_id = None
        community.icon_preset = None
    elif icon_preset is not None:
        community.icon_url = None
        community.icon_public_id = None
        community.icon_preset = icon_preset
    elif icon_given:
        icon_url, icon_public_id = await _resolve_optional_image(
            current_user.id, icon, icon_public_id, "icon"
        )
        community.icon_url = icon_url
        community.icon_public_id = icon_public_id
        community.icon_preset = None

    banner_given = banner is not None or banner_public_id is not None
    old_banner_public_id = community.banner_public_id
    banner_changed = banner_given or clear_banner

    if clear_banner:
        community.banner_url = None
        community.banner_public_id = None
    elif banner_given:
        banner_url, banner_public_id = await _resolve_optional_image(
            current_user.id, banner, banner_public_id, "banner"
        )
        community.banner_url = banner_url
        community.banner_public_id = banner_public_id

    await db.commit()
    await db.refresh(community)

    if icon_changed and old_icon_public_id:
        await delete_uploaded_image(old_icon_public_id)
    if banner_changed and old_banner_public_id:
        await delete_uploaded_image(old_banner_public_id)

    return await get_community(db, current_user, community_id)


async def invite_to_community(
    db: AsyncSession, current_user: User, community_id: uuid.UUID, username: str
) -> MembershipOut:
    """Any active member (not owner-only — "Add Members" is a member-tab action, not an
    owner-moderation one) can invite any other user, friend or not, by username. Creates an
    `invited` row the target accepts via `join_community` or declines via `leave_community`.
    `404` if the target username doesn't exist, `409` if they already have a membership row
    of any status (already a member, already invited, or already have a pending request in)."""
    await require_active_membership(db, community_id, current_user.id)

    target = await get_user_by_username(db, username)
    if target is None:
        raise UserNotFoundError("No user with that username")

    existing = await _get_membership(db, community_id, target.id)
    if existing is not None:
        raise AlreadyMemberOrRequestedError("This user already has a membership or request pending")

    membership = CommunityMembership(
        community_id=community_id,
        user_id=target.id,
        role=MembershipRole.member,
        status=MembershipStatus.invited,
    )
    db.add(membership)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise AlreadyMemberOrRequestedError("This user already has a membership or request pending") from None
    await db.refresh(membership)
    return MembershipOut.model_validate(membership)


async def join_community(
    db: AsyncSession, current_user: User, community_id: uuid.UUID
) -> MembershipOut:
    community = await _get_community_or_404(db, community_id)

    existing = await _get_membership(db, community_id, current_user.id)
    if existing is not None:
        if existing.status == MembershipStatus.invited:
            # Accepting an invite someone else sent — the same call a self-initiated joiner
            # would make, just flipping the existing row instead of creating a new one.
            existing.status = MembershipStatus.active
            await db.commit()
            await db.refresh(existing)
            return MembershipOut.model_validate(existing)
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
    try:
        await db.commit()
    except IntegrityError:
        # Two concurrent join calls from the same user both passed the check above.
        await db.rollback()
        raise AlreadyMemberOrRequestedError("Already a member or a pending request exists") from None
    await db.refresh(membership)
    return MembershipOut.model_validate(membership)


async def leave_community(db: AsyncSession, current_user: User, community_id: uuid.UUID) -> None:
    """Also doubles as "cancel my own pending join request" and "decline an invite I
    received" — all three are the same action from the data's point of view (delete my own
    membership row, whatever its status), and reusing one endpoint for all three avoids a
    separate decline/cancel endpoint per status."""
    community = await _get_community_or_404(db, community_id)
    if community.owner_id == current_user.id:
        raise CannotLeaveAsOwnerError("The owner cannot leave their own community")

    membership = await _get_membership(db, community_id, current_user.id)
    if membership is None:
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
