import datetime
import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.models.post_audience import AudienceType
from app.schemas.auth import PublicUserOut


class CommunityBadge(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str


class MemeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    author: PublicUserOut
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


class MemeEditOut(BaseModel):
    """Author-only — the data an edit screen needs to rehydrate itself. Deliberately not
    part of `MemeOut` (which every feed card fetches): `editor_document` can be sizable
    JSON that nobody but the author, mid-edit, has any use for."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    image_url: str
    caption: str | None
    hashtags: list[str]
    # Null for a meme published before this column existed — the edit screen falls back to
    # treating the flattened image as a fresh, layer-less base image in that case.
    editor_document: dict | None


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
