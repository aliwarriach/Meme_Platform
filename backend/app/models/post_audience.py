import enum
import uuid

from sqlalchemy import Enum as SAEnum
from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDPKMixin


class AudienceType(str, enum.Enum):
    public = "public"
    friends = "friends"


class PostAudience(UUIDPKMixin, Base):
    __tablename__ = "post_audiences"

    meme_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("memes.id", ondelete="CASCADE"), index=True
    )
    audience_type: Mapped[AudienceType] = mapped_column(
        SAEnum(AudienceType, name="post_audience_type")
    )

    __table_args__ = (
        UniqueConstraint("meme_id", "audience_type", name="uq_post_audience_meme_type"),
    )
