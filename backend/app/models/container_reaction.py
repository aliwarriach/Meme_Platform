import uuid

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPKMixin


class ContainerReaction(UUIDPKMixin, TimestampMixin, Base):
    """Mirrors `Reaction`, scoped to `meme_container_id` instead of `meme_id` — kept as a
    separate table rather than a polymorphic/nullable FK on `Reaction`, so native-meme
    reaction queries (feed, scoring, leaderboards) never need a container-aware branch.
    """

    __tablename__ = "container_reactions"

    meme_container_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("meme_containers.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )

    __table_args__ = (
        UniqueConstraint(
            "meme_container_id", "user_id", name="uq_container_reactions_container_user"
        ),
    )
