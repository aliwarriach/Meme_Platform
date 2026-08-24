import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPKMixin

if TYPE_CHECKING:
    # See the matching note in app/models/challenge.py — genuine circular reference,
    # resolved by SQLAlchemy's mapper registry at runtime, not by this import.
    from app.models.challenge import Challenge


class ChallengeSide(UUIDPKMixin, TimestampMixin, Base):
    """A side in a challenge. For `intra_community` challenges this is a team of members
    within the one community. For `community_vs_community` challenges each side *is* one
    whole community (`community_id` set, no individual `ChallengeParticipant` roster —
    every active member of that community may submit).
    """

    __tablename__ = "challenge_sides"

    challenge_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("challenges.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(100))
    community_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("communities.id", ondelete="CASCADE"), default=None
    )

    challenge: Mapped["Challenge"] = relationship(
        lazy="selectin", foreign_keys=[challenge_id], back_populates="sides", overlaps="sides"
    )

    __table_args__ = (
        UniqueConstraint("challenge_id", "name", name="uq_challenge_side_name"),
    )
