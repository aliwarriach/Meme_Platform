"""Instagram Companion Mode (Project_Requirements §13). Sharing a Reel/post link into the
app creates a `MemeContainer` — never re-hosts the source video, just the link + oEmbed-
derived metadata (title/thumbnail) + independent upvote/downvote + comments (`ContainerVote`/
`ContainerComment`, parallel tables, not shared with `Meme`'s). Confirmed with user: only
externally-shared content is containerized — native uploads (`Meme`) are never wrapped, and
both content types coexist in one merged public feed.

Metadata fetch is enqueued as an **arq job** (`app/workers/tasks/instagram.py::fetch_container_metadata_job`)
at intake — the container exists immediately (`metadata_status=pending`) and the request
returns right away; the job fills in title/thumbnail shortly after via the stubbed
`integrations/instagram_oembed.py`, running on the separate `arq` worker process rather
than a bare `asyncio.create_task` (the original Phase 15 approach, retired once a real
task queue existed — see `.claude/memory/hardening.md`) so a mid-fetch worker restart no
longer silently drops the enrichment.
"""

import re
import urllib.parse
import uuid

from sqlalchemy import exists, func, literal, select, union_all, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import InvalidSourceUrlError, MemeContainerNotFoundError
from app.core.redis import get_arq_pool
from app.models.container_comment import ContainerComment
from app.models.container_view import ContainerView
from app.models.container_vote import ContainerVote
from app.models.meme import Meme
from app.models.meme_container import ContainerMetadataStatus, ContainerPlatform, MemeContainer
from app.models.meme_vote import MemeVote
from app.models.user import User
from app.schemas.auth import UserOut
from app.schemas.instagram import (
    ContainerCommentCreate,
    ContainerCommentOut,
    ContainerFeedItem,
    ContainerViewOut,
    MemeContainerOut,
    MemeFeedItem,
    MergedFeedPage,
)
from app.schemas.memes import MemeOut
from app.services.memes import meme_visibility_clause, get_meme_out_for_viewer
from app.services.scoring import hot_score_expr

_INSTAGRAM_URL_RE = re.compile(r"^https?://(www\.)?instagram\.com/", re.IGNORECASE)


def _validate_instagram_url(source_url: str) -> None:
    parsed = urllib.parse.urlparse(source_url)
    if parsed.scheme not in ("http", "https") or not _INSTAGRAM_URL_RE.match(source_url):
        raise InvalidSourceUrlError("Only instagram.com links are supported")


def _build_container_out(
    container: MemeContainer,
    upvote_count: int,
    downvote_count: int,
    comment_count: int,
    viewer_vote: int | None,
    viewer_id: uuid.UUID | None = None,
) -> MemeContainerOut:
    """`viewer_id=None` (competition standings — viewer-agnostic) always yields
    `view_count=None`. A container has no community concept — its only "admin" is the
    submitter, so view-count visibility is simply submitter-only (unlike a community meme,
    which also exposes it to that community's owner)."""
    can_see_views = viewer_id is not None and container.submitter_id == viewer_id
    return MemeContainerOut(
        id=container.id,
        submitter=UserOut.model_validate(container.submitter),
        platform=container.platform,
        source_url=container.source_url,
        title=container.title,
        thumbnail_url=container.thumbnail_url,
        metadata_status=container.metadata_status,
        upvote_count=upvote_count,
        downvote_count=downvote_count,
        score=upvote_count - downvote_count,
        comment_count=comment_count,
        view_count=container.view_count if can_see_views else None,
        viewer_vote=viewer_vote,
        created_at=container.created_at,
    )


async def create_container(
    db: AsyncSession, current_user: User, source_url: str
) -> MemeContainerOut:
    _validate_instagram_url(source_url)

    container = MemeContainer(
        submitter_id=current_user.id,
        platform=ContainerPlatform.instagram,
        source_url=source_url,
        metadata_status=ContainerMetadataStatus.pending,
    )
    db.add(container)
    await db.commit()
    await db.refresh(container)

    arq_pool = await get_arq_pool()
    await arq_pool.enqueue_job("fetch_container_metadata_job", str(container.id), source_url)

    return _build_container_out(
        container, upvote_count=0, downvote_count=0, comment_count=0, viewer_vote=None,
        viewer_id=current_user.id,
    )


async def _get_container_or_404(db: AsyncSession, container_id: uuid.UUID) -> MemeContainer:
    container = await db.get(MemeContainer, container_id)
    if container is None:
        raise MemeContainerNotFoundError("MemeContainer not found")
    return container


async def _container_vote_counts(db: AsyncSession, container_id: uuid.UUID) -> tuple[int, int]:
    upvotes = await db.scalar(
        select(func.count(ContainerVote.id)).where(
            ContainerVote.meme_container_id == container_id, ContainerVote.value == 1
        )
    )
    downvotes = await db.scalar(
        select(func.count(ContainerVote.id)).where(
            ContainerVote.meme_container_id == container_id, ContainerVote.value == -1
        )
    )
    return upvotes or 0, downvotes or 0


async def get_container(
    db: AsyncSession, current_user: User, container_id: uuid.UUID
) -> MemeContainerOut:
    container = await _get_container_or_404(db, container_id)
    upvote_count, downvote_count = await _container_vote_counts(db, container_id)
    comment_count = await db.scalar(
        select(func.count(ContainerComment.id)).where(
            ContainerComment.meme_container_id == container_id
        )
    )
    viewer_vote = await db.scalar(
        select(ContainerVote.value).where(
            ContainerVote.meme_container_id == container_id,
            ContainerVote.user_id == current_user.id,
        )
    )
    return _build_container_out(
        container, upvote_count, downvote_count, comment_count or 0, viewer_vote,
        viewer_id=current_user.id,
    )


async def get_container_out_for_standings(
    db: AsyncSession, container_id: uuid.UUID
) -> MemeContainerOut | None:
    """Viewer-agnostic container build for competition standings/winner display — mirrors
    why `_standings_query` in `services/competitions.py` builds memes without per-viewer
    vote state (`viewer_vote` is always `None` here, same as the meme side).
    """
    container = await db.get(MemeContainer, container_id)
    if container is None:
        return None
    upvote_count, downvote_count = await _container_vote_counts(db, container_id)
    comment_count = await db.scalar(
        select(func.count(ContainerComment.id)).where(
            ContainerComment.meme_container_id == container_id
        )
    )
    return _build_container_out(container, upvote_count, downvote_count, comment_count or 0, None)


async def _upsert_container_vote(
    db: AsyncSession,
    container_id: uuid.UUID,
    user_id: uuid.UUID,
    value: int,
    *,
    retried: bool = False,
) -> bool:
    """Returns whether a concurrent-insert race was hit and resolved via rollback+retry.
    `db.rollback()` expires every ORM object bound to the session (unlike `commit()`,
    which doesn't here since `expire_on_commit=False`) — callers must refresh anything
    they still plan to use afterward (e.g. `current_user`) when this returns `True`.
    """
    result = await db.execute(
        select(ContainerVote).where(
            ContainerVote.meme_container_id == container_id,
            ContainerVote.user_id == user_id,
        )
    )
    existing = result.scalar_one_or_none()

    if existing is None:
        db.add(ContainerVote(meme_container_id=container_id, user_id=user_id, value=value))
        try:
            await db.commit()
        except IntegrityError:
            if retried:
                raise
            # Two concurrent first-votes from the same user raced the insert; the loser
            # falls back to updating the row the winner just created.
            await db.rollback()
            await _upsert_container_vote(db, container_id, user_id, value, retried=True)
            return True
        return False

    if existing.value == value:
        await db.delete(existing)
    else:
        existing.value = value
    await db.commit()
    return False


async def cast_container_vote(
    db: AsyncSession, current_user: User, container_id: uuid.UUID, value: int
) -> MemeContainerOut:
    """Reddit-style upvote/downvote on a `MemeContainer` — same toggle/flip semantics as
    `services/votes.py::cast_vote` for native memes. Unlike a meme, a container has no
    "author" in the platform sense (just a submitter), so there's no self-vote restriction.
    """
    await _get_container_or_404(db, container_id)
    raced = await _upsert_container_vote(db, container_id, current_user.id, value)
    if raced:
        await db.refresh(current_user)
    return await get_container(db, current_user, container_id)


async def record_container_view(
    db: AsyncSession, current_user: User, container_id: uuid.UUID
) -> ContainerViewOut:
    """Registers one impression from this user on this container — **at most once per
    (container, user), ever** (per-user dedup, mirrors `services/memes.py::record_meme_view`).
    A container has no audience gate of its own (a shared Reel is public by nature), so any
    authed user viewing it counts; existence is still checked (404) so we never bump a
    phantom row. Same `ON CONFLICT DO NOTHING` atomic-dedup pattern as the meme side."""
    container = await _get_container_or_404(db, container_id)

    insert_stmt = (
        pg_insert(ContainerView)
        .values(meme_container_id=container.id, user_id=current_user.id)
        .on_conflict_do_nothing(index_elements=["meme_container_id", "user_id"])
    )
    result = await db.execute(insert_stmt)
    if result.rowcount:
        await db.execute(
            update(MemeContainer)
            .where(MemeContainer.id == container.id)
            .values(view_count=MemeContainer.view_count + 1)
        )
    await db.commit()

    new_count = await db.scalar(
        select(MemeContainer.view_count).where(MemeContainer.id == container.id)
    )
    return ContainerViewOut(meme_container_id=container.id, view_count=new_count or 0)


async def add_container_comment(
    db: AsyncSession, current_user: User, container_id: uuid.UUID, data: ContainerCommentCreate
) -> ContainerCommentOut:
    await _get_container_or_404(db, container_id)
    comment = ContainerComment(
        meme_container_id=container_id, author_id=current_user.id, body=data.body
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    return ContainerCommentOut.model_validate(comment)


async def list_container_comments(
    db: AsyncSession, current_user: User, container_id: uuid.UUID
) -> list[ContainerCommentOut]:
    await _get_container_or_404(db, container_id)
    result = await db.execute(
        select(ContainerComment)
        .where(ContainerComment.meme_container_id == container_id)
        .order_by(ContainerComment.created_at.asc())
    )
    return [ContainerCommentOut.model_validate(c) for c in result.scalars().all()]


async def get_merged_feed(
    db: AsyncSession, current_user: User, offset: int, limit: int
) -> MergedFeedPage:
    """Unions native `Meme`s (audience-filtered exactly like `services/memes.py::get_feed`)
    with **every** `MemeContainer` — containers have no audience system of their own
    (Project_Requirements §13 doesn't define one; a shared Reel is public by nature) —
    ranked together by Reddit-style **Hot score** (vote score vs. age), the platform's
    main-feed ranking, computed inline per content type then merged in a single SQL
    `UNION ALL` (not a Python-side merge of two full table scans, so this scales the
    same way the old recency-sort did). **Offset-paginated**, not keyset — Hot score
    drifts continuously with time (the age term ticks every second), so unlike plain
    `created_at`, it has no stable cursor to page against.
    """
    meme_net_score_subq = (
        select(func.coalesce(func.sum(MemeVote.value), 0))
        .where(MemeVote.meme_id == Meme.id)
        .correlate(Meme)
        .scalar_subquery()
    )
    meme_rows_stmt = select(
        Meme.id.label("id"),
        Meme.created_at.label("created_at"),
        literal("meme").label("kind"),
        hot_score_expr(Meme.created_at, meme_net_score_subq).label("hot_score"),
    ).where(meme_visibility_clause(current_user.id))

    container_net_score_subq = (
        select(func.coalesce(func.sum(ContainerVote.value), 0))
        .where(ContainerVote.meme_container_id == MemeContainer.id)
        .correlate(MemeContainer)
        .scalar_subquery()
    )
    container_rows_stmt = select(
        MemeContainer.id.label("id"),
        MemeContainer.created_at.label("created_at"),
        literal("container").label("kind"),
        hot_score_expr(MemeContainer.created_at, container_net_score_subq).label("hot_score"),
    )

    combined_subq = union_all(meme_rows_stmt, container_rows_stmt).subquery()

    stmt = (
        select(combined_subq)
        .order_by(
            combined_subq.c.hot_score.desc(),
            combined_subq.c.created_at.desc(),
            combined_subq.c.id.desc(),
        )
        .offset(offset)
        .limit(limit + 1)
    )

    page_rows = (await db.execute(stmt)).all()
    has_more = len(page_rows) > limit
    page_rows = page_rows[:limit]

    meme_ids = [row.id for row in page_rows if row.kind == "meme"]
    container_ids = [row.id for row in page_rows if row.kind == "container"]

    meme_out_by_id: dict[uuid.UUID, MemeOut] = {}
    for meme_id in meme_ids:
        meme_out = await get_meme_out_for_viewer(db, meme_id, current_user.id)
        if meme_out is not None:
            meme_out_by_id[meme_id] = meme_out

    container_out_by_id: dict[uuid.UUID, MemeContainerOut] = {}
    for container_id in container_ids:
        container_out_by_id[container_id] = await get_container(db, current_user, container_id)

    items: list[MemeFeedItem | ContainerFeedItem] = []
    for row in page_rows:
        if row.kind == "meme" and row.id in meme_out_by_id:
            items.append(MemeFeedItem(kind="meme", meme=meme_out_by_id[row.id]))
        elif row.kind == "container" and row.id in container_out_by_id:
            items.append(ContainerFeedItem(kind="container", container=container_out_by_id[row.id]))

    return MergedFeedPage(items=items, has_more=has_more)


async def is_container(db: AsyncSession, id_: uuid.UUID) -> bool:
    return bool(await db.scalar(select(exists().where(MemeContainer.id == id_))))
