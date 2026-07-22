import enum
import uuid

from sqlalchemy import ForeignKey
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPKMixin
from app.models.meme import Meme
from app.models.user import User


class MemeSendStatus(str, enum.Enum):
    delivered = "delivered"
    pending = "pending"
    seen = "seen"


class MemeSend(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "meme_sends"

    sender_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    recipient_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    meme_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("memes.id", ondelete="CASCADE"))
    status: Mapped[MemeSendStatus] = mapped_column(
        SAEnum(MemeSendStatus, name="meme_send_status"), default=MemeSendStatus.pending
    )
    reaction: Mapped[str | None] = mapped_column(default=None)

    sender: Mapped[User] = relationship(foreign_keys=[sender_id], lazy="selectin")
    recipient: Mapped[User] = relationship(foreign_keys=[recipient_id], lazy="selectin")
    meme: Mapped[Meme] = relationship(lazy="selectin")
