"""Global competitions (Project_Requirements §9) — Meme of the Day/Week/Month. Native
`Meme`s and externally-shared `MemeContainer`s (§13, Instagram Companion Mode) compete
together in one ranking, backed by two separate vote tables (`Vote`/`ContainerVote`) unioned
at read time — same "parallel tables, one merged surface" pattern as the feed.

Period boundaries and winners are computed **live in SQL on read**, the same precedent
Phase 8 set in [[scoring-engine]]/[[leaderboards]]: no Celery/arq worker exists in this repo
yet, and a period's vote tally is a cheap owned-row aggregation, so there is nothing that
needs a scheduled recompute. A period is simply "closed" once its end boundary (computed in
Python, UTC) has passed — `get_winner` refuses to answer for a period that hasn't closed yet,
since votes could still change the outcome.
"""

import datetime
import uuid

from sqlalchemy import exists, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    AlreadyVotedError,
    InvalidPeriodError,
    MemeContainerNotFoundError,
    MemeNotFoundError,
    MemeNotVotableError,
    SelfVoteNotAllowedError,
)
from app.models.comment import Comment
from app.models.container_vote import ContainerVote
from app.models.meme import Meme
from app.models.meme_container import MemeContainer
from app.models.post_audience import AudienceType, PostAudience
from app.models.reaction import Reaction
from app.models.user import User
from app.models.vote import CompetitionPeriod, Vote
from app.schemas.competitions import (
    StandingContentContainer,
    StandingContentMeme,
    StandingEntry,
    StandingsPage,
    VoteOut,
    WinnerOut,
)
from app.schemas.instagram import ContainerVoteOut
from app.services.instagram import get_container_out_for_standings
from app.services.memes import build_meme_out


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


async def cast_vote(
    db: AsyncSession,
    current_user: User,
    meme_id: uuid.UUID,
    period_type: CompetitionPeriod,
) -> VoteOut:
    """A meme is only votable if it has a `public` PostAudience row — competitions run at
    the public-feed level (§9), independent of Friends-only or community-only posts, which
    were never meant to compete platform-wide. A user may vote for as many different memes
    as they like within a period — the only restriction is one vote per meme per period
    (DB-enforced) — but never for their own meme.
    """
    author_id = await db.scalar(select(Meme.author_id).where(Meme.id == meme_id))
    if author_id is None:
        raise MemeNotFoundError("Meme not found")
    if author_id == current_user.id:
        raise SelfVoteNotAllowedError("You can't vote for your own meme")

    is_public = await db.scalar(
        select(
            exists().where(
                PostAudience.meme_id == meme_id,
                PostAudience.audience_type == AudienceType.public,
            )
        )
    )
    if not is_public:
        raise MemeNotVotableError("Only memes visible in the public feed can be voted on")

    key = current_period_key(period_type)

    already_voted = await db.scalar(
        select(
            exists().where(
                Vote.user_id == current_user.id,
                Vote.meme_id == meme_id,
                Vote.period_type == period_type,
                Vote.period_key == key,
            )
        )
    )
    if already_voted:
        raise AlreadyVotedError("You already voted for this meme in the current period")

    vote = Vote(user_id=current_user.id, meme_id=meme_id, period_type=period_type, period_key=key)
    db.add(vote)
    await db.commit()
    await db.refresh(vote)
    return VoteOut.model_validate(vote, from_attributes=True)


async def cast_container_vote(
    db: AsyncSession,
    current_user: User,
    container_id: uuid.UUID,
    period_type: CompetitionPeriod,
) -> ContainerVoteOut:
    """A `MemeContainer` has no author-driven audience system (it's public by nature, see
    `services/instagram.py::get_merged_feed`) and no self-submission concept either — any
    member can vote for any container, including their own submission, unlike a native meme.
    """
    exists_row = await db.scalar(select(exists().where(MemeContainer.id == container_id)))
    if not exists_row:
        raise MemeContainerNotFoundError("MemeContainer not found")

    key = current_period_key(period_type)

    already_voted = await db.scalar(
        select(
            exists().where(
                ContainerVote.user_id == current_user.id,
                ContainerVote.meme_container_id == container_id,
                ContainerVote.period_type == period_type,
                ContainerVote.period_key == key,
            )
        )
    )
    if already_voted:
        raise AlreadyVotedError("You already voted for this content in the current period")

    vote = ContainerVote(
        user_id=current_user.id,
        meme_container_id=container_id,
        period_type=period_type,
        period_key=key,
    )
    db.add(vote)
    await db.commit()
    await db.refresh(vote)
    return ContainerVoteOut.model_validate(vote)


async def _standings_query(
    db: AsyncSession, period_type: CompetitionPeriod, key: str, limit: int
) -> list[StandingEntry]:
    """Ranks native memes and MemeContainers together by vote count for one period. Each
    content type's vote count is grouped separately (cheap, indexed aggregations against
    its own vote table), then merged/ranked in Python — unlike the feed's full-table union,
    this only ever needs `limit` winners so a full SQL-side union isn't worth the complexity.
    """
    meme_vote_counts = (
        await db.execute(
            select(Vote.meme_id, func.count(Vote.id))
            .where(Vote.period_type == period_type, Vote.period_key == key)
            .group_by(Vote.meme_id)
        )
    ).all()
    container_vote_counts = (
        await db.execute(
            select(ContainerVote.meme_container_id, func.count(ContainerVote.id))
            .where(ContainerVote.period_type == period_type, ContainerVote.period_key == key)
            .group_by(ContainerVote.meme_container_id)
        )
    ).all()

    ranked = sorted(
        [(meme_id, count, "meme") for meme_id, count in meme_vote_counts]
        + [(container_id, count, "container") for container_id, count in container_vote_counts],
        key=lambda row: row[1],
        reverse=True,
    )[:limit]

    entries: list[StandingEntry] = []
    for rank, (id_, count, kind) in enumerate(ranked, start=1):
        if kind == "meme":
            meme = await db.get(Meme, id_)
            if meme is None:
                continue
            reaction_count = await db.scalar(
                select(func.count(Reaction.id)).where(Reaction.meme_id == id_)
            )
            comment_count = await db.scalar(
                select(func.count(Comment.id)).where(Comment.meme_id == id_)
            )
            meme_out = build_meme_out(
                meme,
                reaction_count=reaction_count or 0,
                comment_count=comment_count or 0,
                viewer_has_reacted=False,
            )
            entries.append(
                StandingEntry(
                    rank=rank, content=StandingContentMeme(kind="meme", meme=meme_out), vote_count=count
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
                    vote_count=count,
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
        return WinnerOut(period_type=period_type, period_key=key, content=None, vote_count=0)

    winner = top[0]
    return WinnerOut(
        period_type=period_type, period_key=key, content=winner.content, vote_count=winner.vote_count
    )
