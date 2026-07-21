"""Meme scoring — DELIBERATE PLACEHOLDER.

Project_Requirements.md §7 defers the real scoring engine (abuse/gaming-resistant rules)
to its own design effort. Until that lands, every consumer (leaderboards now; challenge
evaluation and community-score aggregation later) must call `meme_score_expr()` rather
than reimplement scoring math, so swapping in the real rules engine later touches only
this file.

Stub formula: reactions + 2 * comments. Not final, not abuse-resistant — just enough
signal to make the three leaderboard surfaces orderable.

Computed live via SQL (not a stored/materialized column) since it's a cheap aggregation
over existing reaction/comment rows — always exact, never stale, needs no recompute
worker or write-time trigger. Swap this for a stored `meme_scores` table only if the
real scoring engine's inputs stop being simple owned-row aggregations.
"""

from sqlalchemy import Select, func, select

from app.models.comment import Comment
from app.models.meme import Meme
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
