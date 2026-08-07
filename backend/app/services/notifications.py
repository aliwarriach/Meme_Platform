"""In-app notification centre + Expo push token registry (Phase 21).

Two delivery channels fan out from the same call: an in-app `Notification` row (read via
`GET /notifications`) and a push, sent as an arq job so a slow/down Expo API never blocks
the request that triggered it (backend/CLAUDE.md — background task, never inline). The WS
frame is a third, "for free" channel over the same per-user socket messaging already uses,
so the in-app unread badge updates live while the app is open.
"""

import datetime
import uuid

from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotificationNotFoundError
from app.core.pagination import decode_cursor, encode_cursor
from app.core.redis import get_arq_pool
from app.models.notification import Notification, NotificationType, PushToken
from app.models.user import User
from app.schemas.notifications import MarkAllReadOut, NotificationOut, NotificationPage, UnreadCountOut
from app.websockets.connection_manager import connection_manager


async def _push_and_broadcast(notifications: list[Notification]) -> None:
    if not notifications:
        return
    arq_pool = await get_arq_pool()
    for notification in notifications:
        out = NotificationOut.model_validate(notification)
        await connection_manager.send_json(
            notification.user_id,
            {"type": "notification", "notification": out.model_dump(mode="json")},
        )
        await arq_pool.enqueue_job(
            "send_push_job",
            [str(notification.user_id)],
            notification.title,
            notification.body,
            notification.data,
        )


async def notify_many(
    db: AsyncSession,
    user_ids: set[uuid.UUID],
    type_: NotificationType,
    title: str,
    body: str,
    data: dict,
) -> list[Notification]:
    """Bulk in-app + push + live-socket fan-out to every id in `user_ids`. Callers own the
    surrounding transaction context (this commits on its own, matching the rest of the
    service layer's per-call-commit convention) — safe to call after a caller's own commit
    since it only ever inserts new rows.
    """
    if not user_ids:
        return []

    notifications = [
        Notification(user_id=user_id, type=type_, title=title, body=body, data=data)
        for user_id in user_ids
    ]
    db.add_all(notifications)
    await db.commit()
    for notification in notifications:
        await db.refresh(notification)

    await _push_and_broadcast(notifications)
    return notifications


async def notify_one(
    db: AsyncSession, user_id: uuid.UUID, type_: NotificationType, title: str, body: str, data: dict
) -> Notification:
    return (await notify_many(db, {user_id}, type_, title, body, data))[0]


async def list_notifications(
    db: AsyncSession, current_user: User, cursor: str | None, limit: int
) -> NotificationPage:
    stmt = (
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc(), Notification.id.desc())
        .limit(limit + 1)
    )
    if cursor:
        cursor_created_at, cursor_id = decode_cursor(cursor)
        stmt = stmt.where(
            or_(
                Notification.created_at < cursor_created_at,
                and_(Notification.created_at == cursor_created_at, Notification.id < cursor_id),
            )
        )

    result = await db.execute(stmt)
    items = list(result.scalars().all())

    has_more = len(items) > limit
    items = items[:limit]
    next_cursor = encode_cursor(items[-1].created_at, items[-1].id) if has_more and items else None

    return NotificationPage(
        items=[NotificationOut.model_validate(n) for n in items], next_cursor=next_cursor
    )


async def unread_count(db: AsyncSession, current_user: User) -> UnreadCountOut:
    count = await db.scalar(
        select(func.count(Notification.id)).where(
            Notification.user_id == current_user.id, Notification.read_at.is_(None)
        )
    )
    return UnreadCountOut(count=count or 0)


async def mark_read(db: AsyncSession, current_user: User, notification_id: uuid.UUID) -> NotificationOut:
    notification = await db.get(Notification, notification_id)
    if notification is None or notification.user_id != current_user.id:
        # 404 rather than 403: notification ids aren't guessable/enumerable, same rationale
        # as `messaging.py`'s conversation lookups — except here even confirming existence
        # to a non-owner has no legitimate use, so 404 (not 403) hides that too.
        raise NotificationNotFoundError("Notification not found")
    if notification.read_at is None:
        notification.read_at = datetime.datetime.now(datetime.timezone.utc)
        await db.commit()
        await db.refresh(notification)
    return NotificationOut.model_validate(notification)


async def mark_all_read(db: AsyncSession, current_user: User) -> MarkAllReadOut:
    result = await db.execute(
        update(Notification)
        .where(Notification.user_id == current_user.id, Notification.read_at.is_(None))
        .values(read_at=datetime.datetime.now(datetime.timezone.utc))
    )
    await db.commit()
    return MarkAllReadOut(read_count=result.rowcount or 0)


async def register_push_token(
    db: AsyncSession, current_user: User, token: str, platform: str
) -> None:
    """Upsert by token, not by (user, token): a device's token can move to a different
    account on reinstall/re-login, and the old owner must stop receiving that device's
    pushes the moment the new owner registers it."""
    existing = await db.scalar(select(PushToken).where(PushToken.token == token))
    if existing is not None:
        existing.user_id = current_user.id
        existing.platform = platform
    else:
        db.add(PushToken(user_id=current_user.id, token=token, platform=platform))
    await db.commit()


async def unregister_push_token(db: AsyncSession, current_user: User, token: str) -> None:
    await db.execute(
        PushToken.__table__.delete().where(
            PushToken.token == token, PushToken.user_id == current_user.id
        )
    )
    await db.commit()
