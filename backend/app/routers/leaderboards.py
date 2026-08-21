import uuid
from typing import Annotated

from fastapi import APIRouter, Query

from app.core.deps import CurrentUser, ReadDbSession
from app.schemas.leaderboards import (
    CommunityLeaderboardPage,
    IndividualLeaderboardPage,
    ProfileScoreOut,
)
from app.services import leaderboards as leaderboards_service

router = APIRouter(prefix="/leaderboards", tags=["leaderboards"])

PageParam = Annotated[int, Query(ge=1)]
LimitParam = Annotated[int, Query(ge=1, le=100)]


@router.get("/individual", response_model=IndividualLeaderboardPage)
async def get_individual_leaderboard(
    current_user: CurrentUser,
    db: ReadDbSession,
    page: PageParam = 1,
    limit: LimitParam = 20,
) -> IndividualLeaderboardPage:
    return await leaderboards_service.get_individual_leaderboard(db, page, limit)


@router.get("/communities", response_model=CommunityLeaderboardPage)
async def get_global_community_leaderboard(
    current_user: CurrentUser,
    db: ReadDbSession,
    page: PageParam = 1,
    limit: LimitParam = 20,
) -> CommunityLeaderboardPage:
    return await leaderboards_service.get_global_community_leaderboard(db, page, limit)


@router.get("/profile/{user_id}", response_model=ProfileScoreOut)
async def get_profile_score(
    user_id: uuid.UUID, current_user: CurrentUser, db: ReadDbSession
) -> ProfileScoreOut:
    """A user's lifetime cumulative MemeScore (Snapchat-style profile number) — all-time,
    not windowed, and public (any authed user can view any profile's score)."""
    return await leaderboards_service.get_profile_score(db, user_id)
