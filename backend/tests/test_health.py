"""Roadmap_Scaling.md A3 — liveness/readiness probes + graceful shutdown.

The roadmap's own TEST section describes stopping Postgres/Redis for real (`docker
compose stop postgres`) — this repo has no docker-compose stack yet (that's A7) and
Postgres/Redis run as native Windows services shared with the rest of this suite (and
possibly other concurrently-running test processes), so actually stopping them here would
be destructive and environment-specific in the wrong way. Monkeypatching
`health._check_database`/`_check_redis` to fail exercises the exact same branch
(readiness correctly reports 503 with which dependency failed) without touching real
shared infrastructure.

Windows also can't deliver a real cross-process SIGTERM to a registered Python signal
handler (verified independently: `os.kill(pid, signal.SIGTERM)` raises `WinError 87`, and
even `kill -TERM <pid>` from Git Bash just force-terminates the process without invoking
the handler) — so the shutdown test calls `app.main._handle_sigterm` directly, which
exercises the exact same application-level code path a real SIGTERM would invoke.
"""

import signal

import app.main as main_module
import app.routers.health as health_module
from httpx import AsyncClient


async def test_health_live_always_returns_ok(client: AsyncClient):
    response = await client.get("/health/live")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


async def test_health_alias_matches_live(client: AsyncClient):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


async def test_ready_returns_200_when_dependencies_are_up(client: AsyncClient):
    response = await client.get("/health/ready")
    assert response.status_code == 200
    assert response.json()["status"] == "ready"


async def test_ready_returns_503_when_the_database_check_fails(client: AsyncClient, monkeypatch):
    async def _fail() -> None:
        raise RuntimeError("db down")

    monkeypatch.setattr(health_module, "_check_database", _fail)

    response = await client.get("/health/ready")
    assert response.status_code == 503
    assert response.json()["failed"] == ["database"]

    # Liveness must stay completely unaffected by a dependency outage.
    assert (await client.get("/health/live")).status_code == 200


async def test_ready_returns_503_when_the_redis_check_fails(client: AsyncClient, monkeypatch):
    async def _fail() -> None:
        raise RuntimeError("redis down")

    monkeypatch.setattr(health_module, "_check_redis", _fail)

    response = await client.get("/health/ready")
    assert response.status_code == 503
    assert response.json()["failed"] == ["redis"]


async def test_ready_reports_both_failures_when_both_dependencies_are_down(
    client: AsyncClient, monkeypatch
):
    async def _fail() -> None:
        raise RuntimeError("down")

    monkeypatch.setattr(health_module, "_check_database", _fail)
    monkeypatch.setattr(health_module, "_check_redis", _fail)

    response = await client.get("/health/ready")
    assert response.status_code == 503
    assert set(response.json()["failed"]) == {"database", "redis"}


async def test_ready_recovers_once_the_dependency_check_succeeds_again(
    client: AsyncClient, monkeypatch
):
    calls = {"n": 0}

    async def _flaky_once() -> None:
        calls["n"] += 1
        if calls["n"] == 1:
            raise RuntimeError("still down")

    monkeypatch.setattr(health_module, "_check_redis", _flaky_once)

    first = await client.get("/health/ready")
    assert first.status_code == 503

    second = await client.get("/health/ready")
    assert second.status_code == 200


async def test_sigterm_flips_readiness_immediately_without_rejecting_other_requests(
    client: AsyncClient,
):
    """The application-level contract this phase exists for: the instant the handler
    fires, /health/ready flips to 503 — but since only that one endpoint consults the
    flag, ordinary requests already in flight or issued afterward keep being served
    normally. It's the external load balancer's job to stop *routing new* traffic once it
    observes the 503, not this process's job to reject requests itself."""
    assert (await client.get("/health/ready")).status_code == 200

    main_module._handle_sigterm(signal.SIGTERM, None)

    assert (await client.get("/health/ready")).status_code == 503
    still_served = await client.get("/health/live")
    assert still_served.status_code == 200
