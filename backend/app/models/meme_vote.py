import uuid

from sqlalchemy import CheckConstraint, ForeignKey, SmallInteger, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPKMixin


class MemeVote(UUIDPKMixin, TimestampMixin, Base):
    """Reddit-style upvote/downvote on a native `Meme` — replaces the old like-only
    `Reaction` table entirely. `value` is `+1` (upvote) or `-1` (downvote); there is no
    "no vote" row — removing a vote deletes the row rather than storing 0.
    """

    __tablename__ = "meme_votes"

    meme_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("memes.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    value: Mapped[int] = mapped_column(SmallInteger)

    __table_args__ = (
        UniqueConstraint("meme_id", "user_id", name="uq_meme_votes_meme_user"),
        CheckConstraint("value IN (-1, 1)", name="ck_meme_votes_value"),
    )
