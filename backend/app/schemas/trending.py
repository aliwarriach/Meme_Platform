import datetime
import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.models.challenge import ChallengeStatus


class TrendingChallengeRef(BaseModel):
    """Minimal challenge reference for a trending row — not a full `ChallengeOut`, since
    the trending list is a single globally-cached page and has no one viewer to build a
    `viewer_side_id` against."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    end_time: datetime.datetime
    status: ChallengeStatus


class TrendingHashtagOut(BaseModel):
    slug: str
    display_text: str
    meme_count_24h: int
    author_count_24h: int
    # Which bucket produced this row, so the client never mislabels a cold-start backfill
    # item as genuinely "trending" (Roadmap_Search.md S2 step 3).
    reason: Literal["trending", "live_challenge", "popular"]
    challenge: TrendingChallengeRef | None = None


class TrendingResponse(BaseModel):
    items: list[TrendingHashtagOut]
    # This is cached, cron-refreshed data — the client can say "as of a few minutes ago"
    # rather than implying it's live.
    generated_at: datetime.datetime
