# scoring-engine

## Status
**Real reach-weighted atom shipped (2026-07-24)** — replaces the old `net_votes + comments*2` stub. Formula, tunables, and three-surface design confirmed with user across a two-turn design discussion. Backend tested against real Postgres (`test_scoring.py` + updated `test_leaderboards.py`/`test_competitions.py`). Not yet human-tap-through-tested. Abuse-resistance is deliberately **light** for now (new platform, low expected abuse — user's explicit call); revisit when farming appears. Still the single source of truth: one atom function, every consumer calls it.

## The atom (per content item — meme or container)
`services/scoring.py::_atom_score_expr(upvotes, downvotes, comments, view_count)`:
```
audience = max(view_count, upvotes + comments)      # a vote/comment proves a view
reach    = log10(audience + 1)                       # log-compressed → fairness lever
quality  = (upvotes + 6) / (upvotes + downvotes + 9) # Bayesian-smoothed approval (prior 6up/3down)
engage   = log10(comments + 1) * 0.5
score    = round( (reach * (0.4 + 0.6 * quality) + engage) * 100 )   # integer, always >= 0
```
Tunables are module constants: `PRIOR_UP=6`, `PRIOR_DOWN=3`, `QUALITY_FLOOR=0.4` (user-confirmed), `ENGAGE_WEIGHT=0.5`, `SCORE_SCALE=100`.

**Why this shape (all confirmed with user):**
- **Reach is the spine, quality is a 0.4..1.0 multiplier.** A widely-seen meme scores high even if it's not the best; a great small meme (few views) *cannot* out-rank a mediocre viral one. That's the intended tradeoff for a reach-first new platform — the user explicitly wants to reward creators who reach a bigger audience.
- **`log10` on reach is the fairness lever** — a 2M-view meme scores only ~2x a 4k-view one, not 500x, so a handful of mega-viral creators can't run away with every board. This is how "reward reach" and "don't let a few get all the hype" coexist.
- **Downvotes are excluded from the `audience` floor.** The floor exists so votes still matter when `view_count` is 0/under-recorded (a voter demonstrably saw it). But a downvote must only ever *lower* score via `quality`, never raise it by inflating reach. Consequence: a 0-view meme with only downvotes bottoms out at **0** (not negative — the atom is always >= 0, unlike the old stub which could go negative). Verified by `test_downvotes_never_raise_score`.
- **Bayesian smoothing** removes the "1 vote = perfect ratio" cliff; a fresh unvoted meme starts at quality ~0.67 (encouraging), not 0 or 0.5.
- **No time decay in the atom.** Recency lives only in the feed's `hot_score_expr()` and in competitions' per-period window — a leaderboard/profile score must not silently drop over time.

**Worked reference values (0 recorded views, so audience = upvotes+comments):** 1 up → 25; 2 up + 1 comment → 65; 3 up/1 down → 49; 2 up → 40; 1 up/1 down → 24; only-downvotes → 0. With 100k views + 1 up → 410. These are the numbers the tests lock.

## What's built
- **`_atom_score_expr(...)`** — content-type-agnostic SQL expression (the math above). Uses `func.greatest`, `func.log(10, x)`, `func.round(...).cast(Integer)`. Safe under outer-join NULL rows (a NULL Meme → audience `greatest(NULL,0)=0` → score 0), which is why the leaderboard outer-joins still return 0 for users/communities with no memes.
- **`meme_score_expr() -> ColumnElement[int]`** — the atom for a native `Meme`, correlated scalar subqueries over `MemeVote`/`Comment` + `Meme.view_count`. Same name/signature as the old stub, so all three consumers ([[leaderboards]], [[challenges]] `_side_score`, `recompute_all_scores`) picked up the new formula with **zero call-site changes**.
- **`container_score_expr() -> ColumnElement[int]`** — new. Same atom for a `MemeContainer` (over `ContainerVote`/`ContainerComment` + `MemeContainer.view_count`), used by competition standings where memes and containers compete together. Containers are **not** cached in `meme_scores` (their atom is only needed live for the bounded top-N competition query).
- **`hot_score_expr(...)`** — UNCHANGED. Reddit "Hot" (`sign(net)*log10(max(|net|,1)) + age/45000`), the feed's time-decaying rank ([[meme-feed]]). Deliberately separate from the atom — the feed answers "what's hot now," the atom answers "how good is this," and only the feed decays with age. Still pure net votes, no comments.
- **`recompute_all_scores(db)`** — unchanged in shape; still bulk `INSERT ... ON CONFLICT DO UPDATE` into `meme_scores` via `meme_score_expr()`, called only by the arq cron (every 30s, [[redis-arq-infra]]). `MemeScore.score` stays `Integer` (the atom rounds to int). **Known scaling limit (flagged, not fixed):** it re-scores every meme each tick — bound to memes-with-activity-since-last-tick when the table grows.
- **`view_count`** columns on `memes` and `meme_containers` (migration `b7c1a9e2d4f5`) — the reach spine. Incremented via `POST /memes/{id}/views` and `POST /instagram/containers/{id}/views` (see [[voting-system]] for the full contract). **Per-user deduped since 2026-07-24** (migration `d3e5f7a9c1b2` added `meme_views`/`container_views` ledger tables — a repeat view from the same user doesn't move the counter) but still **no per-view timestamps**, so views still **cannot be windowed** — this is why competitions window on content `created_at`, not on per-signal timestamps (unchanged). `view_count` is also **not a public field** — gated per-viewer, see [[voting-system]]'s Business rules.

## The three surfaces (one atom, three aggregation policies)
The atom can't be one number for all three uses (confirmed impossible with user) — instead each surface aggregates the *same* atom differently:
- **Competitions** ([[voting-system]]) — atom of content *created within* the period `[start,end)`, ranked, top-N. "Meme of the Day" = best-scoring meme *posted* today. Live-computed on read (no snapshot table yet; late votes can still drift a closed period — flagged for a freeze-at-close snapshot when it matters).
- **Leaderboards** ([[leaderboards]]) — atom summed (individual/internal) or breadth-averaged (community) over a **30-day rolling window**. The window is the freshness/anti-permanent-dominance lever.
- **Profile score** ([[leaderboards]] `get_profile_score`) — atom summed over **all** of a user's memes, all-time, no window. The monotonic-ish "Snapchat Score" that only grows. `GET /leaderboards/profile/{user_id}`.

## Business rules
- **2026-08-30 — deletion does NOT zero out a meme's contribution to the atom's consumers, except one.** A soft-deleted `Meme` row still has its votes/comments/`view_count`, so `meme_score_expr()` still computes a real (non-zero) atom for it — and both [[leaderboards]] (individual/community/profile) and [[challenges]]'s `_side_scores` deliberately never filter `deleted_at`, so that score keeps counting. The one deliberate exception is [[voting-system]]'s competition standings, which now do filter it out — see that file and [[meme-feed]]'s 2026-08-30 entry for the full "score stays, but can't win anything new" rule.
- **Recomputable/transparent by construction** (Project_Requirements §7 bar) — a plain SQL expression over existing rows, inspectable in one function. `meme_scores` is a cache of that computation, rebuildable via `recompute_all_scores`.
- **Recompute is periodic (cron), not event-driven on write** — casting a vote/view doesn't enqueue a targeted recompute; 30s worst-case staleness is fine, and the leaderboard/profile `coalesce(MemeScore.score, meme_score_expr())` fallback means a just-posted meme contributes its real score immediately anyway.
- **Fairness is structural, not from nerfing reach**: log-compression (atom) + per-period competition reset + 30-day leaderboard window + breadth-weighted community aggregation. See [[leaderboards]] for the last two.

## Key files
- backend: `app/services/scoring.py` (`_atom_score_expr` + `meme_score_expr` + `container_score_expr` + `hot_score_expr` + `recompute_all_scores`), `app/models/meme.py` + `app/models/meme_container.py` (`view_count`), `app/models/meme_score.py`, `app/workers/tasks/scoring.py`, `alembic/versions/b7c1a9e2d4f5_add_view_count_to_memes_and_containers.py`. `hot_score_expr()` is also imported by `app/services/memes.py` + `app/services/instagram.py` (feed); `container_score_expr()` by `app/services/competitions.py`.

## Tests
- `backend/tests/test_scoring.py` (new) — view increment (meme + container) + visibility gate on views (404), **reach-beats-quality** (100k-view/1-up meme `410` beats 3-up/0-view meme `51`), downvotes-never-raise-score (0), profile score lifetime-cumulative (`50`) + zero-for-no-memes + 404-unknown-user.
- `test_leaderboards.py` / `test_competitions.py` — assertions updated from the old net-vote stub values to the new atom values (individual alice `65`/bob `25`; community breadth `12`/`8`; internal `40`; standings `49`/`25`; downvoted-last `0`; winner `40`). No dedicated `meme_score_expr()` unit test — exercised through these (and, since no cron runs in tests, always via the live `coalesce` fallback path, not the cached `MemeScore` row).
