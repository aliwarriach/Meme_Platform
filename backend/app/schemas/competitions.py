from typing import Literal

from pydantic import BaseModel

from app.models.competition_period import CompetitionPeriod
from app.schemas.instagram import MemeContainerOut
from app.schemas.memes import MemeOut


class StandingContentMeme(BaseModel):
    kind: Literal["meme"]
    meme: MemeOut


class StandingContentContainer(BaseModel):
    kind: Literal["container"]
    container: MemeContainerOut


class StandingEntry(BaseModel):
    rank: int
    content: StandingContentMeme | StandingContentContainer
    score: int


class StandingsPage(BaseModel):
    period_type: CompetitionPeriod
    period_key: str
    is_closed: bool
    items: list[StandingEntry]


class WinnerOut(BaseModel):
    period_type: CompetitionPeriod
    period_key: str
    content: StandingContentMeme | StandingContentContainer | None
    score: int
