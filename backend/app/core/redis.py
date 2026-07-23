from arq import ArqRedis, create_pool
from arq.connections import RedisSettings

from app.core.config import settings

_redis_settings = RedisSettings.from_dsn(settings.redis_url)
# arq's default conn_timeout is 1s, which some local Windows dev environments
# genuinely exceed on the first connection (observed ~2s here) — every one of arq's 5
# built-in retries then also fails the same way, turning a slow-but-fine connection into
# a hard failure. 10s only affects the initial connect, not steady-state operations.
_redis_settings.conn_timeout = 10

_pool: ArqRedis | None = None


async def get_arq_pool() -> ArqRedis:
    """Lazily-created shared connection pool for enqueueing arq jobs from the API
    process (as opposed to the worker process, which gets its own pool via arq's
    `WorkerSettings.on_startup`)."""
    global _pool
    if _pool is None:
        _pool = await create_pool(_redis_settings)
    return _pool


async def close_arq_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.aclose()
        _pool = None
