import datetime
import uuid

from pydantic import BaseModel, ConfigDict, Field

from app.models.notification import NotificationType


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    type: NotificationType
    title: str
    body: str
    data: dict
    read_at: datetime.datetime | None
    created_at: datetime.datetime


class NotificationPage(BaseModel):
    items: list[NotificationOut]
    next_cursor: str | None


class UnreadCountOut(BaseModel):
    count: int


class MarkAllReadOut(BaseModel):
    read_count: int


class PushTokenRegister(BaseModel):
    token: str = Field(min_length=1, max_length=255)
    platform: str = Field(min_length=1, max_length=16)
