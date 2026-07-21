from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.pool import NullPool
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

import app.services.media as media_service
from app.core.config import settings
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


async def _override_get_db_session() -> AsyncIterator[AsyncSession]:
    async with TestSessionFactory() as session:
        yield session


app.dependency_overrides[get_db_session] = _override_get_db_session


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
