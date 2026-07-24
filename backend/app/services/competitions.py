"""Global competitions (Project_Requirements §9) — Meme of the Day/Week/Month. Native
`Meme`s and externally-shared `MemeContainer`s (§13, Instagram Companion Mode) compete
together in one ranking, backed by the same Reddit-style upvote/downvote tables
(`MemeVote`/`ContainerVote`) that drive the feed and the container cards — there is no
separate per-period "cast a competition vote" action anymore. A period's standing is just
that period's votes (by `created_at`) tallied by net score (upvotes minus downvotes),
unioned at read time — same "parallel tables, one merged surface" pattern as the feed.

Period boundaries and winners are computed **live in SQL on read**, the same precedent
Phase 8 set in [[scoring-engine]]/[[leaderboards]]: no Celery/arq worker exists in this repo
yet, and a period's vote tally is a cheap owned-row aggregation, so there is nothing that
needs a scheduled recompute. A period is simply "closed" once its end boundary (computed in
Python, UTC) has passed — `get_winner` refuses to answer for a period that hasn't closed yet,
since votes could still change the outcome.
"""

import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import InvalidPeriodError
from app.models.comment import Comment
from app.models.competition_period import CompetitionPeriod
from app.models.meme import Meme
from app.models.meme_container import MemeContainer
from app.models.meme_vote import MemeVote
from app.schemas.competitions import (
    StandingContentContainer,
    StandingContentMeme,
    StandingEntry,
    StandingsPage,
    WinnerOut,
)
from app.services.instagram import get_container_out_for_standings
from app.services.memes import build_meme_out
from app.services.scoring import container_score_expr, meme_score_expr


def period_key(period_type: CompetitionPeriod, at: datetime.datetime) -> str:
    """Deterministic period identifier for a given instant (UTC) — stable regardless of
    when it's computed, so the same real-world day/week/month always maps to the same key.
    """
    at = at.astimezone(datetime.timezone.utc)
    if period_type == CompetitionPeriod.day:
        return at.strftime("%Y-%m-%d")
    if period_type == CompetitionPeriod.week:
        iso_year, iso_week, _ = at.isocalendar()
        return f"{iso_year}-W{iso_week:02d}"
    return at.strftime("%Y-%m")


def period_bounds(
    period_type: CompetitionPeriod, key: str
) -> tuple[datetime.datetime, datetime.datetime]:
    """[start, end) UTC bounds for a period key, so votes can be scoped to it and its
    close-time can be checked without re-deriving `key` from `datetime.now()`.
    """
    try:
        if period_type == CompetitionPeriod.day:
            start = datetime.datetime.strptime(key, "%Y-%m-%d").replace(tzinfo=datetime.timezone.utc)
            end = start + datetime.timedelta(days=1)
        elif period_type == CompetitionPeriod.week:
            year_str, week_str = key.split("-W")
            start = datetime.datetime.fromisocalendar(int(year_str), int(week_str), 1).replace(
                tzinfo=datetime.timezone.utc
            )
            end = start + datetime.timedelta(days=7)
        else:
            start = datetime.datetime.strptime(key, "%Y-%m").replace(tzinfo=datetime.timezone.utc)
            end = (start + datetime.timedelta(days=32)).replace(day=1)
    except ValueError as exc:
        raise InvalidPeriodError(f"Malformed period key {key!r} for {period_type.value}") from exc
    return start, end


def current_period_key(period_type: CompetitionPeriod) -> str:
    return period_key(period_type, datetime.datetime.now(datetime.timezone.utc))


async def _standings_query(
    db: AsyncSession, period_type: CompetitionPeriod, key: str, limit: int
) -> list[StandingEntry]:
    """Ranks native memes and MemeContainers together by their **MemeScore atom** (see
    services/scoring.py), scoped to content **created within** the period `[start, end)`.

    "Meme of the Day/Week/Month" = the top-scoring meme *posted* in that window — the reach-
    weighted atom (views + smoothed approval + engagement), not a raw net-vote tally. The
    period window is the recency mechanism (every day is a fresh contest), which is why the
    atom itself carries no time decay. Views can't be windowed (they're a plain counter with
    no per-view timestamps), so the window is applied to `created_at`, not to each signal —
    a meme's atom uses its full lifetime views/votes/comments, which is what you want for a
    meme that belongs to this period anyway.

    Each content type's atom is a cheap correlated aggregation, merged/ranked in Python — as
    before, this only ever needs `limit` winners so a full SQL-side union isn't worth it.
    Standings are computed live on read (no snapshot table yet); a closed period can still
    drift if late votes land on its memes — acceptable pre-launch, flagged for a freeze-at-
    close snapshot when it matters.
    """
    start, end = period_bounds(period_type, key)

    meme_scores = (
        await db.execute(
            select(Meme.id, meme_score_expr().label("score")).where(
                Meme.created_at >= start, Meme.created_at < end
            )
        )
    ).all()
    container_scores = (
        await db.execute(
            select(MemeContainer.id, container_score_expr().label("score")).where(
                MemeContainer.created_at >= start, MemeContainer.created_at < end
            )
        )
    ).all()

    ranked = sorted(
        [(meme_id, int(score), "meme") for meme_id, score in meme_scores]
        + [(container_id, int(score), "container") for container_id, score in container_scores],
        key=lambda row: row[1],
        reverse=True,
    )[:limit]

    entries: list[StandingEntry] = []
    for rank, (id_, score, kind) in enumerate(ranked, start=1):
        if kind == "meme":
            meme = await db.get(Meme, id_)
            if meme is None:
                continue
            upvote_count = await db.scalar(
                select(func.count(MemeVote.id)).where(MemeVote.meme_id == id_, MemeVote.value == 1)
            )
            downvote_count = await db.scalar(
                select(func.count(MemeVote.id)).where(MemeVote.meme_id == id_, MemeVote.value == -1)
            )
            comment_count = await db.scalar(
                select(func.count(Comment.id)).where(Comment.meme_id == id_)
            )
            meme_out = build_meme_out(
                meme,
                upvote_count=upvote_count or 0,
                downvote_count=downvote_count or 0,
                comment_count=comment_count or 0,
                viewer_vote=None,
            )
            entries.append(
                StandingEntry(
                    rank=rank, content=StandingContentMeme(kind="meme", meme=meme_out), score=score
                )
            )
        else:
            container_out = await get_container_out_for_standings(db, id_)
            if container_out is None:
                continue
            entries.append(
                StandingEntry(
                    rank=rank,
                    content=StandingContentContainer(kind="container", container=container_out),
                    score=score,
                )
            )
    return entries


async def get_current_standings(
    db: AsyncSession, period_type: CompetitionPeriod, limit: int
) -> StandingsPage:
    """Live, in-progress tally for whichever period is happening right now."""
    key = current_period_key(period_type)
    items = await _standings_query(db, period_type, key, limit)
    return StandingsPage(period_type=period_type, period_key=key, is_closed=False, items=items)


async def get_winner(db: AsyncSession, period_type: CompetitionPeriod, key: str) -> WinnerOut:
    """The winner for a specific (already-closed) period. Refuses to answer for a period
    still in progress — votes could still flip the outcome, and "the winner" should mean
    a decided result, not a live leader.
    """
    _, end = period_bounds(period_type, key)
    now = datetime.datetime.now(datetime.timezone.utc)
    if now < end:
        raise InvalidPeriodError(
            f"{period_type.value} period {key!r} hasn't closed yet (closes at {end.isoformat()})"
        )

    top = await _standings_query(db, period_type, key, limit=1)
    if not top:
        return WinnerOut(period_type=period_type, period_key=key, content=None, score=0)

    winner = top[0]
    return WinnerOut(
        period_type=period_type, period_key=key, content=winner.content, score=winner.score
    )
