import uuid
from typing import Annotated

from fastapi import APIRouter, Form, Query, UploadFile

from app.core.deps import CurrentUser, DbSession
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
    current_user: CurrentUser,
    db: DbSession,
    name: Annotated[str, Form(min_length=1, max_length=100)],
    privacy: Annotated[CommunityPrivacy, Form()],
    description: Annotated[str | None, Form(max_length=500)] = None,
    icon: UploadFile | None = None,
    banner: UploadFile | None = None,
) -> CommunityOut:
    return await communities_service.create_community(
        db, current_user, name, description, privacy, icon, banner
    )


@router.get("", response_model=CommunityPage)
async def list_communities(
    current_user: CurrentUser,
    db: DbSession,
    cursor: str | None = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
) -> CommunityPage:
    return await communities_service.list_communities(db, current_user, cursor, limit)


@router.get("/mine", response_model=list[CommunityOut])
async def list_my_communities(current_user: CurrentUser, db: DbSession) -> list[CommunityOut]:
    return await communities_service.list_my_communities(db, current_user)


@router.get("/{community_id}", response_model=CommunityOut)
async def get_community(
    community_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> CommunityOut:
    return await communities_service.get_community(db, current_user, community_id)


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
    db: DbSession,
    cursor: str | None = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
) -> FeedPage:
    return await memes_service.get_community_feed(db, current_user, community_id, cursor, limit)


@router.get("/{community_id}/leaderboard", response_model=IndividualLeaderboardPage)
async def get_internal_community_leaderboard(
    community_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
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
