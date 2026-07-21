import uuid

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPKMixin
from app.models.user import User


class Template(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "templates"

    uploader_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    # Null = global (public) library. Set = private to that community's members only —
    # never shown in the global list, regardless of the community's open/invite_only privacy.
    community_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("communities.id", ondelete="CASCADE"), index=True, default=None
    )
    name: Mapped[str] = mapped_column(String(100))
    image_url: Mapped[str] = mapped_column(String(1024))
    image_public_id: Mapped[str] = mapped_column(String(255))

    uploader: Mapped[User] = relationship(lazy="selectin")
