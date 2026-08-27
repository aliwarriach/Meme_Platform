---
name: search
description: Global search aggregator (/search) and trending hashtags (/hashtags/trending) — token matching, per-scope visibility gates, ranking, caching.
metadata:
  type: project
---

# search

## Status
All seven phases (S1-S7) implemented 2026-08-27. Backend (S1/S2/S3/S4/S5's Hot route)
tested against real Postgres. Frontend (S4/S5/S6/S7) `tsc`/`expo lint` clean. **Not yet
human-tap-through tested** — walk `Roadmap_Search.md`'s §4 QA matrix by hand before calling
this fully done, per that file's own instruction for any UI-touching phase.

## Trending hashtags (S2)
- `GET /hashtags/trending?limit=` (default 10, max 25) → `TrendingResponse = {items:
  [{slug, display_text, meme_count_24h, author_count_24h, reason, challenge}], generated_at}`.
  `reason: "trending" | "live_challenge" | "popular"` — the client must label a fallback item
  honestly, never as "trending".
- **Formula**: `distinct_authors_24h * (1 + log10(1 + max(net_votes_24h, 0))) * challenge_boost`
  (`challenge_boost = 1.5` if the tag is owned by a currently-`active` challenge, else `1.0`).
  Distinct authors is the primary term deliberately — same anti-gaming shape as
  [[challenges]]'s `_side_scores` (20 people x 1 meme must beat 1 person x 50).
- **Only publicly-visible memes count** — restricted to memes carrying a `public`
  `PostAudience` row, since this is one globally-cached page shown to every user with no
  per-viewer filtering. A friends-only/community post must never move a tag on this list.
- **24h rolling window** on `Meme.created_at`; **cold-start fallback** (fewer than
  `MIN_TRENDING_ITEMS=5` organic tags) backfills first with tags of currently-`active` open
  challenges (`reason=live_challenge`), then all-time top tags by `MemeHashtag` count
  (`reason=popular`).
- **Cache**: Redis key `trending:hashtags:v1`, `services/trending.py`. Read path is
  cache-then-compute (`app/core/leaderboard_cache.py::cached_or_compute`, which gained an
  optional `ttl` param for this — leaderboards keep their old default). Write path is a 5-min
  arq cron (`refresh_trending_hashtags`, `app/workers/tasks/trending.py`) that **always
  recomputes and overwrites** the key directly (not via `cached_or_compute`'s read-first
  path, which a warm cron would just short-circuit on).
- **Test-infra gotcha**: `app/workers/tasks/trending.py`'s `async_session_factory` must be
  patched to `TestSessionFactory` in `conftest.py`'s `use_test_session_factory_for_background_tasks`
  fixture (same as the instagram/notifications worker modules) or a test calling
  `refresh_trending_hashtags` directly hits the real dev DB instead of the test schema.
  Also: the trending cache key isn't covered by `conftest.py`'s `_reset_leaderboard_cache`
  fixture (that one only flushes `leaderboard:*`) — `test_trending.py` has its own local
  autouse fixture flushing `trending:hashtags:v1` before/after each test.

## Search aggregator (S3)
- `GET /search?q=&scope=all|challenges|posts|people|communities|tags&limit=&offset=`,
  `@limiter.limit("60/minute")`, Bearer-auth-gated, `ReadDbSession`.
- `scope=all` (default) → `SearchAllOut`, one `SearchSection` per scope, each capped at
  `PREVIEW_LIMIT=10` — the single request that powers the search screen's chip counts.
  Any single `scope=` → one paginated `SearchSection = {items, count, capped, has_more}`.
  `capped` is just `has_more` — never run five `COUNT(*)`s for an exact total.
- **`q` shorter than 2 chars (after `.strip()`) → every section empty, `200`** — matches
  `search_hashtags`'s existing empty-query convention. Checked on the raw stripped query,
  before tokenization, specifically so a 1-char query never reaches People/Communities'
  substring search either (an ILIKE `%x%` on a single char is both slow and useless there).
- **Tokenization** (`services/search.py::tokenize_query`): split on whitespace, normalize
  each piece independently with `hashtags._NON_ALNUM` (lowercased, non-alnum stripped), drop
  tokens under 2 chars, cap at `MAX_QUERY_TOKENS=6`. **Stopwords are not stripped** — "vs" is
  load-bearing for a tag like `#barcavsmadrid`. This is the fix for the original design's
  fatal bug: whole-query normalization collapsed "Barcelona vs Real Madrid" into
  "barcelonavsrealmadrid" and matched nothing.
- **Fan-out is sequential, never `asyncio.gather`** — one `AsyncSession` can't service
  concurrent operations; `gather`ing raises `InvalidRequestError` at runtime.
- **Tags** — `hashtags_service.search_hashtags_by_tokens(db, tokens, limit, offset)`. A tag
  matches if *any* token substring-matches its slug, display text, or (outer-joined) owning
  challenge's title — this is how `#ElClasico` is findable via "Barcelona vs Real Madrid"
  with zero new columns. Rank: distinct-tokens-matched DESC → owned by an active challenge
  DESC → meme_count DESC → slug ASC. **`_tokens_matched_expr` counts distinct tokens
  matched (OR across slug/display/title per token), not a sum across fields** — a token
  that hits both slug and title still only counts once; get this wrong and multi-field hits
  overrank single-field, multi-token ones. Deliberately separate from `search_hashtags`
  (whole-query prefix match, backs the creator's `#` autocomplete) — do not merge them.
- **Posts** — tag match (via `hashtags_service.matched_hashtag_ids_subquery(tokens)`, the
  *same* token-match expression as Tags, so a post tagged `#ElClasico` matches via the
  challenge-title path too) **∪** caption ILIKE match, through `meme_visibility_clause` +
  `get_hot_ranked_memes` (Hot-ranked, offset-paginated). Going through
  `meme_visibility_clause` is not optional — a search result must never widen who can see a
  meme, including soft-deleted memes (that clause already excludes `deleted_at IS NOT NULL`).
- **Challenges** — `services/challenges.py::challenge_visibility_clause(viewer_id)`, a
  `WHERE`-clause form of `_require_involved_member` for filtering many rows at once. **Must
  stay in exact parity with `_require_involved_member`** (dedicated parity test in
  `test_search.py`) — drift here is an information leak (wrong count/pagination revealing a
  private challenge exists), not a cosmetic bug. Filtered further on title token match.
- **People / Communities** — `users_service.search_users` / `communities_service.list_communities(query=...)`
  called exactly as they stand, never forked. Neither natively supports `offset`
  (`search_users` has no pagination beyond `limit`; `list_communities` is cursor-paginated) —
  emulated by over-fetching `offset + limit (+1)` and slicing in `services/search.py`, one
  extra query, no changes to either underlying function. People matches `username` only.

## Frontend (S4-S7)
- **Tag screen (S5)** — `features/hashtags/TagFeedScreen.tsx` reworked onto `ListHeaderComponent`
  (race header → result card → `[Hot|Latest]` `SegmentedControl`), new
  `features/hashtags/components/{ChallengeRaceHeader,ChallengeResultCard}.tsx`. `services/useHashtags.ts::useHashtagFeed(slug, sort)`
  always calls both the Hot (`useInfiniteQuery`, offset pageParam) and Latest (keyset cursor)
  queries, gating the inactive one with `enabled: false` rather than conditionally invoking
  different hooks — the latter would violate the rules of hooks even though the underlying
  hook-call *count* would stay stable.
- **`viewer_side_id` (S4) fixed a real bug**, not just added a field: `DuelDetailScreen.tsx`/`.web.tsx`
  used `useState` local join-state for `open` challenges (documented limitation, dated
  2026-08-06 — reset on every remount) — both now read `challenge.viewer_side_id` directly.
- **Search screen (S6)** — `services/{search,trending}.ts` + `services/useSearch.ts`
  (`useSearchAll`, `useSearchScope`, `useTrendingHashtags`), `features/search/SearchScreen.tsx`
  + `features/search/components/{TrendingList,SearchTabs,SearchResultsList}.tsx`, route
  `app/search.tsx`. Entry points: a pressable (non-focusable) search bar in `FeedScreen.tsx`'s
  top bar, and a matching icon button in `WebFeedTopBar.tsx` (the feed's separate `.web.tsx`
  chrome). 300ms debounce + 2-char minimum implemented as local `useState`/`useEffect` inside
  `SearchScreen.tsx` itself, not a shared custom hook (no debounce precedent existed anywhere
  in this codebase before this).
- **Tab selection is derived during render, not synced via a `setState`-in-effect** — an
  earlier version reset `activeTab`/`autoSelected` inside a `useEffect` keyed on the debounced
  query, which trips this repo's React Compiler lint rule
  (`react-hooks/set-state-in-effect`, "Calling setState synchronously within an effect can
  trigger cascading renders"). Fixed by tracking `(manualTab, manualTabQuery)` — the user's
  explicit tab click paired with the query it was made against — and computing
  `activeTab = manualTabQuery === trimmedQuery ? manualTab : autoTab` inline; a stale manual
  pick from a previous query falls through to the auto-picked tab with no effect needed. The
  cache-seeding effect (`queryClient.setQueryData` per scope from the `scope=all` preview, so
  switching tabs renders instantly) legitimately stays an effect — it synchronizes into
  TanStack Query's external cache, which is exactly the case that lint rule allows.
- **S7 desktop parity**: `DesktopSidebarNav` gained a `Search` nav item; no
  `SearchScreen.web.tsx`/`TagFeedScreen.web.tsx` was needed — `DesktopShell` already caps
  every non-`/feed` content column at `DESKTOP_CONTENT_MAX_WIDTH` (680px, see
  `constants/webLayout.ts`), which covers most of the "phone-narrow component looks stretched
  at monitor width" risk for free. Two-column results grid (roadmap step 3) was **deliberately
  skipped** — no masonry/grid precedent exists in this codebase and a single-column render is
  correct, just not maximally space-efficient, at 680px. Flag if product wants it built.

## Gotchas
- `schemas/hashtags.py` imports `schemas/challenges.py` at module scope (for `HashtagOut`'s
  embedded `active_challenge`/`recent_result_challenge` — see [[hashtags]] S1) — fine, no
  cycle, schemas never import services. But `services/hashtags.py` → `services/challenges.py`
  is still lazy/in-function only (`_build_hashtag_out`, `search_hashtags_by_tokens` doesn't
  need it) — the existing circular-import trap between those two service modules is
  unchanged, see [[hashtags]] Gotchas.
- `services/search.py` imports `services/challenges.py` (`_build_challenge_out`,
  `challenge_visibility_clause`) and `services/hashtags.py`/`services/memes.py` at module
  scope — safe, since none of those three import `services/search.py` back.

## Key files
- backend: `app/services/{search,trending}.py`, `app/schemas/{search,trending}.py`,
  `app/routers/search.py` (registered in `app/main.py`), `app/routers/hashtags.py`
  (`/trending` route — registered **before** `/{slug}` or it'd be captured by the dynamic
  slug route), `app/workers/tasks/trending.py`, `app/workers/arq_worker.py` (cron
  registration), `app/core/leaderboard_cache.py` (`ttl` param), `app/services/hashtags.py`
  (`search_hashtags_by_tokens`, `matched_hashtag_ids_subquery`, `_tokens_matched_expr`,
  `get_hashtag_feed_hot`), `app/services/challenges.py` (`challenge_visibility_clause`,
  `_resolve_viewer_side_id`), `app/schemas/challenges.py` (`viewer_side_id`),
  `app/schemas/hashtags.py` (`active_challenge`/`recent_result_challenge`).
- frontend: `src/services/{search,trending,useSearch}.ts`, `src/features/search/SearchScreen.tsx` +
  `src/features/search/components/{TrendingList,SearchTabs,SearchResultsList}.tsx`,
  `src/app/search.tsx`, `src/features/feed/FeedScreen.tsx` (search entry) +
  `src/components/web/WebFeedTopBar.tsx` (web search icon) +
  `src/components/web/DesktopSidebarNav.tsx` (Search nav item), `src/features/hashtags/TagFeedScreen.tsx` +
  `src/features/hashtags/components/{ChallengeRaceHeader,ChallengeResultCard}.tsx`,
  `src/services/useHashtags.ts` (`useHashtagFeed(slug, sort)`), `src/services/hashtags.ts`
  (`HashtagResponse.active_challenge`/`recent_result_challenge`, `getHashtagFeedHotRequest`),
  `src/services/memes.ts` (`HotFeedPageResponse`), `src/services/challenges.ts`
  (`ChallengeResponse.viewer_side_id`), `src/features/challenges/DuelDetailScreen.tsx` + `.web.tsx`.

## Tests
- `backend/tests/test_trending.py` (6): distinct-authors beats one prolific poster, 24h
  window excludes stale memes, friends-only doesn't leak into the global list, active-challenge
  boost outranks an identical organic tag, cold-start fallback ladder + honest `reason`
  labels, cron warms the cache and a request is served from it (same `generated_at`).
- `backend/tests/test_search.py` (13): the Barcelona-vs-Real-Madrid worked example end to
  end, two-token match outranks one-token, Posts caption-only + tag-only matches,
  friends-only/community-private visibility, soft-deleted meme never appears,
  intra_community/duel invisible to a non-participant, open-community `community_vs_community`
  visible to a non-member while an all-invite-only one isn't, the
  `challenge_visibility_clause` ↔ `_require_involved_member` parity check across all four
  shapes, `scope=all` caps at 10 with `capped`/`has_more` set, `q="a"` → empty 200, auth
  required (401).
- `backend/tests/test_hashtag_hot_feed.py` (2, S5): the Hot route (`/memes/hot`) is
  visibility-gated identically to the existing keyset route, negative offset → 422.
- `backend/tests/test_open_challenges.py` (+13, S1/S4): see [[challenges]]'s 2026-08-27 entry
  for the full list — reservation release-on-evaluation, 14-day cap, per-user cap +
  platform-account exemption, popular-tag block, `HashtagOut`'s two embedded challenges incl.
  24h drop-off, weekly-cron idempotency surviving evaluation, `viewer_side_id` survives a
  refetch. `test_duels.py`/`test_vs_challenges.py` each gained one `viewer_side_id` test.
- `frontend/src/features/search/components/SearchTabs.test.ts` (3): the auto-select-first-non-empty-tab
  logic, extracted as a pure `selectAutoTab(sections)` function specifically so it's
  unit-testable without a component-rendering harness (none exists in this codebase — every
  other frontend test targets `services/`/`store/` pure logic, same pattern followed here).
  `useHashtagFeed`'s Hot/Latest branching is a trivial ternary, not meaningfully
  branching business logic — left untested, consistent with "skip if pure composition."
  `tsc`/`expo lint` clean on every touched file.
