import uuid

from fastapi import APIRouter, Query, status

from app.core.deps import CurrentUser, DbSession
from app.schemas.notifications import (
    MarkAllReadOut,
    NotificationOut,
    NotificationPage,
    PushTokenRegister,
    UnreadCountOut,
)
from app.services import notifications as notifications_service

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=NotificationPage)
async def list_notifications(
    current_user: CurrentUser,
    db: DbSession,
    cursor: str | None = None,
    limit: int = Query(default=30, ge=1, le=100),
) -> NotificationPage:
    return await notifications_service.list_notifications(db, current_user, cursor, limit)


@router.get("/unread-count", response_model=UnreadCountOut)
async def unread_count(current_user: CurrentUser, db: DbSession) -> UnreadCountOut:
    return await notifications_service.unread_count(db, current_user)


@router.post("/{notification_id}/read", response_model=NotificationOut)
async def mark_read(
    notification_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> NotificationOut:
    return await notifications_service.mark_read(db, current_user, notification_id)


@router.post("/read-all", response_model=MarkAllReadOut)
async def mark_all_read(current_user: CurrentUser, db: DbSession) -> MarkAllReadOut:
    return await notifications_service.mark_all_read(db, current_user)


@router.post("/push-token", status_code=status.HTTP_204_NO_CONTENT)
async def register_push_token(
    payload: PushTokenRegister, current_user: CurrentUser, db: DbSession
) -> None:
    await notifications_service.register_push_token(db, current_user, payload.token, payload.platform)


@router.delete("/push-token", status_code=status.HTTP_204_NO_CONTENT)
async def unregister_push_token(token: str, current_user: CurrentUser, db: DbSession) -> None:
    await notifications_service.unregister_push_token(db, current_user, token)
