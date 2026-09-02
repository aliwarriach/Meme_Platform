import enum
import uuid

from sqlalchemy import ForeignKey, Index, UniqueConstraint
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPKMixin
from app.models.user import User


class MembershipRole(str, enum.Enum):
    owner = "owner"
    member = "member"


class MembershipStatus(str, enum.Enum):
    pending = "pending"
    active = "active"
    # Owner/member-initiated: someone in the community invited this user to join, distinct
    # from `pending` (that user requesting to join themself). The invitee accepts via the same
    # `join_community` call a self-initiated joiner would use (flips invited -> active) or
    # declines via the same `leave_community` call a member would use to leave.
    invited = "invited"


class CommunityMembership(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "community_memberships"

    community_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("communities.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[MembershipRole] = mapped_column(
        SAEnum(MembershipRole, name="membership_role"), default=MembershipRole.member
    )
    status: Mapped[MembershipStatus] = mapped_column(
        SAEnum(MembershipStatus, name="membership_status")
    )

    user: Mapped[User] = relationship(lazy="selectin")

    __table_args__ = (
        UniqueConstraint("community_id", "user_id", name="uq_community_membership_pair"),
        # Every community-scoped access check filters (community_id, user_id, status=active) —
        # this is the single hottest lookup in the app (feed visibility, template access,
        # leaderboards, challenges all call require_active_membership).
        Index("ix_community_memberships_community_user_status", "community_id", "user_id", "status"),
    )
