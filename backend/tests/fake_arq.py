"""Test double for the arq connection pool. Runs enqueued jobs inline/synchronously
(no real worker process, no real Redis queue) so tests stay fast and deterministic —
same "mock the external/background boundary" pattern as `conftest.py`'s
`mock_media_upload`. Job bodies still run for real (`app/workers/tasks/*.py` functions
are called directly), so this exercises real business logic, just without a live arq
worker process picking jobs off a real queue.
"""

from typing import Any

from app.workers.tasks.ai_caption import generate_caption_job
from app.workers.tasks.email_verification import send_email_otp_job
from app.workers.tasks.instagram import fetch_container_metadata_job
from app.workers.tasks.notifications import send_push_job
from app.workers.tasks.password_reset import send_password_reset_otp_job

_JOB_FUNCTIONS = {
    "generate_caption_job": generate_caption_job,
    "fetch_container_metadata_job": fetch_container_metadata_job,
    "send_push_job": send_push_job,
    "send_email_otp_job": send_email_otp_job,
    "send_password_reset_otp_job": send_password_reset_otp_job,
}


class FakeJob:
    def __init__(self, value: Any = None, error: BaseException | None = None):
        self._value = value
        self._error = error

    async def result(self, timeout: float | None = None) -> Any:
        if self._error is not None:
            raise self._error
        return self._value


class FakeArqPool:
    """`ArqRedis` (what the real `get_arq_pool()` returns) is a full `redis.asyncio.Redis`
    subclass, so callers occasionally use it for plain Redis commands too (e.g.
    `services/meme_sending.py`'s WS ticket store) rather than only `enqueue_job`. This
    fake backs those with a process-local dict — no TTL enforcement, since nothing in the
    test suite needs a ticket to actually expire, only to be set/read/deleted-once.
    """

    def __init__(self) -> None:
        self._store: dict[str, str] = {}

    async def enqueue_job(self, function: str, *args: Any, **kwargs: Any) -> FakeJob:
        job_func = _JOB_FUNCTIONS[function]
        try:
            value = await job_func({}, *args, **kwargs)
        except BaseException as exc:  # noqa: BLE001 - mirrors arq re-raising the job's own exception
            return FakeJob(error=exc)
        return FakeJob(value=value)

    async def set(self, key: str, value: str, ex: int | None = None) -> None:
        self._store[key] = value

    async def get(self, key: str) -> str | None:
        return self._store.get(key)

    async def delete(self, key: str) -> None:
        self._store.pop(key, None)

    async def getdel(self, key: str) -> str | None:
        return self._store.pop(key, None)


_shared_pool = FakeArqPool()


async def get_fake_arq_pool() -> FakeArqPool:
    # A shared instance, not a fresh one per call: real code round-trips state through it
    # across separate calls (e.g. services/meme_sending.py sets a WS ticket in one request
    # and redeems it via getdel in a later one) — a new instance per call would silently
    # lose that state instead of reproducing the real pool's behavior.
    return _shared_pool
