import datetime
import uuid

from pydantic import BaseModel, ConfigDict, Field

from app.models.challenge import ChallengeStatus, ChallengeType
from app.schemas.auth import UserOut
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


class ChallengeSideOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    community_id: uuid.UUID | None
    member_ids: list[uuid.UUID] = []
    score: float | None = None


class ChallengeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    community_id: uuid.UUID
    opponent_community_id: uuid.UUID | None
    creator: UserOut
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
    submitter: UserOut
    meme: MemeOut
    created_at: datetime.datetime


class ChallengeResultsOut(BaseModel):
    challenge: ChallengeOut
    submissions: list[ChallengeSubmissionOut]
