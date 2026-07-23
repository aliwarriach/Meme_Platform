"""arq worker entrypoint. Run with: `arq app.workers.arq_worker.WorkerSettings`
(separate process from `uvicorn` — the API process only *enqueues* jobs via
`app/core/redis.py::get_arq_pool`, it never runs task bodies itself).

Consolidates every background task this repo previously ran as either a bare
`asyncio.create_task`/in-process polling loop (challenge window-close, Instagram
metadata fetch) or an inline synchronous call sharing the request's event loop (AI
caption generation), plus the new periodic score recompute — see backend/CLAUDE.md's
`workers/` folder description and `.claude/memory/hardening.md`'s follow-up plan for why
each of these needed a real task queue rather than staying as they were.
"""

from arq.connections import RedisSettings
from arq.cron import cron

from app.core.config import settings
from app.workers.tasks.ai_caption import generate_caption_job
from app.workers.tasks.challenges import close_expired_challenges
from app.workers.tasks.instagram import fetch_container_metadata_job
from app.workers.tasks.scoring import recompute_meme_scores

SCORE_RECOMPUTE_INTERVAL_S = 30
CHALLENGE_POLL_INTERVAL_S = 5

_redis_settings = RedisSettings.from_dsn(settings.redis_url)
# See the matching comment in app/core/redis.py — arq's default 1s conn_timeout is too
# tight for this environment's observed first-connection latency (~2s).
_redis_settings.conn_timeout = 10


class WorkerSettings:
    functions = [generate_caption_job, fetch_container_metadata_job]
    cron_jobs = [
        cron(recompute_meme_scores, second=set(range(0, 60, SCORE_RECOMPUTE_INTERVAL_S))),
        cron(close_expired_challenges, second=set(range(0, 60, CHALLENGE_POLL_INTERVAL_S))),
    ]
    redis_settings = _redis_settings
