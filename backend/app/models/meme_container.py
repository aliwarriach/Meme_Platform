import enum
import uuid

from sqlalchemy import ForeignKey, String
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPKMixin
from app.models.user import User


class ContainerPlatform(str, enum.Enum):
    instagram = "instagram"


class ContainerMetadataStatus(str, enum.Enum):
    pending = "pending"
    ready = "ready"
    failed = "failed"


class MemeContainer(UUIDPKMixin, TimestampMixin, Base):
    """Wraps an external Reel/post (Project_Requirements §13) — never re-hosts the source
    video, just a link + oEmbed-derived metadata + its own independent reactions/comments/
    votes. Native uploads (`Meme`) are never wrapped in this; only externally-shared
    content is (confirmed with user — see `.claude/memory/instagram-companion.md`).
    """

    __tablename__ = "meme_containers"

    submitter_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    platform: Mapped[ContainerPlatform] = mapped_column(
        SAEnum(ContainerPlatform, name="container_platform")
    )
    source_url: Mapped[str] = mapped_column(String(2048))
    title: Mapped[str | None] = mapped_column(String(300), default=None)
    thumbnail_url: Mapped[str | None] = mapped_column(String(1024), default=None)
    metadata_status: Mapped[ContainerMetadataStatus] = mapped_column(
        SAEnum(ContainerMetadataStatus, name="container_metadata_status"),
        default=ContainerMetadataStatus.pending,
    )

    submitter: Mapped[User] = relationship(lazy="selectin")
