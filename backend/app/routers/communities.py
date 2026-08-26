import uuid
from typing import Annotated

from fastapi import APIRouter, Form, Query, UploadFile

from app.core.deps import CurrentUser, CurrentVerifiedUser, DbSession, ReadDbSession
from app.models.community import CommunityPrivacy
from app.schemas.communities import CommunityOut, CommunityPage, MembershipOut
from app.schemas.leaderboards import IndividualLeaderboardPage
from app.schemas.memes import FeedPage, MemeOut
from app.schemas.templates import TemplatePage
from app.services import communities as communities_service
from app.services import leaderboards as leaderboards_service
from app.services import memes as memes_service
from app.services import templates as templates_service

router = APIRouter(prefix="/communities", tags=["communities"])


@router.post("", response_model=CommunityOut, status_code=201)
async def create_community(
    current_user: CurrentVerifiedUser,
    db: DbSession,
    name: Annotated[str, Form(min_length=1, max_length=100)],
    privacy: Annotated[CommunityPrivacy, Form()],
    description: Annotated[str | None, Form(max_length=500)] = None,
    icon: UploadFile | None = None,
    banner: UploadFile | None = None,
    icon_public_id: Annotated[str | None, Form()] = None,
    banner_public_id: Annotated[str | None, Form()] = None,
) -> CommunityOut:
    """`icon`/`banner` (legacy multipart upload) and `icon_public_id`/`banner_public_id`
    (Roadmap_Scaling.md A4's direct-to-Cloudinary flow — confirm the `public_id` from
    `POST /media/upload-signature`) are each independently optional, mutually exclusive
    with their own file when given."""
    return await communities_service.create_community(
        db, current_user, name, description, privacy, icon, banner,
        icon_public_id=icon_public_id, banner_public_id=banner_public_id,
    )


@router.get("", response_model=CommunityPage)
async def list_communities(
    current_user: CurrentUser,
    db: DbSession,
    cursor: str | None = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
    q: str | None = None,
) -> CommunityPage:
    return await communities_service.list_communities(db, current_user, cursor, limit, query=q)


@router.get("/mine", response_model=list[CommunityOut])
async def list_my_communities(current_user: CurrentUser, db: DbSession) -> list[CommunityOut]:
    return await communities_service.list_my_communities(db, current_user)


@router.get("/invited", response_model=list[CommunityOut])
async def list_invited_communities(current_user: CurrentUser, db: DbSession) -> list[CommunityOut]:
    return await communities_service.list_invited_communities(db, current_user)


@router.get("/{community_id}", response_model=CommunityOut)
async def get_community(
    community_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> CommunityOut:
    return await communities_service.get_community(db, current_user, community_id)


@router.patch("/{community_id}", response_model=CommunityOut)
async def update_community(
    community_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
    icon: UploadFile | None = None,
    icon_public_id: Annotated[str | None, Form()] = None,
    icon_preset: Annotated[str | None, Form()] = None,
    clear_icon: Annotated[bool, Form()] = False,
    banner: UploadFile | None = None,
    banner_public_id: Annotated[str | None, Form()] = None,
    clear_banner: Annotated[bool, Form()] = False,
) -> CommunityOut:
    """Owner-only. See `services/communities.py::update_community_media` for the mutually
    exclusive icon/banner input rules."""
    return await communities_service.update_community_media(
        db,
        current_user,
        community_id,
        icon=icon,
        icon_public_id=icon_public_id,
        icon_preset=icon_preset,
        clear_icon=clear_icon,
        banner=banner,
        banner_public_id=banner_public_id,
        clear_banner=clear_banner,
    )


@router.post("/{community_id}/invites", response_model=MembershipOut, status_code=201)
async def invite_to_community(
    community_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
    username: Annotated[str, Form(min_length=1, max_length=32)],
) -> MembershipOut:
    return await communities_service.invite_to_community(db, current_user, community_id, username)


@router.post("/{community_id}/join", response_model=MembershipOut, status_code=201)
async def join_community(
    community_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> MembershipOut:
    return await communities_service.join_community(db, current_user, community_id)


@router.delete("/{community_id}/membership", status_code=204)
async def leave_community(
    community_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> None:
    await communities_service.leave_community(db, current_user, community_id)


@router.get("/{community_id}/members", response_model=list[MembershipOut])
async def list_members(
    community_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> list[MembershipOut]:
    return await communities_service.list_members(db, current_user, community_id)


@router.get("/{community_id}/templates", response_model=TemplatePage)
async def list_community_templates(
    community_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
    cursor: str | None = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
) -> TemplatePage:
    return await templates_service.list_community_templates(
        db, current_user, community_id, cursor, limit
    )


@router.post("/{community_id}/memes", response_model=MemeOut, status_code=201)
async def create_community_meme(
    community_id: uuid.UUID,
    image: UploadFile,
    current_user: CurrentUser,
    db: DbSession,
    caption: Annotated[str | None, Form(max_length=500)] = None,
) -> MemeOut:
    return await memes_service.create_community_meme(
        db, current_user, community_id, caption, image
    )


@router.get("/{community_id}/feed", response_model=FeedPage)
async def get_community_feed(
    community_id: uuid.UUID,
    current_user: CurrentUser,
    db: ReadDbSession,
    cursor: str | None = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
) -> FeedPage:
    return await memes_service.get_community_feed(db, current_user, community_id, cursor, limit)


@router.get("/{community_id}/leaderboard", response_model=IndividualLeaderboardPage)
async def get_internal_community_leaderboard(
    community_id: uuid.UUID,
    current_user: CurrentUser,
    db: ReadDbSession,
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> IndividualLeaderboardPage:
    return await leaderboards_service.get_internal_community_leaderboard(
        db, current_user, community_id, page, limit
    )


@router.get("/{community_id}/join-requests", response_model=list[MembershipOut])
async def list_join_requests(
    community_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> list[MembershipOut]:
    return await communities_service.list_join_requests(db, current_user, community_id)


@router.post("/{community_id}/join-requests/{membership_id}/approve", response_model=MembershipOut)
async def approve_join_request(
    community_id: uuid.UUID,
    membership_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> MembershipOut:
    return await communities_service.approve_join_request(
        db, current_user, community_id, membership_id
    )


@router.delete("/{community_id}/join-requests/{membership_id}", status_code=204)
async def reject_join_request(
    community_id: uuid.UUID,
    membership_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> None:
    await communities_service.reject_join_request(db, current_user, community_id, membership_id)
