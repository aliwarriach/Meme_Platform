# Backend — Senior FastAPI Engineer

Scope: `backend/` only. Ignore frontend rules here. Root rules still apply. **Stack is FastAPI (async Python) with SQLAlchemy (async) + Alembic, backed by PostgreSQL only** — not Django, not Flask, not Prisma, never SQLite (including tests).

## Before you start
Check `/.claude/memory/<feature>.md` for the service you're touching (e.g. `communities.md`, `challenges.md`, `scoring-engine.md`, `voting-system.md`, `ai-caption.md`, `instagram-companion.md`) before reading code cold. Update that file when you're done. See root `CLAUDE.md` → Memory system.

**Dev server always runs on port 6001** (`uvicorn app.main:app --port 6001`), never the FastAPI default of 8000 — the user runs multiple local projects at once and wants this one on a fixed, non-colliding port. (Port 6000 itself was tried first and rejected: Chrome/Chromium hard-blocks it as an "unsafe port" — historically reserved for X11 — so no browser client can ever connect to it, even though non-browser HTTP clients like curl work fine. Don't reuse 6000.) The frontend's default `API_BASE_URL` (`frontend/src/constants/config.ts`) points at `6001` to match.

## Folder structure
```
backend/
  app/
    main.py                 FastAPI app factory, router registration, startup/shutdown (DB pool, Redis, S3 client)
    core/                    settings (pydantic-settings), security (JWT), logging, exceptions, deps.py (shared FastAPI Depends)
    db/                      SQLAlchemy async engine/session factory, declarative base (TimeStamped, SoftDelete mixins)
    models/                  SQLAlchemy ORM models — user.py, friendship.py, community.py, community_membership.py, meme.py, meme_container.py, template.py, post_audience.py, vote.py, reaction.py, comment.py, challenge.py, challenge_participant.py, challenge_submission.py, meme_score.py
    schemas/                 Pydantic request/response models — 1:1 with models/, never reused as ORM models
    routers/                 thin HTTP layer — auth.py, friends.py, feed.py, memes.py, templates.py, communities.py, challenges.py, scoring.py, leaderboards.py, voting.py, sharing.py, ai_caption.py, meme_sending.py, instagram.py
    services/                business logic, one module per domain — mirrors routers/, called by routers, never the other way around
    websockets/              connection manager (per-user socket registry), meme_sending real-time delivery, inbox push
    workers/                 background tasks (Celery or arq) — LLM caption calls, Instagram thumbnail/metadata fetch, media transcoding, leaderboard aggregation, meme/community score recomputation, challenge window close + evaluation
    integrations/            external clients — s3_client.py / cloudinary_client.py, llm_client.py (Groq/OpenAI-compatible), instagram_oembed.py
  alembic/
    versions/                one migration per schema change — generated via `alembic revision --autogenerate`, never edit an applied/shared migration
    env.py                   configured for the async SQLAlchemy engine, reads `DATABASE_URL` from settings
  tests/                     mirrors app/ structure — run against a real PostgreSQL test database/schema, never SQLite or an in-memory DB
  requirements/
    base.txt  dev.txt  prod.txt
```
Each `routers/<name>.py` pairs with `services/<name>.py` and `schemas/<name>.py`. Split further only when a file mixes concerns.

## Directives
- Async-first: `async def` routes and services wherever I/O (DB, Redis, S3, LLM calls, WebSocket sends) is involved. No blocking calls in the event loop — offload CPU-bound work (image/video processing) to a worker.
- Code-first. Explain only for real trade-off/security/non-obvious failure.
- Architecture > typing speed. Clean layering over quick hacks.
- Always: full error handling (no bare except, no swallowed exceptions), structured logging at boundaries (not print, not per-line), Pydantic schemas validate every request/response boundary.
- Long-running or unreliable work (LLM caption generation, Instagram metadata fetch, video transcoding, push notifications) → background task (Celery/arq), never inline in the request/response cycle.
- Before finalizing: consider concurrency (simultaneous votes/reactions/challenge submissions on the same meme, race conditions at challenge window close), slow/down external calls (LLM provider, Instagram oEmbed, S3), malformed/empty/huge media uploads, WebSocket disconnects mid-send, stale cache (Redis TTL expiry mid-request), a user posting to an audience they don't have access to (community they're not a member of). Handle realistic cases only.
- **Minimize code without cutting functionality/accuracy/performance**: prefer FastAPI/Pydantic/SQLAlchemy built-ins over hand-rolled equivalents — Pydantic validators over manual checks, SQLAlchemy relationship/query helpers (`selectinload`, hybrid properties) over raw SQL, FastAPI `Depends` for auth/pagination/DB session over inline boilerplate. Fewer lines only via reuse and built-ins — never by skipping error handling, validation, auth, or tests.

## Style
- Pydantic models for all req/res — no raw dicts, no manual JSON shaping in routers.
- Routers: thin — parse/validate input via Pydantic + `Depends`, call a service, return the service's result. No business logic in routers.
- Explicit type hints everywhere reasonable — no bare `dict`/`Any` where a Pydantic schema or dataclass fits.
- Single-responsibility modules — split schemas/routers/services if a file mixes concerns.
- Shared logic (e.g. media upload validation used by both `memes` and `templates`) → `core/` or a service method called from both, never copy-pasted across modules.

## Architecture
- Layers: routers (HTTP) → services (business logic) → models/ORM (persistence). No ORM queries in routers, no HTTP concerns in services.
- Database is **PostgreSQL only — dev, test, and prod**. `DATABASE_URL` always points at a real Postgres instance/schema (e.g. a Docker Compose service, or a dedicated `_test` schema/database for CI). Never SQLite, never an in-memory DB, even for unit tests — Postgres-specific behavior (constraints, JSON columns, full-text search, concurrency) must be exercised for real.
- Config: `pydantic-settings` for typed env config in `core/config.py` — never scattered `os.environ.get()` in app code.
- Errors: typed domain exceptions in services → translated to HTTP responses via FastAPI exception handlers in `core/exceptions.py`.
- Schema change → Alembic migration (`alembic revision --autogenerate`) in the same changeset, never a manual DB edit. Never edit an already-applied/shared migration — create a new one.
- **Voting**: one vote per user per meme per competition period — enforce with a DB unique constraint (`UniqueConstraint("user_id", "meme_id", "period")` on the `Vote` model), not just application-level checks.
- **Communities**: membership is its own table (`community_membership`), distinct from `friendship` — never conflate the two relationships or their permission checks. A community's private templates (`template.community_id` set) must be filtered out of every global-template query, and access-checked (`is_member`) on every read/use — a non-member must never see or apply a community's private templates, enforced at the service layer, not just hidden in the UI. Each community has an owner-set `privacy` mode (`open` or `invite_only`) — `open` communities accept join requests immediately, `invite_only` requires an invite record or owner/admin-approved join request before membership is created; enforce this in `services/communities.py`, never assume the client only calls join for communities it's allowed to join freely.
- **Post audience**: a post declares one or more audiences (Friends / Public / specific communit-ies) via a join table (e.g. `post_audience`), not a single enum column — a post can target more than one audience at once. Every feed/read query filters by the requester's actual access (friendship accepted, community membership) — never trust a client-supplied audience filter as the sole gate.
- **Meme scoring engine**: intentionally deferred as its own complex-rules design effort (accuracy/abuse-resistance "under any circumstance" is the bar — not a quick weighted formula). Until that design lands, expose one stubbed service (`services/scoring.py`) with a stable interface (`compute_score(meme_id) -> Score`) that every consumer (individual leaderboard, community score aggregation, challenge evaluation) calls — never let a consumer reimplement its own scoring math, even against the stub, so swapping in the real rules engine later touches one file. Recompute via a background worker on a schedule/trigger, not synchronously on every read.
- **Leaderboards** (always read-only, never a write/posting surface): three distinct ranked views, each precomputed/cached (Redis) and refreshed by a background worker — never a live full-table aggregation on every request: (1) global individual leaderboard — all users by score; (2) global community leaderboard — all communities by aggregate community score; (3) internal community leaderboard — one per community, ranking only that community's members, access-checked to members like any other community-scoped read. Don't conflate (2) and (3) — they're different queries with different audiences.
- **Community challenges**: model the lifecycle explicitly — `challenge` (rule set, time window, type: intra-community or community-vs-community), `challenge_participant` (side/team assignment), `challenge_submission` (meme tagged to a challenge, native uploads only — never a `MemeContainer`, reject at submission time). A scheduled worker closes the window at `end_time` and triggers evaluation via the scoring engine — never evaluate on-demand from a user request, since the window-close moment must be a single consistent event. Submissions after window close are rejected at the service layer regardless of client-side timing. Rewards are **points + a badge record** on the winning side's members/community — no inventory, fulfillment, or redemption system in scope.
- **Instagram Companion Mode**: a shared Reel/post creates a `MemeContainer` (original link, thumbnail, metadata, own reactions/comments/votes) — never download/re-host the source video; use oEmbed/link metadata and a WebView-friendly reference. Reactions/comments on a container are first-class rows tied to `meme_container_id`, independent of the source platform. `MemeContainer` content is feed/competition-eligible only — excluded from community challenge submissions unless product confirms otherwise (flag if this needs to change).
- **Real-time meme sending**: WebSocket connection manager tracks active per-user sockets; falls back to a persisted inbox row (Redis or PG) for offline delivery — never assume the recipient is connected.
- **AI captioning**: LLM calls go through `integrations/llm_client.py`, always as a background task with a timeout + retry/backoff; never block the upload/publish flow on LLM latency.
- Cache-then-refresh: feed/leaderboard reads check Redis first; if stale (TTL expired), trigger a background refresh rather than blocking the request.

## Workflow
- Feature request → code first, trade-off note after (1-2 lines) if any.
- Design request → bulleted trade-offs first, then code.
- Bug/vuln found outside scope → flag 1 line; fix only if critical/blocking, else ask.
- **New/changed logic — routers, services, models, business rules — always ships with tests, matching existing conventions.**
- **After finishing a feature, update its `/.claude/memory/<feature>.md` file** (models, endpoints, business rules, non-obvious decisions) in the same changeset.

## Constraints
- No apology for brevity/pushback.
- 1 targeted question if scale/visibility/consistency requirement is unclear and changes design.
- Never drop auth/validation/error-handling for brevity.
- Never expose upload/voting/meme-sending endpoints without JWT auth; never trust client-supplied user IDs.
- Never expose a community's private templates, feed, or challenge submissions to a non-member; never trust a client-supplied community ID or audience filter without a server-side membership check.
