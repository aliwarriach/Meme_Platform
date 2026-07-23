"""Meme scoring — DELIBERATE PLACEHOLDER.

Project_Requirements.md §7 defers the real scoring engine (abuse/gaming-resistant rules)
to its own design effort. Until that lands, every consumer (leaderboards, challenge
evaluation, community-score aggregation) must call `meme_score_expr()` rather than
reimplement scoring math, so swapping in the real rules engine later touches only this
file.

Stub formula: reactions + 2 * comments. Not final, not abuse-resistant — just enough
signal to make the three leaderboard surfaces orderable.

`meme_score_expr()` remains the single source of truth for *how* a score is computed —
still plain live SQL, used directly by challenge evaluation (a one-off, per-challenge
computation with no caching benefit) and by `recompute_all_scores` below, which is what
actually populates the stored `meme_scores` table leaderboards read from (see
`app/workers/tasks/scoring.py`). This module intentionally has no dependency on arq/Redis
— it's pure scoring logic; the caching/scheduling wrapper lives in the worker layer.
"""

import datetime

from sqlalchemy import Select, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.comment import Comment
from app.models.meme import Meme
from app.models.meme_score import MemeScore
from app.models.reaction import Reaction

REACTION_WEIGHT = 1
COMMENT_WEIGHT = 2


def meme_score_expr() -> Select:
    """Scalar subquery: this stub meme score, correlated to an outer `Meme` row."""
    reaction_count = (
        select(func.count(Reaction.id))
        .where(Reaction.meme_id == Meme.id)
        .correlate(Meme)
        .scalar_subquery()
    )
    comment_count = (
        select(func.count(Comment.id))
        .where(Comment.meme_id == Meme.id)
        .correlate(Meme)
        .scalar_subquery()
    )
    return (REACTION_WEIGHT * reaction_count) + (COMMENT_WEIGHT * comment_count)


async def recompute_all_scores(db: AsyncSession) -> int:
    """Recomputes every meme's score in one pass and upserts it into `meme_scores` —
    called periodically by the arq cron job, never from a request. Returns the number of
    memes scored. A single bulk `INSERT ... ON CONFLICT DO UPDATE` (not one upsert per
    meme) keeps this cheap even as the meme count grows; the live `meme_score_expr()`
    aggregation is still what computes the actual number, so there's exactly one place
    that knows the scoring formula.
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
