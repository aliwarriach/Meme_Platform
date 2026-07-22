import enum
import uuid

from sqlalchemy import ForeignKey, String
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPKMixin


class BadgeType(str, enum.Enum):
    challenge_winner = "challenge_winner"


class Badge(UUIDPKMixin, TimestampMixin, Base):
    """An award record on a user's profile. Points + badge, no redeemable-prize system
    (Project_Requirements §10.1) — this table is purely in-app recognition.
    """

    __tablename__ = "badges"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    badge_type: Mapped[BadgeType] = mapped_column(SAEnum(BadgeType, name="badge_type"))
    challenge_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("challenges.id", ondelete="SET NULL"), default=None
    )
    points: Mapped[int] = mapped_column(default=0)
    label: Mapped[str] = mapped_column(String(100), default="")
