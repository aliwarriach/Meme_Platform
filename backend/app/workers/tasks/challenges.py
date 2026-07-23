"""arq cron job: challenge window-close + evaluation. Replaces the Phase 10 in-process
asyncio polling loop (`app/workers/challenges.py`, now retired) now that a real task
queue exists — per that module's own note-to-self ("revisit if a real task queue is
introduced later"). Same logic, same guarantee (window-close is a single consistent
event, evaluated once per challenge, never live-on-read): each challenge still gets its
own session/transaction so one failure doesn't block the rest.
"""

import datetime
import logging

from sqlalchemy import select

from app.db.session import async_session_factory
from app.models.challenge import Challenge, ChallengeStatus
from app.services.challenges import evaluate_challenge

logger = logging.getLogger(__name__)


async def close_expired_challenges(ctx: dict) -> int:
    async with async_session_factory() as db:
        now = datetime.datetime.now(datetime.timezone.utc)
        result = await db.execute(
            select(Challenge.id).where(
                Challenge.status == ChallengeStatus.active, Challenge.end_time <= now
            )
        )
        challenge_ids = result.scalars().all()

    for challenge_id in challenge_ids:
        async with async_session_factory() as db:
            try:
                await evaluate_challenge(db, challenge_id)
            except Exception:
                logger.exception("Failed to evaluate challenge %s", challenge_id)

    return len(challenge_ids)
