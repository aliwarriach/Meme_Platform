import uuid

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPKMixin
from app.models.user import User


class ChallengeParticipant(UUIDPKMixin, TimestampMixin, Base):
    """A community member assigned to a side, `intra_community` challenges only — a
    `community_vs_community` challenge has no participant rows, since every active member
    of the participating community is implicitly eligible to submit for their community's
    side (see `services/challenges.py::_eligible_side_for_submission`).
    """

    __tablename__ = "challenge_participants"

    challenge_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("challenges.id", ondelete="CASCADE"), index=True
    )
    side_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("challenge_sides.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))

    user: Mapped[User] = relationship(lazy="selectin")

    __table_args__ = (
        # A member can only be on one side of a given challenge.
        UniqueConstraint("challenge_id", "user_id", name="uq_challenge_participant_user"),
    )
