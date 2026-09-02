"""Roadmap_Scaling.md A2 — DB pool configuration + read/write seam.

Deliberately bypasses the app's `TestClient`/`AsyncClient` fixtures and touches
`app/db/session.py`'s real `engine`/`async_session_factory` directly: those fixtures
override `get_db_session`/`get_read_db_session` to point at the isolated per-test schema
(see `conftest.py`), which is exactly right for every other test file but would defeat the
point here — this phase is about the *real* pooled engine's behavior.
"""

import asyncio
import os
import subprocess
import sys

from sqlalchemy import text

from app.core.config import settings
from app.db import session as db_session

# Note: `conftest.py`'s autouse `_dispose_real_db_engine_after_each_test` disposes
# `db_session.engine`/`read_engine` after every test in the suite — necessary here since,
# unlike every other test file, these tests deliberately use the real pooled engine
# directly rather than the `NullPool`-backed test engine, and a connection opened on one
# test function's event loop must never be touched from a later, different loop.


async def test_engine_pool_is_configured_from_settings_not_sqlalchemy_defaults():
    assert db_session.engine.pool.size() == settings.db_pool_size
    assert db_session.engine.pool._max_overflow == settings.db_max_overflow
    assert db_session.engine.pool._timeout == settings.db_pool_timeout
    # SQLAlchemy's own defaults are pool_size=5, max_overflow=10 — this only proves
    # something *besides the pool_size default* is actually wired through.
    assert settings.db_max_overflow != 10 or db_session.engine.pool._max_overflow == 5


async def test_concurrent_sessions_stay_within_the_configured_connection_ceiling():
    """Fires 5x the pool's ceiling worth of concurrent sessions against the real engine
    and polls `pg_stat_activity` throughout — the pool must queue/reuse connections
    instead of opening one per concurrent caller (the exact failure mode this phase
    exists to prevent: pods x (pool_size + max_overflow) growing unbounded)."""
    ceiling = settings.db_pool_size + settings.db_max_overflow
    worker_count = ceiling * 5

    async def _hold_a_connection() -> None:
        async with db_session.async_session_factory() as session:
            await session.execute(text("SELECT pg_sleep(0.3)"))

    async def _sample_peak_connections() -> int:
        peak = 0
        async with db_session.async_session_factory() as session:
            for _ in range(30):
                count = await session.scalar(
                    text(
                        "SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()"
                    )
                )
                peak = max(peak, count or 0)
                await asyncio.sleep(0.05)
        return peak

    workers = [asyncio.create_task(_hold_a_connection()) for _ in range(worker_count)]
    sampler = asyncio.create_task(_sample_peak_connections())
    await asyncio.gather(*workers)
    peak = await sampler

    # "Bounded, not unbounded" is the property under test, not an exact number: with no
    # pooling at all, `worker_count` (50) simultaneous real connections would be opened.
    # Observed under a busy full-suite run, actual DB-side connection teardown lags
    # slightly behind the pool releasing a connection (a real network/Postgres-side
    # round trip, not instantaneous), so a generous-but-still-meaningful ceiling avoids
    # flaking on that lag while still failing hard if pooling stopped working (which would
    # show a peak near `worker_count`, not near `ceiling`).
    assert peak <= ceiling * 2, (
        f"peak connections {peak} is not meaningfully bounded by the configured ceiling "
        f"{ceiling} — the pool is not actually bounding concurrent connections"
    )


async def test_read_session_is_wired_and_aliases_the_write_engine_when_no_replica_is_set():
    """`database_read_url` is unset in this dev environment, so the DONE WHEN bar for
    *today* is: `get_read_db_session` is a real, independently-usable dependency, and it
    is provably talking to the exact same database as `get_db_session` (the "alias the
    write engine" branch) — not a stale/misconfigured second connection."""
    assert settings.database_read_url is None
    assert db_session.read_engine is db_session.engine
    assert db_session.async_read_session_factory is db_session.async_session_factory

    read_gen = db_session.get_read_db_session()
    write_gen = db_session.get_db_session()
    try:
        read_session = await anext(read_gen)
        write_session = await anext(write_gen)
        read_db_name = await read_session.scalar(text("SELECT current_database()"))
        write_db_name = await write_session.scalar(text("SELECT current_database()"))
        assert read_db_name == write_db_name
    finally:
        await read_gen.aclose()
        await write_gen.aclose()


def test_database_read_url_builds_a_genuinely_separate_engine_when_configured():
    """DONE WHEN: `database_read_url` can be pointed at a replica with no code change.
    `engine`/`read_engine` are built once at module import time from env-driven settings,
    so proving the *other* branch (a real second engine) needs a fresh process with
    DATABASE_READ_URL set — in-process monkeypatching can't retroactively rebuild an
    already-imported module-level engine, and shouldn't need to for this to be provably
    correct."""
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    env = os.environ.copy()
    # A synthetic, deliberately-fake DSN rather than `settings.test_database_url` — this
    # subprocess never actually connects with `read_engine` (engine construction is lazy),
    # so it doesn't need to resolve. Using a real-but-different DSN here was a bug: in
    # this dev environment TEST_DATABASE_URL and DATABASE_URL point at different
    # databases, but CI's own workflow env sets them to the *same* value (one ephemeral
    # Postgres service, one database) — coincidentally passing locally and failing in CI
    # for a reason that had nothing to do with app/db/session.py actually being wrong.
    env["DATABASE_READ_URL"] = "postgresql+asyncpg://readonly:readonly@replica-proof-host:5432/replica_db"
    script = (
        "from app.db import session as db_session\n"
        "assert db_session.read_engine is not db_session.engine\n"
        "assert str(db_session.read_engine.url) != str(db_session.engine.url)\n"
        "assert db_session.async_read_session_factory is not db_session.async_session_factory\n"
        "print('OK')\n"
    )
    result = subprocess.run(
        [sys.executable, "-c", script],
        cwd=backend_dir,
        env=env,
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode == 0, result.stderr
    assert "OK" in result.stdout
