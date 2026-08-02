# Backend Audit Report

_First audit — 2026-08-03. Scope: `backend/` (FastAPI/SQLAlchemy/Postgres/Redis-arq). Read every router, service, core module, key models, workers, and integrations against auth, validation, edge-case, concurrency, security, performance, and API-contract categories. Cross-referenced against `.claude/memory/*.md` feature files so already-documented/confirmed design decisions (e.g. reach-weighted scoring, offset-vs-keyset pagination split, no `admin` role, container-vote self-vote allowed) are **not** re-flagged here as bugs._

## Summary
- Total Issues: 10
- Critical: 1 (0 open, 1 resolved)
- Medium: 5 (4 open, 1 resolved)
- Minor: 4

**Resolved 2026-08-03**: the Critical issue and "No token revocation / logout mechanism" (Medium). See each issue's own "Resolution" note below for what shipped. Everything else in this file is unchanged/still open — read the rest of this file normally.

---

## Issues

### Unhandled `IntegrityError` on concurrent duplicate writes (check-then-insert race, no global handler)
**Category:** Edge Case / API Contract
**Severity:** Critical
**Status:** Resolved 2026-08-03

**Resolution:** Implemented the combined fix as recommended. (1) `app/core/exceptions.py::register_exception_handlers` now also registers a system-wide `IntegrityError` → `409` handler (generic safety-net message). (2) `register_user`, `send_friend_request`, `join_community`, `submit_to_challenge` each wrap their commit in `try/except IntegrityError` and re-raise the same specific `DomainError` their normal pre-check already used (`EmailAlreadyExistsError`/`UsernameAlreadyExistsError`, `FriendshipAlreadyExistsError`, `AlreadyMemberOrRequestedError`, `MemeNotEligibleForChallengeError`). (3) `cast_vote`/`cast_container_vote` were refactored into a private `_upsert_vote`/`_upsert_container_vote` helper that retries once (rollback + re-select, which now finds the row the race's winner just committed) instead of a raw `ON CONFLICT` rewrite — simpler than the original option-3 proposal and still eliminates the race, since `MemeVote`/`ContainerVote` toggle semantics (delete-if-same-value, update-if-different) don't map cleanly onto a single atomic upsert statement.
**Non-obvious gotcha hit during implementation**: `db.rollback()` (unlike `db.commit()`, since the app runs with `expire_on_commit=False`) expires *every* ORM object bound to the session, not just the one involved in the failed insert. `cast_vote` originally kept using `meme.id`/`current_user` after the retry and crashed with `sqlalchemy.exc.MissingGreenlet` (an implicit lazy-load of an expired attribute outside an async-safe context) whenever the race path actually fired. Fixed by never touching a pre-fetched ORM object after a rollback: `cast_vote` uses the already-known plain `meme_id` parameter instead of `meme.id`; `cast_container_vote` has `_upsert_container_vote` return whether it hit the race, and only then does `await db.refresh(current_user)` before the following `get_container` call touches `current_user.id`. **Any future retry-after-rollback code in this codebase must apply the same rule**: after any `db.rollback()`, either avoid touching previously-loaded ORM objects again or explicitly `db.refresh()` them first — don't assume `expire_on_commit=False` protects you, it doesn't cover rollback.
**Test coverage**: `test_auth.py::test_concurrent_duplicate_registration_never_returns_500`, `test_friends.py::test_concurrent_friend_requests_never_return_500`, `test_communities.py::test_concurrent_join_never_returns_500`, `test_challenges.py::test_concurrent_submission_of_same_meme_never_returns_500`, `test_memes.py::test_concurrent_first_votes_never_return_500`, `test_instagram.py::test_concurrent_first_container_votes_never_return_500` — each fires two genuinely concurrent (`asyncio.gather`) requests at the real Postgres-backed test app and asserts neither ever surfaces a raw `500`.

**Problem:**
Every "prevent a duplicate" write path in the codebase follows the same shape: SELECT to check "does this already exist?", then INSERT if not. The uniqueness is *also* correctly enforced at the DB level (unique constraints exist for all of these), but nothing catches the `sqlalchemy.exc.IntegrityError` that DB constraint raises when two concurrent requests both pass the SELECT check before either commits:
- `services/auth.py::register_user` — duplicate email/username (`users.email`/`users.username` unique)
- `services/friends.py::send_friend_request` — duplicate friendship (`uq_friendships_pair`)
- `services/communities.py::join_community` — duplicate membership (`uq_community_membership_pair`)
- `services/votes.py::cast_vote` — duplicate vote row (`uq_meme_votes_meme_user`)
- `services/instagram.py::cast_container_vote` — same pattern, `ContainerVote`
- `services/challenges.py::submit_to_challenge` — duplicate submission (`uq_challenge_submission_meme`)

`app/core/exceptions.py::register_exception_handlers` only registers a handler for the app's own `DomainError` subclasses. There is no handler for `IntegrityError` anywhere (confirmed via full-repo grep — zero matches). Confirmed via `app/main.py` review: no generic exception handler, no logging middleware either.

**Impact:**
Under a realistic double-tap, retry-after-timeout, or multi-tab scenario, the second request gets an unhandled `IntegrityError` instead of the intended `409 Conflict`. This surfaces as a raw, unstructured `500` (breaking the API's `{detail: "..."}` contract every other error follows) and — because there is no logging at the router/service layer (see Issue below) — leaves no application-level trace of what happened. This is exactly the class of concurrency edge case `backend/CLAUDE.md` explicitly calls out ("simultaneous votes/reactions/challenge submissions on the same meme, race conditions") but the mitigation was never applied to these check-then-insert paths.

**Fix Options:**
1. Wrap each check-then-insert in `try/except IntegrityError` and re-raise the existing, already-defined `DomainError` (`FriendshipAlreadyExistsError`, `AlreadyMemberOrRequestedError`, etc.) — precise per-endpoint messaging, more code (6 call sites).
2. Add one generic `IntegrityError` → `409` handler in `core/exceptions.py` as a safety net (catches this class system-wide with a generic message).
3. Switch the highest-traffic single-row toggles (votes) to the `INSERT ... ON CONFLICT DO NOTHING` pattern already used for `MemeView`/`ContainerView` dedup, checking `rowcount` instead of a separate SELECT — eliminates the race window entirely rather than just handling the exception.

**Recommended Fix:**
Combine (2) as a system-wide safety net (cheap, closes the "raw 500" contract violation everywhere at once) with (3) for `cast_vote`/`cast_container_vote` specifically, since the toggle/flip semantics there make `ON CONFLICT` the cleanest fit and the codebase already has the exact pattern to copy. Reserve (1) only for register/friend-request/join/submission where a distinct error message actually matters to the client.

---

### Challenge submissions always report 0 upvotes/downvotes/comments on the embedded meme
**Category:** Logical Bug
**Severity:** Medium

**Problem:**
`services/challenges.py::submit_to_challenge` (~line 444-451) and `get_results` (~line 556-563) both build the submission's `MemeOut` with hardcoded `upvote_count=0, downvote_count=0, comment_count=0` instead of the meme's real engagement counts:
```python
meme=build_meme_out(
    submission.meme, upvote_count=0, downvote_count=0, comment_count=0, viewer_vote=None,
),
```
The rest of the codebase (feed, meme-sending, competitions) always fetches real counts before calling `build_meme_out`; there is no design note anywhere (memory files or code comments) indicating this is intentional — it reads as an oversight, likely copy-pasted from a stub before real vote/comment counting existed elsewhere.

**Impact:**
Any client rendering a challenge submission list or a challenge's results screen shows every submitted meme as having zero votes and zero comments, regardless of actual engagement — misleading to end users evaluating a challenge's submissions, and inconsistent with every other surface in the app. The evaluation math itself (`_side_score`) is unaffected (it queries `meme_score_expr()` independently), so this is a display-layer bug, not a scoring bug.

**Fix Options:**
1. Replace both call sites with the existing `services/memes.py::get_meme_out_for_viewer(db, meme_id, viewer_id)` helper (already built for exactly this purpose, already a second consumer in meme-sending) — pass `current_user.id` in `submit_to_challenge` and pass `None` (or the requesting viewer, if threading it through `get_results`) consistently.
2. Inline the same upvote/downvote/comment count subqueries used elsewhere directly in `challenges.py` — duplicates query logic that already exists in a shared helper.
3. Leave `viewer_vote`/counts as a cheap placeholder permanently and document it as an intentional simplification — not recommended, contradicts the rest of the app's consistency.

**Recommended Fix:**
Option 1 — `get_meme_out_for_viewer` already exists, is async-session-scoped correctly, and is a proven second-consumer pattern. Minimal diff, zero duplicated logic.

---

### N+1 query pattern on the main feed, inbox, and competition standings
**Category:** Performance
**Severity:** Medium

**Problem:**
`services/instagram.py::get_merged_feed` (backing `GET /memes/feed`, the app's primary/highest-traffic endpoint) ranks the page in one efficient `UNION ALL` query, but then rebuilds each item individually: `get_meme_out_for_viewer` per meme (5 separate scalar queries: `db.get` + upvote count + downvote count + comment count + viewer-vote) and `get_container` per container (~5 queries each). A 20-item page can issue on the order of 100 SQL round trips. The same shape repeats in `services/meme_sending.py::list_inbox`/`list_sent` (once per `MemeSend` row) and `services/competitions.py::_standings_query` (once per ranked entry, bounded by `limit` so lower severity there).

This is a step backward from `services/memes.py::get_hot_ranked_memes` (the meme-only predecessor), which computes upvote/downvote/comment/viewer-vote counts as correlated scalar subqueries **inside the single ranking query** — proving the efficient shape is already known and used elsewhere in the same file family, just not carried into the merged-feed rewrite.

**Impact:**
Directly contradicts `backend/CLAUDE.md`'s performance directives and is exactly the kind of thing the Phase 16 performance pass looked for (it reviewed indexes but didn't catch this query-count regression since it was introduced by the later Instagram-companion merge). At current seeded-load scale (per `hardening.md`'s timing table) this is likely still under 1s, but it scales linearly worse than the rest of the app's queries and is the first thing that will show up under real concurrent load.

**Fix Options:**
1. Rewrite `get_merged_feed` to compute the same correlated-subquery counts directly in the initial `UNION ALL`/ranking query (mirroring `get_hot_ranked_memes`'s approach) and build `MemeOut`/`MemeContainerOut` straight from the row tuple instead of a second per-item fetch.
2. Keep the two-pass shape but batch: after collecting `meme_ids`/`container_ids` for the page, issue one `GROUP BY meme_id` query per count type instead of N separate single-row queries.
3. Leave as-is, rely on connection pooling and current low load.

**Recommended Fix:**
Option 1 for the main feed specifically (highest traffic, and the efficient template already exists in the same codebase) — this is a rewrite of one function, not new logic. Option 2 as a lighter interim fix for meme-sending/competitions where volumes are naturally much smaller and don't yet justify the bigger rewrite.

---

### Challenge `start_time`/`end_time` accept naive datetimes, silently reinterpreted as UTC
**Category:** Validation
**Severity:** Medium

**Problem:**
`schemas/challenges.py::ChallengeCreate`/`ChallengeProposalCreate` type `start_time`/`end_time` as plain `datetime.datetime`, which Pydantic happily accepts without a UTC offset (e.g. `"2026-08-05T10:00:00"`, no `Z`/`+00:00`). The column is `DateTime(timezone=True)` (Postgres `TIMESTAMPTZ`); a naive Python datetime written through asyncpg to that column type gets silently treated as UTC. No validation error occurs anywhere — the challenge is simply created with a window shifted by however many hours the client's actual local offset was.

**Impact:**
A community owner in, say, UTC+5 who enters "10am" meaning their local time gets a challenge window that actually starts at 10am UTC (their 3pm) — silent, no error, no crash, just a wrong real-world window that only surfaces as "the challenge didn't start/end when I expected." Since window-close is a scheduled, single-consistent-event worker (per `backend/CLAUDE.md`'s explicit directive for this feature), a silently-wrong window is a meaningfully worse failure mode than a rejected request would be.

**Fix Options:**
1. Change both fields to `pydantic.AwareDatetime` — rejects naive input with a clean `422` instead of silently misinterpreting it.
2. Add a `field_validator`/`model_validator` that raises if `dt.tzinfo is None`.
3. Leave lax and document that naive input is assumed UTC (keeps current behavior, least safe, not recommended).

**Recommended Fix:**
Option 1 — a one-line type change (`datetime.datetime` → `AwareDatetime`) that closes the gap with a proper validation error instead of silent misinterpretation, no service-layer changes needed.

---

### No token revocation / logout mechanism
**Category:** Security
**Severity:** Medium
**Status:** Resolved 2026-08-03

**Resolution:** Implemented Option 2 as recommended. `User.token_version` (int, default 0) added via migration `95e49a19db9a`; embedded as `tv` in every JWT (`create_access_token`); checked against the DB value in every real auth gate (`get_current_user`, the meme-sending WebSocket handshake) — a mismatch is treated as an invalid/expired token. New `POST /auth/logout` (`services/auth.py::logout_everywhere`) bumps the version, invalidating every outstanding token for that user. **Also folded in per explicit user request**: `jwt_expire_minutes` dropped from 7 days to 24 hours (`app/core/config.py`) — everything else about the token/session design was deliberately left as-is (no refresh-token pair, no denylist).
**Scope note**: `app/core/rate_limit.py`'s key function also calls `decode_access_token` but was deliberately left checking only `user_id`, not `token_version` — it's a rate-limit bucket key, not an auth gate, so a stale bucket under a revoked token has no security impact and isn't worth the extra DB comparison there.
**Frontend gap flagged, not fixed (out of the backend-only scope of this fix)**: `frontend/src/store/authSlice.ts::signOut` only clears the local token — no frontend call to the new `POST /auth/logout` exists yet, so today's "log out" button doesn't actually invalidate the token server-side. See `.claude/memory/auth-profile.md`.
**Test coverage**: `test_auth.py::test_logout_invalidates_existing_token`, `test_login_after_logout_issues_a_working_token`.

**Problem:**
JWTs are issued with a 7-day default expiry (`settings.jwt_expire_minutes`) and there is no `/auth/logout` endpoint, no denylist, and no per-user "invalidate all sessions" mechanism. `get_current_user` re-fetches the user from the DB on every request (good — catches a deleted/deactivated account), but has no way to reject a token that's still cryptographically valid but should no longer be trusted (e.g. after a suspected leak, or a deliberate "log out everywhere").

**Impact:**
A leaked/stolen access token remains usable for up to 7 days with no operational way to cut it off short of rotating the JWT secret (which would log out every user, not just the affected one). Standard MVP-stage simplification, but worth a conscious call given the token lifetime is long relative to typical access-token practice (usually minutes-to-hours with a separate refresh token).

**Fix Options:**
1. Short-lived access token + refresh token pair, with server-side refresh-token storage/revocation.
2. Add a `token_version` (or `sessions_invalidated_at`) column on `User`; embed the version in the JWT at issuance and compare in `get_current_user`, bump it on password change/logout-everywhere.
3. Redis-backed denylist of revoked JTIs with TTL = remaining token lifetime (now that Redis is already in use for rate limiting/caching).

**Recommended Fix:**
Option 2 — cheapest given the existing "always re-fetch user from DB" pattern already in `get_current_user`; adds one integer comparison, no new infrastructure, and naturally supports a future "log out everywhere" action.

---

### No structured logging at the request/response boundary
**Category:** API Contract / Operability
**Severity:** Medium

**Problem:**
`backend/CLAUDE.md` directive: "structured logging at boundaries (not print, not per-line)." In practice, `logging` is only used inside the four `app/workers/tasks/*.py` job modules. No router or service module logs anything — not successes, not caught `DomainError`s, and (compounding the Critical issue above) not unhandled exceptions either, since there's no middleware or exception-handler-level logging in `app/main.py`/`core/exceptions.py`.

**Impact:**
Any request-path failure — including the unhandled `IntegrityError` races above, a Cloudinary/Groq outage surfacing as a `DomainError`, or a genuine unexpected `500` — currently leaves no application-level log trail beyond whatever Uvicorn/Starlette prints by default. Debugging a production incident would rely entirely on ad hoc reproduction rather than logs.

**Fix Options:**
1. Add a small logging call inside `register_exception_handlers`'s `DomainError` handler (at least at `warning` level) plus a catch-all handler for unhandled exceptions that logs at `error`/`exception` level before returning a generic `500`.
2. Add ASGI middleware that logs method/path/status/duration for every request.
3. Both of the above together.

**Recommended Fix:**
Option 1 first (cheapest, directly closes the "silent 500" gap tied to the Critical issue), then option 2 if/when operational visibility needs grow — don't build a full request-logging middleware speculatively ahead of that need.

---

### No rate limiting on friend requests or community create/join/leave
**Category:** Security / Performance
**Severity:** Minor

**Problem:**
`hardening.md` documents a deliberate, specific rate-limit list (memes, votes, comments, meme-sending, AI caption, Instagram containers). `POST /friends/requests`, `POST /communities`, `POST /communities/{id}/join`, and `DELETE /communities/{id}/membership` are not on that list and have no `@limiter.limit(...)` decorator.

**Impact:**
A single authenticated account can spam friend requests at unlimited rate (each one is a real DB write + eventually surfaces in another user's incoming-requests list) or create unlimited communities (each with an implicit owner membership row and, if icon/banner uploaded, a real Cloudinary upload). Lower severity than the already-limited endpoints since there's no external billed API involved, but inconsistent with the app's own established rate-limiting posture.

**Fix Options:**
1. Add limits matching similar-weight endpoints (e.g. `10/minute` for friend requests, `5/minute` for community creation — matching `POST /auth/register`'s creation-abuse reasoning).
2. Leave unlimited, relying on natural low abuse expectation for a pre-launch app (matches the `scoring-engine.md`'s explicit "abuse-resistance is deliberately light for now" stance elsewhere).

**Recommended Fix:**
Option 1 — cheap, one-line decorator per route, consistent with the pattern already established everywhere else; no reason to leave these four as the only unprotected writes.

---

### Unbounded array sizes in challenge setup schemas
**Category:** Validation
**Severity:** Minor

**Problem:**
`schemas/challenges.py::ChallengeSideSetup.member_ids` (`Field(min_length=1)`, no `max_length`) and `ChallengeCreate.sides` (`Field(min_length=2)`, no `max_length`) accept arbitrarily large arrays. A community owner (the only caller, so lower risk, but still an authenticated write) could submit a request with, say, 50,000 member IDs across thousands of sides in one call.

**Impact:**
Each element triggers a DB row insert (`ChallengeParticipant`) and is checked against the community's active-membership set — a very large payload does proportionally large work in a single request/transaction with no upper bound, and is untested at any scale (existing tests use small fixed rosters).

**Fix Options:**
1. Add a realistic `max_length` to both fields (e.g. `sides: Field(min_length=2, max_length=20)`, `member_ids: Field(min_length=1, max_length=500)`).
2. Leave unbounded, relying on owner-only access as sufficient friction.

**Recommended Fix:**
Option 1 — trivial addition, no behavior change for any realistic community size, removes an unbounded-work vector entirely.

---

### `image/gif` accepted by direct upload despite "no animated content" being the documented scope
**Category:** API Contract / Consistency
**Severity:** Minor

**Problem:**
`services/media.py::ALLOWED_IMAGE_TYPES` includes `"image/gif"`. `.claude/memory/meme-creator.md` explicitly states "**GIF/animated deliberately out of scope — still images (PNG) only**" for the editor/creator pipeline. Since `validate_and_upload_image` is the shared gate for both `POST /memes` (direct/gallery upload, bypassing the Skia editor) and `POST /templates`, an animated GIF can still enter the system directly — just not through the in-app editor.

**Impact:**
Not a security issue, but a scope inconsistency: an animated GIF meme/template would be stored and served as-is (Cloudinary preserves animation), yet nothing downstream (scoring, thumbnailing, challenge submission, feed rendering) was built with animated content in mind. Worth an explicit product call rather than an accidental allowance.

**Fix Options:**
1. Remove `image/gif` from `ALLOWED_IMAGE_TYPES` to match the documented image-only scope everywhere, not just in the editor.
2. Keep it and confirm/document that direct GIF upload (outside the editor) is intentionally supported.

**Recommended Fix:**
Flag to product/user for a one-line confirmation rather than unilaterally changing behavior — this is a scope question, not a clear-cut bug. If out of scope, option 1 is a one-line removal.

---

### Overly broad `except Exception` masks distinct failure modes in two places
**Category:** Logical Bug (code quality)
**Severity:** Minor

**Problem:**
`services/ai_caption.py::generate_meme_caption` and `websockets/connection_manager.py::send_json` both catch bare `Exception`, folding a genuine programming bug in the same code path into the same generic outcome as an expected external failure (LLM timeout, or a dead socket). This is a documented, deliberate choice for the *known* failure modes in both cases, but the request path itself logs nothing before converting the exception (only the worker job body logs, and `send_json` doesn't log at all) — see the structured-logging gap above.

**Impact:**
Low — behavior is arguably correct (fail gracefully either way), but an unrelated bug introduced later in either function would silently present as "caption generation failed" / "user is offline" with zero diagnostic trail, making it harder to notice a regression was introduced at all.

**Fix Options:**
1. Narrow the catches to the specific expected exception types (`LLMGenerationError`, `TimeoutError`, arq's `ResultNotFound` for caption; a specific socket/connection exception for `send_json`) and let anything else propagate/log distinctly.
2. Keep the broad catch but add a log statement before converting, so at least a trace exists.

**Recommended Fix:**
Option 2 is the minimal fix (pairs with the structured-logging issue above); option 1 is the more correct long-term fix once the broad catch's actual exception surface is confirmed narrow enough to enumerate.

---

## Optimization Notes
- **Repeated pattern**: check-then-insert without a DB-constraint-violation fallback appears across auth, friends, communities, votes (both types), and challenge submissions — see the Critical issue above. Any *new* uniqueness-guarded write should default to either the `ON CONFLICT` pattern (already proven for view dedup) or an explicit `try/except IntegrityError`, not a bare SELECT-then-INSERT.
- **Repeated pattern**: per-item N+1 rebuild after an efficient ranking query (merged feed, inbox/sent, standings) — the efficient "compute counts as correlated subqueries in the same query" template already exists (`get_hot_ranked_memes`) and should be the default shape for any future list endpoint that currently loops and re-queries per row.
- **Architectural note**: the app has zero logging in the request path (routers/services) and zero exception handling beyond typed `DomainError`s. As background-job infra (arq) and Redis caching have matured over the phases, the request-path error/observability story hasn't kept pace — worth a small, focused pass (global exception handler + minimal logging) rather than continuing to add features on top of an unobserved failure path.
- No functional gaps found in **auth coverage, community membership gating, or owner-only mutation checks** beyond what `hardening.md`'s Phase 16 security review already covered (its one real IDOR fix, in meme-sending, is confirmed still in place). Every community-, challenge-, and meme-visibility check reviewed here correctly gates on server-side membership/authorship, never a client-supplied filter.
