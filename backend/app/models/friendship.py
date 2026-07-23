import enum
import uuid

from sqlalchemy import CheckConstraint, Computed, ForeignKey, Index, Uuid, UniqueConstraint
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPKMixin
from app.models.user import User


class FriendshipStatus(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"


class Friendship(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "friendships"

    requester_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    addressee_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    status: Mapped[FriendshipStatus] = mapped_column(
        SAEnum(FriendshipStatus, name="friendship_status"), default=FriendshipStatus.pending
    )
    # Order-independent pair columns so a unique index can block a request in either
    # direction while an existing row (pending or accepted) is still in place.
    user_low: Mapped[uuid.UUID] = mapped_column(
        Uuid(), Computed("LEAST(requester_id, addressee_id)", persisted=True)
    )
    user_high: Mapped[uuid.UUID] = mapped_column(
        Uuid(), Computed("GREATEST(requester_id, addressee_id)", persisted=True)
    )

    requester: Mapped[User] = relationship(foreign_keys=[requester_id], lazy="selectin")
    addressee: Mapped[User] = relationship(foreign_keys=[addressee_id], lazy="selectin")

    __table_args__ = (
        UniqueConstraint("user_low", "user_high", name="uq_friendships_pair"),
        CheckConstraint("requester_id <> addressee_id", name="ck_friendships_not_self"),
        # The feed visibility clause's friend-of-author check runs as two correlated EXISTS
        # subqueries per candidate meme, each filtering (requester_id/addressee_id, status).
        Index("ix_friendships_requester_status", "requester_id", "status"),
        Index("ix_friendships_addressee_status", "addressee_id", "status"),
    )
