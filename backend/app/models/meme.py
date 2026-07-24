import uuid

from sqlalchemy import ForeignKey, Index, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPKMixin
from app.models.post_audience import PostAudience
from app.models.user import User


class Meme(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "memes"

    author_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    image_url: Mapped[str] = mapped_column(String(1024))
    image_public_id: Mapped[str] = mapped_column(String(255))
    caption: Mapped[str | None] = mapped_column(String(500), default=None)
    # Impression counter — the "reach" spine of the scoring atom (see services/scoring.py).
    # Incremented via POST /memes/{id}/views; no per-view timestamps (a plain counter, not a
    # dedup'd view-event log) — deliberate low-abuse-cost tradeoff for a new platform.
    view_count: Mapped[int] = mapped_column(default=0, server_default=text("0"))

    author: Mapped[User] = relationship(lazy="selectin")
    audiences: Mapped[list[PostAudience]] = relationship(lazy="selectin")

    __table_args__ = (
        # Feed/community-feed queries always order by (created_at desc, id desc) for
        # keyset pagination — composite covers both the sort and the cursor comparison.
        Index("ix_memes_created_at_id", "created_at", "id"),
    )
