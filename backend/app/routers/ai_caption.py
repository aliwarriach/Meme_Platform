from fastapi import APIRouter, Request

from app.core.deps import CurrentUser
from app.core.rate_limit import limiter
from app.schemas.ai_caption import CaptionGenerateRequest, CaptionSuggestionOut
from app.services import ai_caption as ai_caption_service

router = APIRouter(prefix="/ai-caption", tags=["ai-caption"])


# Each call is a real (billed) Groq API call, so this is capped per-user well below
# what a real "make it funnier" iteration flow would ever need, to bound LLM cost abuse.
@router.post("/generate", response_model=CaptionSuggestionOut)
@limiter.limit("15/minute")
async def generate_caption(
    request: Request, body: CaptionGenerateRequest, current_user: CurrentUser
) -> CaptionSuggestionOut:
    return await ai_caption_service.generate_meme_caption(body.context, body.current_caption)
