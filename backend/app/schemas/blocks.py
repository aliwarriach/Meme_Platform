import datetime
import uuid

from pydantic import BaseModel, ConfigDict

from app.schemas.auth import PublicUserOut


class BlockCreate(BaseModel):
    user_id: uuid.UUID


class BlockOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    blocked: PublicUserOut
    created_at: datetime.datetime
