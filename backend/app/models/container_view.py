import uuid

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPKMixin


class ContainerView(UUIDPKMixin, TimestampMixin, Base):
    """Mirrors `MemeView`, scoped to `meme_container_id` — see `MemeView` for why this is a
    dedup ledger rather than just incrementing `MemeContainer.view_count` directly."""

    __tablename__ = "container_views"

    meme_container_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("meme_containers.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )

    __table_args__ = (
        UniqueConstraint("meme_container_id", "user_id", name="uq_container_views_container_user"),
    )
