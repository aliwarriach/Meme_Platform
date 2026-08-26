# Roadmap — Global Search, Trending Hashtags & the Live-Challenge Tag Screen

Source of truth for the platform's search surface: a top-bar search entry, an X/Twitter-style
**Trending** section, a five-scope tabbed result set, and an upgraded hashtag screen that presents a
live challenge as a race. Written as an implementation document — a future Claude Code session
should be able to pick up any phase and implement it without re-exploring the codebase or
re-litigating decisions.

**Read order for an implementer:** §0 (status board) → §1 (locked decisions) → §2 (baseline: what
already exists) → the one phase you're implementing in §3 → §4 (QA matrix for that phase). Then
`backend/CLAUDE.md` or `frontend/CLAUDE.md`, then `/.claude/memory/{hashtags,challenges,meme-feed}.md`.

**Global status: PENDING.** Nothing in this roadmap has been implemented. Design review completed
and every open question answered by the project owner on 2026-08-27 (§1).

**Statuses are greppable.** `grep "^\*\*STATUS:" Roadmap_Search.md` prints the whole board.
Allowed values, exactly: `PENDING` · `IN PROGRESS` · `IMPLEMENTED` · `BLOCKED`.
**Update the phase's STATUS line in the same changeset that implements it** — a stale status here is
worse than no roadmap, because the next session will trust it.

---

## 0. Status board

| # | Phase | Status | Est. | Depends on |
|---|---|---|---|---|
| S1 | Hashtag reservation lifecycle + anti-squatting | PENDING | 3d | — |
| S2 | Trending hashtags (compute, cache, cron, endpoint) | PENDING | 3d | — |
| S3 | Search API (aggregator + 5 scopes) | PENDING | 4d | S1 (loosely) |
| S4 | `viewer_side_id` on `ChallengeOut` | PENDING | 1d | — |
| S5 | Tag screen: live-race header, result card, Hot/Latest | PENDING | 4d | S1, S4 |
| S6 | Search screen + feed top-bar entry point | PENDING | 5d | S2, S3 |
| S7 | Desktop-web parity | PENDING | 2d | S5, S6 |

**Suggested order:** S1 → S4 → S2 → S3 → S5 → S6 → S7. S1 and S4 are small backend changes that
unblock the frontend work; doing them first means S5 never waits on a schema change mid-phase.
S2 and S3 are independent of each other and can be parallelised if two sessions are available.

---

## 1. Locked decisions — do not re-litigate

Every line below was explicitly proposed to, and approved by, the project owner on 2026-08-27 after a
design review that found the original design would return **zero results for its own worked example**
("Barcelona vs Real Madrid"). If you think one of these is wrong, raise it — don't silently change it.

### 1.1 Search entry point
- A **visible, tappable search bar pinned in the Feed screen's top bar**, which opens a dedicated
  `/search` screen. Matches the X/Twitter pattern and the owner's "clicks on the search bar" mental
  model. Costs ~48pt of vertical feed space; accepted.
- **The bottom nav is not touched.** It is deliberately capped at 5 items for 44pt touch targets on a
  360pt bar — see the comment in `frontend/src/components/FloatingBottomNav.tsx:27`. Search does not
  get a nav slot.

### 1.2 Tag matching
- **Token matching, not whole-query prefix matching.** Split the query on whitespace, normalize each
  token, and match tokens as substrings. `search_hashtags`'s current behaviour
  (`_NON_ALNUM.sub("", <whole query>)` then `slug.startswith(...)`) collapses
  `"Barcelona vs Real Madrid"` into `"barcelonavsrealmadrid"` and matches nothing.
- **Also match against the owning challenge's `title`.** `#ElClasico` becomes findable via
  "Barcelona vs Real Madrid" because its challenge is titled that. Zero new columns, zero new UI,
  zero moderation surface, and it works retroactively on every challenge that already exists —
  including the auto-generated weekly ones.
- **Title-derived keywords are NOT reserved.** Only the hashtag itself is exclusive. Two challenges
  may share title words freely; another user may reserve `#barcelona` as their own entry tag while an
  El Clasico challenge is live. Matching is a read-time convenience, never an ownership claim.
- **The creator's `#` autocomplete keeps its existing prefix-match behaviour, unchanged.** It is a
  different job — completing a tag someone is mid-typing, not finding a topic. Add a new function;
  do not repurpose `search_hashtags`.

### 1.3 Anti-squatting on reserved challenge tags (all four, approved together)
Today a reservation is **permanent** (`create_open_challenge` checks
`exists().where(Challenge.hashtag_id == hashtag.id)` with no status filter, and
`ix_challenges_hashtag_id` is a plain unique index), there is **no maximum window length**, and there
is **no per-user cap**. All four protections ship together in S1:

1. **Release on end** — a reservation holds only while the challenge is `setup` or `active`. Once
   `evaluated`, the tag is free for the next challenge.
2. **14-day maximum duration** for `open` challenges. Bounds the worst case and makes challenges feel
   like events rather than permanent fixtures.
3. **One active reservation per user.** The platform account (`User.is_platform_account`) is exempt so
   the weekly auto-challenge keeps working.
4. **Already-popular tags cannot be newly reserved** — ≥50 memes from ≥20 distinct authors means the
   tag belongs to the community, not to one challenge. Not retroactive: a tag that becomes popular
   *during* a challenge is unaffected.

### 1.4 Tag screen composition
Top to bottom, when all are present:
1. **Live race header** — the currently `active` challenge owning this tag. Prominent, event-like:
   every side's name + live score, a proportional bar, and a countdown. Tapping routes to the
   challenge screen where the user picks a side and posts.
2. **Final results card** — a challenge on this tag that finished within the last **24 hours**.
   Winner highlighted, final scores, "Final" instead of a countdown, tapping opens results. After
   24h it disappears.
3. **The tag feed.**

Both cards can be on screen at once: because reservations release on `evaluated`, a new challenge can
claim a tag whose previous challenge is still inside its 24h result window. **The live race always
renders above the final results card** — explicit owner decision.

### 1.5 Ranking
- Tag feed defaults to the main feed's **Hot** ranking, with a **[Hot | Latest] toggle**. Latest
  exists so a competitor who just entered a busy challenge can actually find their own submission.
- **Trending** = distinct authors in a rolling **24h** window, engagement-weighted, with a modest
  boost for tags owned by a currently-active challenge. Counting *distinct authors* rather than posts
  is the same anti-gaming lever `_side_scores` already uses — see `.claude/memory/challenges.md`
  Business rules. Recomputed by an arq cron into Redis; the search screen reads the cache.
- **Trending cold-start fallback**: when fewer than 5 organic entries qualify, backfill with live open
  challenges, then all-time top tags, each labelled honestly (`live_challenge` / `popular`) rather
  than mislabelled as trending.

### 1.6 Result scopes
Five tabs: **Challenges · Posts · People · Communities · Tags**.
- **Posts** = memes carrying a matching tag **∪** memes whose caption matches. Tag-only would be
  empty for most searches — most memes have no hashtag, and community posts cannot carry one at all
  (`POST /communities/{id}/memes` doesn't accept the field, see `.claude/memory/hashtags.md`).
- **Challenges** = all `open` challenges, plus anything the caller could already fetch directly.
  Never more. See S3 for the exact clause.
- **People** and **Communities** reuse the existing `search_users` / `list_communities(query=)`.

### 1.7 Tab row
Horizontally scrollable `Chip` row reusing the Communities screen's exact component, **each chip
carrying its result count** (`Tags (7)`, matching the existing `Pending (3)` at
`frontend/src/features/communities/CommunitiesScreen.tsx:57`). Counts come from **one** aggregator
request. The screen **auto-selects the first tab that has results** rather than opening on an empty
Challenges tab.

### 1.8 `viewer_side_id`
`ChallengeOut` gains `viewer_side_id`. Without it the funnel's payoff step is broken across app
restarts: `ChallengeSideOut.member_ids` is always `[]` for `open` challenges, so join state today
lives only in local component state and resets on remount — the user is re-asked to pick a side, and
a wrong tap returns a generic 400 that can't say which side they're on
(`.claude/memory/challenges.md:20`).

---

## 2. Baseline — what already exists

Read this before assuming something needs building.

**Hashtags** (`.claude/memory/hashtags.md` is the full picture — read it):
- `Hashtag(slug unique, display_text)` + `MemeHashtag(meme_id, hashtag_id)`.
- `normalize_hashtag()` strips `#`, lowercases, removes every non-alphanumeric. This is the whole
  anti-forking mechanism — do not weaken it.
- `GET /hashtags/search` (prefix, challenge-tags first) · `GET /hashtags/{slug}` ·
  `GET /hashtags/{slug}/memes` (keyset, recency).
- `services/hashtags.py` imports from `services/memes.py` **lazily, inside functions**, and vice
  versa. Both directions are deliberate — a module-scope import either way is a circular import.
  **The same trap applies to any new `services/hashtags.py` → `services/challenges.py` import**
  (S1/S5 both need one), because `services/challenges.py` imports `get_or_create_hashtag` at module
  scope today.

**Challenges** (`.claude/memory/challenges.md`):
- Four shapes: `intra_community`, `community_vs_community`, `open`, `duel`.
- `open` challenges: created `active` immediately, no community, self-service `POST /challenges/{id}/join`,
  entry via the exclusively-reserved hashtag. `ChallengeSideOut.score` is live-computed by
  `_side_scores()` on every read. `participant_count` is populated; `member_ids` is not.
- **`OpenChallengeCreate.sides` is `Field(min_length=2)` with no maximum.** The create screen
  hardcodes two, but the contract permits N. Every "both sides" UI in S5 must render N sides
  gracefully and must not crash on 3+.
- `_require_involved_member` is the visibility gate, with a 2026-08-27 carve-out letting non-members
  of an **open** community see and back its `community_vs_community` challenges.
- `create_weekly_open_challenge` auto-creates one `open` challenge every Monday 00:00 UTC as the
  platform user, with a deterministic per-ISO-week slug (`weekly2026w35`) and a 7-day window.

**Feed / ranking**:
- `services/scoring.py::hot_score_expr(created_at_col, net_score)` — Reddit Hot.
- `services/memes.py::get_hot_ranked_memes(db, user, visibility_clause, offset, limit) -> HotFeedPage`
  **already accepts an arbitrary clause**, so Hot-ranking a filtered set is a few lines, not a rewrite.
- `services/memes.py::_paginated_feed(...)` — the keyset/recency engine, still used by the community
  and tag feeds.
- `meme_visibility_clause(viewer_id)` — the single source of truth for who can see a meme. **Every new
  query that returns memes must go through it.** A search result must never widen visibility.

**Existing search-shaped endpoints to reuse, not rebuild**:
- `GET /users/search?q=&limit=` → `services/users.py:90`. Case-insensitive substring on `username`,
  excludes the caller and inactive users.
- `GET /communities?q=&cursor=&limit=` → `services/communities.py::list_communities`. This is the
  Discover tab's own query; its privacy behaviour is already shipped and tested — preserve it.

**Infrastructure**:
- `app/core/leaderboard_cache.py::cached_or_compute(cache_key, model, compute)` — Redis
  cache-then-compute over a Pydantic model. TTL is a module constant today; S2 adds an optional
  `ttl` parameter.
- `app/core/rate_limit.py::limiter` — slowapi, keyed by user when a bearer token is present.
  Applied as `@limiter.limit("60/minute")` **below** the route decorator, and the handler must take a
  `request: Request` first parameter (see `app/routers/blocks.py:13`).
- arq crons live in `app/workers/tasks/`, registered in `app/workers/arq_worker.py`.
- `ReadDbSession` (read-replica seam, Roadmap_Scaling A2) — use it for every read endpoint here.

---

## 3. Phases

### S1 — Hashtag reservation lifecycle + anti-squatting

**STATUS:** PENDING
**Est:** 3 days · **Depends on:** — · **Blocks:** S5

**WHY.** Three real holes, all reachable today with no special effort: a reservation never expires
(a one-hour challenge from six months ago holds `#football` forever), a challenge window has no
maximum (`end_time > start_time` is the only check — a challenge can end in 2099), and one account
can bulk-reserve every valuable tag on the platform in an afternoon. S5's tag screen also needs to
show two challenges at once, which the current single-scalar `HashtagOut.challenge_id` cannot express.

**FILES.**
- `app/services/challenges.py:440` — `create_open_challenge` (all four guards)
- `app/services/challenges.py:1307` — `create_weekly_open_challenge` (idempotency, see step 6)
- `app/services/hashtags.py:91` — `_build_hashtag_out` (now ambiguous, see step 5)
- `app/schemas/hashtags.py` — `HashtagOut` shape change
- `app/core/exceptions.py` — new/reused domain errors
- `alembic/versions/<new>_*.py` — **new**, the partial unique index
- `backend/tests/test_open_challenges.py` — extend

**IMPLEMENT.**

1. **Replace the permanent unique index with a partial one.** `ix_challenges_hashtag_id` is created
   by `op.create_index(..., unique=True)` in `f4a7b2c9d813` — it is an **index**, not a
   `UniqueConstraint`, so drop it with `op.drop_index`, not `op.drop_constraint`.

   ```python
   op.drop_index("ix_challenges_hashtag_id", table_name="challenges")
   # Non-unique index still wanted for FK lookups.
   op.create_index("ix_challenges_hashtag_id", "challenges", ["hashtag_id"], unique=False)
   op.execute(
       "CREATE UNIQUE INDEX uq_challenge_live_hashtag ON challenges (hashtag_id) "
       "WHERE hashtag_id IS NOT NULL AND status <> 'evaluated'"
   )
   ```
   Mirror the partial index on the model via `__table_args__` with
   `Index(..., unique=True, postgresql_where=...)` so `Base.metadata.create_all` in tests produces
   the same schema. **Verify this** — a test suite that builds its schema from metadata rather than
   migrations will otherwise silently not exercise the constraint.

2. **Status-filter the reservation guard.** `create_open_challenge:460` becomes:
   ```python
   already_reserved = await db.scalar(
       select(exists().where(
           Challenge.hashtag_id == hashtag.id,
           Challenge.status != ChallengeStatus.evaluated,
       ))
   )
   ```

3. **Duration cap.** `MAX_OPEN_CHALLENGE_DAYS = 14` next to `WEEKLY_CHALLENGE_DURATION_DAYS`. Reject
   with `ChallengeSetupInvalidError` naming the limit. Applies to `open` only — the community shapes
   are owner-created and not a squatting vector.

4. **Per-user active reservation cap, and the popular-tag block.** Both in `create_open_challenge`,
   both **before** the challenge row is created:
   - Cap: count challenges where `creator_id == current_user.id`, `hashtag_id IS NOT NULL`,
     `status != evaluated`. If ≥1 → reject. **Exempt `current_user.is_platform_account`** — resolve by
     the flag, not by username, matching the existing precedent at `services/challenges.py:1273`.
   - Popular block: `POPULAR_TAG_MEME_THRESHOLD = 50`, `POPULAR_TAG_AUTHOR_THRESHOLD = 20`. Count
     `MemeHashtag` rows and `COUNT(DISTINCT Meme.author_id)` for the tag; if **both** thresholds are
     met, reject. New `HashtagTooPopularToReserveError` → 409, with an error message that explains
     *why* (this is a rejection a legitimate user will hit, so it must not read like a bug).

5. **`HashtagOut` gains two embedded challenges.** `_build_hashtag_out`'s
   `db.scalar(select(Challenge.id).where(Challenge.hashtag_id == hashtag.id))` can now match several
   rows and would pick one arbitrarily. Replace with two explicit lookups:
   - `active_challenge: ChallengeOut | None` — `status == active` (at most one, guaranteed by the
     partial index).
   - `recent_result_challenge: ChallengeOut | None` — `status == evaluated` and
     `end_time >= now - RESULT_CARD_GRACE_HOURS` (=24), most recent first.

   Keep the existing `challenge_id` field as a deprecated alias for `active_challenge.id` for one
   release so `TagFeedScreen`'s current banner and the creator's autocomplete don't break mid-phase;
   remove it in S5 once the frontend is migrated.

   **Circular import:** building a full `ChallengeOut` needs `services/challenges.py`, which imports
   `get_or_create_hashtag` from `services/hashtags.py` at module scope. Import
   `build_challenge_out` **lazily inside the function**, the same way `_paginated_feed` is already
   imported at `services/hashtags.py:154`. Do not "clean this up" by hoisting it.

6. **Keep the weekly cron idempotent.** `create_weekly_open_challenge` relies on
   `HashtagAlreadyReservedError` as its only "already ran this week" flag. Releasing reservations on
   `evaluated` breaks that in one edge case: re-running the cron for an ISO week whose challenge has
   already been evaluated would create a duplicate. Add an explicit pre-check in
   `create_weekly_open_challenge` for *any* challenge on that slug regardless of status, and return
   `False`. One extra query; removes the dependency on an exception for control flow.

**TEST.** Extend `backend/tests/test_open_challenges.py` (real Postgres, per `backend/CLAUDE.md`):
- Reserving a tag whose previous challenge is `evaluated` **succeeds**; while it is `active` it still
  409s. Casing/punctuation variants still collide (the existing normalization test must stay green).
- A 15-day window is rejected; 14 days exactly is accepted.
- A user with one active reservation is rejected on their second; after the first is evaluated they
  can reserve again; the platform account is not limited.
- A tag at 50 memes / 20 distinct authors is rejected; 50 memes from 3 authors is **accepted** (both
  thresholds required); a tag that crosses the threshold mid-challenge does not retroactively break
  the live challenge.
- `GET /hashtags/{slug}` returns both an active and a recently-evaluated challenge when both exist,
  and drops the evaluated one once it is >24h old.
- `create_weekly_open_challenge` is still idempotent within an ISO week, including after that week's
  challenge has been evaluated.

---

### S2 — Trending hashtags

**STATUS:** PENDING
**Est:** 3 days · **Depends on:** — · **Blocks:** S6

**WHY.** Nothing in the codebase computes tag velocity today. Trending is the entire first impression
of the search screen and the only discovery surface open challenges have ever had.

**FILES.**
- `app/services/trending.py` — **new**
- `app/schemas/trending.py` — **new**
- `app/routers/hashtags.py` — new `GET /hashtags/trending`
- `app/workers/tasks/trending.py` — **new**, the warm cron
- `app/workers/arq_worker.py` — register the cron
- `app/core/leaderboard_cache.py` — add an optional `ttl` parameter
- `backend/tests/test_trending.py` — **new**

**IMPLEMENT.**

1. **Formula.** Over tagged memes created in the last 24 hours:
   ```
   score = distinct_authors_24h * (1 + log10(1 + max(net_votes_24h, 0))) * challenge_boost
   challenge_boost = 1.5 when the tag is owned by a currently-active challenge, else 1.0
   ```
   Distinct authors is the primary term on purpose — 20 people with one meme each must beat one
   account with 50. Rank descending, tie-break on `distinct_authors_24h` then `slug`.

2. **Only count publicly-visible memes.** Trending is a single globally-cached list shown to every
   user, so it cannot be visibility-filtered per viewer. Restrict the underlying query to memes
   carrying a `public` `PostAudience` row. A friends-only tagged post must never push a tag onto the
   global trending list — that leaks the existence of private activity through an aggregate.

3. **Cold-start fallback.** If fewer than `MIN_TRENDING_ITEMS = 5` tags qualify, backfill in order:
   (a) tags of currently-`active` open challenges not already present, (b) all-time top tags by
   `MemeHashtag` count. Every item carries
   `reason: Literal["trending", "live_challenge", "popular"]` so the UI labels it honestly rather
   than calling a two-year-old tag "trending".

4. **Shape.** `TrendingHashtagOut = {slug, display_text, meme_count_24h, author_count_24h, reason,
   challenge: {id, title, end_time, status} | None}`. `TrendingResponse = {items: list[...],
   generated_at: datetime}` — `generated_at` because this is cached data and the client should be able
   to say "as of a few minutes ago" rather than implying it is live.

5. **Cache + cron.** Compute through `cached_or_compute("trending:hashtags:v1", TrendingResponse,
   compute, ttl=300)`. Add the optional `ttl: int | None = None` parameter to `cached_or_compute`
   (defaulting to the existing `TTL_SECONDS` so leaderboards are unaffected). Register an arq cron
   `refresh_trending_hashtags` every 5 minutes that recomputes and writes the same key, so a user is
   almost never the one paying for the aggregation. `backend/CLAUDE.md` forbids live full-table
   aggregation on a read surface, and this one fires on every search-bar tap.

6. **Endpoint.** `GET /hashtags/trending?limit=` (default 10, max 25), Bearer-auth-gated like the rest
   of `/hashtags`. `@limiter.limit("60/minute")`.

**TEST.** `backend/tests/test_trending.py`:
- A tag used by 20 authors once each outranks a tag used by 1 author 50 times. **This is the
  anti-gaming assertion — it must exist.**
- A meme older than 24h does not contribute.
- A friends-only tagged post does not appear in trending; the same tag on a public post does.
- An active challenge's tag outranks an organic tag with identical raw numbers (the boost applies).
- With zero recent activity, the fallback returns live challenges then popular tags, with the correct
  `reason` on each.
- The cron writes the cache key and a subsequent request is served from it.

---

### S3 — Search API

**STATUS:** PENDING
**Est:** 4 days · **Depends on:** S1 (loosely — see step 3) · **Blocks:** S6

**FILES.**
- `app/services/search.py` — **new**, the aggregator
- `app/schemas/search.py` — **new**
- `app/routers/search.py` — **new**, registered in `app/main.py`
- `app/services/hashtags.py` — new `search_hashtags_by_tokens` (leave `search_hashtags` alone)
- `app/services/challenges.py` — new `challenge_visibility_clause`
- `backend/tests/test_search.py` — **new**

**IMPLEMENT.**

1. **Endpoint.**
   `GET /search?q=&scope=all|challenges|posts|people|communities|tags&limit=&offset=`
   - `scope=all` (the default) → `SearchAllOut` with one `SearchSection` per scope, each capped at
     `PREVIEW_LIMIT = 10`. This is the single request that powers the chip counts.
   - Any single scope → one paginated `SearchSection`.
   - `SearchSection = {items: list[...], count: int, capped: bool, has_more: bool}` — `capped` is
     `True` when `count` hit `PREVIEW_LIMIT`, so the chip renders `10+` instead of a wrong exact
     count. **Do not run five `COUNT(*)` queries** for exact totals; the chips do not need them.
   - `q` shorter than 2 characters after normalization → every section empty, `200` not `400`
     (matches `search_hashtags`'s existing empty-query convention).
   - `@limiter.limit("60/minute")`.

2. **Fan out sequentially, not with `asyncio.gather`.** A single SQLAlchemy `AsyncSession` cannot
   service concurrent operations — `gather`ing five queries on one session raises
   `InvalidRequestError` at runtime. These are five short indexed reads on `ReadDbSession`; run them
   in sequence. If this ever becomes a latency problem the fix is separate sessions, not `gather`.

3. **Tokenization** (shared helper, e.g. `services/search.py::tokenize_query`):
   ```
   tokens = [normalize each whitespace-split piece with hashtags._NON_ALNUM]
   drop tokens shorter than 2 chars   # stops "a" matching every tag
   cap at MAX_QUERY_TOKENS = 6        # bounds the generated SQL
   ```
   **Do not strip stopwords** — "vs" is load-bearing here (`#barcavsmadrid`).

4. **Tags scope** — new `search_hashtags_by_tokens(db, tokens, limit, offset)`:
   - A tag matches if **any** token is a substring of `slug`, of `display_text`, **or** of the title
     of a challenge that owns it (outer-joined, as `search_hashtags` already does).
   - Rank: tokens-matched DESC → owned by an `active` challenge DESC → `meme_count` DESC → `slug` ASC.
     Build tokens-matched as a sum of `CASE WHEN ... THEN 1 ELSE 0 END` terms.
   - `ILIKE '%token%'` cannot use a b-tree index. That is acceptable at current scale for the same
     reason documented on `services/users.py:92`; **the scale-up path is a `pg_trgm` GIN index on
     `hashtags.slug` and `challenges.title`** — note it in the docstring so the next person doesn't
     have to rediscover it.
   - **Leave `search_hashtags` (prefix, challenge-first) untouched.** It backs the creator's `#`
     autocomplete, which is a different job.

5. **Posts scope** — match ids from either source, then rank:
   ```python
   tagged = select(MemeHashtag.meme_id).where(MemeHashtag.hashtag_id.in_(matched_tag_ids))
   caption_match = or_(*[Meme.caption.ilike(f"%{t}%") for t in tokens])
   clause = meme_visibility_clause(viewer.id) & or_(Meme.id.in_(tagged), caption_match)
   return await get_hot_ranked_memes(db, viewer, clause, offset, limit)
   ```
   `get_hot_ranked_memes` already takes an arbitrary clause and already returns `HotFeedPage`, so the
   Hot ranking and the soft-delete/visibility filtering come for free. **Going through
   `meme_visibility_clause` is not optional** — a search result must never widen who can see a meme.

6. **Challenges scope** — build a reusable
   `challenge_visibility_clause(viewer_id) -> ColumnElement[bool]` in `services/challenges.py`,
   matching `_require_involved_member` exactly:
   - `challenge_type == open` → always visible.
   - `duel` → `creator_id == viewer OR invitee_id == viewer`.
   - `intra_community` → active `CommunityMembership` in `community_id`.
   - `community_vs_community` → active membership in `community_id` **or** `opponent_community_id`;
     **or** `status IN (active, evaluated)` **and** either community's `privacy == open` (the
     2026-08-27 open-community preview carve-out — see `.claude/memory/challenges.md:3`).

   Then filter on token-matched `title`. **Write a test that asserts the clause and
   `_require_involved_member` agree across all four shapes** — they will drift otherwise, and a drift
   here is an information leak, not a cosmetic bug. Do not filter client-side: result counts and
   pagination leak the existence of private challenges even when the rows are hidden.

7. **People and Communities** — call `users_service.search_users` and
   `communities_service.list_communities(query=...)` as they are. Do not fork or "improve" them here.
   Note in the docstring that People matches `username` only.

**TEST.** `backend/tests/test_search.py`:
- **The worked example, end to end**: a challenge titled "Barcelona vs Real Madrid" owning
  `#ElClasico`, plus tags `#RealMadrid` and `#Barcelona`. Searching `"Barcelona vs Real Madrid"`
  returns all three in Tags, the challenge in Challenges, and their memes in Posts. **This test is
  the reason this phase exists — it must be written first.**
- A tag matching two tokens outranks one matching one.
- Posts returns a caption-only match (no hashtag at all) and a tag-only match (no caption text).
- **A friends-only meme is absent for a non-friend and present for a friend.** Same for a
  community-private post and a non-member.
- A soft-deleted meme never appears.
- An `intra_community` challenge is invisible to a non-member; a duel is invisible to a third party;
  an open-community `community_vs_community` challenge **is** visible to a non-member; an
  invite-only one is not.
- Parity test: `challenge_visibility_clause` matches `_require_involved_member` on all four shapes.
- `scope=all` caps every section at 10 and sets `capped` correctly.
- `q="a"` returns empty sections with `200`.
- Auth required (401).

---

### S4 — `viewer_side_id` on `ChallengeOut`

**STATUS:** PENDING
**Est:** 1 day · **Depends on:** — · **Blocks:** S5

**WHY.** See §1.8. Small change, but S5's funnel is broken without it.

**FILES.** `app/schemas/challenges.py` · `app/services/challenges.py` (`build_challenge_out` and
every call site) · `backend/tests/test_open_challenges.py`, `test_duels.py`, `test_vs_challenges.py`

**IMPLEMENT.**

1. `ChallengeOut.viewer_side_id: uuid.UUID | None = None`.
2. `build_challenge_out` takes a `viewer_id: uuid.UUID | None` parameter. **`build_meme_out` already
   took exactly this treatment** for gating `view_count` (see `.claude/memory/meme-feed.md`) — follow
   that precedent, including passing `None` from genuinely viewer-agnostic call sites rather than
   inventing a fake viewer.
3. Resolution by shape:
   - `intra_community` / `open` / `duel` → the caller's `ChallengeParticipant.side_id`.
   - `community_vs_community` → the side whose `community_id` the caller holds an **active**
     membership in. Return `None` if they are a member of both (ambiguous — the same guard
     `_get_caller_side_vs_community` already applies) or of neither.
4. One query, not one per side. Update **every** `build_challenge_out` call site in the same
   changeset; a missed one silently returns `None` and the UI quietly regresses to today's behaviour.

**TEST.** A user who joined side A sees `viewer_side_id == A` on a fresh fetch; a non-participant sees
`None`; a `community_vs_community` member sees their community's side; a member of both sees `None`;
a duel's two participants each see their own side.

---

### S5 — Tag screen: live-race header, result card, Hot/Latest

**STATUS:** PENDING
**Est:** 4 days · **Depends on:** S1, S4

**WHY.** This is the payoff of the whole funnel: the screen that has to make a challenge feel like a
live event worth entering.

**FILES.**
- `app/routers/hashtags.py` + `app/services/hashtags.py` — new Hot-ranked tag feed route
- `frontend/src/features/hashtags/TagFeedScreen.tsx` — rework
- `frontend/src/features/hashtags/components/ChallengeRaceHeader.tsx` — **new**
- `frontend/src/features/hashtags/components/ChallengeResultCard.tsx` — **new**
- `frontend/src/services/{hashtags,useHashtags}.ts`

**IMPLEMENT.**

1. **Backend: a second, Hot-ranked tag feed route** — `GET /hashtags/{slug}/memes/hot?offset=&limit=`
   returning `HotFeedPage`:
   ```python
   tagged = select(MemeHashtag.meme_id).where(MemeHashtag.hashtag_id == hashtag.id)
   return await get_hot_ranked_memes(
       db, current_user, meme_visibility_clause(current_user.id) & Meme.id.in_(tagged), offset, limit
   )
   ```
   **Add a route; do not add a `sort=` parameter to the existing one.** Hot is offset-paginated and
   Latest is keyset-paginated (a Hot score drifts every second and has no stable cursor — see
   `.claude/memory/meme-feed.md` Business rules). One endpoint returning two different pagination
   contracts would be a union response type and a permanent source of client bugs. `GET
   /hashtags/{slug}/memes` stays exactly as-is and becomes the Latest tab.

2. **`ChallengeRaceHeader`** — the prominent, event-like block, driven by `HashtagOut.active_challenge`:
   - Every side's name and live `score`, plus a proportional bar. **Render N sides** — the contract
     allows more than two (§2). Two sides get the head-to-head treatment; 3+ degrade to a ranked list
     rather than breaking the layout.
   - `CountdownTimer` (already exists at
     `frontend/src/features/challenges/components/CountdownTimer.tsx`) for time remaining.
   - `viewer_side_id` present → show "You're on {side}" and make the primary CTA
     **"Post to this challenge"**, routing straight to the creator with `challengeId`, skipping the
     side picker entirely. Absent → CTA is **"Pick a side"**, routing to `/challenges/[challengeId]`.
   - Poll while `status === 'active'` — the existing `useChallenge` already polls every 5s; match that
     interval so scores visibly move. Stop polling when the screen is unfocused.
   - Light and dark both, using the `NEON_PLUM_LIGHT`/`NEON_PLUM_DARK` tokens via `useThemeMode()`,
     the same way `CommunitiesScreen` does it. Do not hardcode colours.

3. **`ChallengeResultCard`** — driven by `HashtagOut.recent_result_challenge`. Winner highlighted,
   final scores on every side, the word **Final** where the countdown was, tap → results screen.
   Rendered **below** the race header when both are present (§1.4).

4. **`TagFeedScreen`** — race header, then result card, then a `[Hot | Latest]` segmented control,
   then `MemeFeedList`. All three headers go through `MemeFeedList`'s existing
   `ListHeaderComponent` prop; do not nest a `FlatList` in a `ScrollView`.

5. **`useHashtagFeed(slug, sort)`** — branches to the offset-paginated `useInfiniteQuery` for Hot
   (`initialPageParam: 0`, `getNextPageParam` returns `allPages.length * PAGE_SIZE` when `has_more`)
   and the existing cursor one for Latest. **These are genuinely different pagination schemes**; the
   same split already exists between `useFeed` and `useCommunityFeed` — copy that, don't unify them.

6. Drop the deprecated `HashtagOut.challenge_id` alias from S1 step 5 once this screen and the
   creator's autocomplete both read `active_challenge`.

**TEST.** Frontend: `tsc`, `expo lint`, `expo export --platform web` all clean. Backend: the new Hot
route is visibility-gated identically to the existing one (reuse the existing tag-feed visibility
test, parameterized over both routes) and rejects `offset < 0` with 422.
**Human tap-through required** for this phase — see §4.

---

### S6 — Search screen + feed top-bar entry point

**STATUS:** PENDING
**Est:** 5 days · **Depends on:** S2, S3

**FILES.**
- `frontend/src/app/search.tsx` — **new** route
- `frontend/src/features/search/SearchScreen.tsx` — **new**
- `frontend/src/features/search/components/{TrendingList,SearchTabs,SearchResultsList}.tsx` — **new**
- `frontend/src/services/{search,useSearch}.ts` — **new**
- `frontend/src/features/feed/FeedScreen.tsx` — the top-bar search entry

**IMPLEMENT.**

1. **Entry point.** A pressable, non-focusable search bar in the Feed's top bar that navigates to
   `/search` (it does not accept input in place — one input, one screen, no split focus state). Style
   it on the existing search field at `CommunitiesScreen.tsx:65` so it reads as the same control.
   `accessibilityRole="button"`, `accessibilityLabel="Search"`.

2. **`SearchScreen`.**
   - Empty query → **Trending**, from `GET /hashtags/trending`. Each row: `#displayText`, a
     "N posts today"-style subtitle, and a badge when `reason !== "trending"` (`Live challenge` /
     `Popular`) so the section never mislabels itself. Tapping routes to `/tag/[slug]`.
   - Non-empty query → debounce **300ms**, require ≥2 characters, call `GET /search?scope=all`.
   - Tabs: horizontally scrollable `Chip` row (reuse `@/components/Chip`, do not fork it) with counts
     from the `scope=all` response, rendered `10+` when `capped`. **Auto-select the first tab with
     results.** If every section is empty, show **one** empty state — never five tabs the user has to
     tap through to discover they are all empty.
   - Switching to a tab fetches that scope paginated (`useInfiniteQuery`); the `scope=all` preview
     seeds the first page so the tab renders instantly rather than flashing a spinner.

3. **Reuse existing row components** for results — `CommunityCard`, `MemeCard` / `MemeFeedList`,
   `ChallengeRow`, and whichever user row `AddMembersModal` already uses. Verify each before
   importing; do not build new row components for this screen.

4. Explicit loading / error / empty states on every section (`frontend/CLAUDE.md` requires it).
   The 300ms debounce means the in-flight state is visible often — make it a subtle inline indicator,
   not a full-screen spinner that flashes on every keystroke.

5. **Deferred, not in scope:** recent-search history (would use the `services/localFlags.ts` pattern),
   and search-result analytics. Note them here so a future session doesn't treat their absence as an
   oversight.

**TEST.** Per `frontend/CLAUDE.md`, `services/` is the required test surface: mock the network layer
and cover success / error / empty for `useSearchAll`, `useSearchScope`, `useTrendingHashtags`,
including the debounce and the ≥2-character gate. Tab-selection logic (auto-select first non-empty)
is branching logic in `features/` and **is** required. Pure layout is not.
`tsc` / `expo lint` / `expo export --platform web` clean.

---

### S7 — Desktop-web parity

**STATUS:** PENDING
**Est:** 2 days · **Depends on:** S5, S6

**WHY.** This app has a real desktop-web shell (`DesktopShell` / `DesktopSidebarNav` / `WebModalFrame`,
`Platform.OS === 'web'`-gated). A phone-shaped search screen dropped into it will look wrong, and
`FloatingBottomNav` already returns `null` above `DESKTOP_FRAME_MIN_WIDTH`.

**IMPLEMENT.**
1. Search entry in `DesktopSidebarNav` (a sidebar has room the bottom nav doesn't), plus the top-bar
   bar in the content column.
2. `SearchScreen.web.tsx` if the layout diverges meaningfully — follow the existing `.web.tsx`
   precedent (`CreatorScreen.web.tsx`, `CreateOpenChallengeScreen.web.tsx`). If it doesn't diverge,
   **don't create the file**; a pass-through `.web.tsx` is dead weight.
3. Wider viewport → results can be two-column; the five chips fit without scrolling, so drop the
   horizontal scroll there.
4. Verify the race header and result card at desktop width — they are designed for ~360pt and will
   look stretched at 1200pt without a `max-width`.

---

## 4. QA matrix — walk these by hand before calling a phase done

Automated tests cover the logic. These are the paths that only a human catches, written as the
scenarios that broke the original design.

| # | Scenario | Expected | Phase |
|---|---|---|---|
| 1 | Search `"Barcelona vs Real Madrid"` | Tags, Posts **and** Challenges all populated | S3, S6 |
| 2 | Search a single word that is a whole tag | That tag ranks first | S3 |
| 3 | Search gibberish | One honest empty state, not five empty tabs | S6 |
| 4 | Type one character | No request fires | S6 |
| 5 | Open search on a brand-new account | Trending populated via fallback, labelled honestly | S2, S6 |
| 6 | Join side A → kill the app → reopen the tag screen | Still shows "You're on Team A" | S4, S5 |
| 7 | Tag screen during a live challenge | Scores visibly move; countdown ticks down | S5 |
| 8 | Tag screen the moment a challenge ends | Countdown → **Final** + winner. Never `0:00`, never negative | S1, S5 |
| 9 | Tag with a live challenge *and* one that ended 2h ago | Both cards, **live one on top** | S1, S5 |
| 10 | Same tag 25h after the old challenge ended | Result card gone; live card remains | S1, S5 |
| 11 | Post to a challenge, then open its tag feed on **Latest** | Your entry is at the top | S5 |
| 12 | Same, on **Hot** | Your entry may be buried — expected, not a bug | S5 |
| 13 | Search for a friend's friends-only meme's caption, as a non-friend | Absent from Posts | S3 |
| 14 | Search an invite-only community's challenge title, as a non-member | Absent from Challenges, and the count doesn't hint at it | S3 |
| 15 | Reserve a tag, then try to create a second challenge | Rejected with a message explaining the one-at-a-time rule | S1 |
| 16 | Try to reserve a very popular existing tag | Rejected with a message explaining *why*, not a generic 409 | S1 |
| 17 | Try a 30-day challenge | Rejected, naming the 14-day limit | S1 |
| 18 | Every screen above, in **light and dark** | Correct tokens, adequate contrast | S5, S6 |
| 19 | Every screen above, on a **360pt phone** | Chips scroll; nothing clipped; targets ≥44pt | S5, S6 |
| 20 | An open challenge with **3 sides** | Race header degrades to a ranked list, doesn't break | S5 |

---

## 5. Out of scope — deliberate, flag if product disagrees

- **Community posts still cannot carry hashtags.** `POST /communities/{id}/memes` doesn't accept the
  field. This is why the Posts scope had to include caption matching. Adding tags to community posts
  is a separate change with its own visibility questions and is not part of this roadmap.
- **`MemeContainer`s (Instagram Companion) are not searchable.** They carry no hashtags and no
  caption of their own, so they appear in neither Posts nor Tags. Feed-merged only, as today.
- **No semantic / visual search.** There is no OCR of meme text and no vision-generated description.
  Post search is caption + tags, and nothing else can make it more than that. If "search what the
  meme is actually about" is ever the goal, that starts with an OCR or vision step at upload time —
  a separate project, not a search feature.
- **People search matches `username` only.**
- **No explicit challenge keyword field.** Title matching was chosen instead (§1.2) because it needs
  no column, no UI, no moderation, and works retroactively. Revisit only if real usage shows titles
  are too narrow.
- **No recent-search history, no search analytics** (S6 step 5).

---

## 6. Memory files to update

**In the same changeset as the phase, not afterwards.** Stale memory is worse than none.

- `.claude/memory/hashtags.md` — S1 (reservation lifecycle, the four guards, the new `HashtagOut`
  shape), S3 (token search alongside the untouched prefix search), S5 (the second Hot feed route).
- `.claude/memory/challenges.md` — S1 (duration cap, per-user cap, popular-tag block), S3
  (`challenge_visibility_clause` and its required parity with `_require_involved_member`), S4
  (`viewer_side_id`).
- `.claude/memory/search.md` — **new file**, created in S3. The aggregator's contract, the
  tokenization rules, the per-scope ranking, and the visibility gates. Add it to
  `.claude/memory/README.md`'s index.
- `.claude/memory/meme-feed.md` — S5, one line noting the tag feed now has a Hot variant and why it
  is a separate route rather than a `sort=` parameter.
