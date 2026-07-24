"""Meme scoring — the reach-weighted "MemeScore" atom.

One base per-content score (the *atom*), computed the same way for native `Meme`s and
externally-shared `MemeContainer`s, is the single source of truth every consumer builds on
(leaderboards, competitions, challenge evaluation, profile score) — swapping the formula
later still touches only this file. The three surfaces differ only in how they *aggregate*
the atom, never in how it's computed:

  * competitions  — atom of content *created within* the period, ranked, frozen-by-read
  * leaderboards  — atom summed/averaged over a 30-day rolling window
  * profile score — atom summed over all of a user's content, all-time (monotonic-ish)

The atom (per content item):

    audience = max(view_count, upvotes + comments)          # a vote/comment proves a view
    reach    = log10(audience + 1)                          # log-compressed → fairness lever
    quality  = (upvotes + 6) / (upvotes + downvotes + 9)    # Bayesian-smoothed approval
    engage   = log10(comments + 1) * 0.5                    # small discussion bonus
    score    = round( (reach * (0.4 + 0.6 * quality) + engage) * 100 )   # integer, >= 0

Design notes (confirmed with user):
  * **Reach is the spine, quality is a 0.4..1.0 multiplier on it** — a widely-seen meme is
    rewarded even if it's not the best; a genuinely great small meme can't out-rank a
    mediocre viral one. That's the intended tradeoff for a new, reach-first platform.
  * **`log10` on reach is the fairness lever** — a 2M-view meme scores only ~2x a 4k-view
    one, not 500x, so a handful of mega-viral creators can't run away with every board.
  * **Downvotes are excluded from the `audience` floor** — the floor exists so votes still
    matter when `view_count` is 0/under-recorded (a voter demonstrably saw the meme), but a
    downvote must only ever *lower* the score via `quality`, never raise it by inflating
    reach. Real (larger) `view_count` dominates the floor once impressions are tracked.
  * **Bayesian smoothing** (prior 6 up / 3 down) removes the "1 vote = perfect ratio" cliff
    and gives a fresh, unvoted meme an encouraging ~0.67 quality rather than 0 or 0.5.
  * **No time decay in the atom.** Recency lives only in the feed's `hot_score_expr()` and
    in competitions' per-period window — a leaderboard/profile score must not silently drop.
  * Abuse-resistance is deliberately light for now (new platform, low abuse expected) — no
    unique-view dedup, no voter-trust weighting. Revisit if farming appears; the formula is
    versioned by living in this one function.
"""

import datetime

from sqlalchemy import ColumnElement, Integer, case, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.comment import Comment
from app.models.container_comment import ContainerComment
from app.models.container_vote import ContainerVote
from app.models.meme import Meme
from app.models.meme_container import MemeContainer
from app.models.meme_score import MemeScore
from app.models.meme_vote import MemeVote

# Atom tunables — kept here so the whole formula is inspectable in one place. If these ever
# change, snapshotted competition results computed under the old values are not retro-fixed;
# that's acceptable while pre-launch (no historical results to preserve yet).
PRIOR_UP = 6.0
PRIOR_DOWN = 3.0
QUALITY_FLOOR = 0.4  # a downvoted-to-oblivion meme still keeps 40% of its reach credit
ENGAGE_WEIGHT = 0.5
SCORE_SCALE = 100.0

# Reddit's Hot-ranking epoch (2005-12-08T07:46:43Z, the "reddit epoch" used by the
# original algorithm) — an arbitrary zero point, not a business date; only the
# resulting relative ordering matters.
_HOT_EPOCH = datetime.datetime(2005, 12, 8, 7, 46, 43, tzinfo=datetime.timezone.utc)


def hot_score_expr(
    created_at_col: ColumnElement[datetime.datetime],
    net_score: ColumnElement[int],
) -> ColumnElement[float]:
    """Reddit's "Hot" ranking formula: sign(score) * log10(max(|score|, 1)) +
    seconds_since_epoch / 45000. `net_score` is upvotes minus downvotes (never
    comments — Reddit's real Hot formula only ever weighs vote score against age).
    The /45000 constant means a ~10x vote swing is worth about 12.5 hours of age, so
    older posts need increasingly lopsided votes to outrank fresh ones.

    This is the **feed** ranking (the one time-decaying surface), deliberately separate
    from the scoring atom below — the feed answers "what's hot right now," the atom answers
    "how good is this," and only the feed should decay with age.
    """
    abs_score = func.greatest(func.abs(net_score), 1)
    sign = case((net_score > 0, 1.0), (net_score < 0, -1.0), else_=0.0)
    seconds = func.extract("epoch", created_at_col) - _HOT_EPOCH.timestamp()
    return sign * func.log(10, abs_score) + seconds / 45000.0


def _atom_score_expr(
    upvotes: ColumnElement[int],
    downvotes: ColumnElement[int],
    comments: ColumnElement[int],
    view_count: ColumnElement[int],
) -> ColumnElement[int]:
    """The reach-weighted MemeScore atom as a SQL expression — see module docstring.
    Content-type-agnostic: `meme_score_expr()`/`container_score_expr()` just wire in the
    right vote/comment tables and `view_count` column. Always >= 0."""
    n = upvotes + downvotes
    audience = func.greatest(view_count, upvotes + comments)
    reach = func.log(10, audience + 1)
    quality = (upvotes + PRIOR_UP) / (n + PRIOR_UP + PRIOR_DOWN)
    engage = func.log(10, comments + 1) * ENGAGE_WEIGHT
    raw = (reach * (QUALITY_FLOOR + (1.0 - QUALITY_FLOOR) * quality) + engage) * SCORE_SCALE
    return func.round(raw).cast(Integer)


def meme_score_expr() -> ColumnElement[int]:
    """The scoring atom for a native `Meme`, as a scalar expression correlated to an outer
    `Meme` row — usable both standalone (`select(Meme.id, meme_score_expr())`) and inside an
    aggregate (`func.sum(meme_score_expr())`). The one place that knows how a meme is scored;
    every consumer calls this rather than reimplementing the math."""
    upvotes = (
        select(func.count(MemeVote.id))
        .where(MemeVote.meme_id == Meme.id, MemeVote.value == 1)
        .correlate(Meme)
        .scalar_subquery()
    )
    downvotes = (
        select(func.count(MemeVote.id))
        .where(MemeVote.meme_id == Meme.id, MemeVote.value == -1)
        .correlate(Meme)
        .scalar_subquery()
    )
    comments = (
        select(func.count(Comment.id))
        .where(Comment.meme_id == Meme.id)
        .correlate(Meme)
        .scalar_subquery()
    )
    return _atom_score_expr(upvotes, downvotes, comments, Meme.view_count)


def container_score_expr() -> ColumnElement[int]:
    """The same scoring atom for a `MemeContainer` (Instagram Companion Mode), correlated to
    an outer `MemeContainer` row — used by competition standings where native memes and
    containers compete together. Containers aren't cached in `meme_scores`; their atom is
    only ever needed live for the bounded top-N competition query."""
    upvotes = (
        select(func.count(ContainerVote.id))
        .where(ContainerVote.meme_container_id == MemeContainer.id, ContainerVote.value == 1)
        .correlate(MemeContainer)
        .scalar_subquery()
    )
    downvotes = (
        select(func.count(ContainerVote.id))
        .where(ContainerVote.meme_container_id == MemeContainer.id, ContainerVote.value == -1)
        .correlate(MemeContainer)
        .scalar_subquery()
    )
    comments = (
        select(func.count(ContainerComment.id))
        .where(ContainerComment.meme_container_id == MemeContainer.id)
        .correlate(MemeContainer)
        .scalar_subquery()
    )
    return _atom_score_expr(upvotes, downvotes, comments, MemeContainer.view_count)


async def recompute_all_scores(db: AsyncSession) -> int:
    """Recomputes every meme's atom in one pass and upserts it into `meme_scores` — called
    periodically by the arq cron job, never from a request. Returns the number of memes
    scored. A single bulk `INSERT ... ON CONFLICT DO UPDATE` (not one upsert per meme) keeps
    this cheap; the live `meme_score_expr()` is still what computes the number, so there's
    exactly one place that knows the scoring formula.

    Note: this scans all memes each tick — fine at current scale, but the first thing to
    bound (to memes with activity since the last tick) when the table grows.
    """
    rows = (await db.execute(select(Meme.id, meme_score_expr().label("score")))).all()
    if not rows:
        return 0

    now = datetime.datetime.now(datetime.timezone.utc)
    values = [{"meme_id": meme_id, "score": score, "updated_at": now} for meme_id, score in rows]

    stmt = pg_insert(MemeScore).values(values)
    stmt = stmt.on_conflict_do_update(
        index_elements=[MemeScore.meme_id],
        set_={"score": stmt.excluded.score, "updated_at": stmt.excluded.updated_at},
    )
    await db.execute(stmt)
    await db.commit()
    return len(rows)
