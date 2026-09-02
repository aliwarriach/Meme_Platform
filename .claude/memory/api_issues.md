# API Efficiency & Error-Handling Audit

_2026-09-02. One-off audit, scope limited to §G (API efficiency/endpoint design) and §H
(error-handling soundness) per the audit brief — NOT a full correctness/security pass (that's
`.claude/memory/Shortcomings.md`, last full pass 2026-08-03, which this run does not duplicate).
Read `backend/CLAUDE.md`, `Roadmap_Scaling.md`'s A1-A7 status entries, and the memory files for
meme-feed, communities, challenges, messaging, notifications, search, leaderboards,
instagram-companion, scoring-engine before auditing code, per the brief's orientation step._

_This backend is unusually mature for the categories in scope: a typed `DomainError` hierarchy
translated by two registered exception handlers (`core/exceptions.py`), a system-wide
`IntegrityError` → 409 safety net, structured JSON request/security logging with a request-id
context var, WebSocket cleanup that's `try/finally`-safe, and per-item try/except+rollback in
every cron loop so one bad row never kills a whole worker pass. Several patterns this brief asks
auditors to look for (check-then-insert races, N+1 on the main feed, missing structured logging)
were already found and fixed/tracked in `Shortcomings.md`'s 2026-08-03 pass — this file does not
re-open them; see the Summary below for how they relate to what's new here._

---

## Issues

### `list_my_challenges` / `list_open_challenges` / challenge search results are N+1 and `list_my_challenges` is completely unbounded
**Category:** API Efficiency
**Severity:** Medium
**Verdict:** Significantly inefficient
**Status: FIXED 2026-09-02** — Fix Option 1 (batch `_build_challenge_out`'s per-item queries) shipped;
see `.claude/memory/challenges.md`'s 2026-09-02 entry for the implementation. The N+1 query cost is
gone (O(1) queries per list regardless of size); the unbounded-result-set part (Fix Option 2,
pagination) is unchanged and intentionally deferred — see that memory entry for why.

**Problem:**
`services/challenges.py::_build_challenge_out` (line 324) issues, per challenge, roughly 6-8
separate round trips: a `ChallengeParticipant` select, `_resolve_viewer_side_id`, `_side_scores`
(itself a query), a `GROUP BY` for `participant_counts`, and up to four separate `db.get()` calls
(`creator`, `invitee`, `community`, `opponent`). This is called in a per-row loop by:
- `list_my_challenges` (line 1264, backs `GET /challenges/mine` → `CompeteScreen`'s primary list)
- `list_open_challenges` (line 693, backs `GET /challenges/open`)
- `services/search.py::_search_challenges` (line 105, backs the Challenges tab of global search)

`list_my_challenges` additionally has **no pagination at all** — it's `list[ChallengeOut]` with
no `limit`/`offset`/cursor, and its query has no `LIMIT` clause. It returns *every* challenge
across every community the caller has ever been an active member of, including full evaluated
history, going back to account creation. `frontend/src/services/challenges.ts::listMyChallengesRequest()`
confirms the client-side contract matches: a bare `GET /challenges/mine` with no query params,
consumed by `useMyChallenges()` in both `CompeteScreen.tsx` and `CompeteScreen.web.tsx`.

**Impact:**
Per root `CLAUDE.md`, community membership + challenges is explicitly "the core, retained
experience" of this app, not a peripheral feature — this is one of the highest-value screens a
retained user opens repeatedly. A user active in several communities over any meaningful lifetime
will accumulate dozens-to-hundreds of challenge rows (every intra-community, inter-community, and
open challenge they were ever eligible to see), each triggering the ~6-8 query burst above on
every single visit to the Compete tab. This scales far worse than the already-tracked main-feed
N+1 (`Shortcomings.md`, Medium, still open) because that one is bounded by a page `limit`; this
one is not bounded at all — the query cost grows linearly with the user's community/challenge
history forever, with no cap.

**Fix Options:**
1. **Batch `_build_challenge_out`'s per-item queries.** For a list of N challenges: one
   `ChallengeParticipant` select across all N challenge IDs (`.in_()`) instead of N selects, one
   batched `_side_scores`-style query per challenge-id set, one `GROUP BY (challenge_id, side_id)`
   for all counts at once, and resolve `creator`/`invitee`/`community`/`opponent` via
   `selectinload` on the initial `Challenge` query (or a single batched `db.execute(select(User).where(User.id.in_(...)))` keyed by a dict) instead of N individual `db.get()` calls each. Response
   shape (`ChallengeOut`) is unchanged — this only changes how the same data is fetched.
2. Add pagination (`limit`/`cursor` or `offset`) to `GET /challenges/mine` and `GET /challenges/open`,
   matching the keyset/offset conventions already used elsewhere in the app (e.g. community feed's
   keyset cursor).
3. Leave as-is, relying on low current user tenure/community count to keep this cheap for now.

**Recommended Fix:**
Do (1) first — it is a pure backend rewrite of one helper function, the response shape and every
consumer's contract stay byte-for-byte identical, so it ships with zero client coordination and
zero risk to `CompeteScreen`. This alone turns an O(N × 8) query cost into O(1) for any list size.
Treat (2) as a separate, larger follow-up: it changes the wire contract (`list[ChallengeOut]` →
a paginated envelope) and needs the frontend `useMyChallenges()`/`useOpenChallenges()` hooks and
both `CompeteScreen` variants updated to page or infinite-scroll — worth doing once a real user's
challenge history is large enough that even the batched query in (1) becomes noticeably slow, but
not a prerequisite for shipping (1) first.

**Blast radius:** `GET /challenges/mine` consumers — `frontend/src/services/useChallenges.ts::useMyChallenges()`,
`frontend/src/features/challenges/CompeteScreen.tsx` + `.web.tsx`. `GET /challenges/open` consumers
— `useOpenChallenges()`, same two screens. `services/search.py::_search_challenges` (search results,
capped at `PREVIEW_LIMIT=10`/`MAX_LIMIT=50` so lower relative severity there, but the same fix
benefits it for free since it calls the same helper). No test, worker, or AI-agent-layer consumer
found (`grep -rn "_build_challenge_out\|list_my_challenges\|list_open_challenges"` — only these
three call sites and their own tests).

**Why it's currently shaped this way:** `_build_challenge_out` was written as a single-challenge
detail builder (used correctly and cheaply by `GET /challenges/{id}`, one call per request) and
then reused as-is for the two list endpoints and search when they were added later — a reasonable
default at the time (`.claude/memory/challenges.md` describes `list_my_challenges` as a later
addition, "without this a user in three communities had no single place to see..."), but nobody
went back to batch it once it became a list-context helper. Drift, not a deliberate trade-off.

**Client impact:** None for fix option (1) — response shape identical, no client change needed.
Fix option (2) would require updating `useMyChallenges()`/`useOpenChallenges()` (currently
`useQuery` returning a bare array) to an infinite-query shape and both `CompeteScreen` variants to
render/request additional pages — real but mechanical, matching the pattern the app already uses
for the community feed and messaging inbox.

**Safety:** Option (1) is a like-for-like data-fetching rewrite behind an unchanged function
signature and return type (`ChallengeOut`) — every existing test asserting on `ChallengeOut` field
values keeps passing unchanged; only the query plan changes. No behavior change to verify beyond
"same output, fewer queries," which is directly testable by asserting query count via
`db.execute` call counting or SQLAlchemy's event hooks in a new/extended test, without touching
any existing assertion.

---

### `GET /competitions/{period_type}/current` and `/winner` bypass the read-replica session despite being pure reads
**Category:** API Efficiency / Performance
**Severity:** Minor

**Problem:**
`app/routers/competitions.py` types both routes' `db` parameter as `DbSession` (the
primary/write-engine session), not `ReadDbSession`. `services/competitions.py::get_current_standings`
and `get_winner` never call `db.add`/`db.commit`/any mutating statement — confirmed via
`grep -n "db.commit\|db.add\|db.execute" app/services/competitions.py`, both matches are plain
`SELECT`s. This is exactly the class of endpoint `Roadmap_Scaling.md`'s A2 entry describes moving
onto `ReadDbSession`: "each verified read-only line by line (no `db.add`/`db.commit`/`update`
anywhere in their call graphs) before moving," alongside `/leaderboards/*` and the two feed
endpoints. Competitions ("Meme of the Day/Week/Month") is functionally the same class of
precomputed-ranking read as leaderboards — root `CLAUDE.md` groups "Voting & Competitions" and
"Leaderboards" as sibling read surfaces — but was not included in that migration.

**Impact:**
No behavioral difference today, since `read_engine` aliases the primary `engine` until
`database_read_url` is configured (`app/db/session.py`) — this is a forward-looking correctness
gap, not a live outage. But once a read replica is provisioned (`Roadmap_Scaling.md`'s own
50k-user milestone table lists "+ 1 read replica" as the trigger), these two endpoints will
silently keep sending Meme-of-the-Day/Week/Month traffic — a high-read, competition-results
surface every user can hit repeatedly — to the primary, undermining exactly the load-shedding A2
was built to provide, right alongside leaderboards which *will* correctly move.

**Fix Options:**
1. Change both routes' `db: DbSession` to `db: ReadDbSession` in `app/routers/competitions.py`.
2. Leave as `DbSession`, treating competitions as intentionally out of A2's original six-endpoint
   scope.

**Recommended Fix:**
Option 1 — a two-parameter type change with no logic difference (confirmed no writes in the call
graph), consistent with the project's own stated criterion for this migration, and free today
since `read_engine`/`engine` alias to the same connection until a replica exists.

**Blast radius:** Both routes are read-only, no request-body change, no response-model change —
zero client impact. The one operational gotcha the project's own A2 note calls out generally
applies here too: `tests/conftest.py` must override `get_read_db_session` (it already does, for
the six existing `ReadDbSession` routes) or these two routes would silently read from the real dev
DB instead of the per-test schema during the test suite — but since the override is already global
(applied once for `get_read_db_session`, not per-route), no additional test wiring is needed for
this specific change; existing `test_competitions.py` coverage should be re-run once to confirm.

**Why it's currently shaped this way:** Drift, not a deliberate exclusion — `Roadmap_Scaling.md`'s
A2 note explicitly enumerates the endpoints it moved and competitions isn't one of them, with no
stated reason for the omission (no privacy/consistency/staleness concern documented anywhere for
this specific pair of endpoints, unlike, say, `/memes/feed`'s explicit "safe against replica lag"
framing which applies here identically).

**Safety:** Changing only the `Depends` type with an already-confirmed-read-only call graph; no
existing test asserts on which engine/session backs a response the way it currently exists.

---

## Rejected Optimizations (do NOT "fix" these)

### Every other `DbSession`-typed read in `communities.py`/`challenges.py`/`hashtags.py`/etc.
**Looks like:** A broader sweep — "just move every pure-read endpoint onto `ReadDbSession`."
**Why it stays:** `Roadmap_Scaling.md`'s A2 entry documents this as a deliberately scoped,
line-by-line-verified migration of exactly six endpoints (later joined by `profiles`/`search`,
also confirmed read-only), not a blanket rule. Several read endpoints outside that list
(`GET /communities/{id}`, `GET /challenges/{id}`, `list_join_requests`, etc.) are lower-traffic,
detail/administrative reads rather than the high-frequency ranked-list class A2 targeted, and
migrating every one of them without the same line-by-line write-graph audit A2 did risks silently
moving a read that turns out not to be pure (e.g. a lazy side-effect commit buried in a shared
helper) onto a session that will hard-fail against a real replica.
**What would break:** Nothing today (no replica configured yet), but an unverified endpoint moved
onto `ReadDbSession` that turns out to write somewhere in its call graph would fail outright the
moment a real replica is provisioned, with a confusing "read-only transaction" error far from the
call site.
**Revisit if:** A future pass wants to formally extend A2's scope — at that point, audit each
additional candidate endpoint's full call graph the same way A2's implementation note describes,
one file at a time, rather than doing it in bulk here.

### `_build_challenge_out`'s viewer-personalized fields prevent a shared/cached list response
**Looks like:** "Precompute/cache challenge list responses like leaderboards do, since
`_side_scores` and participant counts are read constantly."
**Why it stays:** Unlike leaderboards (globally identical for every viewer, hence cacheable),
`ChallengeOut` includes `viewer_side_id` — genuinely per-caller state (`_resolve_viewer_side_id`)
that can't be served from one shared cached blob without keying the cache per-user, which for a
feature with potentially hundreds of active challenges city-wide would trade a query-count problem
for a cache-fragmentation one. The batched-query fix above (Fix Option 1) solves the actual cost
driver without touching this per-viewer shape.
**What would break:** Any shared-cache approach would need to strip `viewer_side_id` out of the
cached payload and re-attach it per-viewer on read anyway — which is most of the batching work
already recommended, just routed through Redis instead of one SQL round trip. Not worth the added
moving part (cache invalidation on every vote/submission/window-close) for a win the query batch
already captures.
**Revisit if:** Challenge list read volume becomes large enough that even the batched query (O(1)
vs. current O(N)) is a measurable cost — unlikely at this app's current stage per `hardening.md`'s
own seeded-load numbers.

---

## Optimization Notes

- **Error-handling approach: Appropriate.** A typed `DomainError` hierarchy is translated at one
  choke point (`core/exceptions.py::register_exception_handlers`), consistently mapped (401/403 →
  logged as `security.forbidden`, everything else silent-by-design to avoid alert fatigue on
  routine 4xx), with a system-wide `IntegrityError` → 409 safety net closing the exact
  check-then-insert race class this brief's H-section calls out — and that net is *also* backed
  up by narrower `try/except IntegrityError` at every actual check-then-insert call site found
  during this pass (`hashtags.py::get_or_create_hashtag`, `challenges.py::create_open_challenge`'s
  tag reservation), each re-raising the same specific `DomainError` its pre-check already used —
  exactly the layered "narrow catch with a broad net behind it" shape H10 asks for. No `HTTPException`
  or `status.HTTP_*` found anywhere in `app/services/` (confirmed via grep) — the
  domain/HTTP-boundary layering directive holds everywhere, not just in the common case. Structured
  JSON logging (`core/logging.py`) is live with a request-id contextvar and a dedicated
  `security_logger`; `app/main.py`'s outermost middleware logs every unhandled exception before
  re-raising, so a genuine 500 is never silent. WebSocket handling (`connection_manager.py`,
  `routers/meme_sending.py`'s socket handler) is `try/finally`-safe — a disconnect always cleans up
  the local registry entry and Redis presence key even on an unexpected exception, not just the
  expected `WebSocketDisconnect`. Background cron jobs (`workers/tasks/notifications.py`) wrap each
  item's work in its own `try/except Exception: logger.exception(...); await db.rollback()` inside
  the loop, so one bad row can't sink an entire batch run — the right shape for a fan-out worker.
  The handful of broad `except Exception` blocks found (`ai_caption.py`, `connection_manager.py`,
  `cloudinary_client.py`) are each already documented in code comments as deliberate
  "must degrade gracefully regardless of failure cause" boundaries, and two of the three (caption
  generation, connection manager) are already tracked as a Minor "narrow this" item in
  `Shortcomings.md` — not re-flagged here.
- **API-efficiency summary:** the one clear, high-value new finding is the N+1 + unbounded-result
  combination on the challenges list surface (`list_my_challenges`/`list_open_challenges`/challenge
  search) — the same "efficient ranking query, then N individual per-item rebuilds" anti-pattern
  `Shortcomings.md` already tracks for the main feed/inbox/standings, recurring in a part of the
  codebase that pattern hadn't reached yet. A second, lower-severity finding
  (`competitions` read-replica routing) is a scope gap in an otherwise-deliberate, well-documented
  migration (A2), not a design flaw. Beyond these two: `services/search.py`'s five-scope fan-out is
  correctly sequential (not `asyncio.gather`, which would crash on a shared `AsyncSession`) and each
  sub-search is capped (`PREVIEW_LIMIT`/`MAX_LIMIT`), the AI-caption flow's synchronous
  `job.result(timeout=...)` wait on an arq-enqueued job is a deliberate, explicitly-commented
  trade-off (avoids a client-side polling rewrite at the cost of holding one HTTP connection open
  for up to ~15s) rather than an oversight, and the WebSocket/notification/messaging "patch-don't-
  invalidate" cache discipline documented across `meme-feed.md`/`messaging.md`/`notifications.md`
  is applied consistently everywhere it was checked. No orphaned/dead routes, no endpoints forking
  behavior on a query param in a way that hides a second endpoint, and no redundant sibling
  endpoints (differing only by a filter that should've been a query param) were found in the
  routers read this pass (`competitions`, `leaderboards`, `communities`, `challenges`, `memes`,
  `search`, `notifications`, `meme_sending`).
- **Areas checked and found appropriate, not re-audited beyond this pass:** `core/exceptions.py`
  (full read), `core/deps.py`, `app/main.py` (full read), `core/logging.py` (full read),
  `websockets/connection_manager.py` (full read), `routers/meme_sending.py`'s WS handler (full
  read), `integrations/llm_client.py` + `services/ai_caption.py` (retry/timeout/error-mapping
  shape), `integrations/cloudinary_client.py` (error mapping to `MediaUploadError`, best-effort
  delete), `services/hashtags.py`'s reservation/get-or-create race handling,
  `services/search.py` (full read), `app/db/session.py` (full read).
- **Not reached this pass** (budget): `services/instagram.py`/`services/memes.py`'s full bodies
  beyond what `Shortcomings.md` already covers, `services/media.py`'s A4 direct-upload flow's error
  paths in detail, `services/scoring.py`, `services/trending.py`, `app/workers/tasks/challenges.py`
  and `instagram.py` beyond a grep-level check, and the full `services/communities.py`/
  `services/memes.py` bodies (only their routers and memory-file-documented behavior were read).
  A follow-up pass should start there if continuing this audit.
