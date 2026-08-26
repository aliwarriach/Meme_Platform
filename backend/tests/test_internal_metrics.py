"""Roadmap_Scaling.md C4 — GET /internal/metrics/ws-connections and
/internal/metrics/arq-queue-depth, the aggregate signals KEDA's realtime and worker
ScaledObjects poll. Token-gated because these endpoints are reachable through the
ALB's api catch-all route like anything else (see app/routers/internal_metrics.py's
docstring for why network position alone isn't trusted)."""

from app.core.config import settings
from app.core.redis import get_arq_pool
from app.websockets.pubsub import pubsub_bus
from arq.constants import default_queue_name
from httpx import AsyncClient

TEST_TOKEN = "test-internal-metrics-token"


async def test_returns_403_when_no_token_is_configured(client: AsyncClient, monkeypatch):
    monkeypatch.setattr(settings, "internal_metrics_token", None)
    response = await client.get("/internal/metrics/ws-connections")
    assert response.status_code == 403


async def test_returns_403_when_the_caller_sends_no_token(client: AsyncClient, monkeypatch):
    monkeypatch.setattr(settings, "internal_metrics_token", TEST_TOKEN)
    response = await client.get("/internal/metrics/ws-connections")
    assert response.status_code == 403


async def test_returns_403_when_the_caller_sends_the_wrong_token(client: AsyncClient, monkeypatch):
    monkeypatch.setattr(settings, "internal_metrics_token", TEST_TOKEN)
    response = await client.get(
        "/internal/metrics/ws-connections", headers={"X-Internal-Token": "wrong"}
    )
    assert response.status_code == 403


async def test_returns_the_live_connection_count_with_the_correct_token(
    client: AsyncClient, monkeypatch
):
    monkeypatch.setattr(settings, "internal_metrics_token", TEST_TOKEN)
    expected = await pubsub_bus.connection_count()

    response = await client.get(
        "/internal/metrics/ws-connections", headers={"X-Internal-Token": TEST_TOKEN}
    )

    assert response.status_code == 200
    assert response.json() == {"connections": expected}


async def test_arq_queue_depth_requires_a_valid_token(client: AsyncClient, monkeypatch):
    monkeypatch.setattr(settings, "internal_metrics_token", TEST_TOKEN)
    response = await client.get("/internal/metrics/arq-queue-depth")
    assert response.status_code == 403


async def test_arq_queue_depth_reflects_zcard_not_llen(client: AsyncClient, monkeypatch):
    """The bug this endpoint exists to work around: arq's queue is a sorted set
    (ZADD), not a list — a KEDA `redis` trigger's LLEN-based listLength always reads 0
    against it. Enqueue a real job via the same ArqRedis pool the app itself uses and
    assert the count actually reflects ZCARD."""
    monkeypatch.setattr(settings, "internal_metrics_token", TEST_TOKEN)
    pool = await get_arq_pool()
    baseline = await pool.zcard(default_queue_name)

    job = await pool.enqueue_job("send_push_job", [], "test", "test", {})
    try:
        response = await client.get(
            "/internal/metrics/arq-queue-depth", headers={"X-Internal-Token": TEST_TOKEN}
        )
        assert response.status_code == 200
        assert response.json() == {"depth": baseline + 1}
    finally:
        assert job is not None
        await job.abort()
