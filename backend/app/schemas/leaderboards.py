import uuid

from pydantic import BaseModel

from app.schemas.auth import UserOut


class IndividualLeaderboardEntry(BaseModel):
    rank: int
    user: UserOut
    score: int


class IndividualLeaderboardPage(BaseModel):
    items: list[IndividualLeaderboardEntry]
    next_cursor: str | None


class CommunityLeaderboardEntry(BaseModel):
    rank: int
    community_id: uuid.UUID
    community_name: str
    score: int


class CommunityLeaderboardPage(BaseModel):
    items: list[CommunityLeaderboardEntry]
    next_cursor: str | None
