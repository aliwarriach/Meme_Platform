import uuid

from pydantic import BaseModel

from app.models.vote import CompetitionPeriod
from app.schemas.memes import MemeOut


class VoteOut(BaseModel):
    id: uuid.UUID
    meme_id: uuid.UUID
    period_type: CompetitionPeriod
    period_key: str


class StandingEntry(BaseModel):
    rank: int
    meme: MemeOut
    vote_count: int


class StandingsPage(BaseModel):
    period_type: CompetitionPeriod
    period_key: str
    is_closed: bool
    items: list[StandingEntry]


class WinnerOut(BaseModel):
    period_type: CompetitionPeriod
    period_key: str
    meme: MemeOut | None
    vote_count: int
