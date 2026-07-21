import datetime
import uuid

from pydantic import BaseModel, ConfigDict

from app.schemas.auth import UserOut


class TemplateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    uploader: UserOut
    community_id: uuid.UUID | None
    name: str
    image_url: str
    created_at: datetime.datetime


class TemplatePage(BaseModel):
    items: list[TemplateOut]
    next_cursor: str | None
