"""arq cron job: periodic full recompute of `meme_scores`, replacing the live
correlated-subquery aggregation leaderboards used to run on every request. Runs every
`SCORE_RECOMPUTE_INTERVAL_S` — see `app/workers/arq_worker.py`'s `cron_jobs` list for the
actual schedule.
"""

import logging

from app.db.session import async_session_factory
from app.services.scoring import recompute_all_scores

logger = logging.getLogger(__name__)


async def recompute_meme_scores(ctx: dict) -> int:
    async with async_session_factory() as db:
        count = await recompute_all_scores(db)
    logger.info("Recomputed scores for %d memes", count)
    return count
