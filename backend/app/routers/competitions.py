import uuid
from typing import Annotated

from fastapi import APIRouter, Query

from app.core.deps import CurrentUser, DbSession
from app.models.vote import CompetitionPeriod
from app.schemas.competitions import StandingsPage, VoteOut, WinnerOut
from app.services import competitions as competitions_service

router = APIRouter(prefix="/competitions", tags=["competitions"])

LimitParam = Annotated[int, Query(ge=1, le=100)]


@router.post("/{period_type}/votes/{meme_id}", response_model=VoteOut, status_code=201)
async def cast_vote(
    period_type: CompetitionPeriod, meme_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> VoteOut:
    return await competitions_service.cast_vote(db, current_user, meme_id, period_type)


@router.get("/{period_type}/current", response_model=StandingsPage)
async def get_current_standings(
    period_type: CompetitionPeriod, current_user: CurrentUser, db: DbSession, limit: LimitParam = 20
) -> StandingsPage:
    return await competitions_service.get_current_standings(db, period_type, limit)


@router.get("/{period_type}/winner", response_model=WinnerOut)
async def get_winner(
    period_type: CompetitionPeriod, period_key: str, current_user: CurrentUser, db: DbSession
) -> WinnerOut:
    return await competitions_service.get_winner(db, period_type, period_key)
