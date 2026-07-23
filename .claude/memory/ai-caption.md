# ai-caption

## Status
Done (Phase 13 backend + frontend built). Backend fully tested against real Postgres (134/134 pytest total, 9 new: 5 in `test_ai_caption.py`, 4 in `test_llm_client.py` exercising the retry/timeout/4xx-no-retry logic directly). Frontend type-checks/lints/exports clean (`tsc`, `expo lint`, `expo export --platform web` — 17 routes, unchanged). No human tap-through yet. **Post-Phase-16 update**: the actual Groq call now runs as a real background job (arq), not inline — see Business rules and [[redis-arq-infra]]. The `POST /ai-caption/generate` contract and frontend are unchanged.

## Models
None. Stateless request/response — no caption history is persisted (not in scope per `Project_Requirements.md`; the client holds the current draft caption in its own form state, same as any other creator field).

## Endpoints
- `POST /ai-caption/generate` — auth: yes (Bearer) — request `{context: string, current_caption?: string}` → `200` `{caption: string}`. `current_caption` omitted/null → first-draft generation; present → "make it funnier" iteration on that exact text. `502` (`CaptionGenerationFailedError`) if the LLM provider call ultimately fails — a normal, expected response the client must handle, not a crash.

## Business rules
- **Post-Phase-16: now a real arq background job**, closing the original gap against `backend/CLAUDE.md`'s "background task with timeout/retry" wording. `services/ai_caption.py::generate_meme_caption` enqueues `app/workers/tasks/ai_caption.py::generate_caption_job` (which just calls the unchanged `integrations/llm_client.py::generate_caption`) and awaits the job's result with a 15s bound (`job.result(timeout=JOB_RESULT_TIMEOUT_SECONDS)`) — see [[redis-arq-infra]] for why "await the result in the same request" was chosen over a job-id-plus-polling API (keeps the frontend contract synchronous-feeling, no UI rewrite). `integrations/llm_client.py`'s own 8s timeout + 1 retry logic is unchanged — that's still the layer that talks to Groq; arq just moves *where* that call executes (a separate worker process) and adds a second, outer bound (the 15s job-result wait) so a dead/overloaded worker still fails the request cleanly instead of hanging it.
- The original rationale for "must never block publish" is unchanged and still correct: this is a separate, optional endpoint the client calls before publish, never part of the publish transaction — publish always succeeds/fails independent of caption generation, regardless of which execution model backs caption generation itself.
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
- **Post-Phase-16**: in tests, `get_arq_pool` is monkeypatched to a `FakeArqPool` (see `tests/fake_arq.py`/`tests/conftest.py`) that runs `generate_caption_job` inline rather than enqueueing to a real worker — `test_ai_caption.py`'s existing tests mock `services.ai_caption.generate_meme_caption` directly, so they never touch this path anyway, but any *new* test hitting the real service function needs the fake pool (already autouse, no per-test setup needed).

## Key files
- backend: `app/integrations/llm_client.py`, `app/services/ai_caption.py`, `app/workers/tasks/ai_caption.py` (post-Phase-16), `app/schemas/ai_caption.py`, `app/routers/ai_caption.py`, `app/core/config.py` (`groq_api_key`/`groq_model`), `app/core/exceptions.py` (`CaptionGenerationFailedError`), `app/main.py` (router registration).
- frontend: `src/services/aiCaption.ts`, `src/services/useAiCaption.ts`, `src/features/creator/CreatorScreen.tsx` (caption-generation button + handler).

## Tests
- `backend/tests/test_ai_caption.py` (5 tests): auth-required, first-draft generation, "make it funnier" iteration (asserts `current_caption` is passed through), provider-failure returns `502` not a hang/crash, empty `context` rejected (`422`) — all mock `services.ai_caption.generate_meme_caption` (patched where imported).
- `backend/tests/test_llm_client.py` (4 tests, mocks `httpx.AsyncClient.post` directly — no network): success path (content trimmed), retry-then-succeed on a timeout, retry exhaustion raises `LLMGenerationError`, 4xx fails fast with no retry attempt (asserts call count == 1).
