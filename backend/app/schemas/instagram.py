import datetime
import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models.meme_container import ContainerMetadataStatus, ContainerPlatform
from app.schemas.auth import UserOut
from app.schemas.memes import MemeOut


class MemeContainerCreate(BaseModel):
    source_url: str = Field(min_length=1, max_length=2048)


class MemeContainerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    submitter: UserOut
    platform: ContainerPlatform
    source_url: str
    title: str | None
    thumbnail_url: str | None
    metadata_status: ContainerMetadataStatus
    upvote_count: int
    downvote_count: int
    score: int
    comment_count: int
    # Private engagement data — null unless the caller is the submitter. See
    # services/instagram.py::_build_container_out.
    view_count: int | None
    viewer_vote: Literal[1, -1] | None
    created_at: datetime.datetime


class ContainerViewOut(BaseModel):
    meme_container_id: uuid.UUID
    view_count: int


class ContainerCommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=500)


class ContainerCommentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    author: UserOut
    body: str
    created_at: datetime.datetime


class MemeFeedItem(BaseModel):
    kind: Literal["meme"]
    meme: MemeOut


class ContainerFeedItem(BaseModel):
    kind: Literal["container"]
    container: MemeContainerOut


class MergedFeedPage(BaseModel):
    """The public feed's actual response shape: native `Meme`s and `MemeContainer`s
    (externally-shared Reels/posts) merged and sorted together — the two content types
    share one feed by design (confirmed with user), even though they're backed by
    entirely separate tables/reactions/comments/votes under the hood. Ranked by Reddit-
    style Hot score (vote score vs. age), not recency — offset-paginated (`has_more`),
    since Hot score drifts continuously with time and has no stable keyset cursor.
    """

    items: list[MemeFeedItem | ContainerFeedItem]
    has_more: bool
