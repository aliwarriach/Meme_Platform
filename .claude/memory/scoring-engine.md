# scoring-engine

## Status
Stubbed — deliberately, per Project_Requirements §7. The real scoring engine (abuse/gaming-resistant rules) is deferred as its own design effort. This file describes the **interim placeholder** every leaderboard consumer calls today. **Post-Phase-16 update**: recompute is now a real background job (see [[redis-arq-infra]]) rather than live-on-read, but the formula itself and its "one source of truth" contract are unchanged.

## What's built
- `services/scoring.py::meme_score_expr()` — a SQLAlchemy scalar-subquery expression, correlated to an outer `Meme` row: `reactions * 1 + comments * 2`. Not final, not abuse-resistant — just enough signal to make leaderboards orderable. Still the single place that knows the scoring formula — used directly by challenge evaluation (a one-off per-challenge computation, no caching benefit) and by `recompute_all_scores` below.
- `services/scoring.py::recompute_all_scores(db)` — new. Computes every meme's score in one pass via `meme_score_expr()` and bulk-upserts into the new `MemeScore` table (`app/models/meme_score.py`, `meme_id` PK, 1:1 with `Meme`) using a single `INSERT ... ON CONFLICT DO UPDATE`, not one upsert per meme. Called only by the arq cron job `app/workers/tasks/scoring.py::recompute_meme_scores`, never from a request.
- **Stored table now exists** (`meme_scores`, migration `cc9508a586a7`), populated on a periodic arq cron (every 30s, see [[redis-arq-infra]]) instead of computed live on every leaderboard read — per backend/CLAUDE.md's leaderboard caching directive. [[leaderboards]] reads `coalesce(MemeScore.score, meme_score_expr())` — the live fallback means a meme posted after the last cron tick still contributes its real score immediately (never silently 0), it just isn't cached yet.
- Every consumer (leaderboards; challenge evaluation) still calls `meme_score_expr()` rather than reimplementing scoring math — swapping in the real rules engine later still only touches this one file (the cron job and the coalesce fallback both call the same function, so there's exactly one formula in the codebase).

## Business rules
- Score is always **recomputable and transparent by construction** (Project_Requirements §7's bar) — it's a plain SQL expression over rows that already exist, inspectable by reading this one file, not a hardcoded/stored one-off number. The stored `meme_scores` table is a cache of that computation, not an independent source of truth — it can always be rebuilt by re-running `recompute_all_scores`.
- Recompute is **periodic (cron), not event-driven on write** — confirmed with user: adding a reaction/comment does not itself enqueue a targeted recompute, since that would put an extra arq round-trip in the hot reaction/comment write path for marginal freshness benefit over a 30s-worst-case-staleness cron tick.

## Key files
- backend: `app/services/scoring.py`, `app/models/meme_score.py`, `app/workers/tasks/scoring.py`, `alembic/versions/cc9508a586a7_*.py`.

## Tests
- No dedicated test file — `meme_score_expr()` and the coalesce-fallback path are exercised indirectly via `backend/tests/test_leaderboards.py` (score values asserted against known seeded reactions/comments; since no arq cron runs during tests, every assertion there is actually exercising the live-fallback path, not the stored `MemeScore` row — both paths use the identical `meme_score_expr()`, so this is still real coverage of the formula, just not of the cache-hit path itself).
