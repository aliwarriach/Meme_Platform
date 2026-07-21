# Project Timeline — Meme Creation & Sharing Platform

This is the living build plan: phases in build order, each with an **exit test** that must pass before the next phase starts. See `Project_Requirements.md` for what each feature must do, and `CLAUDE.md` (root/backend/frontend) for how it's built. Durations are t-shirt sizes, not calendar promises — nobody has real velocity data for this project yet. Fill in actual dates as each phase starts/finishes.

**Rule of the sequence**: a phase isn't "done" because the code is written — it's done when its exit test passes on a real device/API call, not just unit tests in isolation. Don't start the next phase's build until the current one's exit test is green. If a phase turns up a design gap, fix it in `Project_Requirements.md` before continuing, don't quietly improvise around it in code.

**Update cadence**: update the status column + add a Daily Log entry (bottom of this file) at the end of every work day — what moved, what's blocked, what's next. Stale timeline is worse than no timeline.

## Status legend
`Not started` · `In progress` · `Blocked` · `Testing` · `Done`

## Phase index

| # | Phase | Size | Status | Started | Finished |
|---|-------|------|--------|---------|----------|
| 0 | Project scaffolding | S | Done | — | — |
| 1 | Auth & profile | S | Testing (see note) | 2026-07-20 | |
| 2 | Friends | S | Not started | | |
| 3 | Public feed (Public/Friends audiences only) | M | Not started | | |
| 4 | Meme creator + global templates | M | Not started | | |
| 5 | Communities core (create/join/leave, privacy) | M | Not started | | |
| 6 | Community-private templates | S | Not started | | |
| 7 | Multi-audience posting (+ community) | M | Not started | | |
| 8 | Scoring stub + leaderboards (individual, global community, internal community) | M | Not started | | |
| 9 | Global competitions (Meme of Day/Week/Month) | S | Not started | | |
| 10 | Community challenges — intra-community team vs. team | L | Not started | | |
| 11 | Community challenges — community vs. community | M | Not started | | |
| 12 | Real-time meme sending + inbox | M | Not started | | |
| 13 | AI caption/joke generator | S | Not started | | |
| 14 | Sharing system | S | Not started | | |
| 15 | Instagram Companion Mode | M | Not started | | |
| 16 | Hardening pass (security, perf, accessibility, full regression) | M | Not started | | |

---

## Phase 0 — Project scaffolding
**Goal**: backend and frontend projects exist, boot, and talk to a real Postgres instance.
**Deliverables**: FastAPI skeleton (SQLAlchemy + Alembic wired to Postgres), Expo RN skeleton with the agreed folder structure, both `CLAUDE.md`s reflecting the real stack.
**Exit test**: `uvicorn` boots the FastAPI app against a live Postgres `DATABASE_URL`; `alembic upgrade head` runs clean on an empty DB; Expo app builds and launches on a device/simulator to the default screen.
**Status**: Done (completed in an earlier session).

## Phase 1 — Auth & profile
**Goal**: a user can register, log in, and see their own profile — the identity every later phase depends on.
**Deliverables**: `User` model + migration, JWT issue/verify, register/login/me endpoints, RN login/register screens, session held in a Redux slice.
**Exit test**: register a new account via the app, log out, log back in, see the correct profile on the Profile screen; a request to a protected endpoint without a token is rejected (401).
**Note (2026-07-20)**: backend fully verified (automated tests + manual curl, real Postgres). Frontend type-checks and bundles clean (`tsc`, `expo export --platform web`), but the actual tap-through on a simulator/device/`expo start` hasn't been done by a human yet — no browser/device automation available in this session. **Do that manual pass before flipping this row to `Done`.** See `.claude/memory/auth-profile.md` for full detail.

## Phase 2 — Friends
**Goal**: the Friends relationship exists and is provably separate from community membership (needed before Phase 3's audience filtering).
**Deliverables**: `friendship` model (request/accept/remove), friends list/request endpoints, RN friends screen.
**Exit test**: user A sends a friend request to user B, B accepts, both see each other in their friends list; a third user C does not see A/B as friends.

## Phase 3 — Public feed (Public/Friends audiences only)
**Goal**: the core feed loop works before communities exist to complicate it — Community audience is added later in Phase 7 on purpose, so audience filtering is provable in isolation first.
**Deliverables**: `Meme`/`post_audience` models, upload endpoint (image, no text overlay editor yet — server just stores the image + caption text), infinite-scroll feed endpoint filtered by audience, reactions + comments, RN feed screen with `FlatList`.
**Exit test**: post as Public — a logged-out-of-friendship third user can see it; post as Friends-only — only accepted friends see it, a non-friend does not; reactions/comments round-trip correctly.

## Phase 4 — Meme creator + global templates
**Goal**: the actual creation tool — upload, text overlay, template picker, preview/publish — works end to end using only the global template library (community templates don't exist until Phase 6).
**Deliverables**: `Template` model (global scope only for now), text overlay editor (gesture-handler + reanimated), camera/gallery picker, preview screen, publish wired to the Phase 3 feed endpoint.
**Exit test**: pick a template, add top/bottom text, preview matches the final published post pixel-for-pixel (same overlay position/text), publish succeeds and appears in the feed from Phase 3.

## Phase 5 — Communities core
**Goal**: communities exist as a first-class entity with real membership and access control, before anything (templates, feeds, leaderboards) is scoped to them.
**Deliverables**: `Community`/`community_membership` models, owner-set privacy (`open`/`invite_only`), create/join/leave/invite-approve endpoints, RN Communities tab (My Communities / Discover) + Community Detail shell (Members tab only for now).
**Exit test**: create an open community, a second user joins with no approval step; create an invite-only community, a join request requires owner approval before membership is granted; a non-member cannot hit any member-only endpoint for that community (403, not just hidden in UI).

## Phase 6 — Community-private templates
**Goal**: prove the "private to members, invisible to everyone else" rule on the simplest possible feature before it's load-bearing for posting/challenges.
**Deliverables**: `template.community_id`, community template upload/browse endpoints, RN Templates tab split (global vs. this community's private set).
**Exit test**: a member uploads a community template — a non-member's global template list does not include it, and a direct API request for it as a non-member is rejected; a member sees and can apply it in the creator.

## Phase 7 — Multi-audience posting (+ community)
**Goal**: extend the Phase 3 audience system to include one-or-more communities, now that Phase 5 gives it something real to point at.
**Deliverables**: creator audience selector's Community option wired live (multi-select from the user's own communities), community feed endpoint/screen, backend audience validation (can't post to a community you're not in).
**Exit test**: publish one meme to Public + a specific community simultaneously — it shows in both the public feed and that community's feed, and does **not** show in a community the user didn't select; attempting to post to a community the user isn't a member of is rejected server-side even if the client is tampered with.

## Phase 8 — Scoring stub + leaderboards
**Goal**: get the three read-only leaderboard surfaces working against a deliberately simple placeholder scoring formula, without waiting on the full scoring-engine design (see `Project_Requirements.md` §7).
**Deliverables**: `services/scoring.py` stub (e.g. likes + comments, clearly labeled placeholder), background recompute worker, individual leaderboard, global community leaderboard, internal per-community leaderboard, RN Leaderboards tab + community-scoped leaderboard tab.
**Exit test**: all three leaderboards rank correctly against known seeded data; internal community leaderboard is only reachable/visible to that community's members; **no endpoint accepts a write to any leaderboard** — they are read paths only.

## Phase 9 — Global competitions (Meme of the Day/Week/Month)
**Goal**: the one-vote-per-period competition layer, independent of community challenges.
**Deliverables**: `Vote` model with the `(user_id, meme_id, period)` unique constraint, vote endpoint, period-close worker, RN voting UI + winner display.
**Exit test**: a user's first vote in a period succeeds, a second vote in the same period is rejected by the DB constraint (not just the API layer); at period close, the correct winner is surfaced.

## Phase 10 — Community challenges: intra-community team vs. team
**Goal**: the first full challenge lifecycle (setup → active window → evaluation → results/rewards) in its simplest shape, one community, two internal sides.
**Deliverables**: `challenge`/`challenge_participant`/`challenge_submission` models, challenge setup/submit endpoints, scheduled window-close + evaluation worker (using the Phase 8 scoring stub), points + badge award, RN challenge setup wizard + active/results screens.
**Exit test**: set up a short test-length challenge (minutes, not days, for testability), two sides submit memes, a submission attempted after window close is rejected, evaluation picks the correct winner per the scoring stub, winner's members receive points + a badge visible on their profile.

## Phase 11 — Community challenges: community vs. community
**Goal**: the second challenge shape, reusing Phase 10's lifecycle machinery scoped to two communities instead of two sides within one.
**Deliverables**: challenge type variant for cross-community, matching UI entry point.
**Exit test**: two communities' members submit during the window, aggregate community performance determines the winner, both communities' leaderboard standing (Phase 8) updates accordingly.

## Phase 12 — Real-time meme sending + inbox
**Goal**: friend-to-friend real-time sending, independent of the feed/community system.
**Deliverables**: WebSocket connection manager, inbox fallback row for offline recipients, reaction-only replies, RN inbox drawer + socket-status Redux slice.
**Exit test**: two connected clients send/receive a meme in real time with no page refresh; one recipient goes offline, receives the meme as an inbox entry, and sees it correctly on reconnect.

## Phase 13 — AI caption/joke generator
**Goal**: LLM-assisted captioning bolted onto the existing creator, fully backgrounded so it can never block publish.
**Deliverables**: `integrations/llm_client.py`, background task with timeout/retry, "make it funnier" iteration endpoint, RN caption generator UI in the creator.
**Exit test**: request a caption, receive a suggestion within the configured timeout; trigger a provider failure/timeout (mocked) and confirm the creator still lets the user publish manually rather than hanging or crashing.

## Phase 14 — Sharing system
**Goal**: get memes out of the app onto other platforms.
**Deliverables**: native share sheet integration, image/video export.
**Exit test**: share sheet opens with the correct target apps on both iOS and Android; exported file matches the published meme (image/text overlay intact).

## Phase 15 — Instagram Companion Mode
**Goal**: wrap external Reels/posts as first-class, competition-eligible content without re-hosting video.
**Deliverables**: `MemeContainer` model, share-to-app intake, oEmbed/link metadata fetch (background task), WebView display, independent reactions/comments, feed-level competition eligibility.
**Exit test**: share a Reel link into the app, a `MemeContainer` is created with correct metadata/thumbnail, it appears in the public feed and can be voted on (Phase 9), and — confirmed per `Project_Requirements.md` — it **cannot** be submitted as a challenge entry (Phase 10/11 submission endpoint rejects it).

## Phase 16 — Hardening pass
**Goal**: a full regression across every permission/audience/scoring surface before calling the MVP done, plus the non-functional work that's easy to skip mid-feature.
**Deliverables**: security review (auth, audience/community access checks, rate limiting on write endpoints), performance pass on feed/leaderboard/challenge queries under seeded load, accessibility pass on core screens (labels, touch targets, screen reader), full cross-phase regression.
**Exit test**: security review has no open criticals; leaderboard/feed endpoints hold acceptable latency under seeded load; accessibility audit passes on Feed, Creator, Communities, Leaderboards, Profile; every exit test from Phases 1–15 still passes in sequence on a clean environment.

---

## Daily Log
Newest entry on top. One entry per work day: what shipped, what's blocked, what's next.

### 2026-07-20
- Phase: 1 (Auth & profile)
- Done: Backend — `User` model, JWT auth (`bcrypt` + `python-jose`), `/auth/register|login|me`, Alembic migration applied to a real local Postgres (`meme_platform` dev DB), 9/9 pytest passing against a dedicated `meme_platform_test` DB. Frontend — NativeWind/Redux Toolkit/TanStack Query/React Hook Form+Zod wired in; login/register/session screens; `expo-secure-store` session persistence with a bootstrap-on-launch flow; removed the leftover Expo demo screens/components. `tsc --noEmit` and `expo export --platform web` both clean. Set up `.claude/memory/` (README + `auth-profile.md`).
- Blocked: nothing blocking. Local Postgres found on `127.0.0.1:5432` (password provided by user), separate `meme_platform`/`meme_platform_test` DBs created so this project doesn't share state with the sibling `Lead_Generator` project.
- Next: human needs to actually tap through the app (register → logout → login → see profile) on a simulator/device/`npm run android`/`npm run web` to close out Phase 1's exit test, then start Phase 2 (Friends).

<!--
### 2026-XX-XX
- Phase: #
- Done:
- Blocked:
- Next:
-->
