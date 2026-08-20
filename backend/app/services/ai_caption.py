"""AI caption generation. The actual Groq call runs as an arq job
(`app/workers/tasks/ai_caption.py::generate_caption_job`) on the separate worker process,
per backend/CLAUDE.md's "background task, never inline in the request/response cycle"
directive — this service enqueues that job and awaits its result within the same request,
so the `POST /ai-caption/generate` contract stays synchronous-feeling for the frontend
(no polling rewrite) while execution moves off the API process's event loop and gains
arq's retry/observability for free. A bounded `job.result(timeout=...)` wait means a dead
or overloaded worker still fails the request cleanly rather than hanging it forever.
"""

from app.core.exceptions import CaptionGenerationFailedError
from app.core.redis import get_arq_pool
from app.schemas.ai_caption import CaptionSuggestionOut

JOB_RESULT_TIMEOUT_SECONDS = 15
# Enforced server-side on the *response*, independent of whether the model actually
# honors the system prompt's "max 100 characters" instruction — see M-4.
MAX_CAPTION_LENGTH = 100


def _build_prompt(context: str, current_caption: str | None) -> str:
    # `context` and `current_caption` are attacker-controlled (any authenticated user).
    # Fencing them in a <user_data> block, and telling the model as much in the system
    # prompt (integrations/llm_client.py), stops a crafted context/caption from being
    # read as an instruction and hijacking the completion (SecurityIssues.md M-4).
    if current_caption:
        return (
            "<user_data>\n"
            f'Meme context: "{context}"\n'
            f'Current caption: "{current_caption}"\n'
            "</user_data>\n"
            "Make the current caption above funnier. Keep it short."
        )
    return (
        "<user_data>\n"
        f'Meme context: "{context}"\n'
        "</user_data>\n"
        "Write a funny caption for the meme context above."
    )


async def generate_meme_caption(context: str, current_caption: str | None) -> CaptionSuggestionOut:
    prompt = _build_prompt(context, current_caption)
    arq_pool = await get_arq_pool()
    job = await arq_pool.enqueue_job("generate_caption_job", prompt)
    try:
        # Catches the re-raised LLMGenerationError from the job body, asyncio.TimeoutError
        # if the worker doesn't finish in time, and ResultNotFound if no worker process is
        # even running to pick the job up — all three must fail the request the same way,
        # per backend/CLAUDE.md's "never let this block or crash the creator flow."
        caption = await job.result(timeout=JOB_RESULT_TIMEOUT_SECONDS)
    except Exception as exc:
        raise CaptionGenerationFailedError(
            "Couldn't generate a caption suggestion right now — try again or write your own."
        ) from exc
    return CaptionSuggestionOut(caption=caption[:MAX_CAPTION_LENGTH])
