import datetime
import uuid

from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    ConversationNotFoundError,
    EmailNotVerifiedError,
    NotConversationParticipantError,
    NotFriendsError,
)
from app.core.pagination import decode_cursor, encode_cursor
from app.core.redis import get_arq_pool
from app.models.conversation import Conversation
from app.models.message import Message, MessageKind
from app.models.user import User
from app.schemas.messaging import (
    ConversationOut,
    ConversationReadOut,
    MessageCreate,
    MessageOut,
    MessagePage,
)
from app.services import friends as friends_service
from app.services.memes import get_meme_out_for_viewer, get_visible_meme
from app.websockets.connection_manager import connection_manager


def _canonical_pair(user_a_id: uuid.UUID, user_b_id: uuid.UUID) -> tuple[uuid.UUID, uuid.UUID]:
    """Orders a participant pair so (A, B) and (B, A) map to the same row — the ordering
    the `uq_conversation_pair` unique constraint relies on."""
    return (user_a_id, user_b_id) if str(user_a_id) < str(user_b_id) else (user_b_id, user_a_id)


async def _to_message_out(
    db: AsyncSession, message: Message, viewer_id: uuid.UUID
) -> MessageOut:
    meme_out = (
        await get_meme_out_for_viewer(db, message.meme_id, viewer_id)
        if message.meme_id is not None
        else None
    )
    return MessageOut(
        id=message.id,
        conversation_id=message.conversation_id,
        sender=message.sender,
        kind=message.kind,
        body=message.body,
        meme=meme_out,
        read_at=message.read_at,
        created_at=message.created_at,
    )


async def _require_participant(
    db: AsyncSession, current_user: User, conversation_id: uuid.UUID
) -> Conversation:
    conversation = await db.get(Conversation, conversation_id)
    if conversation is None:
        raise ConversationNotFoundError("Conversation not found")
    if not conversation.includes(current_user.id):
        # 403 rather than 404: the caller supplied a real ID they simply aren't part of,
        # and conversation IDs aren't guessable/enumerable from anywhere in the API.
        raise NotConversationParticipantError("You are not part of this conversation")
    return conversation


async def _get_or_create_conversation(
    db: AsyncSession, current_user: User, other_user_id: uuid.UUID
) -> Conversation:
    viewer_id = current_user.id
    if not await friends_service.are_friends(db, viewer_id, other_user_id):
        raise NotFriendsError("You can only message accepted friends")

    user_a_id, user_b_id = _canonical_pair(viewer_id, other_user_id)
    pair_clause = (Conversation.user_a_id == user_a_id, Conversation.user_b_id == user_b_id)

    conversation = await db.scalar(select(Conversation).where(*pair_clause))
    if conversation is not None:
        return conversation

    # Only reached when genuinely creating a *new* thread — reusing an existing one
    # (the branch above) never requires verification (SecurityFeatures.md F-1). Both
    # `/messaging/conversations` and the legacy `/meme-sending/send` shim funnel through
    # this one function, so gating here covers both entry points for free.
    if current_user.email_verified_at is None:
        raise EmailNotVerifiedError("Verify your email to start a new conversation")

    conversation = Conversation(user_a_id=user_a_id, user_b_id=user_b_id)
    db.add(conversation)
    try:
        await db.commit()
    except IntegrityError:
        # Both participants tapping "message" at the same moment race here; the unique
        # constraint settles it and the loser just re-reads the winner's row.
        await db.rollback()
        conversation = await db.scalar(select(Conversation).where(*pair_clause))
        if conversation is None:
            raise
        return conversation

    await db.refresh(conversation)
    return conversation


async def get_or_create_conversation(
    db: AsyncSession, current_user: User, other_user_id: uuid.UUID
) -> ConversationOut:
    conversation = await _get_or_create_conversation(db, current_user, other_user_id)
    return await _to_conversation_out(db, conversation, current_user.id)


async def _to_conversation_out(
    db: AsyncSession, conversation: Conversation, viewer_id: uuid.UUID
) -> ConversationOut:
    last_message = await db.scalar(
        select(Message)
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.created_at.desc(), Message.id.desc())
        .limit(1)
    )
    unread_count = await db.scalar(
        select(func.count(Message.id)).where(
            Message.conversation_id == conversation.id,
            Message.sender_id != viewer_id,
            Message.read_at.is_(None),
        )
    )
    return ConversationOut(
        id=conversation.id,
        other_user=conversation.other_participant(viewer_id),
        last_message=(
            await _to_message_out(db, last_message, viewer_id) if last_message is not None else None
        ),
        unread_count=unread_count or 0,
        last_message_at=conversation.last_message_at,
    )


async def list_conversations(db: AsyncSession, current_user: User) -> list[ConversationOut]:
    """Every thread the caller is in, most recently active first. Threads with no messages
    yet (created by tapping "message" but never used) sort last via the null
    `last_message_at`, rather than being hidden — the user did deliberately open them."""
    result = await db.execute(
        select(Conversation)
        .where(
            or_(
                Conversation.user_a_id == current_user.id,
                Conversation.user_b_id == current_user.id,
            )
        )
        .order_by(Conversation.last_message_at.desc().nullslast(), Conversation.created_at.desc())
    )
    conversations = result.scalars().all()
    return [await _to_conversation_out(db, c, current_user.id) for c in conversations]


async def list_messages(
    db: AsyncSession,
    current_user: User,
    conversation_id: uuid.UUID,
    cursor: str | None,
    limit: int,
) -> MessagePage:
    """Newest-first keyset page. A thread only ever grows at the newest end, so unlike the
    Hot-ranked main feed there is no drift for a cursor to skip or duplicate over."""
    conversation = await _require_participant(db, current_user, conversation_id)

    stmt = (
        select(Message)
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.created_at.desc(), Message.id.desc())
        .limit(limit + 1)
    )
    if cursor:
        cursor_created_at, cursor_id = decode_cursor(cursor)
        stmt = stmt.where(
            or_(
                Message.created_at < cursor_created_at,
                and_(Message.created_at == cursor_created_at, Message.id < cursor_id),
            )
        )

    result = await db.execute(stmt)
    messages = list(result.scalars().all())

    has_more = len(messages) > limit
    messages = messages[:limit]
    next_cursor = (
        encode_cursor(messages[-1].created_at, messages[-1].id) if has_more and messages else None
    )

    return MessagePage(
        items=[await _to_message_out(db, m, current_user.id) for m in messages],
        next_cursor=next_cursor,
    )


async def send_message(
    db: AsyncSession, current_user: User, conversation_id: uuid.UUID, data: MessageCreate
) -> MessageOut:
    conversation = await _require_participant(db, current_user, conversation_id)
    recipient_id = conversation.other_participant(current_user.id).id

    # Re-checked on every send, not just at conversation creation — an existing thread must
    # not stay writable after the friendship is removed.
    if not await friends_service.are_friends(db, current_user.id, recipient_id):
        raise NotFriendsError("You can only message accepted friends")

    if data.kind is MessageKind.meme:
        # A meme the sender can't otherwise see (another user's Friends-only or
        # private-community post) must not become forwardable just because its ID is
        # known — same IDOR fix the old `send_meme` carried, ported to this endpoint.
        await get_visible_meme(db, current_user, data.meme_id)

    message = Message(
        conversation_id=conversation.id,
        sender_id=current_user.id,
        kind=data.kind,
        body=data.body,
        meme_id=data.meme_id,
    )
    db.add(message)
    conversation.last_message_at = datetime.datetime.now(datetime.timezone.utc)
    await db.commit()
    await db.refresh(message)

    out = await _to_message_out(db, message, current_user.id)
    delivered_live = await connection_manager.send_json(
        recipient_id,
        {
            "type": "message_received",
            "conversation_id": str(conversation.id),
            # Built for the *recipient*, not the sender — `MemeOut` carries viewer-specific
            # fields (viewer_vote, view-count visibility) that must not leak the sender's state.
            "message": (await _to_message_out(db, message, recipient_id)).model_dump(mode="json"),
        },
    )
    if not delivered_live:
        # Offline recipient gets a push, not a `Notification` row — conversations already
        # have their own unread-count/inbox surface (see messaging.md), so an in-app entry
        # here would just be a duplicate. Reuses the same arq job the Notification-backed
        # events enqueue (app/workers/tasks/notifications.py::send_push_job).
        preview = data.body if data.kind is MessageKind.text else "Sent you a meme"
        arq_pool = await get_arq_pool()
        await arq_pool.enqueue_job(
            "send_push_job",
            [str(recipient_id)],
            current_user.username,
            (preview or "New message")[:200],
            {"conversation_id": str(conversation.id)},
        )
    return out


async def mark_conversation_read(
    db: AsyncSession, current_user: User, conversation_id: uuid.UUID
) -> ConversationReadOut:
    conversation = await _require_participant(db, current_user, conversation_id)
    read_at = datetime.datetime.now(datetime.timezone.utc)

    result = await db.execute(
        update(Message)
        .where(
            Message.conversation_id == conversation.id,
            Message.sender_id != current_user.id,
            Message.read_at.is_(None),
        )
        .values(read_at=read_at)
    )
    read_count = result.rowcount or 0
    if read_count:
        await db.commit()
        await connection_manager.send_json(
            conversation.other_participant(current_user.id).id,
            {
                "type": "message_read",
                "conversation_id": str(conversation.id),
                "reader_id": str(current_user.id),
                "read_at": read_at.isoformat(),
            },
        )

    return ConversationReadOut(
        conversation_id=conversation.id,
        read_count=read_count,
        read_at=read_at if read_count else None,
    )


async def send_meme_message(
    db: AsyncSession, current_user: User, recipient_id: uuid.UUID, meme_id: uuid.UUID
) -> tuple[MessageOut, User, bool]:
    """Backs the `/meme-sending/send` shim: resolve (or open) the thread with `recipient_id`
    and post a meme message into it. Also returns the recipient and whether they had an
    open socket, since that endpoint's legacy response shape reports delivery state."""
    conversation = await _get_or_create_conversation(db, current_user, recipient_id)
    recipient = conversation.other_participant(current_user.id)

    out = await send_message(
        db, current_user, conversation.id, MessageCreate(kind=MessageKind.meme, meme_id=meme_id)
    )
    # Read *after* the send: a push that fails mid-flight makes the manager drop the
    # socket, so this reflects real delivery rather than a stale pre-send registry hit.
    return out, recipient, await connection_manager.is_online(recipient_id)
