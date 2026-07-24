import uuid

from sqlalchemy import CheckConstraint, ForeignKey, SmallInteger, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPKMixin


class ContainerVote(UUIDPKMixin, TimestampMixin, Base):
    """Reddit-style upvote/downvote on a `MemeContainer` — replaces the old like-only
    `ContainerReaction` table entirely (and the old period-based container vote). Mirrors
    `MemeVote`, scoped to `meme_container_id` instead of `meme_id`.
    """

    __tablename__ = "container_votes"

    meme_container_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("meme_containers.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    value: Mapped[int] = mapped_column(SmallInteger)

    __table_args__ = (
        UniqueConstraint(
            "meme_container_id", "user_id", name="uq_container_votes_container_user"
        ),
        CheckConstraint("value IN (-1, 1)", name="ck_container_votes_value"),
    )
