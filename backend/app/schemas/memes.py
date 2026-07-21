import datetime
import uuid

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
    reaction_count: int
    comment_count: int
    viewer_has_reacted: bool
    created_at: datetime.datetime


class FeedPage(BaseModel):
    items: list[MemeOut]
    next_cursor: str | None
