"""Liveness/readiness probes + the graceful-shutdown flag (Roadmap_Scaling.md A3).

Kubernetes needs two distinct signals, not one: *liveness* ("restart this pod") and
*readiness* ("send this pod traffic"). A liveness probe that touches the DB/Redis turns a
slow dependency into a pod restart loop — `/health/live` checks nothing but that the
process is running. `/health/ready` is the one that actually verifies dependencies, and is
also what flips to 503 the instant a SIGTERM is received (see `app/main.py`), so a polling
load balancer stops routing new traffic to this pod *before* the process starts draining.
"""

import asyncio
import logging

from fastapi import APIRouter, Response, status
from sqlalchemy import text

from app.core.redis import get_arq_pool
from app.db.session import async_session_factory

logger = logging.getLogger(__name__)

router = APIRouter(tags=["health"])

READINESS_CHECK_TIMEOUT_SECONDS = 2.0

# Set once, the instant SIGTERM is received (app/main.py's handler) — never cleared, since
# a pod that started draining never goes back to accepting new traffic.
_shutting_down = False


def mark_shutting_down() -> None:
    global _shutting_down
    _shutting_down = True


def is_shutting_down() -> bool:
    return _shutting_down


async def _check_database() -> None:
    async with async_session_factory() as session:
        await session.execute(text("SELECT 1"))


async def _check_redis() -> None:
    # Reuses the API process's existing arq enqueue pool (app/core/redis.py) rather than
    # opening a dedicated connection just to PING — `ArqRedis` is a `redis.asyncio.Redis`
    # subclass, so this is a real round trip to Redis, not a no-op.
    pool = await get_arq_pool()
    await pool.ping()


@router.get("/health/live")
async def liveness() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/health")
async def health_alias() -> dict[str, str]:
    """Alias for /health/live — kept for existing callers (see
    .claude/memory/project_run_setup.md) that predate the live/ready split."""
    return await liveness()


@router.get("/health/ready")
async def readiness(response: Response) -> dict[str, object]:
    if _shutting_down:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"status": "shutting_down"}

    failed: list[str] = []
    for name, check in (("database", _check_database), ("redis", _check_redis)):
        try:
            await asyncio.wait_for(check(), timeout=READINESS_CHECK_TIMEOUT_SECONDS)
        except Exception:
            logger.warning("Readiness check failed: %s", name, exc_info=True)
            failed.append(name)

    if failed:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"status": "not_ready", "failed": failed}
    return {"status": "ready"}
