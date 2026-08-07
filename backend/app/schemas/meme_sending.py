import datetime
import enum
import uuid

from pydantic import BaseModel, ConfigDict

from app.schemas.auth import UserOut
from app.schemas.memes import MemeOut


class MemeSendStatus(str, enum.Enum):
    """Wire-format only since Phase 19 — there is no `meme_sends` table any more. A send
    is a `meme`-kind `Message`, and `delivered`/`pending` now just report whether the
    recipient had an open socket at send time. `seen` is gone from this shape: read state
    lives on `Message.read_at` and is reported through `/messaging`."""

    delivered = "delivered"
    pending = "pending"


class MemeSendCreate(BaseModel):
    recipient_id: uuid.UUID
    meme_id: uuid.UUID


class MemeSendOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    sender: UserOut
    recipient: UserOut
    meme: MemeOut
    status: MemeSendStatus
    reaction: str | None
    created_at: datetime.datetime
