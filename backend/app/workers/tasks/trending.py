"""arq cron job: keeps the trending-hashtags cache warm (Roadmap_Search.md S2) so a user
opening the search screen is almost never the one paying for the aggregation. Runs every 5
minutes — see `app/workers/arq_worker.py`'s `cron_jobs` list for the actual schedule.
"""

import logging

from app.core.leaderboard_cache import _get_redis
from app.db.session import async_session_factory
from app.services.trending import MAX_LIMIT, TRENDING_CACHE_KEY, TRENDING_CACHE_TTL_SECONDS, _compute_trending

logger = logging.getLogger(__name__)


async def refresh_trending_hashtags(ctx: dict) -> int:
    """Always recomputes and overwrites the cache key — unlike `cached_or_compute`'s
    read-first path (which a warm cron would just short-circuit on), this is the thing
    that's supposed to keep it warm.
    """
    async with async_session_factory() as db:
        response = await _compute_trending(db, MAX_LIMIT)

    redis = _get_redis()
    await redis.set(TRENDING_CACHE_KEY, response.model_dump_json(), ex=TRENDING_CACHE_TTL_SECONDS)
    logger.info("Refreshed trending hashtags cache: %d items", len(response.items))
    return len(response.items)
