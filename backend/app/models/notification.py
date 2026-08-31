import enum
import uuid
import datetime

from sqlalchemy import DateTime, ForeignKey, Index, JSON, String
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPKMixin


class NotificationType(str, enum.Enum):
    challenge_invite = "challenge_invite"
    challenge_invite_accepted = "challenge_invite_accepted"
    challenge_invite_declined = "challenge_invite_declined"
    challenge_starting = "challenge_starting"
    challenge_ending_soon = "challenge_ending_soon"
    challenge_side_overtaken = "challenge_side_overtaken"
    challenge_results = "challenge_results"
    # 2026-08-31: second wave, extending the same infra to friends/communities/engagement/
    # competitions — see .claude/memory/notifications.md.
    friend_request_received = "friend_request_received"
    friend_request_accepted = "friend_request_accepted"
    community_join_request = "community_join_request"
    community_join_approved = "community_join_approved"
    community_join_rejected = "community_join_rejected"
    community_post_removed = "community_post_removed"
    meme_comment_received = "meme_comment_received"
    meme_upvotes_received = "meme_upvotes_received"
    competition_won = "competition_won"


class Notification(UUIDPKMixin, TimestampMixin, Base):
    """The in-app notification centre. New chat messages deliberately do NOT create a row
    here — a conversation already has its own unread-count/inbox surface (see
    `.claude/memory/messaging.md`), so a duplicate entry here would just be redundant. This
    table is for events with no other surface: challenge invites/lifecycle/results.
    """

    __tablename__ = "notifications"
    __table_args__ = (
        # Backs the list's keyset page: filter by user, order by (created_at, id) desc.
        Index("ix_notifications_user_created", "user_id", "created_at", "id"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    type: Mapped[NotificationType] = mapped_column(SAEnum(NotificationType, name="notification_type"))
    title: Mapped[str] = mapped_column(String(150))
    body: Mapped[str] = mapped_column(String(280))
    # Deep-link payload, e.g. {"challenge_id": "..."} — shape varies by `type`, the client
    # reads only the keys it expects for that type.
    data: Mapped[dict] = mapped_column(JSON, default=dict)
    read_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(timezone=True), default=None)


class PushToken(UUIDPKMixin, TimestampMixin, Base):
    """One Expo push token per registered device. `token` is globally unique rather than
    unique-per-user: a reinstall/re-login on the same device must move the token to the new
    account, not leave two rows racing to receive the same device's pushes.
    """

    __tablename__ = "push_tokens"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    token: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    platform: Mapped[str] = mapped_column(String(16))
