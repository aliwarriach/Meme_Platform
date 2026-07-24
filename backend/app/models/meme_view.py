import uuid

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPKMixin


class MemeView(UUIDPKMixin, TimestampMixin, Base):
    """One row per (meme, user) that has ever viewed it — the dedup ledger behind
    `Meme.view_count`. A user can register at most one view per meme, ever (no re-counting
    on repeat visits), mirroring `MemeVote`'s one-row-per-user shape. `Meme.view_count` is a
    denormalized counter incremented only the first time a given user's row is inserted here
    — kept so the scoring atom (services/scoring.py) stays a cheap column read instead of a
    `COUNT(DISTINCT)` aggregation on every score computation.
    """

    __tablename__ = "meme_views"

    meme_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("memes.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )

    __table_args__ = (UniqueConstraint("meme_id", "user_id", name="uq_meme_views_meme_user"),)
