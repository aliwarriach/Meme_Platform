"""Thin Redis read-through cache for leaderboard pages. Deliberately dumb: whole-page
JSON blobs behind a short TTL, no invalidation on write — a leaderboard tolerates being a
few seconds stale (score updates themselves only land every `SCORE_RECOMPUTE_INTERVAL_S`
via the arq cron job anyway, see `app/workers/tasks/scoring.py`), so a TTL is simpler and
just as correct as event-driven invalidation here.
"""

from collections.abc import Awaitable, Callable
from typing import TypeVar

from pydantic import BaseModel
from redis.asyncio import Redis

from app.core.config import settings

TTL_SECONDS = 30

ModelT = TypeVar("ModelT", bound=BaseModel)

_redis: Redis | None = None


def _get_redis() -> Redis:
    global _redis
    if _redis is None:
        _redis = Redis.from_url(settings.redis_url, decode_responses=True)
    return _redis


async def cached_or_compute(
    cache_key: str,
    model: type[ModelT],
    compute: Callable[[], Awaitable[ModelT]],
    ttl: int | None = None,
) -> ModelT:
    """`ttl` defaults to the module's `TTL_SECONDS` so existing leaderboard callers are
    unaffected — trending hashtags (Roadmap_Search.md S2) passes a shorter one since it's
    also warmed by its own arq cron rather than relying solely on read-triggered refresh."""
    redis = _get_redis()
    cached = await redis.get(cache_key)
    if cached is not None:
        return model.model_validate_json(cached)

    result = await compute()
    await redis.set(cache_key, result.model_dump_json(), ex=ttl if ttl is not None else TTL_SECONDS)
    return result
