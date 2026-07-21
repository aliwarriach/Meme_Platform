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
| 1 | Auth & profile | S | Done | 2026-07-20 | 2026-07-21 |
| 2 | Friends | S | Done | 2026-07-21 | 2026-07-21 |
| 3 | Public feed (Public/Friends audiences only) | M | Done | 2026-07-21 | 2026-07-21 |
| 4 | Meme creator + global templates | M | Done | 2026-07-21 | 2026-07-21 |
| 5 | Communities core (create/join/leave, privacy) | M | Done | 2026-07-21 | 2026-07-21 |
| 6 | Community-private templates | S | Done | 2026-07-21 | 2026-07-21 |
| 7 | Multi-audience posting (+ community) | M | Done | 2026-07-21 | 2026-07-21 |
| 8 | Scoring stub + leaderboards (individual, global community, internal community) | M | Testing | 2026-07-21 | |
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
**Note (2026-07-20)**: backend fully verified (automated tests + manual curl, real Postgres). Frontend type-checks and bundles clean (`tsc`, `expo export --platform web`).
**Note (2026-07-21)**: user manually tapped through register → logout → login → profile against live `uvicorn` + `expo start --web` dev servers — confirmed working. Exit test green. See `.claude/memory/auth-profile.md` for full detail.

## Phase 2 — Friends
**Goal**: the Friends relationship exists and is provably separate from community membership (needed before Phase 3's audience filtering).
**Deliverables**: `friendship` model (request/accept/remove), friends list/request endpoints, RN friends screen.
**Exit test**: user A sends a friend request to user B, B accepts, both see each other in their friends list; a third user C does not see A/B as friends.
**Note (2026-07-21)**: started without Phase 1's manual on-device gate being green (user's explicit call — see Daily Log). Backend fully verified (16 new pytest, 22/22 total, against real Postgres; migration applied to the dev DB). Frontend type-checks and bundles clean (`tsc`, `expo export --platform web`). User then manually tapped through both Phase 1 and Phase 2 flows together against live dev servers — friend request send/accept/mutual-visibility confirmed working. Exit test green. See `.claude/memory/friends.md` for full detail.

## Phase 3 — Public feed (Public/Friends audiences only)
**Goal**: the core feed loop works before communities exist to complicate it — Community audience is added later in Phase 7 on purpose, so audience filtering is provable in isolation first.
**Deliverables**: `Meme`/`post_audience` models, upload endpoint (image, no text overlay editor yet — server just stores the image + caption text), infinite-scroll feed endpoint filtered by audience, reactions + comments, RN feed screen with `FlatList`.
**Exit test**: post as Public — a logged-out-of-friendship third user can see it; post as Friends-only — only accepted friends see it, a non-friend does not; reactions/comments round-trip correctly.
**Note (2026-07-21)**: media storage decided as Cloudinary (user's choice — credentials added to `backend/.env`). Backend: `Meme`/`PostAudience`/`Reaction`/`Comment` models, keyset-paginated feed with server-side audience visibility (reused Phase 2's `Friendship` model directly), migration applied to the real dev DB; 38/38 pytest passing total (16 new, Cloudinary calls mocked in tests) against real Postgres; Cloudinary integration additionally smoke-tested for real via a manual multipart upload — confirmed a live, publicly-reachable `res.cloudinary.com` URL. Frontend: `FeedScreen` (infinite scroll + pull-to-refresh), `NewPostScreen` (minimal upload UI — no text overlay/templates, that's Phase 4), inline-expandable comments on each card; `tsc`/`expo export --platform web` both clean (8 routes). See `.claude/memory/meme-feed.md` for full detail, including two real bugs hit and fixed along the way (an async relationship-loading gotcha and a FastAPI multipart-form gotcha — both documented there for future phases).
**Note (2026-07-21, cont'd)**: user manually tapped through Phase 3's exit test on live dev servers — Public/Friends visibility and reactions/comments confirmed working. Exit test green, phase flipped to Done.

## Phase 4 — Meme creator + global templates
**Goal**: the actual creation tool — upload, text overlay, template picker, preview/publish — works end to end using only the global template library (community templates don't exist until Phase 6).
**Deliverables**: `Template` model (global scope only for now), text overlay editor (gesture-handler + reanimated), camera/gallery picker, preview screen, publish wired to the Phase 3 feed endpoint.
**Exit test**: pick a template, add top/bottom text, preview matches the final published post pixel-for-pixel (same overlay position/text), publish succeeds and appears in the feed from Phase 3.
**Note (2026-07-21)**: Backend: `Template` model (global scope, no `community_id` yet — that's Phase 6) + `/templates` create/list endpoints, reusing Phase 3's Cloudinary upload path via a newly-extracted shared `services/media.py` (promoted since templates is the 2nd consumer of image-upload validation) and a shared `core/pagination.py` cursor helper (2nd consumer of Phase 3's keyset cursor scheme). Migration applied to the real dev DB; 46/46 backend pytest passing total (8 new for templates, Cloudinary mocked — mock consolidated into `conftest.py`). Frontend: new `features/creator/` replaces the old minimal `NewPostScreen` at the same `/new-post` route — pick own image or a template (grid picker modal with inline template-upload), drag top/bottom text overlay on an `OverlayCanvas` (`react-native-gesture-handler` + `react-native-reanimated`, both newly wired up via a new `GestureHandlerRootView` in `_layout.tsx`), **Preview** captures the composed view to a real PNG via newly-added `react-native-view-shot`, then caption + Public/Friends audience selection, then **Publish** uploads that exact captured file through the unchanged Phase 3 `/memes` endpoint — preview and published post are pixel-identical by construction (same file), not by comparison. `tsc`, `expo export --platform web` (8 routes, unchanged), and `expo lint` (bootstrapped ESLint for the first time in this repo as a side effect — 0 errors, 1 pre-existing React Compiler/`react-hook-form` warning) all clean. Seeded a real global template (user-supplied `meme_template.jpg`, uploaded via the real `/templates` endpoint, not a raw file copy). Editor scope explicitly confirmed with user: top/bottom draggable text only, no arbitrary text boxes/stickers — intended design, not a gap.
**Note (2026-07-21, cont'd)**: hit and fixed a stale-server bug during manual testing — an orphaned `uvicorn --reload` worker process (parent already killed, child survived — a Windows-specific quirk, since killing a process there doesn't cascade to children) kept serving pre-Phase-4 routes, causing `/templates` to 404 even though the code was correct. Killed the orphaned process tree and restarted cleanly; documented in `.claude/memory/meme-creator.md` as a gotcha for future phases. User then manually tapped through Phase 4 on live dev servers and confirmed it works. Exit test green, phase flipped to Done.

## Phase 5 — Communities core
**Goal**: communities exist as a first-class entity with real membership and access control, before anything (templates, feeds, leaderboards) is scoped to them.
**Deliverables**: `Community`/`community_membership` models, owner-set privacy (`open`/`invite_only`), create/join/leave/invite-approve endpoints, RN Communities tab (My Communities / Discover) + Community Detail shell (Members tab only for now).
**Exit test**: create an open community, a second user joins with no approval step; create an invite-only community, a join request requires owner approval before membership is granted; a non-member cannot hit any member-only endpoint for that community (403, not just hidden in UI).
**Note (2026-07-21, cont'd)**: user tapped through Phase 5's exit test on live dev servers across two sessions — open-community join confirmed instant, invite-only join confirmed pending-then-owner-approved, and a non-member correctly got a 403 (not just hidden UI) trying to view an invite-only community's members, which the detail screen surfaced gracefully as inline text rather than a crash. Along the way fixed two real frontend bugs (both documented in `.claude/memory/communities.md`): a broken `communities/index.tsx` + `communities/[id].tsx` folder co-location that made Expo Router swallow `/communities` navigation into the dynamic route (`id="index"`, sent as a literal non-UUID to the backend), fixed by moving the list screen to a flat `communities.tsx`; and a noisy `console.error` in `services/api.ts::throwApiError` that fired for every gracefully-handled error (including expected 403s), removed since the existing `console.warn` network monitor already covers debugging needs without looking like a crash. Exit test green, phase flipped to Done.
**Note (2026-07-21)**: Backend: `Community`/`CommunityMembership` models (`owner`/`member` roles only — no `admin` yet, nothing to promote to it in this phase), `/communities` endpoints — create (auto-adds owner as an active member), discover (paginated, all communities regardless of privacy — existence is public per Requirements §3, only member-only *content* is gated), mine (unpaginated), single-get, join (open→immediate, invite-only→pending), leave (owner blocked, 400), members (open→public, invite-only→members-only, 403 otherwise), join-requests list/approve/reject (owner-only). Migration applied to the real dev DB; 61/61 backend pytest passing total (15 new). Frontend: `features/communities/` — Communities tab (My Communities/Discover) reachable from the profile screen, Create Community screen (name/description/privacy/optional icon), Community Detail screen (join/leave/pending button that switches on `viewer_membership_status`, owner-only join-requests approve/reject section, members list). First folder-based nested route group in the app (`app/communities/{index,new,[id]}.tsx`) — hit an Expo Router typed-routes quirk (bare `/communities` isn't a valid typed href, only `/communities/index`; dynamic `[id]` navigation needs the object form, not a template string), documented in `.claude/memory/communities.md`. `tsc`, `expo export --platform web` (11 routes), `expo lint` (0 errors) all clean. Hit the same orphaned-`uvicorn`-worker issue as Phase 4 (twice) — restarted cleanly each time. No human tap-through on a simulator/device yet.

## Phase 6 — Community-private templates
**Goal**: prove the "private to members, invisible to everyone else" rule on the simplest possible feature before it's load-bearing for posting/challenges.
**Deliverables**: `template.community_id`, community template upload/browse endpoints, RN Templates tab split (global vs. this community's private set).
**Note (2026-07-21)**: Backend: nullable `template.community_id` (FK communities) added via migration; `POST /templates` gained an optional `community_id` form field, gated by a new shared `services/communities.py::require_active_membership` helper (404 if the community doesn't exist, 403 if not an active member — reused as-is, no per-caller duplication); the global `GET /templates` list now explicitly excludes community-scoped rows; a new `GET /communities/{id}/templates` browse endpoint is member-gated **with no open-community exception** (stricter than Phase 5's member-list rule — community templates are private to members full stop, per Requirements §3). Migration applied to the real dev DB; 67/67 backend pytest passing (6 new). Frontend: `TemplatePickerModal` (used by the Phase 4 creator) gained a horizontal scope-tab row — Global plus one tab per community the user belongs to (via `useMyCommunities`) — switching between `useTemplates()` and a new `useCommunityTemplates(communityId)`; extracted the shared grid UI into `TemplateGrid.tsx` so both scopes render identically without duplicating the `FlatList`. The existing "+" upload affordance now targets whichever scope is active. `tsc`, `expo export --platform web` (11 routes, unchanged), `expo lint` (0 errors) all clean. No human tap-through yet.
**Exit test**: a member uploads a community template — a non-member's global template list does not include it, and a direct API request for it as a non-member is rejected; a member sees and can apply it in the creator.
**Note (2026-07-21, cont'd)**: user manually tapped through Phase 6's exit test on live dev servers — a member uploaded a community template, a non-member's global template list confirmed to exclude it, a direct API request as a non-member confirmed rejected (403), and a member confirmed able to see and apply it in the creator. Exit test green, phase flipped to Done.

## Phase 7 — Community posting (+ public exposure for open communities)
**Goal**: give communities a real posting surface, now that Phase 5 gives them something to post into.
**Deliverables**: a **community post** flow reachable only from inside a community (not a generic creator audience option), backend audience derived automatically from the community's `open`/`invite_only` privacy (open → also public, with the community shown alongside the poster; invite-only → community-only), community feed endpoint/screen, backend membership validation (can't post to a community you're not in).
**Exit test**: post in an **open** community — it shows in both that community's feed and the public feed, with the community visibly attached to the post (not just the poster); post in an **invite-only** community — it shows only in that community's feed, never the public feed; attempting to post to a community the user isn't a member of is rejected server-side even if the client is tampered with.
**Design history (2026-07-21)**: built twice. **First pass** (superseded, do not resurrect): a single generic creator let a poster multi-select Public/Friends/one-or-more-communities in one publish action (client-chosen `community_ids` sent to `POST /memes`) — this matched the *original* `Project_Requirements.md` §4 wording. The user then explicitly redirected mid-phase: community posting must be its own flow, only reachable from inside a community, with community visibility fully **automatic** from the community's privacy (no manual audience choice, no multi-community cross-posting). `Project_Requirements.md` §3/§4/§17 were rewritten to match; treat those sections, not this timeline entry, as the source of truth for current scope. **Second (final) pass**: Backend — new `POST /communities/{id}/memes` (member-gated, no client-chosen audience; auto-adds a `community` `PostAudience` row plus a `public` row iff the community is `open`) alongside the original `POST /memes` (reverted to Public/Friends-only, rejects a literal `"community"` in `audiences`). `require_active_membership` now returns the `Community` row (needed for `.privacy`). `MemeOut` gained a `community: {id, name} | null` badge (replacing an interim `community_ids: uuid[]` list field from the first pass) so feed cards can show "posted by X in community Y." `PostAudience` still carries the `community` enum value + nullable `community_id` FK from the first pass (no migration change needed for the redesign — only Python-level service/router logic changed). 76/76 backend pytest passing. Frontend — `CreatorScreen` now branches on an optional `communityId`/`communityName` route param: personal-post mode keeps the Public/Friends chips; community-post mode shows a static "Posting to `<name>`" panel and no picker at all, submitting via a new `useCreateCommunityMemeMutation`. Entry point is a "+ Post" button in `CommunityDetailScreen`'s Feed tab (active members only) — there is no community picker anywhere in the generic creator. `MemeCard` shows the community badge under the author's name. `tsc`, `expo export --platform web` (11 routes), `expo lint` (0 errors) all clean. No human tap-through yet.

## Phase 8 — Scoring stub + leaderboards
**Goal**: get the three read-only leaderboard surfaces working against a deliberately simple placeholder scoring formula, without waiting on the full scoring-engine design (see `Project_Requirements.md` §7).
**Deliverables**: `services/scoring.py` stub (e.g. likes + comments, clearly labeled placeholder), background recompute worker, individual leaderboard, global community leaderboard, internal per-community leaderboard, RN Leaderboards tab + community-scoped leaderboard tab.
**Exit test**: all three leaderboards rank correctly against known seeded data; internal community leaderboard is only reachable/visible to that community's members; **no endpoint accepts a write to any leaderboard** — they are read paths only.
**Note (2026-07-21)**: Backend: `services/scoring.py` — `meme_score_expr()`, a SQLAlchemy scalar-subquery stub (`reactions*1 + comments*2`), clearly labeled placeholder per §7, computed **live in SQL** (no stored score table) since the inputs are cheap owned-row aggregations — no staleness possible, so no recompute worker was needed for this stub (see below). `services/leaderboards.py` — three read-only queries: `GET /leaderboards/individual` (all users, all-time, all their memes), `GET /leaderboards/communities` (all communities, ranked by aggregate community-post score, visible to everyone per the discovery/content-visibility split), `GET /communities/{id}/leaderboard` (that community's active members only, ranked by community-post-only score, member-gated via the existing `require_active_membership`). Offset-based `page`/`limit` pagination (not the feed's keyset cursor scheme — score ranking has no stable resume-row). 84/84 backend pytest passing (8 new). Frontend: new `features/leaderboards/` — `LeaderboardsScreen` (Individual/Communities tab toggle, route `/leaderboards`, reachable from a new button on `SessionScreen`); `CommunityDetailScreen` gained a third `Leaderboard` tab alongside Feed/Members, member-gated the same way. Shared `IndividualLeaderboardRow`/`CommunityLeaderboardRow` components. `tsc`, `expo export --platform web` (12 routes), `expo lint` (0 errors, same 2 pre-existing warnings) all clean.
**Background-worker decision**: no Celery/arq/task-queue infra exists in this repo yet (`workers/` is an empty planned folder; every prior phase's I/O has run inline). Discussed with user — chose **recompute inline (i.e., live SQL on read)** over standing up real worker infra this phase, since the stub formula's inputs are trivially cheap aggregations with no staleness window. Revisit once the real scoring engine (§7, still deferred) has non-trivial inputs that can't be computed live on every leaderboard read — that's the point a stored `meme_scores` table + a real scheduled worker becomes necessary, likely alongside Phase 12's Redis infra. See `.claude/memory/scoring-engine.md`.
**Blocked**: nothing. No human tap-through yet on Phase 8's exit test.

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

### 2026-07-21 (Phase 8)
- Phase: 8 (Scoring stub + leaderboards)
- Done: Built Phase 8 end to end — see the phase entry above for full detail. Backend `services/scoring.py` (live-SQL placeholder score) + `services/leaderboards.py` (individual/global-community/internal-community, all read-only, offset-paginated), new router + a community-scoped route added to `routers/communities.py` matching established convention. 84/84 backend pytest passing (8 new, covering ranking correctness and all three access-control cases). Frontend `features/leaderboards/` (new tab screen) + a third tab on `CommunityDetailScreen`. `tsc`/`expo export --platform web` (12 routes)/`expo lint` all clean. Chose to recompute scores live in SQL rather than stand up Celery/arq infra this phase (user's explicit call when asked) — documented as an interim decision in `.claude/memory/scoring-engine.md`, revisit once the real scoring engine's inputs stop being cheap live aggregations.
- Blocked: nothing. No human tap-through yet on Phase 8's exit test.
- Next: human needs to tap through Phase 8 — seed known reactions/comments across a few users/communities and confirm all three leaderboards rank correctly, confirm a non-member is rejected from an internal community leaderboard, confirm no leaderboard endpoint accepts a write — before flipping Phase 8 to Done. Then start Phase 9 (Global competitions — Meme of the Day/Week/Month).

### 2026-07-21 (Phase 7 confirmed, Phase 8 starting)
- Phase: 7 confirmed Done; 8 (Scoring stub + leaderboards) starting
- Done: User confirmed Phase 7's exit test tested perfectly fine (open-community post appears in both community + public feed with badge, invite-only stays community-only, non-member posting rejected server-side). Exit test green, phase flipped to Done.
- Blocked: nothing.
- Next: build Phase 8 — `services/scoring.py` stub (likes + comments, clearly labeled placeholder per Project_Requirements §7 — not the final rules engine), background recompute worker, `MemeScore`-style aggregate storage, individual leaderboard, global community leaderboard, internal per-community leaderboard (member-gated), RN Leaderboards tab + community-scoped leaderboard tab. All three surfaces read-only — no write/submission endpoint.

### 2026-07-21 (Phase 7, redesigned mid-phase)
- Phase: 7 (Community posting)
- Done: Built Phase 7 twice — see the phase entry above for the full "design history." First pass shipped a generic-creator multi-select (Public/Friends/communities) matching the original `Project_Requirements.md` §4; user redirected the design (community posting must be its own flow, entered only from inside a community, audience fully automatic from that community's privacy, no cross-posting to multiple communities). Rewrote `Project_Requirements.md` §3/§4/§17 to match, then reworked the implementation: backend `POST /communities/{id}/memes` (new, member-gated, server-derives audience from `community.privacy`) replaces the interim `community_ids` field on `POST /memes` (reverted to Public/Friends-only); `MemeOut.community_ids: uuid[]` replaced with `community: {id, name} | null`; `require_active_membership` now returns the `Community` row. 76/76 backend pytest passing (rewritten community tests). Frontend `CreatorScreen` now branches on an optional `communityId` route param instead of showing a communities multi-select; entry point moved to a "+ Post" button inside `CommunityDetailScreen`; `MemeCard` shows the community badge. `tsc`/`expo export --platform web` (11 routes)/`expo lint` all clean.
- Blocked: nothing. No human tap-through yet on Phase 7's exit test.
- Next: human needs to tap through Phase 7 — post in an open community and confirm it appears in both that community's feed and the public feed with the community visibly attached; post in an invite-only community and confirm it stays community-only; confirm posting to a community you're not a member of is rejected server-side — before flipping Phase 7 to Done. Then start Phase 8 (Scoring stub + leaderboards).

### 2026-07-21 (Phase 6 confirmed, Phase 7 starting)
- Phase: 6 confirmed Done; 7 (Multi-audience posting + community) starting
- Done: User tapped through Phase 6's exit test on live dev servers — member-uploaded community template correctly excluded from a non-member's global list and rejected (403) on direct API access, and correctly visible/applicable in the creator for a member. Exit test green, phase flipped to Done.
- Blocked: nothing.
- Next: build Phase 7 — extend the Phase 3 audience system to include one-or-more communities: creator audience selector's Community option wired live (multi-select from the user's own communities), community feed endpoint/screen, backend audience validation (can't post to a community you're not a member of).

### 2026-07-21 (Phase 6)
- Phase: 6 (Community-private templates)
- Done: Added nullable `template.community_id` + migration, `require_active_membership` shared helper on `services/communities.py`, optional `community_id` on `POST /templates` (member-gated), new member-gated `GET /communities/{id}/templates` browse endpoint (no open-community exception, unlike the Phase 5 member-list rule), global list now excludes community templates. 67/67 backend pytest passing (6 new). Frontend: `TemplatePickerModal` now has a Global/per-community scope-tab row backed by a new `useCommunityTemplates` hook and a shared `TemplateGrid` presentational component. `tsc`/`expo export --platform web`/`expo lint` all clean.
- Blocked: nothing. No human tap-through yet on Phase 6's exit test.
- Next: human needs to tap through Phase 6 — a member uploads a community template, confirm a non-member's global template list doesn't include it and a direct API request for the community's template list as a non-member is rejected (403), confirm a member sees and can apply it in the creator — before flipping Phase 6 to Done. Then start Phase 7 (Multi-audience posting + community).

### 2026-07-21 (Phase 5 confirmed, Phase 6 starting)
- Phase: 5 confirmed Done; 6 (Community-private templates) starting
- Done: User tapped through all three parts of Phase 5's exit test across two sessions (open-community instant join, invite-only pending-then-approve, non-member 403 on an invite-only community's members). Fixed a real Expo Router routing bug (`communities/index.tsx` colliding with the sibling `[id].tsx` dynamic route — moved the list screen to a flat `communities.tsx`) and quieted a noisy `console.error` for gracefully-handled API errors. Exit test green, phase flipped to Done.
- Blocked: nothing.
- Next: build Phase 6 — `template.community_id`, community template upload/browse endpoints (member-only regardless of community privacy setting — no open-community carve-out here, unlike the members-list rule), RN Templates split (global vs. community) in the creator's template picker.

### 2026-07-21 (Phase 5)
- Phase: 5 (Communities core)
- Done: Built out Phase 5 end to end — backend `Community`/`CommunityMembership` models (owner/member roles, open/invite-only privacy), `/communities` create/discover/mine/get/join/leave/members/join-requests(list/approve/reject) endpoints, migration applied to the real dev DB, 61/61 backend pytest passing (15 new). Frontend Communities tab (My Communities/Discover), Create Community screen, Community Detail screen (join/leave/pending states, owner join-request approval, members list) — first folder-based nested route group in the app, hit and worked around an Expo Router typed-routes quirk around bare vs. index folder hrefs. `tsc`/`expo export --platform web`(11 routes)/`expo lint` all clean. Hit the same orphaned-`uvicorn`-worker stale-server issue as Phase 4 (twice) — restarted cleanly each time, same root cause as documented in `.claude/memory/meme-creator.md`.
- Blocked: nothing blocking. No human tap-through yet on Phase 5's exit test.
- Next: human needs to tap through Phase 5 on a simulator/device — create an open community and confirm a second user can join with no approval step, create an invite-only community and confirm a join request requires owner approval, confirm a non-member gets 403 (not just hidden UI) on member-only reads for an invite-only community — before flipping Phase 5 to Done. Then start Phase 6 (Community-private templates).

### 2026-07-21 (Phase 4 confirmed, Phase 5 starting)
- Phase: 4 confirmed Done; 5 (Communities core) starting
- Done: Fixed a stale-`uvicorn`-worker bug blocking manual testing (orphaned reload child process serving pre-Phase-4 routes — see gotcha in `.claude/memory/meme-creator.md`) and seeded a real global template from a user-supplied image via the actual `/templates` endpoint. User then tapped through Phase 4 on live dev servers and confirmed it works. Exit test green, phase flipped to Done.
- Blocked: nothing.
- Next: build Phase 5 — `Community`/`community_membership` models, owner-set privacy (open/invite-only), create/join/leave/invite-approve endpoints, RN Communities tab (My Communities / Discover) + Community Detail shell (Members tab only for now).

### 2026-07-21 (Phase 4)
- Phase: 4 (Meme creator + global templates)
- Done: Phase 3 confirmed Done (user tapped through Public/Friends visibility + reactions/comments on live dev servers). Started and built out Phase 4: backend `Template` model + `/templates` create/list endpoints (global scope only), extracting two shared helpers along the way (`services/media.py` for image-upload validation, `core/pagination.py` for keyset cursors) since templates is the 2nd consumer of both — 46/46 backend pytest passing. Frontend `features/creator/CreatorScreen` (own-image or template pick → draggable top/bottom text overlay → view-shot preview capture → caption/audience → publish), replacing the old `NewPostScreen` at `/new-post`; added `react-native-view-shot` dependency and a `GestureHandlerRootView` wrapper for gesture-handler's first real usage in this codebase. `tsc`/`expo export --platform web`/`expo lint` all clean.
- Blocked: nothing blocking. No human tap-through yet on Phase 4's exit test (pick a template, add top/bottom text, confirm preview matches published post, confirm it appears in the feed).
- Next: human needs to tap through Phase 4 on a simulator/device — upload own image and separately pick a template, drag top/bottom text, preview, publish, confirm it shows correctly in the Phase 3 feed — before flipping Phase 4 to Done. Then start Phase 5 (Communities core).

### 2026-07-21 (Phase 3)
- Phase: 3 (Public feed)
- Done: Picked Cloudinary for media storage (user decision) and wired credentials into `backend/.env`. Built `Meme`/`PostAudience`/`Reaction`/`Comment` models + migration (applied to real dev Postgres), `/memes` endpoints (create via multipart upload, keyset-paginated feed, reactions, comments) with server-enforced audience visibility reusing Phase 2's friendship model. 38/38 backend pytest passing (Cloudinary mocked in tests; real upload path separately smoke-tested against live Cloudinary — confirmed a real, publicly-reachable image URL). Frontend: `FeedScreen` (infinite scroll, pull-to-refresh), `NewPostScreen` (image picker + caption + Public/Friends audience toggle — added `expo-image-picker` dependency), inline comments on feed cards. `tsc`/`expo export --platform web` clean (8 routes).
- Blocked: nothing blocking. Two real bugs hit and fixed mid-build (both documented in `.claude/memory/meme-feed.md`): an async SQLAlchemy `db.get()`-vs-`db.refresh()` relationship-loading gotcha, and a FastAPI `Form(PydanticModel)` multipart gotcha. Also hit and fixed a `uvicorn --reload` issue where watching `venv/` caused the reloader to wedge after `pip install` — now scoped to `--reload-dir app`.
- Next: human tap-through on a simulator/device for Phase 3's exit test (post Public/Friends-only from two accounts, confirm visibility + reactions/comments round-trip), then start Phase 4 (Meme creator + global templates).

### 2026-07-21 (cont'd)
- Phase: 1 & 2 confirmed Done; 3 (Public feed) started
- Done: Started `uvicorn` (port 6001) and `expo start --web` (port 8081) as live dev servers; user manually tapped through register → logout → login → profile (Phase 1) and friend request send → accept → mutual friends-list visibility (Phase 2). Both confirmed working — both phases flipped to `Done`.
- Blocked: nothing.
- Next: build Phase 3 — `Meme`/`post_audience` models, image upload endpoint, infinite-scroll feed filtered by Public/Friends audience, reactions + comments, RN feed screen.

### 2026-07-21
- Phase: 2 (Friends)
- Done: Backend — `Friendship` model (`backend/app/models/friendship.py`) with a DB-level direction-independent unique constraint (`LEAST`/`GREATEST`-computed columns) so a request can't exist twice in either direction; `/friends` endpoints (send/accept/remove/list/list-requests) in `routers/friends.py` + `services/friends.py`; 6 new domain exceptions; Alembic migration generated and applied to the real dev Postgres DB; 16 new pytest (22/22 total) passing against real Postgres. Frontend — `friends.ts`/`useFriends.ts` service layer, `FriendsScreen` (single `FlatList`, add-friend form + incoming requests in the header), `/friends` route reachable via a button on the profile screen; promoted `AuthTextField` → `components/TextField.tsx` (2nd consumer) and updated Login/RegisterScreen. `tsc --noEmit` and `expo export --platform web` both clean (6 static routes including `/friends`).
- Blocked: nothing blocking. **Process note**: started this phase without Phase 1's manual device tap-through being confirmed — user explicitly chose to skip that gate rather than block on it. Both phases now carry the same open item (see below).
- Next: human needs to tap through both flows on a simulator/device/`expo start` — Phase 1 (register → logout → login → profile) and Phase 2 (A sends request to B → B accepts → both see each other in Friends → C doesn't) — before flipping either row to `Done`. Then start Phase 3 (Public feed).

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
