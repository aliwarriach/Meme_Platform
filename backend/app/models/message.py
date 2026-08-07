import datetime
import enum
import uuid

from sqlalchemy import DateTime, ForeignKey, Index, String
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPKMixin
from app.models.user import User


class MessageKind(str, enum.Enum):
    text = "text"
    meme = "meme"


class Message(UUIDPKMixin, TimestampMixin, Base):
    """One entry in a conversation — either text or a forwarded meme.

    Deliberately a single table with a `kind` discriminator rather than a `messages` table
    beside the old `meme_sends`: a thread view over two tables means a UNION, and keyset
    pagination over a UNION is both painful and slow. One table, one ordering, one cursor.
    """

    __tablename__ = "messages"
    __table_args__ = (
        # Backs the thread's keyset page: filter by conversation, order by (created_at, id) desc.
        Index("ix_messages_conversation_created", "conversation_id", "created_at", "id"),
    )

    conversation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"), index=True
    )
    sender_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    kind: Mapped[MessageKind] = mapped_column(
        SAEnum(MessageKind, name="message_kind"), default=MessageKind.text
    )
    body: Mapped[str | None] = mapped_column(String(2000), default=None)
    # SET NULL, not CASCADE: deleting a meme must not punch holes in conversation history.
    # A meme-kind message whose meme is gone renders as an unavailable-attachment
    # placeholder (`MessageOut.meme` is nullable for exactly this case).
    meme_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("memes.id", ondelete="SET NULL"), default=None
    )
    # Read receipts only — set when the *recipient* opens the thread. Null on every message
    # the viewer sent themselves, and the basis of the conversation list's unread count.
    read_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), default=None
    )

    sender: Mapped[User] = relationship(foreign_keys=[sender_id], lazy="selectin")
