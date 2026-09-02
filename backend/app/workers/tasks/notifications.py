"""arq jobs backing the notification system (Phase 21, extended 2026-08-31): the push-send
job itself, the three original cron jobs that generate challenge-lifecycle notifications on
a schedule (the event-driven ones — invite, starting, results — fire directly from
services/challenges.py and services/messaging.py, no cron needed there), plus two more
crons for the second notification wave: competition wins (event-driven at the *service*
layer isn't possible here — nothing calls a "period just closed" hook, since standings are
computed live on read, see services/competitions.py's module docstring) and batched meme
upvotes (deliberately NOT event-driven — a per-vote notification would spam a popular
meme's author, see .claude/memory/notifications.md).
"""

import datetime
import logging

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.db.session import async_session_factory
from app.integrations.expo_push import send_push_notifications
from app.models.challenge import Challenge, ChallengeStatus
from app.models.competition_period import CompetitionPeriod
from app.models.competition_winner_notification import CompetitionWinnerNotification
from app.models.meme import Meme
from app.models.meme_vote import MemeVote
from app.models.notification import NotificationType, PushToken
from app.models.notification_cron_cursor import NotificationCronCursor
from app.services import challenges as challenges_service
from app.services import competitions as competitions_service
from app.services import notifications as notifications_service
from app.services.challenges import _side_scores

logger = logging.getLogger(__name__)

ENDING_SOON_WINDOW_MINUTES = 60
MEME_UPVOTES_BATCH_LOOKBACK_MINUTES = 15


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


async def notify_competition_winners(ctx: dict) -> int:
    """Detects each period type's most-recently-*closed* period on every poll and, the
    first time it's seen, notifies whoever won it. There is no "period just closed" event
    to hook — standings are computed live on read (services/competitions.py) — so this
    polls instead, same shape as the challenge crons above.

    Idempotency is a DB-level `ON CONFLICT DO NOTHING` on `CompetitionWinnerNotification`,
    claimed *before* resolving/notifying the winner (not after) — so a crash mid-notify, or
    two overlapping runs, can never double-send, at the cost of a period with no winner
    (or a winner-resolution failure) being permanently marked "handled" without ever having
    sent anything. That's the right tradeoff here: a missed win is a one-time inconvenience,
    a duplicate "you won" push every 15 minutes forever is a worse one.
    """
    notified = 0
    async with async_session_factory() as db:
        for period_type in CompetitionPeriod:
            current_key = competitions_service.current_period_key(period_type)
            current_start, _ = competitions_service.period_bounds(period_type, current_key)
            # The period immediately before "now" — its end is exactly this period's start,
            # so a timestamp one second before that start always falls inside it.
            prev_key = competitions_service.period_key(
                period_type, current_start - datetime.timedelta(seconds=1)
            )

            claim = await db.execute(
                pg_insert(CompetitionWinnerNotification)
                .values(period_type=period_type, period_key=prev_key)
                .on_conflict_do_nothing(
                    index_elements=["period_type", "period_key"]
                )
            )
            await db.commit()
            if not claim.rowcount:
                continue  # already processed by an earlier poll (or another worker)

            try:
                recipient_id = await competitions_service.get_winner_recipient(
                    db, period_type, prev_key
                )
                if recipient_id is None:
                    continue  # no entries that period — nobody to notify

                await notifications_service.notify_one(
                    db,
                    recipient_id,
                    NotificationType.competition_won,
                    title=f"You won Meme of the {period_type.value.capitalize()}!",
                    body="Your post came out on top — tap to see the standings.",
                    data={"period_type": period_type.value, "period_key": prev_key},
                )
                notified += 1
            except Exception:
                logger.exception(
                    "Failed to resolve/notify competition winner for %s %s",
                    period_type.value,
                    prev_key,
                )

    return notified


async def notify_batched_meme_upvotes(ctx: dict) -> int:
    """Summarizes new upvotes per meme since this job's own last run into one notification
    per meme, rather than one per vote — a popular meme picking up dozens of upvotes an
    hour would otherwise spam its author (see .claude/memory/notifications.md, this batching
    decision was confirmed with the user before building). Self-upvotes are excluded (a
    meme author voting on their own post shouldn't count toward "you got upvoted").
    """
    async with async_session_factory() as db:
        cursor = await db.get(NotificationCronCursor, "meme_upvotes_batch")
        now = datetime.datetime.now(datetime.timezone.utc)
        since = (
            cursor.last_run_at
            if cursor is not None
            else now - datetime.timedelta(minutes=MEME_UPVOTES_BATCH_LOOKBACK_MINUTES)
        )

        result = await db.execute(
            select(Meme.id, Meme.author_id, func.count(MemeVote.id))
            .join(MemeVote, MemeVote.meme_id == Meme.id)
            .where(
                MemeVote.value == 1,
                MemeVote.created_at > since,
                MemeVote.created_at <= now,
                MemeVote.user_id != Meme.author_id,
                Meme.deleted_at.is_(None),
            )
            .group_by(Meme.id, Meme.author_id)
        )
        rows = result.all()

        for meme_id, author_id, new_upvotes in rows:
            await notifications_service.notify_one(
                db,
                author_id,
                NotificationType.meme_upvotes_received,
                title="Your meme is getting upvotes",
                body=f"+{new_upvotes} new upvote{'s' if new_upvotes != 1 else ''} since your last check.",
                data={"meme_id": str(meme_id)},
            )

        if cursor is None:
            db.add(NotificationCronCursor(job_name="meme_upvotes_batch", last_run_at=now))
        else:
            cursor.last_run_at = now
        await db.commit()

    return len(rows)


async def create_weekly_open_challenge(ctx: dict) -> bool:
    """Platform-run open challenge so the Compete tab is never empty for a new user
    (Roadmap §3.3). Idempotent for free: the hashtag slug is deterministic per ISO week, and
    `create_open_challenge` already turns a duplicate-tag reservation into
    `HashtagAlreadyReservedError` — this just treats that as "already ran this week."
    """
    async with async_session_factory() as db:
        created = await challenges_service.create_weekly_open_challenge(db)
    return created
