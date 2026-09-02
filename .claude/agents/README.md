# Subagents

Delegate broad or token-heavy codebase search here instead of burning main-context tool calls. Each `.md` file defines one subagent (Claude Code agent definition format: YAML frontmatter + instructions body).

## When to delegate
- Searching across many files/apps for a symbol, pattern, or "where is X handled" when you're not confident of the first 2-3 guesses.
- Auditing a cross-cutting concern (e.g. "find every place that reads user.profile without a null check") across backend or frontend.
- Anything explicitly "very thorough" in scope that would otherwise flood main context with intermediate file reads.

Don't delegate a lookup you already know the answer's location for — just Read/Grep directly.

## Agents in this folder
- `codebase-search.md` — read-only search agent for locating code/config across `backend/` and `frontend/` (mirrors the built-in Explore agent, scoped with this project's folder map so it doesn't waste turns rediscovering the app/feature layout).
- `backend-audit.md` — read-only senior backend auditor, **portable across any FastAPI + SQLAlchemy + Postgres project** (stack is fixed; layout, features, caching layer, and consumers are all discovered per repo — no caching layer is assumed). Covers bugs, validation, edge cases, concurrency, security, API contracts, **and API efficiency** (unnecessary calls, redundant endpoints, repeated data/DB retrieval, over-/under-fetching, endpoint structure). Every efficiency recommendation must pass a safety gate first — preserving working behavior outranks any optimization. Writes to `.claude/memory/Shortcomings.md`; discovers client apps and any AI-agent tool layer itself, and inspects them only when a backend finding's blast radius reaches them.
- `security-auditor.md` — read-only OWASP/ASVS security auditor; writes `.claude/memory/Security{Issues,Features}.md`.
- `ux-ui.md` — senior product designer for frontend UI/UX work, grounded in the `ui-ux-pro-max` skill.
