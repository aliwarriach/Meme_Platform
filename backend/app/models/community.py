import enum
import uuid

from sqlalchemy import ForeignKey, String
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPKMixin
from app.models.user import User


class CommunityPrivacy(str, enum.Enum):
    open = "open"
    invite_only = "invite_only"


class Community(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "communities"

    owner_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(String(500), default=None)
    icon_url: Mapped[str | None] = mapped_column(String(1024), default=None)
    icon_public_id: Mapped[str | None] = mapped_column(String(255), default=None)
    banner_url: Mapped[str | None] = mapped_column(String(1024), default=None)
    banner_public_id: Mapped[str | None] = mapped_column(String(255), default=None)
    privacy: Mapped[CommunityPrivacy] = mapped_column(
        SAEnum(CommunityPrivacy, name="community_privacy")
    )

    owner: Mapped[User] = relationship(lazy="selectin")
