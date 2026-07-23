# ai-caption

## Status
Done (Phase 13 backend + frontend built). Backend fully tested against real Postgres (134/134 pytest total, 9 new: 5 in `test_ai_caption.py`, 4 in `test_llm_client.py` exercising the retry/timeout/4xx-no-retry logic directly). Frontend type-checks/lints/exports clean (`tsc`, `expo lint`, `expo export --platform web` — 17 routes, unchanged). No human tap-through yet.

## Models
None. Stateless request/response — no caption history is persisted (not in scope per `Project_Requirements.md`; the client holds the current draft caption in its own form state, same as any other creator field).

## Endpoints
- `POST /ai-caption/generate` — auth: yes (Bearer) — request `{context: string, current_caption?: string}` → `200` `{caption: string}`. `current_caption` omitted/null → first-draft generation; present → "make it funnier" iteration on that exact text. `502` (`CaptionGenerationFailedError`) if the LLM provider call ultimately fails — a normal, expected response the client must handle, not a crash.

## Business rules
- **No background task queue used** — unlike the `backend/CLAUDE.md`/timeline wording ("background task with timeout/retry"), this is a synchronous HTTP call from within the request (`integrations/llm_client.py::generate_caption`, `httpx.AsyncClient`, natively async — no thread offload needed unlike Cloudinary's SDK) with an 8s timeout + 1 retry on timeout/network/5xx (not on 4xx — bad request/auth won't fix itself on retry). Rationale: the "must never block publish" requirement is satisfied by this being a **separate, optional endpoint the client calls before publish**, never invoked as part of the publish transaction itself — publish always succeeds/fails independent of caption generation. A true fire-and-forget background task doesn't fit here since the whole point is the client is actively waiting for a suggestion to show in the UI.
- Groq's OpenAI-compatible `/openai/v1/chat/completions` endpoint is called directly via `httpx` (already a repo dependency) — no Groq/OpenAI SDK added, since raw REST is trivial for a single chat-completion call and avoids a new dependency.
- Model: `llama-3.1-8b-instant` (`GROQ_MODEL` env var, defaults to this) — chosen explicitly for lowest token cost + highest throughput/rate limits among Groq's catalog, since caption suggestions are short and don't need a larger model's reasoning depth. User confirmed Groq as provider (only option with no key already in `.env`); key added directly to `backend/.env` (gitignored, never committed).
- 4xx from Groq (bad request, invalid key) raises immediately without consuming the retry — only transient failures (timeout, connection error, 5xx) get one retry attempt.

## Frontend integration notes
- `services/aiCaption.ts` (`generateCaptionRequest`) + `services/useAiCaption.ts` (`useGenerateCaptionMutation`, TanStack Query mutation — no query cache to invalidate, this isn't server-owned list data).
- Wired into the **existing** `features/creator/CreatorScreen.tsx`'s caption step (no new screen/route) — a "✨ Generate a caption" / "✨ Make it funnier" button (label switches based on whether `caption` already has text) sits directly below the caption `TextField`. `context` sent to the backend is derived from the overlay's top/bottom text (`topText`/`bottomText` joined), falling back to `"a meme image"` if both are empty. On success, `setValue('caption', ...)` fills the form field — the user can still hand-edit or ignore the suggestion before publishing.
- **Publish is structurally decoupled from caption generation** — `onGenerateCaption`/`generateCaption.mutateAsync` and `onSubmit`/`activeMutation.mutateAsync` are two independent handlers on two independent mutations; a caption-generation failure only sets `generateCaption.isError` (shown inline, does not disable or block the Publish button in any way). This is what satisfies the phase's exit test ("creator still lets the user publish manually rather than hanging or crashing" on a provider failure).
- No new Redux slice — caption iteration is transient mutation state (`generateCaption.isPending`/`isError`) plus the existing React Hook Form `caption` field, consistent with "promote to Redux only on 2nd cross-component consumer."

## Gotchas
- None hit this phase.

## Key files
- backend: `app/integrations/llm_client.py`, `app/services/ai_caption.py`, `app/schemas/ai_caption.py`, `app/routers/ai_caption.py`, `app/core/config.py` (`groq_api_key`/`groq_model`), `app/core/exceptions.py` (`CaptionGenerationFailedError`), `app/main.py` (router registration).
- frontend: `src/services/aiCaption.ts`, `src/services/useAiCaption.ts`, `src/features/creator/CreatorScreen.tsx` (caption-generation button + handler).

## Tests
- `backend/tests/test_ai_caption.py` (5 tests): auth-required, first-draft generation, "make it funnier" iteration (asserts `current_caption` is passed through), provider-failure returns `502` not a hang/crash, empty `context` rejected (`422`) — all mock `services.ai_caption.generate_meme_caption` (patched where imported).
- `backend/tests/test_llm_client.py` (4 tests, mocks `httpx.AsyncClient.post` directly — no network): success path (content trimmed), retry-then-succeed on a timeout, retry exhaustion raises `LLMGenerationError`, 4xx fails fast with no retry attempt (asserts call count == 1).
