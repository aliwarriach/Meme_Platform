from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.pool import NullPool
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

import app.services.instagram as instagram_service
import app.services.media as media_service
from app.core.config import settings
from app.core.rate_limit import limiter
from app.db.base import Base
from app.db.session import get_db_session
from app.main import app

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


async def _override_get_db_session() -> AsyncIterator[AsyncSession]:
    async with TestSessionFactory() as session:
        yield session


app.dependency_overrides[get_db_session] = _override_get_db_session


@pytest.fixture(autouse=True)
def use_test_session_factory_for_background_tasks(monkeypatch):
    """`services/instagram.py::_run_metadata_fetch` runs as a fire-and-forget
    `asyncio.create_task` outside any request's `app.dependency_overrides` — without this,
    it would open a real connection to the dev Postgres DB (via the module-level
    `async_session_factory`) during every test that creates a container, not the test DB.
    Patched on the module the task actually calls, same "patch where imported" rule as
    `mock_media_upload` below.
    """
    monkeypatch.setattr(instagram_service, "async_session_factory", TestSessionFactory)


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
