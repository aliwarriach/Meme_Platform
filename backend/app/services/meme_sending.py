"""Compatibility shim for the pre-Phase-19 "send a meme to a friend" flow.

There is no `meme_sends` table any more — Phase 19 migrated it into
`conversations`/`messages` (see `services/messaging.py`). Everything here does is
translate the feed's existing "↗ Send" call into a meme-kind message so clients built
against the old contract keep working through the migration. New surfaces should call
`/messaging` directly; this module is expected to be deleted once no client uses it.

Also owns the `/meme-sending/ws` connect-ticket store (SecurityIssues.md M-1) — grouped
here rather than in a dedicated module since it's small and the WS route already lives
under this router's prefix.
"""

import secrets
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.redis import get_arq_pool
from app.models.user import User
from app.schemas.meme_sending import MemeSendCreate, MemeSendOut, MemeSendStatus, WsTicketOut
from app.services import messaging as messaging_service

# WebSocket upgrades can't carry an Authorization header from a browser client, so identity
# has to travel as a query param instead. Rather than putting the long-lived (24h) session
# JWT itself there — which tunnels, reverse proxies and any future access-log pipeline
# record in full by default — the client first exchanges its JWT (over a normal
# Bearer-authenticated request) for a single-use ticket good for a few seconds, and only
# the ticket goes in the URL.
WS_TICKET_KEY_PREFIX = "ws-ticket:"
WS_TICKET_TTL_SECONDS = 30


async def create_ws_ticket(current_user: User) -> WsTicketOut:
    ticket = secrets.token_urlsafe(32)
    redis = await get_arq_pool()
    await redis.set(
        f"{WS_TICKET_KEY_PREFIX}{ticket}",
        f"{current_user.id}:{current_user.token_version}",
        ex=WS_TICKET_TTL_SECONDS,
    )
    return WsTicketOut(ticket=ticket)


async def redeem_ws_ticket(ticket: str) -> tuple[uuid.UUID, int] | None:
    """Consumes the ticket (single-use) and returns the `(user_id, token_version)` it was
    minted for, or `None` if it's missing, expired, or already redeemed."""
    redis = await get_arq_pool()
    raw = await redis.getdel(f"{WS_TICKET_KEY_PREFIX}{ticket}")
    if raw is None:
        return None

    try:
        raw_str = raw.decode() if isinstance(raw, bytes) else raw
        user_id_str, token_version_str = raw_str.split(":")
        return uuid.UUID(user_id_str), int(token_version_str)
    except (ValueError, AttributeError):
        return None


async def send_meme(db: AsyncSession, current_user: User, data: MemeSendCreate) -> MemeSendOut:
    message, recipient, delivered = await messaging_service.send_meme_message(
        db, current_user, data.recipient_id, data.meme_id
    )
    return MemeSendOut(
        # The message *is* the send now — returning its id keeps the response addressable.
        id=message.id,
        sender=current_user,
        recipient=recipient,
        # `send_meme_message` only ever creates meme-kind messages, so `meme` is populated.
        meme=message.meme,
        status=MemeSendStatus.delivered if delivered else MemeSendStatus.pending,
        # Reactions were replaced by real replies; nothing writes this field any more.
        reaction=None,
        created_at=message.created_at,
    )
