import uuid
from typing import Literal

from pydantic import BaseModel

from app.models.vote import CompetitionPeriod
from app.schemas.instagram import MemeContainerOut
from app.schemas.memes import MemeOut


class VoteOut(BaseModel):
    id: uuid.UUID
    meme_id: uuid.UUID
    period_type: CompetitionPeriod
    period_key: str


class StandingContentMeme(BaseModel):
    kind: Literal["meme"]
    meme: MemeOut


class StandingContentContainer(BaseModel):
    kind: Literal["container"]
    container: MemeContainerOut


class StandingEntry(BaseModel):
    rank: int
    content: StandingContentMeme | StandingContentContainer
    vote_count: int


class StandingsPage(BaseModel):
    period_type: CompetitionPeriod
    period_key: str
    is_closed: bool
    items: list[StandingEntry]


class WinnerOut(BaseModel):
    period_type: CompetitionPeriod
    period_key: str
    content: StandingContentMeme | StandingContentContainer | None
    vote_count: int
