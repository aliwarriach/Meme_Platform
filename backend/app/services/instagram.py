"""Instagram Companion Mode (Project_Requirements §13). Sharing a Reel/post link into the
app creates a `MemeContainer` — never re-hosts the source video, just the link + oEmbed-
derived metadata (title/thumbnail) + independent reactions/comments/votes (`ContainerReaction`/
`ContainerComment`/`ContainerVote`, parallel tables, not shared with `Meme`'s). Confirmed
with user: only externally-shared content is containerized — native uploads (`Meme`) are
never wrapped, and both content types coexist in one merged public feed.

Metadata fetch runs as a **fire-and-forget `asyncio.create_task`** kicked off at intake —
the container exists immediately (`metadata_status=pending`) and the request returns right
away; the task fills in title/thumbnail shortly after via the stubbed
`integrations/instagram_oembed.py`. Confirmed with user over a synchronous inline fetch,
since a slow/hanging external call must never block intake (no Celery/arq infra exists yet
for a more durable queue — same "no task queue yet" precedent as every other phase, but
here it's a genuine one-shot enrichment, not a recurring job, so a bare asyncio task fits).
"""

import asyncio
import logging
import re
import urllib.parse
import uuid

from sqlalchemy import exists, func, literal, select, union_all
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    AlreadyReactedToContainerError,
    ContainerReactionNotFoundError,
    InvalidSourceUrlError,
    MemeContainerNotFoundError,
)
from app.core.pagination import decode_cursor, encode_cursor
from app.db.session import async_session_factory
from app.integrations.instagram_oembed import fetch_metadata
from app.models.container_comment import ContainerComment
from app.models.container_reaction import ContainerReaction
from app.models.meme import Meme
from app.models.meme_container import ContainerMetadataStatus, ContainerPlatform, MemeContainer
from app.models.user import User
from app.schemas.auth import UserOut
from app.schemas.instagram import (
    ContainerCommentCreate,
    ContainerCommentOut,
    ContainerFeedItem,
    ContainerReactionOut,
    MemeContainerOut,
    MemeFeedItem,
    MergedFeedPage,
)
from app.schemas.memes import MemeOut
from app.services.memes import meme_visibility_clause, get_meme_out_for_viewer

logger = logging.getLogger(__name__)

_INSTAGRAM_URL_RE = re.compile(r"^https?://(www\.)?instagram\.com/", re.IGNORECASE)


def _validate_instagram_url(source_url: str) -> None:
    parsed = urllib.parse.urlparse(source_url)
    if parsed.scheme not in ("http", "https") or not _INSTAGRAM_URL_RE.match(source_url):
        raise InvalidSourceUrlError("Only instagram.com links are supported")


async def _run_metadata_fetch(container_id: uuid.UUID, source_url: str) -> None:
    """Runs in its own DB session/task, decoupled from the request that created the
    container — must never raise into an unawaited task, so every failure path here ends
    in a `failed` status update, not an unhandled exception.
    """
    try:
        metadata = await fetch_metadata(source_url)
        status_ = ContainerMetadataStatus.ready
    except Exception:
        logger.exception("Metadata fetch failed for container %s", container_id)
        metadata = None
        status_ = ContainerMetadataStatus.failed

    async with async_session_factory() as db:
        container = await db.get(MemeContainer, container_id)
        if container is None:
            return
        container.metadata_status = status_
        if metadata is not None:
            container.title = metadata.title
            container.thumbnail_url = metadata.thumbnail_url
        await db.commit()


def _build_container_out(
    container: MemeContainer, reaction_count: int, comment_count: int, viewer_has_reacted: bool
) -> MemeContainerOut:
    return MemeContainerOut(
        id=container.id,
        submitter=UserOut.model_validate(container.submitter),
        platform=container.platform,
        source_url=container.source_url,
        title=container.title,
        thumbnail_url=container.thumbnail_url,
        metadata_status=container.metadata_status,
        reaction_count=reaction_count,
        comment_count=comment_count,
        viewer_has_reacted=viewer_has_reacted,
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

    asyncio.create_task(_run_metadata_fetch(container.id, source_url))

    return _build_container_out(container, reaction_count=0, comment_count=0, viewer_has_reacted=False)


async def _get_container_or_404(db: AsyncSession, container_id: uuid.UUID) -> MemeContainer:
    container = await db.get(MemeContainer, container_id)
    if container is None:
        raise MemeContainerNotFoundError("MemeContainer not found")
    return container


async def get_container(
    db: AsyncSession, current_user: User, container_id: uuid.UUID
) -> MemeContainerOut:
    container = await _get_container_or_404(db, container_id)
    reaction_count = await db.scalar(
        select(func.count(ContainerReaction.id)).where(
            ContainerReaction.meme_container_id == container_id
        )
    )
    comment_count = await db.scalar(
        select(func.count(ContainerComment.id)).where(
            ContainerComment.meme_container_id == container_id
        )
    )
    viewer_reacted = await db.scalar(
        select(
            exists().where(
                ContainerReaction.meme_container_id == container_id,
                ContainerReaction.user_id == current_user.id,
            )
        )
    )
    return _build_container_out(
        container, reaction_count or 0, comment_count or 0, bool(viewer_reacted)
    )


async def get_container_out_for_standings(
    db: AsyncSession, container_id: uuid.UUID
) -> MemeContainerOut | None:
    """Viewer-agnostic container build for competition standings/winner display — mirrors
    why `_standings_query` in `services/competitions.py` builds memes without per-viewer
    reaction state (`viewer_has_reacted` is always `False` here, same as the meme side).
    """
    container = await db.get(MemeContainer, container_id)
    if container is None:
        return None
    reaction_count = await db.scalar(
        select(func.count(ContainerReaction.id)).where(
            ContainerReaction.meme_container_id == container_id
        )
    )
    comment_count = await db.scalar(
        select(func.count(ContainerComment.id)).where(
            ContainerComment.meme_container_id == container_id
        )
    )
    return _build_container_out(container, reaction_count or 0, comment_count or 0, False)


async def add_container_reaction(
    db: AsyncSession, current_user: User, container_id: uuid.UUID
) -> ContainerReactionOut:
    await _get_container_or_404(db, container_id)
    already = await db.scalar(
        select(
            exists().where(
                ContainerReaction.meme_container_id == container_id,
                ContainerReaction.user_id == current_user.id,
            )
        )
    )
    if already:
        raise AlreadyReactedToContainerError("You already reacted to this content")
    reaction = ContainerReaction(meme_container_id=container_id, user_id=current_user.id)
    db.add(reaction)
    await db.commit()
    await db.refresh(reaction)
    return ContainerReactionOut.model_validate(reaction)


async def remove_container_reaction(
    db: AsyncSession, current_user: User, container_id: uuid.UUID
) -> None:
    await _get_container_or_404(db, container_id)
    result = await db.execute(
        select(ContainerReaction).where(
            ContainerReaction.meme_container_id == container_id,
            ContainerReaction.user_id == current_user.id,
        )
    )
    reaction = result.scalar_one_or_none()
    if reaction is None:
        raise ContainerReactionNotFoundError("You haven't reacted to this content")
    await db.delete(reaction)
    await db.commit()


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
    db: AsyncSession, current_user: User, cursor: str | None, limit: int
) -> MergedFeedPage:
    """Unions native `Meme`s (audience-filtered exactly like `services/memes.py::get_feed`)
    with **every** `MemeContainer` — containers have no audience system of their own
    (Project_Requirements §13 doesn't define one; a shared Reel is public by nature) — sorted
    by `created_at` together, keyset-paginated on `(created_at, id)` across both content types
    using the same cursor scheme as the rest of the feed. The sort/limit/cursor filter all run
    in a single SQL `UNION ALL`, not a Python-side merge of two full table scans, so this scales
    the same way `_paginated_feed` does.
    """
    meme_ids_stmt = (
        select(
            Meme.id.label("id"), Meme.created_at.label("created_at"), literal("meme").label("kind")
        )
        .where(meme_visibility_clause(current_user.id))
    )
    container_ids_stmt = select(
        MemeContainer.id.label("id"),
        MemeContainer.created_at.label("created_at"),
        literal("container").label("kind"),
    )
    combined_subq = union_all(meme_ids_stmt, container_ids_stmt).subquery()

    stmt = select(combined_subq).order_by(
        combined_subq.c.created_at.desc(), combined_subq.c.id.desc()
    ).limit(limit + 1)

    if cursor:
        cursor_created_at, cursor_id = decode_cursor(cursor)
        stmt = stmt.where(
            (combined_subq.c.created_at < cursor_created_at)
            | (
                (combined_subq.c.created_at == cursor_created_at)
                & (combined_subq.c.id < cursor_id)
            )
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

    next_cursor = (
        encode_cursor(page_rows[-1].created_at, page_rows[-1].id) if has_more and page_rows else None
    )
    return MergedFeedPage(items=items, next_cursor=next_cursor)


async def is_container(db: AsyncSession, id_: uuid.UUID) -> bool:
    return bool(await db.scalar(select(exists().where(MemeContainer.id == id_))))
