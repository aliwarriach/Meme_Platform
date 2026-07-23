import datetime
import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models.meme_container import ContainerMetadataStatus, ContainerPlatform
from app.models.vote import CompetitionPeriod
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
    reaction_count: int
    comment_count: int
    viewer_has_reacted: bool
    created_at: datetime.datetime


class ContainerReactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    meme_container_id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime.datetime


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


class ContainerVoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    meme_container_id: uuid.UUID
    period_type: CompetitionPeriod
    period_key: str


class MergedFeedPage(BaseModel):
    """The public feed's actual response shape: native `Meme`s and `MemeContainer`s
    (externally-shared Reels/posts) merged and sorted together by recency — the two
    content types share one feed by design (confirmed with user), even though they're
    backed by entirely separate tables/reactions/comments/votes under the hood.
    """

    items: list[MemeFeedItem | ContainerFeedItem]
    next_cursor: str | None
