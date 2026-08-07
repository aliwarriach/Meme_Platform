import datetime
import enum
import uuid

from sqlalchemy import DateTime, ForeignKey, ForeignKeyConstraint, String
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPKMixin
from app.models.community import Community
from app.models.hashtag import Hashtag


class ChallengeType(str, enum.Enum):
    intra_community = "intra_community"
    community_vs_community = "community_vs_community"
    # Platform-level, no community at all: anyone can create one, anyone can join a side,
    # and entry is by posting with the challenge's reserved hashtag. `community_id` and
    # `opponent_community_id` are both null for this shape.
    open = "open"
    # 1v1 friend challenge, no community. Reuses the same participant-roster scoring path
    # as `intra_community` (see services/challenges.py) — the only genuinely new behaviour
    # is the propose/accept/decline flow, gated on `invitee_id` rather than an owner.
    duel = "duel"


class ChallengeStatus(str, enum.Enum):
    setup = "setup"
    active = "active"
    evaluated = "evaluated"


class Challenge(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "challenges"

    # Null only for `open` challenges, which belong to the platform rather than to any
    # community. Both community-scoped shapes always set it.
    community_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("communities.id", ondelete="CASCADE"), index=True, default=None
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
    # `open` challenges only: the tag that enters a meme into this challenge. Unique, so a
    # tag can only ever be reserved by one challenge — no squatting an active competition.
    hashtag_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("hashtags.id", ondelete="RESTRICT"), unique=True, index=True, default=None
    )
    # `duel` only: the challenged friend, set at proposal time. Needed because a duel has no
    # `ChallengeParticipant` row for the invitee until they accept — without this column
    # there'd be no way to gate/show a pending duel to the person who needs to respond.
    invitee_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, default=None
    )
    # Live-leader tracking for the "side overtaken" notification (arq cron, Phase 21) —
    # updated on every recompute, compared against the new leader to detect a real change.
    # Circular with challenge_sides just like `winning_side_id` (see below) — same
    # named + use_alter treatment required, plain `ForeignKey` isn't enough.
    leading_side_id: Mapped[uuid.UUID | None] = mapped_column(default=None)
    # One-shot dedupe flag for the "ending in 1h" notification cron — set the first time a
    # challenge is seen inside that window so it isn't re-sent every poll.
    ending_soon_notified_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), default=None
    )

    community: Mapped[Community | None] = relationship(
        lazy="selectin", foreign_keys=[community_id]
    )
    hashtag: Mapped["Hashtag | None"] = relationship(lazy="selectin")
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
        ForeignKeyConstraint(
            ["leading_side_id"],
            ["challenge_sides.id"],
            ondelete="SET NULL",
            use_alter=True,
            name="fk_challenges_leading_side_id_challenge_sides",
        ),
    )
