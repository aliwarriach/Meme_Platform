import uuid

from pydantic import BaseModel, ConfigDict


class HashtagOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    slug: str
    display_text: str
    meme_count: int
    # Set when an open challenge has reserved this tag — posting with it is how you enter.
    challenge_id: uuid.UUID | None = None


class HashtagSuggestion(BaseModel):
    """Autocomplete row. Carries the challenge title so the creator can show
    "enters: Dogs vs Cats" inline instead of making the user guess what the tag does."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    slug: str
    display_text: str
    challenge_id: uuid.UUID | None = None
    challenge_title: str | None = None
