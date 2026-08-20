import datetime
import uuid

from pydantic import BaseModel, ConfigDict, Field

from app.models.friendship import FriendshipStatus
from app.schemas.auth import PublicUserOut


class FriendRequestCreate(BaseModel):
    username: str = Field(min_length=3, max_length=32, pattern=r"^[a-zA-Z0-9_]+$")


class FriendshipOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    status: FriendshipStatus
    requester: PublicUserOut
    addressee: PublicUserOut
    created_at: datetime.datetime


class FriendOut(BaseModel):
    friendship_id: uuid.UUID
    user: PublicUserOut
