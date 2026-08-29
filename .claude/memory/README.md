# Memory format & index

One file per backend feature/module. Purpose: let a new session (or the frontend, integrating against this backend) understand a feature **without re-reading the codebase** — token efficiency is the whole point. If a fact is obvious from the code/framework convention, or is already stated in a `CLAUDE.md`, it does not belong here — don't restate it.

## What belongs in a memory file
- Models: table name, key fields, non-obvious constraints (unique/composite keys, nullable rules).
- Endpoints: method + path + request/response shape (the actual contract, field names as they cross the wire) + auth requirement.
- Business rules that aren't derivable by reading one file in isolation (e.g. "one vote per user per period enforced by a DB constraint, not just the API").
- Gotchas: things that cost real debugging time or a non-obvious library choice (e.g. "passlib doesn't work with bcrypt>=4.1, we use `bcrypt` directly").
- File map: only the files someone would actually need to open to extend this feature.
- Status: what's built vs. deliberately deferred/stubbed.

## What does NOT belong
- Full code listings — point at the file/line instead.
- Anything a `CLAUDE.md` already states as a repo-wide rule (async-first, Pydantic at boundaries, etc.).
- Speculative/future design not yet built.
- Verbose prose — bullet points, short.

## Template
```markdown
# <feature-name>

## Status
<Done | In progress | Stubbed — what's stubbed and why>

## Models
- `TableName` (`app/models/x.py`): key fields, constraints.

## Endpoints
- `METHOD /path` — auth: yes/no — request `{...}` → response `{...}`

## Business rules
- ...

## Frontend integration notes
- Base URL / auth header shape, field name mapping (snake_case wire → camelCase client), anything the frontend must know that isn't obvious from the endpoint list.

## Gotchas
- ...

## Key files
- backend: ...
- frontend: ...

## Tests
- `backend/tests/test_x.py` — what's covered.
```

## Index
- [auth-profile.md](auth-profile.md) — User model, JWT auth, register/login/me.
- [friends.md](friends.md) — Friendship model (request/accept/remove), `/friends` endpoints, friends screen.
- [meme-feed.md](meme-feed.md) — Meme/PostAudience/Comment models, `/memes` endpoints, Cloudinary upload, feed screen, multi-audience posting (Public/Friends/Community) + community feed. Likes replaced by upvote/downvote — see voting-system.md. **2026-08-30**: author-only `PATCH /memes/{id}` (photo/caption/tags/text-overlay editing, `Meme.editor_document` for real layer rehydration) + owner three-dot menu (Edit/Delete) on `MemeCard`; also fixed deleted-meme gaps in competitions/challenge-submission.
- [meme-creator.md](meme-creator.md) — Template model, `/templates` endpoints, shared media/pagination helpers, creator screen. **Editor rebuilt on Skia (Phases 1–4, 2026-07-24)**: `MemeDocument` (discriminated `Layer` union + `canvas` aspect/fit/bg) + `creatorDraftSlice` (undo/redo) + Skia `drawAsImage` flatten (replaced view-shot); **multi-layer text + image layers + emoji stickers** with drag/pinch/rotate + `LayerInspector`, **aspect-ratio presets (1:1/4:5/9:16/16:9/3:4) + Fit/Fill**. First JS unit tests (jest-expo, 35). Needs a native dev-client rebuild to run.
- [communities.md](communities.md) — Community/CommunityMembership models, `/communities` endpoints (create/discover/mine/join/leave/members/join-requests/media-update), Communities tab + detail screen. **2026-08-26**: `PATCH /communities/{id}` (owner-only icon/banner editing incl. avatar-preset system for the icon), Facebook-page-style header (cover photo + overlapping circular icon), 5th Templates tab — native only so far.
- [scoring-engine.md](scoring-engine.md) — `services/scoring.py` placeholder score (net vote score + comments), live SQL, no stored table/worker yet.
- [leaderboards.md](leaderboards.md) — individual/global-community/internal-community leaderboards, `/leaderboards/*` + `/communities/{id}/leaderboard` endpoints, Leaderboards tab + community leaderboard tab.
- [voting-system.md](voting-system.md) — **Reddit-style upvote/downvote** (`MemeVote`/`ContainerVote`, replaced likes + old per-period Vote 2026-07-24), `POST /memes/{id}/votes` + `POST /instagram/containers/{id}/votes`, read-only `/competitions/*` standings/winner ranked by net score per period, Voting screen + feed-card vote controls.
- [challenges.md](challenges.md) — Challenge/ChallengeSide/ChallengeParticipant/ChallengeSubmission/Badge models, `/communities/{id}/challenges/*` + flat `/challenges/*` endpoints, scheduled window-close worker, Compete tab + challenge-aware creator + setup/active/results screens. **Phases 18+20 (2026-08-06)**: live per-side scores, `GET /challenges/mine`, one-transaction create-and-submit, third `open` shape + anti-gaming side scoring. **Phase 21 (2026-08-06)**: fourth `duel` shape + notification hooks. **Phase 18+20 frontend (2026-08-07)**: Compete tab, challenge-aware creator, hashtag autocomplete — full backend+frontend done.
- [hashtags.md](hashtags.md) — **Phase 20 (2026-08-06)**: first-class `Hashtag`/`MemeHashtag`, exclusive tag reservation by open challenges, `/hashtags/*` search + tag feed. **Frontend (2026-08-07)**: creator autocomplete + side-picker, `/tag/[slug]`. Read before touching tag entry — free-text caption parsing was considered and deliberately rejected.
- [messaging.md](messaging.md) — **Phase 19 (2026-08-06), replaced `meme-sending.md`**: `Conversation`/`Message(kind: text|meme)` (migrated from the dropped `meme_sends`), `/messaging/*` REST + `WS /meme-sending/ws` frames, conversation list + thread screens. Read before touching chat, the socket, or the `/meme-sending/send` shim.
- [ai-caption.md](ai-caption.md) — `integrations/llm_client.py` (Groq, timeout+retry), `POST /ai-caption/generate`, caption generator button wired into the existing creator screen.
- [sharing.md](sharing.md) — frontend-only native share sheet (`expo-sharing` + `expo-file-system`), Share button wired into MemeCard, image-only (no video meme pipeline exists).
- [instagram-companion.md](instagram-companion.md) — MemeContainer + parallel Container{Comment,Vote} tables (upvote/downvote, see voting-system.md), stubbed oEmbed fetch, merged `/memes/feed`, WebView feed cards + share-intake modal.
- [hardening.md](hardening.md) — Phase 16: rate limiting (slowapi + Redis, first real Redis usage in the repo), CORS allow-list, one real IDOR fix in meme-sending.
- [redis-arq-infra.md](redis-arq-infra.md) — post-Phase-16: arq task queue + Redis caching added for scoring/leaderboards/challenge-close/ai-caption/instagram-metadata, replacing live-SQL/in-process-asyncio stopgaps. Read this before touching any of those five features' background-work paths.
- [optimistic-cache.md](optimistic-cache.md) — **frontend-only, Phase 17 (2026-08-06)**: `services/optimisticCache.ts`, the shared in-place cache patcher behind optimistic voting/commenting. Read this before adding any interaction mutation — the rule is patch the cached entity, never invalidate a feed key.
- [notifications.md](notifications.md) — **Phase 21 (2026-08-06)**: `Notification`/`PushToken` models, `/notifications/*` REST, Expo push (raw `httpx`, no SDK) via an arq job, three new notification crons + cold-start weekly challenge, in-app notification centre + push registration. Read before touching the challenge-lifecycle notification hooks (documented in [[challenges]]) or the shared per-user WS socket's frame types.
- [user-profiles.md](user-profiles.md) — **2026-08-25**: Instagram-style profile (own + friends' — read-only aggregation, no new tables), `GET /users/{id}/{profile,posts}`, friends-only posts-grid gate stricter than normal feed visibility. Frontend: one shared `ProfileScreen`(`.web`) for self/friend, old profile entry-links moved to a new feed-header hamburger `NavDrawer`. Read before touching profile viewing, the nav drawer, or the feed's top-left menu icon.
- [search.md](search.md) — **2026-08-27, backend only**: `GET /search` (5-scope aggregator, token matching, `challenge_visibility_clause`) + `GET /hashtags/trending` (distinct-author-weighted, cold-start fallback, arq-warmed cache). Read before touching hashtag matching/ranking, cross-scope visibility, or the trending formula.
