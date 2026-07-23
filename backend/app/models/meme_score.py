import uuid

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class MemeScore(Base, TimestampMixin):
    """Stored, periodically-recomputed cache of `services/scoring.py::meme_score_expr()`
    for one meme — read by leaderboards instead of live-aggregating reactions/comments on
    every request. `meme_id` is the primary key (1:1 with `Meme`, not a separate UUID PK)
    since a row only ever exists to cache that one meme's score; `updated_at` (from
    TimestampMixin) doubles as "when was this last recomputed" for staleness checks.
    """

    __tablename__ = "meme_scores"

    meme_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("memes.id", ondelete="CASCADE"), primary_key=True
    )
    score: Mapped[int] = mapped_column(default=0)
