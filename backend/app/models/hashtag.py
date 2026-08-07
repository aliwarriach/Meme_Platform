import uuid

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPKMixin


class Hashtag(UUIDPKMixin, TimestampMixin, Base):
    """A first-class tag, not free text parsed out of a caption.

    Open challenges are entered by posting with the challenge's tag, so the tag has to be
    an entity a challenge can *reserve* — otherwise two challenges could claim the same
    tag, and a typo ("#dogsvcats") would silently drop a meme out of the competition with
    no feedback to the poster. The creator resolves what the user types against this table
    and makes the side choice an explicit, confirmable action; an unresolved tag stays a
    plain discovery tag and never counts as a challenge entry.
    """

    __tablename__ = "hashtags"

    # Normalized lookup key — lowercased, leading '#' stripped, non-alphanumerics removed.
    # "#DogsVsCats", "dogsvscats" and "#Dogs-Vs-Cats" must all resolve to one tag.
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    # What was originally typed, preserved for display casing.
    display_text: Mapped[str] = mapped_column(String(100))


class MemeHashtag(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "meme_hashtags"

    meme_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("memes.id", ondelete="CASCADE"), index=True
    )
    hashtag_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("hashtags.id", ondelete="CASCADE"), index=True
    )

    __table_args__ = (UniqueConstraint("meme_id", "hashtag_id", name="uq_meme_hashtag"),)
