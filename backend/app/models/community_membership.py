import enum
import uuid

from sqlalchemy import ForeignKey, UniqueConstraint
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
    )
