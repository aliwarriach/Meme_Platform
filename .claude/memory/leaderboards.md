# leaderboards

## Status
Done (Phase 8 backend + frontend built). Backend fully tested against real Postgres (84/84 pytest total, 8 new; Cloudinary mocked). Frontend type-checks and bundles clean (`tsc`, `expo export --platform web` — 12 routes), `expo lint` 0 errors. All three surfaces are **read-only** — no service function here mutates a score, meme, or membership row. No human tap-through yet.

## Endpoints
All require Bearer auth. All ranking is built on [[scoring-engine]]'s `meme_score_expr()` stub.
- `GET /leaderboards/individual?page=&limit=` — all users platform-wide, ranked by the sum of their memes' scores across **all** their memes regardless of audience (a user's own standing isn't audience-gated the way reading someone else's feed is). → `200` `IndividualLeaderboardPage` = `{items: [{rank, user: UserOut, score}], next_cursor}`. Users with zero memes still appear, at score 0.
- `GET /leaderboards/communities?page=&limit=` — all communities platform-wide ("which communities are best"), ranked by the aggregate score of memes posted *into* them (community-typed `PostAudience` rows only). Visible to everyone regardless of membership — matches [[communities]]'s discovery-vs-content-visibility split (existence/ranking is public; only *content* is member-gated). → `200` `CommunityLeaderboardPage` = `{items: [{rank, community_id, community_name, score}], next_cursor}`.
- `GET /communities/{id}/leaderboard?page=&limit=` (registered in `routers/communities.py`, matching the established convention for community-scoped routes — see [[meme-feed]]'s community feed/post routes) — **internal** per-community leaderboard: that community's own **active members only**, ranked by their score from **community posts targeting this specific community only** (not their platform-wide individual score, not scores from other communities they belong to). Member-gated with no open-community exception (`require_active_membership`, same as the community feed) — `403` non-member, `404` nonexistent community. → same `IndividualLeaderboardPage` shape as the global individual leaderboard.

## Business rules
- **Three genuinely distinct queries, not variations of one** (Project_Requirements §8 explicitly warns against conflating the global-community and internal-community leaderboards): the global community leaderboard sums *all* community-post scores per community; the internal one further restricts to *that one* community's `PostAudience.community_id` and to the community's own active membership roster.
- **Pagination is offset-based (`page`/`limit`), not the keyset cursor scheme** [[meme-feed]]/[[communities]] use — a score-ranked list's order key isn't a monotonic `created_at`, so there's no stable resume-from-row once ties/score changes are involved. `next_cursor` in the response is just the next page number as a string; don't feed it through `core/pagination.py`'s cursor helpers.
- **No write endpoint exists anywhere in this feature** — verified explicitly in the exit test's "no endpoint accepts a write to any leaderboard" requirement. `services/leaderboards.py` has no `create`/`update`/`delete` function.

## Frontend integration notes
- `services/leaderboards.ts` + `services/useLeaderboards.ts` — three `useInfiniteQuery` hooks (`useIndividualLeaderboard`, `useGlobalCommunityLeaderboard`, `useInternalCommunityLeaderboard(communityId, enabled)`), numeric `pageParam` (not a cursor string) per the offset-pagination note above.
- `features/leaderboards/LeaderboardsScreen.tsx` (route `/leaderboards`, reachable via a "Leaderboards" button on `SessionScreen`) — tab toggle between Individual / Communities (the two **global**, platform-wide surfaces). Uses shared row components `components/{IndividualLeaderboardRow,CommunityLeaderboardRow}.tsx`.
- The **internal** per-community leaderboard is a third tab (`Feed / Members / Leaderboard`) added directly inside `features/communities/CommunityDetailScreen.tsx`, member-gated the same way the existing Members tab already is (`isMember` check) — reuses `IndividualLeaderboardRow`, not a separate component, since the row shape (rank/user/score) is identical to the global individual leaderboard.
- `IndividualLeaderboardRow` highlights the viewer's own row (`isViewer` prop, compares `entry.user.id` to the Redux `auth.user.id`) — a small UX nicety so a user can find themselves in a long list without counting ranks.

## Key files
- backend: `app/services/{scoring,leaderboards}.py`, `app/schemas/leaderboards.py`, `app/routers/leaderboards.py` (global individual + global community), `app/routers/communities.py` (internal community leaderboard route, logic in `services/leaderboards.py`).
- frontend: `src/services/{leaderboards,useLeaderboards}.ts`, `src/features/leaderboards/*`, `src/features/communities/CommunityDetailScreen.tsx` (internal tab), `src/app/leaderboards.tsx`.

## Tests
- `backend/tests/test_leaderboards.py` (8 tests, real Postgres): individual leaderboard ranks correctly by reactions+comments including a zero-score user; auth-required; global community leaderboard ranks by community-post scores and is visible to a non-member of an invite-only community; internal leaderboard requires active membership (403)/404s on nonexistent community/ranks members by **community-post-only** score (excludes a member's personal-post score and another community's scores).
