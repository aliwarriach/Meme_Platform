import datetime
import uuid

from pydantic import BaseModel, ConfigDict


class ReactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    meme_id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime.datetime
