import logging

import httpx

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
REQUEST_TIMEOUT_SECONDS = 8.0
# Expo caps a single push request at 100 messages.
BATCH_SIZE = 100

logger = logging.getLogger(__name__)


async def send_push_notifications(
    tokens: list[str], title: str, body: str, data: dict
) -> None:
    """Fire-and-forget batched send to Expo's push API. Raw `httpx` call rather than a
    dedicated SDK dependency — same precedent as `integrations/llm_client.py`'s call to
    Groq. Basic sends don't need an access token.

    Never raises: a flaky push provider must not fail the arq job or bubble into the
    request/response cycle that triggered it (backend/CLAUDE.md — push notifications are
    background, best-effort work). Failures are logged only.
    """
    if not tokens:
        return

    messages = [
        {"to": token, "title": title, "body": body, "data": data, "sound": "default"}
        for token in tokens
    ]

    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS) as client:
        for i in range(0, len(messages), BATCH_SIZE):
            batch = messages[i : i + BATCH_SIZE]
            try:
                response = await client.post(
                    EXPO_PUSH_URL,
                    json=batch,
                    headers={"Content-Type": "application/json", "Accept": "application/json"},
                )
                response.raise_for_status()
            except httpx.HTTPError:
                logger.exception("Expo push batch failed (%d tokens)", len(batch))
