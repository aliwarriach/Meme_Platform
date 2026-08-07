import datetime
import uuid

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.message import MessageKind
from app.schemas.auth import UserOut
from app.schemas.memes import MemeOut

MAX_MESSAGE_LENGTH = 2000


class ConversationCreate(BaseModel):
    user_id: uuid.UUID


class MessageCreate(BaseModel):
    kind: MessageKind = MessageKind.text
    body: str | None = Field(default=None, max_length=MAX_MESSAGE_LENGTH)
    meme_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def _check_payload_matches_kind(self) -> "MessageCreate":
        if self.kind is MessageKind.text:
            if self.meme_id is not None:
                raise ValueError("A text message cannot carry a meme_id")
            body = (self.body or "").strip()
            if not body:
                raise ValueError("A text message needs a non-empty body")
            self.body = body
        else:
            if self.meme_id is None:
                raise ValueError("A meme message needs a meme_id")
            # A meme message is the meme; an accompanying caption would be a second
            # content channel to render, moderate and truncate for no product gain.
            if self.body is not None:
                raise ValueError("A meme message cannot carry a body")
        return self


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    conversation_id: uuid.UUID
    sender: UserOut
    kind: MessageKind
    body: str | None
    # Null on a text message, and also on a meme message whose meme was deleted after
    # the fact — the client renders an unavailable-attachment placeholder for the latter.
    meme: MemeOut | None
    read_at: datetime.datetime | None
    created_at: datetime.datetime


class ConversationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    other_user: UserOut
    last_message: MessageOut | None
    unread_count: int
    last_message_at: datetime.datetime | None


class MessagePage(BaseModel):
    items: list[MessageOut]
    next_cursor: str | None


class ConversationReadOut(BaseModel):
    conversation_id: uuid.UUID
    read_count: int
    read_at: datetime.datetime | None
