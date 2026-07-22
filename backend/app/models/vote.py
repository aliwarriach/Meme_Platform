import enum
import uuid

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPKMixin


class CompetitionPeriod(str, enum.Enum):
    day = "day"
    week = "week"
    month = "month"


class Vote(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "votes"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    meme_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("memes.id", ondelete="CASCADE"), index=True
    )
    period_type: Mapped[CompetitionPeriod] = mapped_column(
        SAEnum(CompetitionPeriod, name="competition_period_type")
    )
    # e.g. "2026-07-22" (day), "2026-W30" (week, ISO), "2026-07" (month) — see
    # services/competitions.py::period_key() for the deterministic derivation.
    period_key: Mapped[str] = mapped_column(String(16), index=True)

    __table_args__ = (
        # Per user, per meme, per period — blocks re-voting the *same* meme twice within a
        # period (matches backend/CLAUDE.md's directive verbatim). Does not cap a user to a
        # single meme per period; a user may cast one vote each for several different memes
        # within the same day/week/month.
        UniqueConstraint(
            "user_id", "meme_id", "period_type", "period_key", name="uq_votes_user_meme_period"
        ),
    )
