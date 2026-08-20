import datetime
import uuid

from sqlalchemy import DateTime
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class UUIDPKMixin:
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)


class TimestampMixin:
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.datetime.now(datetime.timezone.utc)
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.datetime.now(datetime.timezone.utc),
        onupdate=lambda: datetime.datetime.now(datetime.timezone.utc),
    )


class SoftDeleteMixin:
    """`deleted_at` null = live. A soft-deleted row stays in place (so a DM/challenge
    reference to it degrades to null gracefully instead of a broken foreign key) but is
    excluded from every read query — see SecurityFeatures.md F-4. Query filters live at
    each model's own visibility clause (`meme_visibility_clause`, comment list queries,
    etc.), not here — this mixin only adds the column."""

    deleted_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), default=None
    )
