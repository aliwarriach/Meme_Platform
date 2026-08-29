from typing import Literal

from pydantic import BaseModel

from app.models.competition_period import CompetitionPeriod
from app.schemas.instagram import MemeContainerOut
from app.schemas.memes import MemeOut


class StandingContentMeme(BaseModel):
    kind: Literal["meme"]
    # Null when the meme was deleted after already deciding a *closed* period's winner —
    # its score/rank still stand (a deletion never rewrites who actually won), but its
    # content is gone (the Cloudinary asset is cleaned up on delete, so there's nothing
    # live to show) and `is_deleted` tells the client to render "Deleted Post" and disable
    # the click-through instead of a broken image. Never null for a *live* period's
    # standings — a deleted meme is excluded from those entirely (see services/competitions.py).
    meme: MemeOut | None
    is_deleted: bool = False


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
