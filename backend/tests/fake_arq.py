"""Test double for the arq connection pool. Runs enqueued jobs inline/synchronously
(no real worker process, no real Redis queue) so tests stay fast and deterministic —
same "mock the external/background boundary" pattern as `conftest.py`'s
`mock_media_upload`. Job bodies still run for real (`app/workers/tasks/*.py` functions
are called directly), so this exercises real business logic, just without a live arq
worker process picking jobs off a real queue.
"""

from typing import Any

from app.workers.tasks.ai_caption import generate_caption_job
from app.workers.tasks.instagram import fetch_container_metadata_job

_JOB_FUNCTIONS = {
    "generate_caption_job": generate_caption_job,
    "fetch_container_metadata_job": fetch_container_metadata_job,
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
    async def enqueue_job(self, function: str, *args: Any, **kwargs: Any) -> FakeJob:
        job_func = _JOB_FUNCTIONS[function]
        try:
            value = await job_func({}, *args, **kwargs)
        except BaseException as exc:  # noqa: BLE001 - mirrors arq re-raising the job's own exception
            return FakeJob(error=exc)
        return FakeJob(value=value)


async def get_fake_arq_pool() -> FakeArqPool:
    return FakeArqPool()
