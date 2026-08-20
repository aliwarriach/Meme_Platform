import datetime
import uuid

from pydantic import BaseModel, ConfigDict, Field

from app.models.challenge import ChallengeStatus, ChallengeType
from app.schemas.auth import PublicUserOut
from app.schemas.memes import MemeOut


class ChallengeSideSetup(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    member_ids: list[uuid.UUID] = Field(min_length=1)


class ChallengeCreate(BaseModel):
    title: str = Field(min_length=1, max_length=150)
    start_time: datetime.datetime
    end_time: datetime.datetime
    sides: list[ChallengeSideSetup] = Field(min_length=2)


class ChallengeProposalCreate(BaseModel):
    title: str = Field(min_length=1, max_length=150)
    start_time: datetime.datetime
    end_time: datetime.datetime


class OpenChallengeSideSetup(BaseModel):
    """No `member_ids` — an open challenge's sides are filled by self-service join."""

    name: str = Field(min_length=1, max_length=100)


class OpenChallengeCreate(BaseModel):
    title: str = Field(min_length=1, max_length=150)
    # Normalized server-side; a challenge reserves its tag exclusively.
    hashtag: str = Field(min_length=1, max_length=100)
    start_time: datetime.datetime
    end_time: datetime.datetime
    sides: list[OpenChallengeSideSetup] = Field(min_length=2)


class ChallengeJoin(BaseModel):
    side_id: uuid.UUID


class DuelCreate(BaseModel):
    title: str = Field(min_length=1, max_length=150)
    start_time: datetime.datetime
    end_time: datetime.datetime


class ChallengeSideOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    community_id: uuid.UUID | None
    # Always empty for an open challenge — its roster is unbounded, use participant_count.
    member_ids: list[uuid.UUID] = []
    participant_count: int = 0
    score: float | None = None


class ChallengeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    # Both null for an `open` challenge, which belongs to the platform, not a community.
    community_id: uuid.UUID | None
    # Names are included alongside the ids because the cross-community "my challenges" list
    # can't resolve them locally — a challenge there may belong to any community the caller
    # is in. Same rationale as MemeOut's community badge carrying a name.
    community_name: str | None = None
    opponent_community_id: uuid.UUID | None
    opponent_community_name: str | None = None
    # `open` challenges only: the reserved entry tag (normalized slug, no leading '#').
    hashtag: str | None = None
    creator: PublicUserOut
    # `duel` only: the challenged friend. Set from proposal time, before they've accepted
    # (and therefore before any `ChallengeParticipant` row for them exists).
    invitee_id: uuid.UUID | None = None
    invitee: PublicUserOut | None = None
    title: str
    challenge_type: ChallengeType
    status: ChallengeStatus
    start_time: datetime.datetime
    end_time: datetime.datetime
    winning_side_id: uuid.UUID | None
    sides: list[ChallengeSideOut]


class ChallengeSubmissionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    side_id: uuid.UUID
    submitter: PublicUserOut
    meme: MemeOut
    created_at: datetime.datetime


class ChallengeResultsOut(BaseModel):
    challenge: ChallengeOut
    submissions: list[ChallengeSubmissionOut]
