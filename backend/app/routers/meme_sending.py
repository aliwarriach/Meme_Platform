from fastapi import APIRouter, Depends, Request, WebSocket, WebSocketDisconnect, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser, DbSession
from app.core.rate_limit import limiter
from app.db.session import get_db_session
from app.schemas.meme_sending import MemeSendCreate, MemeSendOut, WsTicketOut
from app.services import meme_sending as meme_sending_service
from app.services import users as users_service
from app.websockets.connection_manager import connection_manager

router = APIRouter(prefix="/meme-sending", tags=["meme-sending"])


@router.post("/send", status_code=status.HTTP_201_CREATED, response_model=MemeSendOut)
@limiter.limit("30/minute")
async def send_meme(
    request: Request, data: MemeSendCreate, current_user: CurrentUser, db: DbSession
) -> MemeSendOut:
    """Shim over `/messaging` — see `services/meme_sending.py`. The inbox/sent/seen/react
    endpoints that used to live here are gone: reading, read-receipts and replies are all
    conversation operations now (`/messaging/conversations/...`)."""
    return await meme_sending_service.send_meme(db, current_user, data)


@router.post("/ws-ticket", response_model=WsTicketOut)
@limiter.limit("30/minute")
async def create_ws_ticket(request: Request, current_user: CurrentUser) -> WsTicketOut:
    return await meme_sending_service.create_ws_ticket(current_user)


@router.websocket("/ws")
async def meme_sending_socket(
    websocket: WebSocket, ticket: str, db: AsyncSession = Depends(get_db_session)
) -> None:
    # The app's single per-user socket — it carries messaging frames (`message_received`,
    # `message_read`) as of Phase 19, not just meme sends. The path stays under
    # /meme-sending so shipped clients don't have to move; it is the connection that is
    # shared, not the feature.
    redeemed = await meme_sending_service.redeem_ws_ticket(ticket)
    if redeemed is None:
        # Missing, expired, or already redeemed — tickets are single-use.
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    user_id, token_version = redeemed

    user = await users_service.get_user_by_id(db, user_id)
    if user is None or user.token_version != token_version or not user.is_active:
        # A version mismatch means the ticket predates a logout-everywhere action; a
        # disabled account is rejected the same way `get_current_user` rejects it.
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    user_id = user.id
    await connection_manager.connect(user_id, websocket)
    try:
        while True:
            # No client->server messages are expected on this channel: sending a message
            # goes through the REST endpoint, matching the mobile-UX/REST-first convention
            # used everywhere else. receive_text just keeps the connection open and
            # detects disconnects promptly.
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        connection_manager.disconnect(user_id)
