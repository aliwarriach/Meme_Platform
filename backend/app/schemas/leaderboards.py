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


class ProfileScoreOut(BaseModel):
    """A user's lifetime, all-time cumulative MemeScore — the "Snapchat Score" surface,
    distinct from the 30-day-windowed individual leaderboard. Not audience-gated: anyone
    can see anyone's profile score, same as the public individual leaderboard."""

    user: UserOut
    score: int
