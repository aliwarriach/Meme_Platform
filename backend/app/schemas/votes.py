import uuid
from typing import Literal

from pydantic import BaseModel


class VoteCast(BaseModel):
    value: Literal[1, -1]


class VoteOut(BaseModel):
    meme_id: uuid.UUID
    upvote_count: int
    downvote_count: int
    score: int
    viewer_vote: Literal[1, -1] | None


class ContainerVoteOut(BaseModel):
    meme_container_id: uuid.UUID
    upvote_count: int
    downvote_count: int
    score: int
    viewer_vote: Literal[1, -1] | None
