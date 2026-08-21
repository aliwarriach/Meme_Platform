import datetime
import uuid
from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from redis.asyncio import Redis
from sqlalchemy.pool import NullPool
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

import app.core.leaderboard_cache as leaderboard_cache_module
import app.main as main_module
import app.routers.health as health_module
import app.services.ai_caption as ai_caption_service
import app.services.email_verification as email_verification_service
import app.services.google_auth as google_auth_service
import app.services.instagram as instagram_service
import app.services.media as media_service
import app.services.meme_sending as meme_sending_service
import app.services.memes as memes_service
import app.services.messaging as messaging_service
import app.services.notifications as notifications_service
import app.services.password_reset as password_reset_service
import app.services.users as users_service
import app.workers.tasks.email_verification as email_verification_worker_tasks
import app.workers.tasks.instagram as instagram_worker_tasks
import app.workers.tasks.notifications as notifications_worker_tasks
import app.workers.tasks.password_reset as password_reset_worker_tasks
from app.core.config import settings
from app.core.leaderboard_cache import _get_redis as get_leaderboard_redis
from app.core.rate_limit import limiter
import app.db.session as db_session_module
from app.db.base import Base
from app.db.session import get_db_session, get_read_db_session
from app.main import app
from app.models.user import User
from app.websockets import pubsub as pubsub_module
from app.websockets.connection_manager import connection_manager
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
async def _dispose_real_db_engine_after_each_test() -> AsyncIterator[None]:
    """`app/db/session.py`'s `engine`/`read_engine` (Roadmap_Scaling.md A2) are real
    pooled connections to the actual dev database — used directly (not through the
    `get_db_session`/`get_read_db_session` overrides above) by anything that intentionally
    wants real connectivity rather than the isolated per-test schema, e.g.
    `app/routers/health.py`'s readiness check (A3). Same event-loop-per-test hazard as
    every other module-level connection singleton in this file: dispose after every test
    so a connection opened on one test's loop is never touched from a later, different
    loop. A no-op if the pool was never actually used by that test.
    """
    yield
    await db_session_module.engine.dispose()
    if db_session_module.read_engine is not db_session_module.engine:
        await db_session_module.read_engine.dispose()


@pytest.fixture(autouse=True)
def _reset_shutting_down_flag():
    """`app/routers/health.py`'s `_shutting_down` module flag (Roadmap_Scaling.md A3) is
    never cleared by production code — a pod that started draining never goes back to
    accepting traffic — but a test that exercises the SIGTERM handler would otherwise leak
    `/health/ready` returning 503 into every later test."""
    yield
    health_module._shutting_down = False


@pytest_asyncio.fixture(autouse=True)
async def _reset_connection_manager() -> AsyncIterator[None]:
    """`connection_manager` (app/websockets/connection_manager.py) is a module-level
    singleton holding live `WebSocket` objects, each bound to the event loop of whichever
    `TestClient(app)` lifespan created it. pytest-asyncio gives every test function its
    own event loop, so a `WebSocket` left over from a prior websocket test — e.g. one a
    test's own teardown didn't get a clean disconnect frame for — raises "Event loop is
    closed" the moment anything later touches it, same class of leak as
    `_reset_leaderboard_cache` below. Clearing the registry between tests is enough: any
    handler still `await`ing `websocket.receive_text()` belongs to a `TestClient` context
    that's already exiting by the time this fixture's teardown runs.

    As of Roadmap_Scaling.md A1, presence/pub-sub also live in real Redis
    (`app/websockets/pubsub.py`), not just this dict, so `ws:*` keys a prior test left
    behind (real Redis, not the per-test DB schema, so nothing else clears these) must be
    flushed too — but through a **throwaway** client, never `pubsub_bus._get_redis()`
    itself: that singleton's connection is bound to whichever event loop first created it,
    and the one test using it "for real" (`TestClient(app)`'s ASGI lifespan) runs its own
    app on a separate anyio portal loop, not this fixture's pytest-asyncio loop. Populating
    `pubsub_bus._redis` here would bind it to *this* loop and hand a stale, wrong-loop
    connection to the next test's lifespan — exactly the "attached to a different loop"
    crash this sidesteps. `pubsub_bus._redis`/`_pubsub` are reset to `None` defensively
    (normally already `None`: `RedisPubSubBus.stop()` clears them at the end of every
    `TestClient(app)` `with` block) so a real lifespan always builds fresh connections on
    its own loop.
    """
    pubsub_module.pubsub_bus._redis = None
    pubsub_module.pubsub_bus._pubsub = None
    flush_redis = Redis.from_url(settings.redis_url, decode_responses=True)
    async for key in flush_redis.scan_iter(match="ws:*"):
        await flush_redis.delete(key)
    await flush_redis.aclose()
    yield
    connection_manager._connections.clear()


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
# `get_read_db_session` (Roadmap_Scaling.md A2) must be overridden too, or any endpoint
# using `ReadDbSession` (leaderboards, feed) would hit the real dev database instead of
# the per-test schema — there's no read replica in tests, matching production's own
# behavior of aliasing the write engine when `database_read_url` is unset.
app.dependency_overrides[get_read_db_session] = _override_get_db_session


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
    monkeypatch.setattr(notifications_worker_tasks, "async_session_factory", TestSessionFactory)


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
    monkeypatch.setattr(notifications_service, "get_arq_pool", get_fake_arq_pool)
    monkeypatch.setattr(messaging_service, "get_arq_pool", get_fake_arq_pool)
    monkeypatch.setattr(meme_sending_service, "get_arq_pool", get_fake_arq_pool)
    monkeypatch.setattr(email_verification_service, "get_arq_pool", get_fake_arq_pool)
    monkeypatch.setattr(password_reset_service, "get_arq_pool", get_fake_arq_pool)
    monkeypatch.setattr(google_auth_service, "get_arq_pool", get_fake_arq_pool)
    monkeypatch.setattr(main_module, "get_arq_pool", get_fake_arq_pool)
    monkeypatch.setattr(main_module, "close_arq_pool", _noop_close_arq_pool)
    # `app/routers/health.py`'s readiness Redis check (Roadmap_Scaling.md A3) also calls
    # the real `get_arq_pool()` — same reasoning as every other call site above, plus its
    # own wrinkle: the real `create_pool()` ping can take longer than the endpoint's own
    # 2s check timeout on this environment (see the arq conn_timeout note in
    # redis-arq-infra.md), which would make the "dependencies are up" happy-path test
    # itself report a false failure.
    monkeypatch.setattr(health_module, "get_arq_pool", get_fake_arq_pool)
    # `services/media.py`'s pending-upload store (Roadmap_Scaling.md A4) also calls the
    # real `get_arq_pool()` for plain SET/GETDEL commands, same pattern as
    # `services/meme_sending.py`'s WS ticket store.
    monkeypatch.setattr(media_service, "get_arq_pool", get_fake_arq_pool)


@pytest.fixture(autouse=True)
def mock_expo_push(monkeypatch):
    """Fakes the outbound Expo push HTTP call for every test — `send_push_job` runs
    inline via `FakeArqPool` (see above), so without this, any test that triggers a
    notification would fire a real request to Expo's push API. Same "mock the external
    boundary" precedent as `mock_media_upload`. Patched on the worker task module, where
    the function is imported into and actually called from.
    """
    calls: list[dict] = []

    async def _fake_send(tokens: list[str], title: str, body: str, data: dict) -> None:
        calls.append({"tokens": tokens, "title": title, "body": body, "data": data})

    monkeypatch.setattr(notifications_worker_tasks, "send_push_notifications", _fake_send)
    return calls


@pytest.fixture(autouse=True)
def mock_gmail_send(monkeypatch):
    """Fakes the outbound Gmail API call for every test — `send_email_otp_job`/
    `send_password_reset_otp_job` run inline via `FakeArqPool` (see above), so without
    this, any test that requests an OTP would try to refresh a real OAuth token and hit
    Gmail with whatever's in `.env` (which may be unset, or may be real local-dev
    credentials — either way, not something a test should depend on). Same "mock the
    external boundary" precedent as `mock_expo_push`/`mock_media_upload`. Patched on each
    worker task module, where the function is imported into and actually called from.
    """
    calls: list[dict] = []

    async def _fake_send(to: str, subject: str, body: str) -> None:
        calls.append({"to": to, "subject": subject, "body": body})

    monkeypatch.setattr(email_verification_worker_tasks, "send_email", _fake_send)
    monkeypatch.setattr(password_reset_worker_tasks, "send_email", _fake_send)
    return calls


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


@pytest.fixture(autouse=True)
def mock_media_delete(monkeypatch):
    """Fakes Cloudinary asset cleanup for every test (SecurityFeatures.md F-4) — without
    this, deleting a meme/avatar in a test would fire a real (doomed-to-fail, since the
    public_id is fake) Cloudinary API call. `delete_uploaded_image` is imported by name
    into each calling module, so it's patched on every one of them, not on `media_service`
    itself — same "patch where imported" rule as `mock_expo_push`.
    """
    calls: list[str] = []

    async def _fake_delete(public_id: str) -> None:
        calls.append(public_id)

    monkeypatch.setattr(memes_service, "delete_uploaded_image", _fake_delete)
    monkeypatch.setattr(users_service, "delete_uploaded_image", _fake_delete)
    return calls


@pytest_asyncio.fixture
async def client() -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


async def register(client: AsyncClient, **overrides) -> dict:
    payload = {
        "email": "alice@test.com",
        "username": "alice",
        "password": "password123",
        # Comfortably 13+ (SecurityFeatures.md F-13) — override explicitly in a test
        # that specifically exercises the under-13 rejection path.
        "date_of_birth": "2000-01-01",
    }
    payload.update(overrides)
    response = await client.post("/auth/register", json=payload)
    return response


async def mark_email_verified(user_id: str) -> None:
    """Bypasses the real OTP flow for tests that just need "a normal, verified user" —
    the verification-gating behavior itself (SecurityFeatures.md F-1) gets its own
    dedicated tests in test_email_verification.py. Any test exercising a gated action
    (AI captions, voting, community creation, starting a new conversation) via a
    directly-registered user rather than `create_user` must call this itself — see
    test_meme_sending.py / test_messaging.py's websocket tests for the pattern.
    """
    async with TestSessionFactory() as session:
        db_user = await session.get(User, uuid.UUID(user_id))
        db_user.email_verified_at = datetime.datetime.now(datetime.timezone.utc)
        await session.commit()


async def create_user(client: AsyncClient, username: str) -> dict:
    response = await register(client, email=f"{username}@test.com", username=username)
    user = response.json()
    await mark_email_verified(user["user"]["id"])
    return user


def auth_header(user: dict) -> dict:
    return {"Authorization": f"Bearer {user['access_token']}"}


def ws_ticket(test_client, user: dict) -> str:
    """Mints a `/meme-sending/ws` connect ticket via the sync `TestClient` — the socket
    no longer accepts the session JWT directly in its query string (SecurityIssues.md
    M-1), so every `websocket_connect` call in the test suite goes through this first."""
    response = test_client.post("/meme-sending/ws-ticket", headers=auth_header(user))
    assert response.status_code == 200
    return response.json()["ticket"]
