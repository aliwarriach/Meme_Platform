import enum
import uuid

from sqlalchemy import CheckConstraint, Index, text
from sqlalchemy import Enum as SAEnum
from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDPKMixin
from app.models.community import Community


class AudienceType(str, enum.Enum):
    public = "public"
    friends = "friends"
    community = "community"


class PostAudience(UUIDPKMixin, Base):
    __tablename__ = "post_audiences"

    meme_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("memes.id", ondelete="CASCADE"), index=True
    )
    audience_type: Mapped[AudienceType] = mapped_column(
        SAEnum(AudienceType, name="post_audience_type")
    )
    # Set only when audience_type == community — a meme can target more than one
    # community at once, so (unlike public/friends) this is a per-row value, not a
    # meme-level singleton. Null for public/friends rows.
    community_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("communities.id", ondelete="CASCADE"), index=True, default=None
    )

    # Only populated on community rows — used to surface the community's name on
    # feed cards ("posted in <Community>") without a separate lookup.
    community: Mapped[Community | None] = relationship(lazy="selectin")

    __table_args__ = (
        # public/friends: at most one row per meme per type.
        Index(
            "uq_post_audience_public_friends",
            "meme_id",
            "audience_type",
            unique=True,
            postgresql_where=text("audience_type != 'community'"),
        ),
        # community: at most one row per meme per target community (many allowed per meme).
        Index(
            "uq_post_audience_community",
            "meme_id",
            "community_id",
            unique=True,
            postgresql_where=text("audience_type = 'community'"),
        ),
        CheckConstraint(
            "(audience_type = 'community') = (community_id IS NOT NULL)",
            name="ck_post_audience_community_id_presence",
        ),
    )
