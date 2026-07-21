# Meme Creation & Sharing Platform — Monorepo Root

`backend/CLAUDE.md` loads in `backend/`. `frontend/CLAUDE.md` loads in `frontend/`. Never cross-apply. Cross-cutting change → read both, apply separately, don't blend.

## What this project is
A **mobile-first, community-focused** meme creation and sharing platform: fast meme creation (upload + text overlays + templates), AI-assisted captioning ("make it funnier" iterations), **communities** (join/create, community-private template libraries, community feeds), a rule-based **meme scoring engine** driving individual + community **leaderboards**, **community challenges** (intra-community team vs. team, and community vs. community, with a full setup → active window → evaluation → results/rewards lifecycle), per-post audience selection (Friends / Public / one-or-more Communities), a global voting/competition system (Meme of the Day/Week/Month), real-time meme sending between friends, native cross-platform sharing (WhatsApp/Instagram/X), and an **Instagram Companion Mode** that wraps shared Reels/posts in an internal `MemeContainer` so external content can carry reactions, comments, and compete in feed-level leaderboards. Casual users can just use the public feed; the core, retained experience is community membership + challenges. Not a full social network — a creation + distribution + competition tool for meme enthusiasts and the communities they belong to.

See `Idea.md` (pitch/positioning) and `Project_Requirements.md` (detailed numbered functional requirements, including open questions still to be settled — e.g. exact scoring weights, challenge judging model) in this folder for the full spec — re-read them if a task touches a flow you're unsure about.

## Map
```
/backend   FastAPI (async Python) — see backend/CLAUDE.md
/frontend  React Native + Expo — see frontend/CLAUDE.md
/shared    cross-cutting types/contracts (API response shapes, enums)
/.claude/memory     per-feature technical memory (see below) — READ BEFORE working on a known feature
/.claude/agents     delegated-search subagent definitions (auto-discovered by Claude Code)
```

## Core services (backend, conceptual)
Auth & Profile (incl. friends) · Communities (membership, community feed, community-private template library) · Meme Feed (infinite scroll, reactions, multi-audience posts: Friends/Public/Community) · Meme Creator (upload, text overlays, templates) · Template Library (global + per-community private) · Meme Scoring Engine (rule-based, shared by leaderboards + challenges) · Leaderboards (individual + community) · Community Challenges (intra-community team vs. team, community vs. community; setup/active/evaluation/results lifecycle) · Voting & Competitions (Meme of the Day/Week/Month, feed-level) · Real-time Meme Sending (WebSockets, lightweight inbox) · AI Caption/Joke Generator (Groq/OpenAI-compatible LLM) · Instagram Companion Mode (`MemeContainer` wrapping external Reels/posts) · Media Storage (Cloudinary/S3). Data stores: PostgreSQL (system of record), Redis (cache + real-time pub/sub), Cloudinary or S3 (media).

## Memory system — READ THIS BEFORE STARTING FEATURE WORK
`/.claude/memory/` holds one `.md` file per backend feature/module (e.g. `communities.md`, `challenges.md`, `scoring-engine.md`, `meme-feed.md`, `voting-system.md`, `ai-caption.md`, `instagram-companion.md`). Each file is the token-efficient source of truth for that feature's models, endpoints, business rules, and current state — **more current than re-deriving from scratch by reading all the code.**

- **Before touching a feature**: check if `/.claude/memory/<feature>.md` exists. If it does, read it first instead of exploring the codebase cold.
- **After implementing or materially changing a feature**: update (or create) its memory file in the same changeset. Stale memory is worse than no memory — keep it in sync with what actually shipped.
- Format and index rules live in `/.claude/memory/README.md`.

## Mindset
- Plan silently before non-trivial code; state plan in 1-3 lines only if complex.
- Push back on flawed specs (e.g. "skip validation") — propose fix, don't comply silently.
- State trade-off in 1 line only when a real fork exists (sync/async, cache strategy, client/server state). Skip for obvious choices.
- Brevity = prose only. Never cut error handling, validation, auth, edge cases.
- No speculative abstraction — build for current requirement, not imagined future one.
- 1 targeted question if a missing assumption changes the design. Don't ask what's inferable.
- Security/correctness bug spotted outside scope → flag in 1 line. Fix only if critical; else ask.
- Testing scope differs by domain — see backend/frontend files.
- Use the `codebase-search` subagent (`/.claude/agents/codebase-search.md`) to delegate broad/token-heavy codebase search instead of burning main-context tool calls on it.

## Conventions
- JSON: camelCase. Python: snake_case. Convert at boundary only.
- Commits: `type(scope): imperative msg`.
- Never commit secrets/.env (JWT secret, S3/Cloudinary keys, Groq/OpenAI API keys) — flag if about to happen.
- No apologies for brevity or pushback.
