import uuid

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPKMixin
from app.models.meme import Meme


class ChallengeSubmission(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "challenge_submissions"

    challenge_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("challenges.id", ondelete="CASCADE"), index=True
    )
    side_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("challenge_sides.id", ondelete="CASCADE"), index=True
    )
    submitter_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    meme_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("memes.id", ondelete="CASCADE"))

    meme: Mapped[Meme] = relationship(lazy="selectin")

    __table_args__ = (
        # A given meme can only be submitted to a challenge once (not once per side —
        # a meme belongs to exactly one submitter/side pairing).
        UniqueConstraint("challenge_id", "meme_id", name="uq_challenge_submission_meme"),
    )
