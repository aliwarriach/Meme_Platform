import datetime
import uuid

from pydantic import BaseModel, ConfigDict

from app.models.community import CommunityPrivacy
from app.models.community_membership import MembershipRole, MembershipStatus
from app.schemas.auth import PublicUserOut


class CommunityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    owner: PublicUserOut
    name: str
    description: str | None
    icon_url: str | None
    icon_preset: str | None
    banner_url: str | None
    privacy: CommunityPrivacy
    member_count: int
    viewer_membership_status: MembershipStatus | None
    has_active_challenge: bool
    created_at: datetime.datetime


class CommunityPage(BaseModel):
    items: list[CommunityOut]
    next_cursor: str | None


class MembershipOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user: PublicUserOut
    role: MembershipRole
    status: MembershipStatus
    created_at: datetime.datetime
