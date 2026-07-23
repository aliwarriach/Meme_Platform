from app.core.exceptions import CaptionGenerationFailedError
from app.integrations.llm_client import LLMGenerationError, generate_caption
from app.schemas.ai_caption import CaptionSuggestionOut


def _build_prompt(context: str, current_caption: str | None) -> str:
    if current_caption:
        return (
            f'Meme context: "{context}"\n'
            f'Current caption: "{current_caption}"\n'
            "Make this caption funnier. Keep it short."
        )
    return f'Meme context: "{context}"\nWrite a funny caption for this meme.'


async def generate_meme_caption(context: str, current_caption: str | None) -> CaptionSuggestionOut:
    prompt = _build_prompt(context, current_caption)
    try:
        caption = await generate_caption(prompt)
    except LLMGenerationError as exc:
        raise CaptionGenerationFailedError(
            "Couldn't generate a caption suggestion right now — try again or write your own."
        ) from exc
    return CaptionSuggestionOut(caption=caption)
