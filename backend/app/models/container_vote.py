import uuid

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPKMixin
from app.models.vote import CompetitionPeriod


class ContainerVote(UUIDPKMixin, TimestampMixin, Base):
    """Mirrors `Vote`, scoped to `meme_container_id` — a `MemeContainer` is competition-
    eligible (Project_Requirements §9/§13) but never challenge-eligible (enforced at the
    challenge-submission service layer, which only ever accepts a native `Meme`)."""

    __tablename__ = "container_votes"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    meme_container_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("meme_containers.id", ondelete="CASCADE"), index=True
    )
    # Reuses the existing `competition_period_type` Postgres enum (same name as `Vote`'s
    # column) via `create_type=False` — one DB enum type shared by both tables, and
    # Alembic autogenerate won't try to create it a second time.
    period_type: Mapped[CompetitionPeriod] = mapped_column(
        SAEnum(CompetitionPeriod, name="competition_period_type", create_type=False)
    )
    period_key: Mapped[str] = mapped_column(String(16), index=True)

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "meme_container_id",
            "period_type",
            "period_key",
            name="uq_container_votes_user_container_period",
        ),
    )
