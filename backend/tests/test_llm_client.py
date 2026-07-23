import httpx
import pytest

from app.integrations import llm_client


class _FakeResponse:
    def __init__(self, status_code: int, json_data: dict | None = None, text: str = ""):
        self.status_code = status_code
        self._json_data = json_data or {}
        self.text = text

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError("error", request=None, response=self)

    def json(self):
        return self._json_data


@pytest.mark.asyncio
async def test_generate_caption_success(monkeypatch):
    async def _fake_post(self, url, json, headers):
        return _FakeResponse(
            200, {"choices": [{"message": {"content": "  A funny caption  "}}]}
        )

    monkeypatch.setattr(httpx.AsyncClient, "post", _fake_post)

    result = await llm_client.generate_caption("a cat staring")
    assert result == "A funny caption"


@pytest.mark.asyncio
async def test_generate_caption_retries_then_succeeds(monkeypatch):
    calls = {"n": 0}

    async def _fake_post(self, url, json, headers):
        calls["n"] += 1
        if calls["n"] == 1:
            raise httpx.ConnectTimeout("timed out")
        return _FakeResponse(200, {"choices": [{"message": {"content": "Second try caption"}}]})

    monkeypatch.setattr(httpx.AsyncClient, "post", _fake_post)

    result = await llm_client.generate_caption("a cat staring")
    assert result == "Second try caption"
    assert calls["n"] == 2


@pytest.mark.asyncio
async def test_generate_caption_exhausts_retries_raises(monkeypatch):
    async def _fake_post(self, url, json, headers):
        raise httpx.ConnectTimeout("timed out")

    monkeypatch.setattr(httpx.AsyncClient, "post", _fake_post)

    with pytest.raises(llm_client.LLMGenerationError):
        await llm_client.generate_caption("a cat staring")


@pytest.mark.asyncio
async def test_generate_caption_4xx_fails_fast_no_retry(monkeypatch):
    calls = {"n": 0}

    async def _fake_post(self, url, json, headers):
        calls["n"] += 1
        return _FakeResponse(401, text="invalid api key")

    monkeypatch.setattr(httpx.AsyncClient, "post", _fake_post)

    with pytest.raises(llm_client.LLMGenerationError):
        await llm_client.generate_caption("a cat staring")
    assert calls["n"] == 1
