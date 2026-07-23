from pydantic import BaseModel, Field


class CaptionGenerateRequest(BaseModel):
    context: str = Field(..., min_length=1, max_length=300)
    current_caption: str | None = Field(default=None, max_length=500)


class CaptionSuggestionOut(BaseModel):
    caption: str
