"""arq job: the actual Groq call for caption generation, moved off the request path per
backend/CLAUDE.md's directive that LLM calls go through a background task, never inline.
The router (`routers/ai_caption.py`) enqueues this job and awaits its result within the
same request/response cycle — the API contract stays synchronous-feeling for the
frontend (no polling rewrite needed), but execution now runs through arq's durable queue
(retried on worker crash, observable, rate-limitable independently of the API process)
instead of an inline `httpx` call sharing the request's event loop.
"""

from app.integrations.llm_client import generate_caption


async def generate_caption_job(ctx: dict, prompt: str) -> str:
    return await generate_caption(prompt)
