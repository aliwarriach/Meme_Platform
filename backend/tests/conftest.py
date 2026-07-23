from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.pool import NullPool
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

import app.core.leaderboard_cache as leaderboard_cache_module
import app.main as main_module
import app.services.ai_caption as ai_caption_service
import app.services.instagram as instagram_service
import app.services.media as media_service
import app.workers.tasks.instagram as instagram_worker_tasks
from app.core.config import settings
from app.core.leaderboard_cache import _get_redis as get_leaderboard_redis
from app.core.rate_limit import limiter
from app.db.base import Base
from app.db.session import get_db_session
from app.main import app
from tests.fake_arq import get_fake_arq_pool


async def _noop_close_arq_pool() -> None:
    pass

test_engine = create_async_engine(
    settings.test_database_url or settings.database_url, poolclass=NullPool
)
TestSessionFactory = async_sessionmaker(test_engine, expire_on_commit=False)


@pytest_asyncio.fixture(autouse=True)
async def _reset_schema() -> AsyncIterator[None]:
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield


@pytest.fixture(autouse=True)
def _reset_rate_limits():
    """Rate-limit counters live in the shared Redis backend, not the per-test DB
    schema, so they'd otherwise leak across tests that share the same client IP key."""
    limiter.reset()
    yield


@pytest_asyncio.fixture(autouse=True)
async def _reset_leaderboard_cache() -> AsyncIterator[None]:
    """Leaderboard reads are cached in Redis by page/limit/community_id (see
    `app/core/leaderboard_cache.py`) — without flushing between tests, one test's cached
    leaderboard page would leak into the next test's assertions (unlike the rate limiter,
    a stale cache hit here doesn't just under/over-count requests, it returns outright
    wrong ranked data), since the fixed 30s TTL easily outlives a single test.

    `leaderboard_cache._redis` is a module-level singleton whose connection is bound to
    whichever asyncio event loop created it — pytest-asyncio closes and recreates the
    event loop between test functions by default, so reusing that singleton across tests
    raises "Event loop is closed" the moment a later test's loop tries to use a connection
    opened on an earlier, now-dead loop. Resetting the singleton to `None` here forces a
    fresh client (and fresh connection) bound to the *current* test's loop every time.
    """
    leaderboard_cache_module._redis = None
    redis = get_leaderboard_redis()
    async for key in redis.scan_iter(match="leaderboard:*"):
        await redis.delete(key)
    yield


async def _override_get_db_session() -> AsyncIterator[AsyncSession]:
    async with TestSessionFactory() as session:
        yield session


app.dependency_overrides[get_db_session] = _override_get_db_session


@pytest.fixture(autouse=True)
def use_test_session_factory_for_background_tasks(monkeypatch):
    """`app/workers/tasks/instagram.py::fetch_container_metadata_job` (run inline by
    `FakeArqPool`, see below) opens its own session via the module-level
    `async_session_factory` rather than a request's `app.dependency_overrides` — without
    this, it would hit the real dev Postgres DB during every test that creates a
    container, not the test DB. Patched on the module the job actually calls, same
    "patch where imported" rule as `mock_media_upload` below.
    """
    monkeypatch.setattr(instagram_worker_tasks, "async_session_factory", TestSessionFactory)


@pytest.fixture(autouse=True)
def use_fake_arq_pool(monkeypatch):
    """Runs `app/workers/tasks/*.py` job bodies inline instead of enqueueing to a real
    Redis queue/worker process — no arq worker runs during tests, so without this,
    `POST /ai-caption/generate` and `POST /instagram/containers` would hang waiting for a
    job result that's never picked up. Patched on every call site (`get_arq_pool` is
    imported directly into each service module, plus `main.py`'s lifespan).

    Also covers `app/main.py`'s lifespan, which calls the real `get_arq_pool()` on
    startup — this only actually runs for the one test that uses a real ASGI lifespan
    (`test_websocket_delivers_meme_in_real_time`'s `TestClient(app)`; the `AsyncClient`
    fixture used everywhere else never triggers the lifespan at all). Without patching it
    there too, that one test hits arq's real `create_pool`, which pings Redis as part of
    pool construction — a call that reliably times out under `TestClient`'s anyio
    thread-portal event loop on this platform even though a plain `redis.asyncio.Redis`
    connection works fine in the same context (isolated and reproduced independently of
    this app's code) — so the real pool is never appropriate inside a test process anyway.
    """
    monkeypatch.setattr(instagram_service, "get_arq_pool", get_fake_arq_pool)
    monkeypatch.setattr(ai_caption_service, "get_arq_pool", get_fake_arq_pool)
    monkeypatch.setattr(main_module, "get_arq_pool", get_fake_arq_pool)
    monkeypatch.setattr(main_module, "close_arq_pool", _noop_close_arq_pool)


@pytest.fixture(autouse=True)
def mock_media_upload(monkeypatch):
    """Fakes the Cloudinary call for every test — deterministic, no quota use.
    Patched on `media_service` since that's where `memes`/`templates` services import it from.
    """
    counter = {"n": 0}

    async def _fake_upload(file_bytes: bytes, folder: str) -> tuple[str, str]:
        counter["n"] += 1
        return (
            f"https://res.cloudinary.com/test/image/upload/fake-{counter['n']}.png",
            f"{folder}/fake-{counter['n']}",
        )

    monkeypatch.setattr(media_service, "upload_image", _fake_upload)


@pytest_asyncio.fixture
async def client() -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


async def register(client: AsyncClient, **overrides) -> dict:
    payload = {"email": "alice@test.com", "username": "alice", "password": "password123"}
    payload.update(overrides)
    response = await client.post("/auth/register", json=payload)
    return response


async def create_user(client: AsyncClient, username: str) -> dict:
    response = await register(client, email=f"{username}@test.com", username=username)
    return response.json()


def auth_header(user: dict) -> dict:
    return {"Authorization": f"Bearer {user['access_token']}"}
