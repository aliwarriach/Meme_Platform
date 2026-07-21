# Project Requirements — Meme Creation & Sharing Platform

Consolidated functional requirements. This is the source of truth for scope — `Idea.md` holds the pitch/positioning version of the same product; this document is the detailed breakdown used to plan and build features. Update both together when scope changes.

## 1. Product Positioning
A **mobile-first, community-focused** meme creation and sharing platform. Casual users get a fast creation tool and a public feed to have fun in; the core/retained user is expected to live inside **communities** — joining, posting for them, competing in challenges, and climbing community + individual leaderboards. Not a full social network — a creation, distribution, and competition tool built around community identity and meme quality.

## 2. User System
- JWT authentication, basic profile (username, avatar, bio).
- **Friends**: users can add/accept friends; friends are a distinct audience/relationship from community membership.
- **Communities**: users can belong to multiple communities simultaneously. Each community's owner chooses its privacy mode at creation — **open** (anyone can join freely) or **invite-only** (joining requires an invite or owner/admin approval).
- A user's profile shows their individual meme score, rank, communities they belong to, and badges/prizes won from challenges.

## 3. Communities
- Users can **create a community** (name, description, icon/banner, privacy setting, rules/theme if any).
- **Privacy setting is owner's choice per community**, set at creation and changeable later by the owner:
  - **Open** — anyone can join immediately, no approval needed.
  - **Invite-only** — joining requires an invite from a member/owner, or an owner/admin-approved join request.
  - **Resolved**: browsing a community's own feed page (`GET /communities/{id}/feed`) is always member-gated, regardless of privacy — no open-community carve-out (matches the private-template rule in this section, stricter than the member-*list* rule). Community leaderboard visibility follows the same member-gated rule once leaderboards are built (§8). See §4 for how an *open* community's individual posts still reach non-members (via the public feed, not via browsing the community feed page directly).
- Users can **join/leave communities**; a community has members and (at least) one owner/admin role for moderation and challenge setup.
- **Community meme templates**: a community can have its own private template library.
  - Templates uploaded to a community are visible and usable **only by members of that community** — not shown in the public/global template library, not usable by non-members.
  - Global templates (public library) remain separately available to everyone regardless of community membership.
- **Community score**: every community has an aggregate meme score, computed from a defined rule set over the memes its members produce (see §7 Meme Scoring System). This score drives the community leaderboard and challenge seeding/matchmaking.

## 4. Feed & Posting
Two distinct posting flows, not one unified creator with a full audience multi-select — **community posting is only reachable from inside the community you're posting to**, not a general-purpose creator option:

- **Personal post** (creator reached from the main Feed's "New Post"): the poster explicitly chooses an audience at publish time — **Friends** and/or **Public**, multi-select, reviewable before publish. Never includes a community — communities aren't targetable from this flow.
- **Community post** (reached only from inside a specific community, e.g. a "Post" action on that community's own feed screen): **no manual audience picker at all.** Visibility is fully and automatically derived from that community's privacy setting:
  - **Open community** → the post is visible in that community's feed **and** the public feed — when it appears in the public feed, the card shows **both the poster and the community it was posted in** (a visible community badge/label), so it reads as "posted in the public feed" plus "belongs to this community."
  - **Invite-only community** → the post is visible **only** within that community's feed, to that community's active members — it never appears in the public feed regardless of the poster's other relationships (friends, etc.).
  - A community post targets exactly one community (the one it was created from) — no cross-posting a single meme to multiple communities at once.
- Public feed remains infinite-scroll with reactions/likes, same as before. It now also contains open-communities' posts (badged), not just pure personal Public posts.
- Each community has its own feed, scoped to that community's own posts only (not a mix of "community posts + public posts the community chooses to surface" — that alternate design was considered and dropped).

## 5. Meme Creation Tools
- Upload from camera/gallery, text overlays (top/bottom + custom positioning), preview, save & publish — unchanged from original scope.
- Template picker draws from two sources: the global public template library, and (if the user belongs to one or more communities) that community's private template library — kept visually/structurally separate so provenance is always clear.
- Users can submit new templates either to the global library or to a specific community's private library.

## 6. AI Caption & Joke Generator
- Input context/situation → generate funny captions; "make it funnier" iterative refinement — unchanged from original scope.

## 7. Meme Scoring System
- Every meme is assigned a **meme score**. This is intentionally being designed as a **deep, complex rules system** rather than a simple weighted formula — the goal is a scoring engine whose results hold up "under any circumstance" (resistant to gaming, abuse, brigading, low-effort mass-posting, etc.), not just a first-pass heuristic. **Deferred: exact rules/architecture to be designed as its own dedicated effort before implementation** — do not build a placeholder scoring formula into the schema/services as if it were final; keep the scoring engine behind a single service interface (`services/scoring.py`) so the rest of the system (leaderboards, challenge evaluation, community score) never depends on *how* the score is computed, only that a score exists per meme and is recomputable.
- This score is the single evaluation primitive reused across:
  - Individual leaderboard ranking.
  - Community score aggregation (community leaderboard).
  - Challenge winner determination (community vs community, and intra-community team vs team).
- Score computation must be transparent/inspectable (a user or community can see roughly why a meme scored what it did) and re-computable if rules change — never a black-box, hardcoded, one-off number.
- **Sequencing implication**: because the scoring engine is a dedicated design effort, features that depend on a finished scoring engine (real leaderboard ranking, real challenge evaluation) should be built against a stubbed/minimal scoring interface first, so the surrounding CRUD/UI/lifecycle work isn't blocked waiting on the rules design.

## 8. Leaderboards
Leaderboards are **always read-only** — ranking surfaces only, never a posting/submission surface.
- **Global individual leaderboard**: all users across the platform, ranked by highest aggregate meme score.
- **Global community leaderboard**: all communities, ranked by highest aggregate community score. This is the "which communities are best" ranking, visible platform-wide (not community-scoped).
- **Internal community leaderboard**: a separate, per-community ranking of that community's own members by meme score — scoped to and visible only to members of that specific community. Distinct surface from the global community leaderboard above; a community's internal leaderboard is not shown outside the community.
- Leaderboards should support time windows (all-time, and periodic — e.g. weekly/monthly) consistent with the existing Meme of the Day/Week/Month competition cadence.

## 9. Competitions (existing, global)
- Meme of the Day / Week / Month: one vote per user per period, leaderboard — unchanged from original scope. This runs at the public-feed level, independent of community challenges (§10).

## 10. Community Challenges
Two challenge shapes, sharing the same underlying lifecycle:

### 10.1 Intra-community team challenge
- Members of a single community split into two (or more) sides (e.g. 10 members → 5 vs 5).
- A challenge is configured with: participating sides/members, a rule set for judging, and a time window during which each side posts memes toward the challenge.
- At the end of the time window, submissions are evaluated against the configured rules (built on the meme scoring system, §7) and a winning side is determined.
- **Winners receive points + badges** (in-app recognition: contributes to individual/community score standing, plus a visible badge on the winner's profile). No real-world/redeemable prize system in scope for v1 — do not build inventory, fulfillment, or redemption flows.

### 10.2 Community vs community challenge
- Two communities challenge each other on "whose memes are better," under a defined rule set (could be identical structure to intra-community challenges but scoped at the community level rather than sub-groups of members).
- Each community's participating members post memes during the challenge window; the community's aggregate performance (via the scoring system) determines the winner.
- Contributes to both communities' community score/leaderboard standing, win or lose.

### 10.3 Challenge lifecycle (common to both shapes)
1. **Setup** — challenge creator defines: participants/sides, rule set (which scoring criteria apply, any challenge-specific weighting), time window (start/end), and rewards (if any).
2. **Active window** — participants submit memes tagged to the challenge; submissions are visible to challenge participants/judges per the challenge's visibility rules.
3. **Evaluation** — at window close, submissions are scored per the configured rule set; this may be automatic (via the meme scoring system) and/or involve designated judges/voting, depending on the rule set chosen.
4. **Results** — winning side/community is determined, points + badge awarded, results reflected in individual and community leaderboards, results visible/announced to participants (and optionally publicly).

## 11. Real-time Meme Sending
- Send memes to friends via WebSockets, lightweight inbox, reactions-only replies (no full chat) — unchanged from original scope.

## 12. Sharing System
- Native share sheet (WhatsApp, Instagram, X, etc.), export as image/video — unchanged from original scope.

## 13. Instagram Companion Mode
- Sharing a Reel/post from Instagram into the app creates a `MemeContainer` (original link, thumbnail, metadata, independent reactions/comments/votes) — unchanged from original scope.
- External content wrapped this way can participate in feed-level competitions (§9). **Confirmed: `MemeContainer`s are not eligible for community challenge submissions — challenges are native-uploads only**, to keep judging fair and consistent.

## 14. Interaction System
- Likes/multi-reactions, comments — on feed posts, community posts, and `MemeContainer`s — unchanged from original scope, now also feeding into the meme scoring system (§7).

## 15. Tech Stack (confirmed, unchanged by this update)
- **Frontend**: React Native + Expo, TypeScript, NativeWind, Redux Toolkit (client state), TanStack Query (server state), Apisauce/axios.
- **Backend**: FastAPI (async), SQLAlchemy (async) + Alembic, PostgreSQL only (never SQLite, incl. tests).
- **Infra**: Redis (cache + real-time), Cloudinary/S3 (media storage).
- **AI**: Groq/OpenAI-compatible LLMs for captioning.

## 16. MVP Scope (updated)

### Must build (core)
1. Auth & profile, friends.
2. **Communities** — create/join, membership, community feed, community-private template library.
3. Feed with audience selection (Friends / Public / Community, multi-select).
4. Meme creator (upload, text overlays, templates, preview/publish).
5. **Meme scoring system** (baseline rule set — can start simple, must be pluggable/config-driven).
6. **Leaderboards** — individual + community.
7. Sharing (native share sheet).

### Enhanced (near-term after core)
8. **Community challenges** — both intra-community team challenges and community-vs-community challenges, full lifecycle (setup → active → evaluation → results/rewards).
9. Global competitions (Meme of the Day/Week/Month).
10. Template library (global) + AI caption/joke generator.
11. Real-time meme sending + inbox.
12. Instagram Companion Mode.

## 17. Decisions Log
- **Meme scoring**: deferred as a dedicated, complex rules-engine design effort (see §7) — not a simple weighted formula. Build everything else behind a stubbed scoring interface in the meantime.
- **Challenge rewards**: points + badges only for v1. No real/redeemable prizes.
- **Instagram Companion Mode in challenges**: not eligible — challenges are native-uploads only.
- **Community privacy**: owner's choice per community, open or invite-only (see §3).
- **Community posting is its own flow, not a creator audience option** (superseded an earlier Phase 7 design where a single creator let a poster multi-select Public/Friends/one-or-more-communities in one publish action): a community post is only created from inside that community, targets exactly that one community, and has no manual audience picker — visibility (community-only vs. also-public) is fully derived from the community's open/invite-only setting (see §4). Personal posts (Friends/Public) remain a separate, explicit multi-select flow from the main feed's creator.
- **Community feed page (`GET /communities/{id}/feed`) is always member-gated**, even for open communities — no open-community exception (matches §3). This doesn't limit *reach*: an open community's individual posts still surface in the public feed (badged with the community), so open-community content is publicly visible platform-wide even though browsing the community's dedicated feed page requires membership.

## 18. Open Questions (still to confirm)
- Challenge judging mechanics within the (deferred) scoring engine — fully automatic, human-judged, or hybrid — will be settled as part of the scoring-engine design effort, not before.
