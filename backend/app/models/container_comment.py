import uuid

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPKMixin
from app.models.user import User


class ContainerComment(UUIDPKMixin, TimestampMixin, Base):
    """Mirrors `Comment`, scoped to `meme_container_id` — see `ContainerReaction` for why
    this is a parallel table rather than a shared/polymorphic one."""

    __tablename__ = "container_comments"

    meme_container_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("meme_containers.id", ondelete="CASCADE"), index=True
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    body: Mapped[str] = mapped_column(String(500))

    author: Mapped[User] = relationship(lazy="selectin")
