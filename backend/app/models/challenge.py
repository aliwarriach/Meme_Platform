import datetime
import enum
import uuid

from sqlalchemy import DateTime, ForeignKey, ForeignKeyConstraint, String
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPKMixin
from app.models.community import Community


class ChallengeType(str, enum.Enum):
    intra_community = "intra_community"
    community_vs_community = "community_vs_community"


class ChallengeStatus(str, enum.Enum):
    setup = "setup"
    active = "active"
    evaluated = "evaluated"


class Challenge(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "challenges"

    community_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("communities.id", ondelete="CASCADE"), index=True
    )
    # community_vs_community only: the challenged community. Null for intra_community.
    # The proposer's community is `community_id` above in both shapes — for an
    # intra_community challenge that's the (only) community; for a community_vs_community
    # challenge it's the *proposing* community, with `opponent_community_id` as the
    # challenged one, until accepted (status flips setup -> active).
    opponent_community_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("communities.id", ondelete="CASCADE"), index=True, default=None
    )
    creator_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(150))
    challenge_type: Mapped[ChallengeType] = mapped_column(
        SAEnum(ChallengeType, name="challenge_type"), default=ChallengeType.intra_community
    )
    status: Mapped[ChallengeStatus] = mapped_column(
        SAEnum(ChallengeStatus, name="challenge_status"), default=ChallengeStatus.active
    )
    start_time: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True))
    end_time: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True))
    # Circular FK with challenge_sides (challenge_sides.challenge_id -> challenges.id):
    # named + use_alter so SQLAlchemy adds/drops it via a separate ALTER TABLE rather than
    # needing a single unresolvable table-creation/drop order (matches the migration's
    # create_foreign_key done after both tables exist).
    winning_side_id: Mapped[uuid.UUID | None] = mapped_column(default=None)

    community: Mapped[Community] = relationship(lazy="selectin", foreign_keys=[community_id])
    opponent_community: Mapped[Community | None] = relationship(
        lazy="selectin", foreign_keys=[opponent_community_id]
    )
    sides: Mapped[list["ChallengeSide"]] = relationship(
        lazy="selectin", foreign_keys="ChallengeSide.challenge_id", back_populates="challenge"
    )

    __table_args__ = (
        ForeignKeyConstraint(
            ["winning_side_id"],
            ["challenge_sides.id"],
            ondelete="SET NULL",
            use_alter=True,
            name="fk_challenges_winning_side_id_challenge_sides",
        ),
    )
