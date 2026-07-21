from typing import Annotated

from fastapi import APIRouter, Query

from app.core.deps import CurrentUser, DbSession
from app.schemas.leaderboards import CommunityLeaderboardPage, IndividualLeaderboardPage
from app.services import leaderboards as leaderboards_service

router = APIRouter(prefix="/leaderboards", tags=["leaderboards"])

PageParam = Annotated[int, Query(ge=1)]
LimitParam = Annotated[int, Query(ge=1, le=100)]


@router.get("/individual", response_model=IndividualLeaderboardPage)
async def get_individual_leaderboard(
    current_user: CurrentUser,
    db: DbSession,
    page: PageParam = 1,
    limit: LimitParam = 20,
) -> IndividualLeaderboardPage:
    return await leaderboards_service.get_individual_leaderboard(db, page, limit)


@router.get("/communities", response_model=CommunityLeaderboardPage)
async def get_global_community_leaderboard(
    current_user: CurrentUser,
    db: DbSession,
    page: PageParam = 1,
    limit: LimitParam = 20,
) -> CommunityLeaderboardPage:
    return await leaderboards_service.get_global_community_leaderboard(db, page, limit)
