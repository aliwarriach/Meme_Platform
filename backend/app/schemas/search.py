import enum
from typing import Generic, TypeVar

from pydantic import BaseModel

from app.schemas.challenges import ChallengeOut
from app.schemas.communities import CommunityOut
from app.schemas.auth import PublicUserOut
from app.schemas.hashtags import HashtagSuggestion
from app.schemas.memes import MemeOut


class SearchScope(str, enum.Enum):
    all = "all"
    challenges = "challenges"
    posts = "posts"
    people = "people"
    communities = "communities"
    tags = "tags"


ItemT = TypeVar("ItemT", bound=BaseModel)


class SearchSection(BaseModel, Generic[ItemT]):
    items: list[ItemT]
    # Not an exact total — capped at PREVIEW_LIMIT for a `scope=all` request so the chip
    # counts never cost five `COUNT(*)` queries. `capped=True` means the real count may be
    # higher; the UI renders "10+" rather than a wrong exact number in that case.
    count: int
    capped: bool
    has_more: bool


class SearchAllOut(BaseModel):
    challenges: SearchSection[ChallengeOut]
    posts: SearchSection[MemeOut]
    people: SearchSection[PublicUserOut]
    communities: SearchSection[CommunityOut]
    tags: SearchSection[HashtagSuggestion]
