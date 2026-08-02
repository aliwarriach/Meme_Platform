import uuid

from fastapi import APIRouter, Depends, Request, WebSocket, WebSocketDisconnect, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser, DbSession
from app.core.rate_limit import limiter
from app.core.security import InvalidTokenError, decode_access_token
from app.db.session import get_db_session
from app.schemas.meme_sending import MemeSendCreate, MemeSendOut, MemeSendReactionCreate
from app.services import meme_sending as meme_sending_service
from app.services import users as users_service
from app.websockets.connection_manager import connection_manager

router = APIRouter(prefix="/meme-sending", tags=["meme-sending"])


@router.post("/send", status_code=status.HTTP_201_CREATED, response_model=MemeSendOut)
@limiter.limit("30/minute")
async def send_meme(
    request: Request, data: MemeSendCreate, current_user: CurrentUser, db: DbSession
) -> MemeSendOut:
    return await meme_sending_service.send_meme(db, current_user, data)


@router.get("/inbox", response_model=list[MemeSendOut])
async def get_inbox(current_user: CurrentUser, db: DbSession) -> list[MemeSendOut]:
    return await meme_sending_service.list_inbox(db, current_user)


@router.get("/sent", response_model=list[MemeSendOut])
async def get_sent(current_user: CurrentUser, db: DbSession) -> list[MemeSendOut]:
    return await meme_sending_service.list_sent(db, current_user)


@router.post("/inbox/{send_id}/seen", response_model=MemeSendOut)
async def acknowledge_send(send_id: uuid.UUID, current_user: CurrentUser, db: DbSession) -> MemeSendOut:
    return await meme_sending_service.mark_seen(db, current_user, send_id)


@router.post("/inbox/{send_id}/react", response_model=MemeSendOut)
async def react_to_send(
    send_id: uuid.UUID, data: MemeSendReactionCreate, current_user: CurrentUser, db: DbSession
) -> MemeSendOut:
    return await meme_sending_service.react_to_send(db, current_user, send_id, data)


@router.websocket("/ws")
async def meme_sending_socket(
    websocket: WebSocket, token: str, db: AsyncSession = Depends(get_db_session)
) -> None:
    # WebSocket upgrades can't carry an Authorization header from a browser client, so the
    # JWT travels as a query param here instead — this endpoint is the one deliberate
    # exception to the Bearer-header convention used everywhere else in this API.
    try:
        decoded = decode_access_token(token)
    except InvalidTokenError:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    user = await users_service.get_user_by_id(db, decoded.user_id)
    if user is None or user.token_version != decoded.token_version:
        # A version mismatch means the token predates a logout-everywhere action.
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    user_id = user.id
    await connection_manager.connect(user_id, websocket)
    try:
        while True:
            # No client->server messages are expected on this channel yet (send-a-meme goes
            # through the REST endpoint above, matching the mobile-UX/REST-first convention
            # used everywhere else); receive_text just keeps the connection open and detects
            # disconnects promptly.
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        connection_manager.disconnect(user_id)
