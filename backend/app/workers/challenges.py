"""Scheduled challenge window-close + evaluation — the first real background worker in
this repo (Phase 8/9 both deliberately stayed on live-SQL-on-read since no Celery/arq
infra existed and nothing needed one). Challenges are different: backend/CLAUDE.md
requires the window-close moment to be a **single consistent event**, not something
recomputed differently on every read, since a submission and an evaluation racing the
same instant must resolve the same way. Rather than standing up Celery/arq for this one
feature, this is a minimal in-process asyncio polling loop, started from `main.py`'s
lifespan — good enough at this scale (one process, no horizontal scaling yet); revisit if
a real task queue is introduced later for other features (AI captioning, Instagram
metadata fetch).
"""

import asyncio
import datetime
import logging

from sqlalchemy import select

from app.db.session import async_session_factory
from app.models.challenge import Challenge, ChallengeStatus
from app.services.challenges import evaluate_challenge

logger = logging.getLogger(__name__)

POLL_INTERVAL_SECONDS = 5


async def close_expired_challenges() -> None:
    """One pass: evaluate every `active` challenge whose window has ended. Each challenge
    is evaluated inside its own session/transaction so one failure doesn't block others.
    """
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


async def run_challenge_close_loop() -> None:
    while True:
        try:
            await close_expired_challenges()
        except Exception:
            logger.exception("Challenge close-loop iteration failed")
        await asyncio.sleep(POLL_INTERVAL_SECONDS)
