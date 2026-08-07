"""arq jobs backing the notification system (Phase 21): the push-send job itself, plus the
three new cron jobs that generate challenge-lifecycle notifications on a schedule (the
event-driven ones — invite, starting, results — fire directly from services/challenges.py
and services/messaging.py, no cron needed there).
"""

import datetime
import logging

from sqlalchemy import select

from app.db.session import async_session_factory
from app.integrations.expo_push import send_push_notifications
from app.models.challenge import Challenge, ChallengeStatus
from app.models.notification import NotificationType, PushToken
from app.services import challenges as challenges_service
from app.services import notifications as notifications_service
from app.services.challenges import _side_scores

logger = logging.getLogger(__name__)

ENDING_SOON_WINDOW_MINUTES = 60


async def send_push_job(ctx: dict, user_ids: list[str], title: str, body: str, data: dict) -> int:
    async with async_session_factory() as db:
        result = await db.execute(select(PushToken.token).where(PushToken.user_id.in_(user_ids)))
        tokens = list(result.scalars().all())
    await send_push_notifications(tokens, title, body, data)
    return len(tokens)


async def notify_challenges_ending_soon(ctx: dict) -> int:
    """One-shot: any active challenge whose end_time falls inside the next hour and hasn't
    already been flagged gets its participants notified, then the flag is stamped so a
    later poll doesn't re-send it.
    """
    now = datetime.datetime.now(datetime.timezone.utc)
    window_end = now + datetime.timedelta(minutes=ENDING_SOON_WINDOW_MINUTES)

    async with async_session_factory() as db:
        result = await db.execute(
            select(Challenge).where(
                Challenge.status == ChallengeStatus.active,
                Challenge.end_time <= window_end,
                Challenge.end_time > now,
                Challenge.ending_soon_notified_at.is_(None),
            )
        )
        challenges = result.scalars().all()

        notified = 0
        for challenge in challenges:
            try:
                user_ids = await challenges_service.challenge_participant_user_ids(db, challenge)
                if user_ids:
                    await notifications_service.notify_many(
                        db,
                        user_ids,
                        NotificationType.challenge_ending_soon,
                        title=f"{challenge.title} is ending soon",
                        body="Less than an hour left — get your submission in.",
                        data={"challenge_id": str(challenge.id)},
                    )
                challenge.ending_soon_notified_at = now
                await db.commit()
                notified += 1
            except Exception:
                logger.exception("Failed to send ending-soon notification for %s", challenge.id)
                await db.rollback()

    return notified


async def notify_side_overtaken(ctx: dict) -> int:
    """Recomputes the live leader for every active multi-side challenge and notifies
    participants only on a genuine overtake — both the old and new leader must be
    established (non-null) and different. A leader being established for the first time,
    or a tie resolving into one, is not an "overtake" and would just be noise.
    """
    async with async_session_factory() as db:
        result = await db.execute(
            select(Challenge).where(Challenge.status == ChallengeStatus.active)
        )
        challenges = result.scalars().all()

        notified = 0
        for challenge in challenges:
            try:
                if len(challenge.sides) < 2:
                    continue

                # `_side_scores` omits a side with zero submissions entirely — default it to
                # 0.0 (same precedent as `evaluate_challenge`'s tie detection), or a side
                # that hasn't posted anything yet would make this skip the comparison
                # instead of correctly treating it as trailing at 0.
                scored = await _side_scores(db, challenge.id)
                scores = {side.id: scored.get(side.id, 0.0) for side in challenge.sides}

                top_score = max(scores.values())
                leaders = [side_id for side_id, score in scores.items() if score == top_score]
                new_leader = leaders[0] if len(leaders) == 1 and top_score > 0 else None
                old_leader = challenge.leading_side_id

                if old_leader is not None and new_leader is not None and old_leader != new_leader:
                    user_ids = await challenges_service.challenge_participant_user_ids(db, challenge)
                    if user_ids:
                        await notifications_service.notify_many(
                            db,
                            user_ids,
                            NotificationType.challenge_side_overtaken,
                            title=f"The lead changed in {challenge.title}",
                            body="Someone just took the lead — check the scoreboard.",
                            data={"challenge_id": str(challenge.id)},
                        )
                    notified += 1

                challenge.leading_side_id = new_leader
                await db.commit()
            except Exception:
                logger.exception("Failed to check side-overtaken for %s", challenge.id)
                await db.rollback()

    return notified


async def create_weekly_open_challenge(ctx: dict) -> bool:
    """Platform-run open challenge so the Compete tab is never empty for a new user
    (Roadmap §3.3). Idempotent for free: the hashtag slug is deterministic per ISO week, and
    `create_open_challenge` already turns a duplicate-tag reservation into
    `HashtagAlreadyReservedError` — this just treats that as "already ran this week."
    """
    async with async_session_factory() as db:
        created = await challenges_service.create_weekly_open_challenge(db)
    return created
