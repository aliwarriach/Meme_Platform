import uuid

from sqlalchemy import CheckConstraint, ForeignKey, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPKMixin
from app.models.user import User


class Block(UUIDPKMixin, TimestampMixin, Base):
    """One-directional: `blocker_id` blocked `blocked_id`. Unlike `Friendship`, blocking is
    never mutual by construction — each side blocking the other is two separate rows.
    See SecurityFeatures.md F-5 (item 1)."""

    __tablename__ = "blocks"

    blocker_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    blocked_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))

    blocked: Mapped[User] = relationship(foreign_keys=[blocked_id], lazy="selectin")

    __table_args__ = (
        # Covers forward-direction lookups ("does A block B") as a leftmost-prefix match
        # too, so no separate index on `blocker_id` alone is needed.
        UniqueConstraint("blocker_id", "blocked_id", name="uq_blocks_blocker_blocked"),
        CheckConstraint("blocker_id <> blocked_id", name="ck_blocks_not_self"),
        # `services/blocks.py::is_blocked` checks both directions with two correlated
        # EXISTS subqueries per candidate row (feed visibility, friend-request, messaging) —
        # this covers the reverse direction ("does B block A").
        Index("ix_blocks_blocked_blocker", "blocked_id", "blocker_id"),
    )
