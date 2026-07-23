import pytest
from httpx import AsyncClient

import app.services.ai_caption as ai_caption_service
from app.core.exceptions import CaptionGenerationFailedError
from tests.conftest import auth_header, create_user


@pytest.mark.asyncio
async def test_generate_caption_requires_auth(client: AsyncClient):
    response = await client.post("/ai-caption/generate", json={"context": "a cat staring"})
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_generate_caption_first_draft(client: AsyncClient, monkeypatch):
    user = await create_user(client, "alice")

    async def _fake_generate(context: str, current_caption: str | None):
        assert current_caption is None
        return ai_caption_service.CaptionSuggestionOut(caption="When Monday hits different")

    monkeypatch.setattr(ai_caption_service, "generate_meme_caption", _fake_generate)

    response = await client.post(
        "/ai-caption/generate",
        json={"context": "a cat staring at the camera"},
        headers=auth_header(user),
    )
    assert response.status_code == 200
    assert response.json() == {"caption": "When Monday hits different"}


@pytest.mark.asyncio
async def test_generate_caption_make_it_funnier_iteration(client: AsyncClient, monkeypatch):
    user = await create_user(client, "bob")

    async def _fake_generate(context: str, current_caption: str | None):
        assert current_caption == "When Monday hits"
        return ai_caption_service.CaptionSuggestionOut(caption="When Monday hits different fr fr")

    monkeypatch.setattr(ai_caption_service, "generate_meme_caption", _fake_generate)

    response = await client.post(
        "/ai-caption/generate",
        json={"context": "a cat staring at the camera", "current_caption": "When Monday hits"},
        headers=auth_header(user),
    )
    assert response.status_code == 200
    assert response.json() == {"caption": "When Monday hits different fr fr"}


@pytest.mark.asyncio
async def test_generate_caption_provider_failure_returns_502_not_hang(
    client: AsyncClient, monkeypatch
):
    user = await create_user(client, "carol")

    async def _fake_generate(context: str, current_caption: str | None):
        raise CaptionGenerationFailedError("Couldn't generate a caption suggestion right now")

    monkeypatch.setattr(ai_caption_service, "generate_meme_caption", _fake_generate)

    response = await client.post(
        "/ai-caption/generate",
        json={"context": "a cat staring at the camera"},
        headers=auth_header(user),
    )
    assert response.status_code == 502
    assert "detail" in response.json()


@pytest.mark.asyncio
async def test_generate_caption_empty_context_rejected(client: AsyncClient):
    user = await create_user(client, "dave")

    response = await client.post(
        "/ai-caption/generate", json={"context": ""}, headers=auth_header(user)
    )
    assert response.status_code == 422
