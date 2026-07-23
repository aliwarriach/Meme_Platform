# hardening (Phase 16)

## Status
Testing. Security, performance, and accessibility sub-passes done. Automated regression done (full backend suite, 145/145, green with every Phase 16 change applied together). The manual half of the exit test — re-running Phases 1-15's actual exit tests by hand on a live device/simulator — is the one remaining item before Phase 16 can flip to Done; see Project_Timeline.md's Phase 16 entry for the walkthrough.

## Security review (done)
Ran a full audit of every router/service against auth, audience/community access-control, and IDOR risk (see `.claude/memory/meme-sending.md` for the one real bug found). Auth coverage, community membership gating, and owner-only mutation checks were already solid across all 15 prior phases — no other IDOR/access-control gaps found.

### Rate limiting (new — didn't exist before this phase)
- New `app/core/rate_limit.py`: a `slowapi.Limiter` keyed by **authenticated user ID** (decoded from the bearer token, when present) so limits track the account rather than a shared/rotating IP; falls back to client IP only for the pre-auth `register`/`login` endpoints. Storage backend is `settings.redis_url` (`storage_uri=`) — **this is the first real usage of Redis anywhere in the codebase**; every prior phase computed things live in SQL or in-process, so the `redis` Python package (listed in `requirements/base.txt` since Phase 0 but never actually installed/exercised) had to be installed for real. Wired into `app/main.py` via `app.state.limiter` + `SlowAPIMiddleware` + the `RateLimitExceeded` exception handler (429 responses).
- Limits applied (per-user unless noted, all `@limiter.limit(...)` decorators on the route function, which must take a `request: Request` param for slowapi to key off):
  - `POST /auth/register` — 5/minute (IP-keyed)
  - `POST /auth/login` — 10/minute (IP-keyed)
  - `POST /ai-caption/generate` — 15/minute (real billed Groq call per request)
  - `POST /competitions/{period}/votes/{meme_id}` and `.../container-votes/{id}` — 30/minute each
  - `POST /memes` (upload) — 20/minute
  - `POST /memes/{id}/reactions` — 60/minute
  - `POST /memes/{id}/comments` — 30/minute
  - `POST /meme-sending/send` — 30/minute
  - `POST /instagram/containers` — 10/minute (each call spawns a fire-and-forget background metadata-fetch task, so this is capped tighter than typical writes)
- **Test isolation**: rate-limit counters live in Redis, not the per-test Postgres schema `_reset_schema` fixture already resets — without a matching reset, counters leak across tests that share the same key (e.g. many tests share `127.0.0.1` as the IP-fallback key). Fixed with a new autouse `_reset_rate_limits` fixture in `conftest.py` that calls `limiter.reset()` before every test.
- Not rate-limited (deliberately): read-only GETs (feed, leaderboards, standings) and challenge-lifecycle mutations (setup/submit/accept/decline) — these are naturally infrequent/owner-gated and not realistic abuse vectors.

### CORS
- `app/main.py`'s `CORSMiddleware` no longer uses `allow_origins=["*"]`. Now reads `settings.cors_origins` (new `CORS_ALLOWED_ORIGINS` env var, comma-separated, parsed via a `cors_origins` property on `Settings` in `core/config.py`), defaulting to Expo's local web dev ports (`http://localhost:8081`, `http://localhost:19006`) so local dev needs no `.env` change. Also added `allow_credentials=True`. Set `CORS_ALLOWED_ORIGINS` explicitly in `.env` before any non-local deployment — a wildcard origin with credentials is invalid per the CORS spec anyway (browsers reject it), so this was a correctness fix as much as a security one.

## Key files
- `backend/app/core/rate_limit.py` (new), `backend/app/core/config.py` (`cors_origins`), `backend/app/main.py` (CORS + slowapi wiring), `backend/tests/conftest.py` (`_reset_rate_limits` fixture), `backend/.env.example`.
- Touched for the IDOR fix: `backend/app/services/meme_sending.py`, `backend/tests/test_meme_sending.py`.

## Tests
- Full backend suite (145/145) passing with rate limiting + CORS changes + the IDOR fix all live, against real Postgres + real Redis.

## Performance pass (done)
Reviewed indexes on every table touched by the feed/leaderboard/challenge/competition hot-path queries (`services/memes.py::meme_visibility_clause`, `services/leaderboards.py`, `services/challenges.py`, `services/competitions.py`) — most FK columns were already indexed from earlier phases, but a few real gaps existed:
- `memes.created_at` had **no index** despite being the feed's primary sort key (keyset pagination orders by `(created_at desc, id desc)`) — added a composite `ix_memes_created_at_id`.
- `community_memberships.status` had no index, despite `status == active` being filtered on every single community-scoped access check (`require_active_membership`, called from templates/feed/leaderboards/challenges — the single hottest lookup in the app) — added a composite `ix_community_memberships_community_user_status (community_id, user_id, status)` covering the whole check in one index.
- `friendships.status` had no index, despite being filtered in the feed visibility clause's two correlated EXISTS subqueries (friend-of-author, checked per candidate meme) — added `ix_friendships_requester_status` / `ix_friendships_addressee_status`.
- `challenge_participants.user_id` and `challenge_submissions.{meme_id,submitter_id}` had no index at all (not even via a FK — Postgres doesn't auto-index FKs) — added `index=True` to each.
- `post_audiences.audience_type` looked unindexed on paper, but its two existing **partial unique indexes** (`uq_post_audience_public_friends` on `(meme_id, audience_type) WHERE audience_type != 'community'`, `uq_post_audience_community` on `(meme_id, community_id) WHERE audience_type = 'community'`) already cover the visibility clause's actual query shapes — no new index needed there, confirmed by reading the actual predicates rather than trusting a flat column-index count.
- New migration: `alembic/versions/6b07283419b0_add_performance_indexes_for_feed_.py` (autogenerated, applied to the real dev DB). All 7 indexes are pure additions — no data migration, no behavior change, so no new tests were needed (existing 145/145 still pass, confirming query correctness is unaffected).

### Seeded-load timing
Ran a one-off script (not committed — throwaway, seeds via the real app/services against the dedicated `meme_platform_test` DB, not real dev data) with slowapi disabled for the run: 60 users, 5 open communities (all users joined to all 5), a friend chain (~5 friends/user), 480 memes (mixed public/friends/community audiences), reactions on 1/4 of memes (20 reactors each) and comments on 1/6 (5 commenters each). Timed cold (first-call, no warm cache) latency post-migration:

| Endpoint | Latency |
|---|---|
| `GET /memes/feed` (limit=20) | 299 ms |
| `GET /memes/feed` (limit=50) | 507 ms |
| `GET /communities/{id}/feed` | 184 ms |
| `GET /leaderboards/individual` | 202 ms |
| `GET /leaderboards/communities` | 185 ms |
| `GET /communities/{id}/leaderboard` | 292 ms |
| `GET /competitions/day/current` | 279 ms |

All well under 1s at this scale (reasonable for an MVP's expected initial user base), so judged **acceptable** for the Phase 16 exit test as written ("holds acceptable latency under seeded load"). The `limit=50` feed page is the one endpoint that scales noticeably worse than the rest (~1.7x the `limit=20` page rather than the expected ~2.5x row-count increase, actually sublinear — but still the slowest absolute number) because `build_meme_out` walks each meme's `selectin`-loaded `audiences` relationship in Python for every row; if feed latency becomes a real problem at higher scale (thousands of concurrent users, not the tens-of-thousands-of-rows tested here), that per-row Python-side loop plus the live reaction/comment COUNT subqueries per row (`services/memes.py::_paginated_feed`) are the next things to look at — likely a stored/cached count rather than a live aggregation, mirroring the same "live SQL now, cache later" trajectory already taken for [[scoring-engine]].

## Accessibility pass (done)
Frontend had never had an accessibility pass — `frontend/CLAUDE.md` mandates accessible labels/roles/touch targets as a directive, but it wasn't consistently applied. Audited the 5 screens the Phase 16 exit test names (Feed, Creator, Communities, Leaderboards, Profile) and fixed the real gaps found (most primary action buttons already had `accessibilityRole`/`accessibilityLabel` from earlier phases — the gaps clustered in a few recurring patterns):
- **Decorative avatar/icon `View`/`Image`s** (username initials circles, community icon fallbacks) had no `accessibilityElementsHidden`/`importantForAccessibility="no-hide-descendants"`, so a screen reader would announce raw initials text ("AL", "BE") with no context. Fixed across `SessionScreen.tsx` (Profile), `MemeCard.tsx` (Feed), `CommunityCard.tsx` (Communities), and both leaderboard row components.
- **Meme/preview images had no accessible label at all** — the actual content of the app was invisible to a screen reader. Fixed in `MemeCard.tsx` (feed image, labeled with caption or author), `OverlayCanvas.tsx` (in-progress edit), and `CreatorScreen.tsx` (captured preview).
- **Toggle/selection state not exposed via `accessibilityState`** — reaction hearts, Meme-of-the-Day vote buttons, tab toggles (Leaderboards' Individual/Communities, Communities' Mine/Discover), and the Create-Community privacy radio options all conveyed "selected" purely via background/border color, with the same label announced regardless of state. Added `accessibilityState={{selected/checked}}` throughout, plus switched tab Pressables to `accessibilityRole="tab"` and the privacy options to `accessibilityRole="radio"` (were generic `"button"`).
- **Leaderboard rows read as 3-4 disjoint text fragments** (rank, avatar, name, score all separate `Text` nodes with no grouping) — added a single `accessibilityLabel` (e.g. "Rank 3, jdoe, 420 points") on the wrapping `View` with `accessible` set, in both `IndividualLeaderboardRow.tsx` and `CommunityLeaderboardRow.tsx`.
- **`SessionScreen.tsx` (Profile) had zero accessibility props anywhere** — the clear outlier among the 5 screens; every nav button (Feed/Friends/Communities/Leaderboards/Voting/Inbox/Log out) got `accessibilityRole="button"` + a label, plus `accessibilityRole="header"` on the username.
- **Flagged, not fixed**: `DraggableText.tsx` (the Creator's drag-to-position top/bottom text overlay) has no non-visual alternative to dragging — a screen-reader/switch-control user cannot reposition text at all. Added `accessibilityRole="adjustable"` + a label/hint describing current text and that it's draggable, but a real fix (e.g. stepper buttons or a position picker) is a UI feature addition beyond a hardening-pass label/role fix, and wasn't built here — flagged for a follow-up decision, not silently addressed.
- Verified clean after all edits: `tsc --noEmit` (0 errors), `expo lint` (0 errors, same 2 pre-existing React Compiler/`react-hook-form` `watch()` warnings as every prior phase), `expo export --platform web` (17 routes, unchanged).

## Key files (accessibility)
- `frontend/src/features/auth/SessionScreen.tsx`, `frontend/src/features/feed/components/MemeCard.tsx`, `frontend/src/features/creator/components/{DraggableText,OverlayCanvas}.tsx`, `frontend/src/features/creator/CreatorScreen.tsx`, `frontend/src/features/communities/{CommunitiesScreen,CreateCommunityScreen}.tsx`, `frontend/src/features/communities/components/CommunityCard.tsx`, `frontend/src/features/leaderboards/LeaderboardsScreen.tsx`, `frontend/src/features/leaderboards/components/{IndividualLeaderboardRow,CommunityLeaderboardRow}.tsx`.
