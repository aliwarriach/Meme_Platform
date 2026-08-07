"""Compatibility shim for the pre-Phase-19 "send a meme to a friend" flow.

There is no `meme_sends` table any more — Phase 19 migrated it into
`conversations`/`messages` (see `services/messaging.py`). Everything here does is
translate the feed's existing "↗ Send" call into a meme-kind message so clients built
against the old contract keep working through the migration. New surfaces should call
`/messaging` directly; this module is expected to be deleted once no client uses it.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.schemas.meme_sending import MemeSendCreate, MemeSendOut, MemeSendStatus
from app.services import messaging as messaging_service


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
