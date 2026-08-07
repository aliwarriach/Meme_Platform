import uuid

from fastapi import APIRouter, Query, Request, status

from app.core.deps import CurrentUser, DbSession
from app.core.rate_limit import limiter
from app.schemas.messaging import (
    ConversationCreate,
    ConversationOut,
    ConversationReadOut,
    MessageCreate,
    MessageOut,
    MessagePage,
)
from app.services import messaging as messaging_service

router = APIRouter(prefix="/messaging", tags=["messaging"])


@router.get("/conversations", response_model=list[ConversationOut])
async def list_conversations(current_user: CurrentUser, db: DbSession) -> list[ConversationOut]:
    return await messaging_service.list_conversations(db, current_user)


@router.post(
    "/conversations", status_code=status.HTTP_201_CREATED, response_model=ConversationOut
)
async def open_conversation(
    data: ConversationCreate, current_user: CurrentUser, db: DbSession
) -> ConversationOut:
    """Get-or-create — starting a chat with someone you already have a thread with returns
    that thread rather than 409ing, since the client can't know which case it's in."""
    return await messaging_service.get_or_create_conversation(db, current_user, data.user_id)


@router.get("/conversations/{conversation_id}/messages", response_model=MessagePage)
async def list_messages(
    conversation_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
    cursor: str | None = None,
    limit: int = Query(default=30, ge=1, le=100),
) -> MessagePage:
    return await messaging_service.list_messages(db, current_user, conversation_id, cursor, limit)


@router.post(
    "/conversations/{conversation_id}/messages",
    status_code=status.HTTP_201_CREATED,
    response_model=MessageOut,
)
@limiter.limit("60/minute")
async def send_message(
    request: Request,
    conversation_id: uuid.UUID,
    data: MessageCreate,
    current_user: CurrentUser,
    db: DbSession,
) -> MessageOut:
    return await messaging_service.send_message(db, current_user, conversation_id, data)


@router.post("/conversations/{conversation_id}/read", response_model=ConversationReadOut)
async def mark_conversation_read(
    conversation_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> ConversationReadOut:
    return await messaging_service.mark_conversation_read(db, current_user, conversation_id)
