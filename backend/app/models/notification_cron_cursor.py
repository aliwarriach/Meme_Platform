import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class NotificationCronCursor(Base):
    """One row per recurring (non-one-shot) notification cron job, tracking how far it has
    already processed — unlike `Challenge.ending_soon_notified_at` (a one-shot flag on a
    single row), a batching job like `notify_batched_meme_upvotes` sweeps a moving window
    of *many* rows each run and needs its own bookmark rather than one per swept row.
    """

    __tablename__ = "notification_cron_cursors"

    job_name: Mapped[str] = mapped_column(String(64), primary_key=True)
    last_run_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True))
