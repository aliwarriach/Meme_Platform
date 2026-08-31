from sqlalchemy import String, UniqueConstraint
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPKMixin
from app.models.competition_period import CompetitionPeriod


class CompetitionWinnerNotification(UUIDPKMixin, TimestampMixin, Base):
    """Dedup ledger for the "you won Meme of the Day/Week/Month" notification cron
    (`app/workers/tasks/notifications.py::notify_competition_winners`) — one row per
    (period_type, period_key) ever processed, inserted via `ON CONFLICT DO NOTHING` before
    the winner is resolved/notified, so a later poll (or a second worker) never re-sends
    the same period's result. Mirrors `Challenge.ending_soon_notified_at`'s one-shot-flag
    role, just as its own table since this dedupes across three independent period types
    rather than a single row's own column.
    """

    __tablename__ = "competition_winner_notifications"
    __table_args__ = (
        UniqueConstraint("period_type", "period_key", name="uq_competition_winner_notifications_period"),
    )

    # The Postgres enum `competition_period_type` was dropped entirely when `ContainerVote`
    # was redesigned off period-scoped voting (see `.claude/memory/instagram-companion.md`)
    # — this column creates it fresh, it isn't reusing an existing DB type.
    period_type: Mapped[CompetitionPeriod] = mapped_column(
        SAEnum(CompetitionPeriod, name="competition_period_type")
    )
    period_key: Mapped[str] = mapped_column(String(16))
