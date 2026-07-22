import datetime
import uuid

from pydantic import BaseModel, ConfigDict, Field

from app.models.meme_send import MemeSendStatus
from app.schemas.auth import UserOut
from app.schemas.memes import MemeOut


class MemeSendCreate(BaseModel):
    recipient_id: uuid.UUID
    meme_id: uuid.UUID


class MemeSendReactionCreate(BaseModel):
    reaction: str = Field(min_length=1, max_length=8)


class MemeSendOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    sender: UserOut
    recipient: UserOut
    meme: MemeOut
    status: MemeSendStatus
    reaction: str | None
    created_at: datetime.datetime
