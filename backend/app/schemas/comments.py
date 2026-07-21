import datetime
import uuid

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.auth import UserOut


class CommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=500)


class CommentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    author: UserOut
    body: str
    created_at: datetime.datetime
