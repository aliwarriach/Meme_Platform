import uuid

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    MemeSendNotFoundError,
    NotFriendsError,
    NotMemeSendRecipientError,
)
from app.models.meme_send import MemeSend, MemeSendStatus
from app.models.user import User
from app.schemas.meme_sending import MemeSendCreate, MemeSendOut, MemeSendReactionCreate
from app.services import friends as friends_service
from app.services.memes import get_meme_out_for_viewer, get_visible_meme
from app.websockets.connection_manager import connection_manager


async def _to_out(db: AsyncSession, send: MemeSend, viewer_id: uuid.UUID) -> MemeSendOut:
    meme_out = await get_meme_out_for_viewer(db, send.meme_id, viewer_id)
    return MemeSendOut(
        id=send.id,
        sender=send.sender,
        recipient=send.recipient,
        meme=meme_out,
        status=send.status,
        reaction=send.reaction,
        created_at=send.created_at,
    )


async def send_meme(db: AsyncSession, current_user: User, data: MemeSendCreate) -> MemeSendOut:
    if not await friends_service.are_friends(db, current_user.id, data.recipient_id):
        raise NotFriendsError("You can only send memes to accepted friends")

    # A meme the sender can't otherwise see (e.g. another user's Friends-only or
    # private-community post) must not be forwardable just because its ID is known.
    await get_visible_meme(db, current_user, data.meme_id)

    send = MemeSend(
        sender_id=current_user.id,
        recipient_id=data.recipient_id,
        meme_id=data.meme_id,
        status=MemeSendStatus.pending,
    )
    db.add(send)
    await db.commit()
    await db.refresh(send)

    out = await _to_out(db, send, current_user.id)

    delivered_live = await connection_manager.send_json(
        data.recipient_id, {"type": "meme_received", "send": out.model_dump(mode="json")}
    )
    if delivered_live:
        send.status = MemeSendStatus.delivered
        await db.commit()
        await db.refresh(send)
        out = await _to_out(db, send, current_user.id)

    return out


async def list_inbox(db: AsyncSession, current_user: User) -> list[MemeSendOut]:
    result = await db.execute(
        select(MemeSend)
        .where(MemeSend.recipient_id == current_user.id)
        .order_by(MemeSend.created_at.desc())
    )
    sends = result.scalars().all()
    return [await _to_out(db, send, current_user.id) for send in sends]


async def list_sent(db: AsyncSession, current_user: User) -> list[MemeSendOut]:
    result = await db.execute(
        select(MemeSend)
        .where(MemeSend.sender_id == current_user.id)
        .order_by(MemeSend.created_at.desc())
    )
    sends = result.scalars().all()
    return [await _to_out(db, send, current_user.id) for send in sends]


async def mark_seen(db: AsyncSession, current_user: User, send_id: uuid.UUID) -> MemeSendOut:
    send = await db.get(MemeSend, send_id)
    if send is None:
        raise MemeSendNotFoundError("Meme send not found")
    if send.recipient_id != current_user.id:
        raise NotMemeSendRecipientError("Only the recipient can acknowledge this send")

    if send.status != MemeSendStatus.seen:
        send.status = MemeSendStatus.seen
        await db.commit()
        await db.refresh(send)

    return await _to_out(db, send, current_user.id)


async def react_to_send(
    db: AsyncSession, current_user: User, send_id: uuid.UUID, data: MemeSendReactionCreate
) -> MemeSendOut:
    send = await db.get(MemeSend, send_id)
    if send is None:
        raise MemeSendNotFoundError("Meme send not found")
    if send.recipient_id != current_user.id:
        raise NotMemeSendRecipientError("Only the recipient can react to this send")

    send.reaction = data.reaction
    await db.commit()
    await db.refresh(send)
    out = await _to_out(db, send, current_user.id)

    await connection_manager.send_json(
        send.sender_id, {"type": "meme_send_reaction", "send": out.model_dump(mode="json")}
    )
    return out
