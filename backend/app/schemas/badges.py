import datetime
import uuid

from pydantic import BaseModel, ConfigDict

from app.models.badge import BadgeType


class BadgeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    badge_type: BadgeType
    challenge_id: uuid.UUID | None
    points: int
    label: str
    created_at: datetime.datetime
