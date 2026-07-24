import datetime
import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.models.post_audience import AudienceType
from app.schemas.auth import UserOut


class CommunityBadge(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str


class MemeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    author: UserOut
    image_url: str
    caption: str | None
    audiences: list[AudienceType]
    community: CommunityBadge | None
    upvote_count: int
    downvote_count: int
    score: int
    comment_count: int
    # Private engagement data — null unless the caller is authorized to see it (the meme's
    # author, or a community post's community owner). See services/memes.py::build_meme_out.
    view_count: int | None
    viewer_vote: Literal[1, -1] | None
    created_at: datetime.datetime


class MemeViewOut(BaseModel):
    meme_id: uuid.UUID
    view_count: int


class FeedPage(BaseModel):
    items: list[MemeOut]
    next_cursor: str | None


class HotFeedPage(BaseModel):
    """Main-feed page shape for Hot-ranked results — offset-paginated (`has_more`),
    not keyset (`next_cursor`), since Hot score drifts continuously with time and has
    no stable cursor to page against. Community feeds (`FeedPage` above) still rank by
    recency and keep keyset pagination.
    """

    items: list[MemeOut]
    has_more: bool
