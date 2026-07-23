"""arq job: Instagram oEmbed metadata fetch, replacing the bare `asyncio.create_task`
fire-and-forget in `services/instagram.py::create_container` per backend/CLAUDE.md's
`workers/` folder listing this as expected background-task work. Same behavior as
before (container is created immediately with `metadata_status=pending`; this job fills
in title/thumbnail — or marks `failed` — shortly after) but now durable: if the worker
process restarts mid-fetch, arq redelivers the job instead of silently losing it the way
an in-process `asyncio.Task` would.
"""

import logging
import uuid

from app.db.session import async_session_factory
from app.integrations.instagram_oembed import fetch_metadata
from app.models.meme_container import ContainerMetadataStatus, MemeContainer

logger = logging.getLogger(__name__)


async def fetch_container_metadata_job(ctx: dict, container_id: str, source_url: str) -> None:
    try:
        metadata = await fetch_metadata(source_url)
        status_ = ContainerMetadataStatus.ready
    except Exception:
        logger.exception("Metadata fetch failed for container %s", container_id)
        metadata = None
        status_ = ContainerMetadataStatus.failed

    async with async_session_factory() as db:
        container = await db.get(MemeContainer, uuid.UUID(container_id))
        if container is None:
            return
        container.metadata_status = status_
        if metadata is not None:
            container.title = metadata.title
            container.thumbnail_url = metadata.thumbnail_url
        await db.commit()
