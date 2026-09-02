import uuid

from pydantic import BaseModel, ConfigDict

from app.schemas.challenges import ChallengeOut


class HashtagOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    slug: str
    display_text: str
    meme_count: int
    # The currently-active challenge reserving this tag, if any (at most one, guaranteed by
    # the partial unique index on `challenges.hashtag_id`).
    active_challenge: ChallengeOut | None = None
    # A challenge on this tag that finished within the last 24h — the tag screen's "Final
    # results" card. Disappears once >24h old.
    recent_result_challenge: ChallengeOut | None = None


class HashtagSuggestion(BaseModel):
    """Autocomplete row. Carries the challenge title so the creator can show
    "enters: Dogs vs Cats" inline instead of making the user guess what the tag does."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    slug: str
    display_text: str
    challenge_id: uuid.UUID | None = None
    challenge_title: str | None = None
