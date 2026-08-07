import datetime
import uuid

from sqlalchemy import DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPKMixin
from app.models.user import User


class Conversation(UUIDPKMixin, TimestampMixin, Base):
    """A 1:1 thread between two accepted friends.

    Participants are two columns rather than a join table because every conversation in
    this product is pairwise — the accepted-friendship gate that guards messaging is
    itself pairwise, so there is no group shape to model. That keeps "find the thread
    between A and B" a single indexed lookup and lets a DB unique constraint (not
    application code racing itself) guarantee a pair can only ever have one thread.

    `user_a_id` always holds the lexicographically smaller UUID (see
    `services/messaging.py::_canonical_pair`) so the pair is stored identically no matter
    which side opens the conversation — without that, the unique constraint would happily
    accept both (A, B) and (B, A).
    """

    __tablename__ = "conversations"
    __table_args__ = (UniqueConstraint("user_a_id", "user_b_id", name="uq_conversation_pair"),)

    user_a_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    user_b_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    # Denormalised from the newest message so the conversation list can order by recency
    # without a correlated MAX(messages.created_at) per row. Null until the first message.
    last_message_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), default=None, index=True
    )

    user_a: Mapped[User] = relationship(foreign_keys=[user_a_id], lazy="selectin")
    user_b: Mapped[User] = relationship(foreign_keys=[user_b_id], lazy="selectin")

    def other_participant(self, viewer_id: uuid.UUID) -> User:
        return self.user_b if self.user_a_id == viewer_id else self.user_a

    def includes(self, user_id: uuid.UUID) -> bool:
        return user_id in (self.user_a_id, self.user_b_id)
