# scoring-engine

## Status
Stubbed — deliberately, per Project_Requirements §7. The real scoring engine (abuse/gaming-resistant rules) is deferred as its own design effort. This file describes the **interim placeholder** every leaderboard consumer calls today.

## What's built
- `services/scoring.py::meme_score_expr()` — a SQLAlchemy scalar-subquery expression, correlated to an outer `Meme` row: `reactions * 1 + comments * 2`. Not final, not abuse-resistant — just enough signal to make leaderboards orderable.
- **No stored score column/table.** The stub's inputs (reaction/comment counts) are cheap owned-row aggregations, so the score is computed **live in SQL** on every leaderboard read — always exact, never stale, no recompute worker or write-time trigger needed. This was a deliberate scope call (see Business rules) instead of building a `meme_scores` table + background recompute job.
- Every consumer (currently [[leaderboards]]; later challenge evaluation, community-score aggregation) must call `meme_score_expr()` rather than reimplement scoring math — swapping in the real rules engine later touches only this one file.

## Business rules
- **No background recompute worker exists** — Phase 8's timeline entry calls for one, but this repo has no Celery/arq/task-queue infra yet (`workers/` is an empty planned folder). Since the stub formula is a pure live aggregation, there is nothing to go stale, so a worker would have nothing to do yet. Revisit this **once the real scoring engine lands** (its rules may include non-trivial/expensive inputs — e.g. an abuse-detection pass — that can no longer be computed live on every read; that's the point at which a stored `meme_scores` table + a real scheduled worker becomes necessary, likely alongside Phase 12's Redis infra for real-time sending).
- Score is always **recomputable and transparent by construction** (Project_Requirements §7's bar) — it's a plain SQL expression over rows that already exist, inspectable by reading this one file, not a hardcoded/stored one-off number.

## Key files
- backend: `app/services/scoring.py`.

## Tests
- No dedicated test file — `meme_score_expr()` is exercised indirectly via `backend/tests/test_leaderboards.py` (score values asserted against known seeded reactions/comments).
