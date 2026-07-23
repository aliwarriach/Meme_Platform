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
- [meme-feed.md](meme-feed.md) — Meme/PostAudience/Reaction/Comment models, `/memes` endpoints, Cloudinary upload, feed screen, multi-audience posting (Public/Friends/Community) + community feed.
- [meme-creator.md](meme-creator.md) — Template model, `/templates` endpoints, shared media/pagination helpers, creator screen (overlay editor + view-shot flatten + template picker).
- [communities.md](communities.md) — Community/CommunityMembership models, `/communities` endpoints (create/discover/mine/join/leave/members/join-requests), Communities tab + detail screen.
- [scoring-engine.md](scoring-engine.md) — `services/scoring.py` placeholder score (reactions + comments), live SQL, no stored table/worker yet.
- [leaderboards.md](leaderboards.md) — individual/global-community/internal-community leaderboards, `/leaderboards/*` + `/communities/{id}/leaderboard` endpoints, Leaderboards tab + community leaderboard tab.
- [voting-system.md](voting-system.md) — Vote model (day/week/month periods), `/competitions/*` vote/standings/winner endpoints, live period-close computation, Voting screen.
- [challenges.md](challenges.md) — Challenge/ChallengeSide/ChallengeParticipant/ChallengeSubmission/Badge models, `/communities/{id}/challenges/*` endpoints, scheduled window-close worker, setup wizard + active/results screens.
- [meme-sending.md](meme-sending.md) — MemeSend model, `/meme-sending/*` REST + `WS /meme-sending/ws` real-time delivery, in-memory connection manager, inbox screen + socket-status slice.
- [ai-caption.md](ai-caption.md) — `integrations/llm_client.py` (Groq, timeout+retry), `POST /ai-caption/generate`, caption generator button wired into the existing creator screen.
- [sharing.md](sharing.md) — frontend-only native share sheet (`expo-sharing` + `expo-file-system`), Share button wired into MemeCard, image-only (no video meme pipeline exists).
- [instagram-companion.md](instagram-companion.md) — MemeContainer + parallel Container{Reaction,Comment,Vote} tables, stubbed oEmbed fetch, merged `/memes/feed`, container voting, WebView feed cards + share-intake modal.
- [hardening.md](hardening.md) — Phase 16: rate limiting (slowapi + Redis, first real Redis usage in the repo), CORS allow-list, one real IDOR fix in meme-sending.
- [redis-arq-infra.md](redis-arq-infra.md) — post-Phase-16: arq task queue + Redis caching added for scoring/leaderboards/challenge-close/ai-caption/instagram-metadata, replacing live-SQL/in-process-asyncio stopgaps. Read this before touching any of those five features' background-work paths.
