import uuid

from sqlalchemy import ForeignKey, String
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

    author: Mapped[User] = relationship(lazy="selectin")
    audiences: Mapped[list[PostAudience]] = relationship(lazy="selectin")
