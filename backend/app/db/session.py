from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

# asyncpg's prepared-statement cache doesn't survive PgBouncer's transaction-pooling mode
# (Roadmap_Scaling.md A2/A7) — disable it when pointed at PgBouncer; local dev talking
# directly to Postgres keeps the cache.
_connect_args = {"statement_cache_size": 0} if settings.db_use_pgbouncer else {}

engine = create_async_engine(
    settings.database_url,
    pool_size=settings.db_pool_size,
    max_overflow=settings.db_max_overflow,
    pool_timeout=settings.db_pool_timeout,
    pool_recycle=settings.db_pool_recycle,
    # Drops connections already killed by a PgBouncer/RDS restart instead of failing the
    # next request with a stale-connection error.
    pool_pre_ping=True,
    connect_args=_connect_args,
)
async_session_factory = async_sessionmaker(engine, expire_on_commit=False)

# Read engine: a real second engine once `database_read_url` points at a replica (§C4);
# until then, aliasing the write engine costs nothing and the seam is already in place —
# no caller of `get_read_db_session` needs to change when a replica shows up.
if settings.database_read_url:
    read_engine = create_async_engine(
        settings.database_read_url,
        pool_size=settings.db_pool_size,
        max_overflow=settings.db_max_overflow,
        pool_timeout=settings.db_pool_timeout,
        pool_recycle=settings.db_pool_recycle,
        pool_pre_ping=True,
        connect_args=_connect_args,
    )
    async_read_session_factory = async_sessionmaker(read_engine, expire_on_commit=False)
else:
    read_engine = engine
    async_read_session_factory = async_session_factory


async def get_db_session() -> AsyncSession:
    async with async_session_factory() as session:
        yield session


async def get_read_db_session() -> AsyncSession:
    """Only for handlers that are safe against replica lag and never write on this session
    — leaderboards and feed reads today (Roadmap_Scaling.md A2). Anything ambiguous stays
    on `get_db_session`."""
    async with async_read_session_factory() as session:
        yield session
