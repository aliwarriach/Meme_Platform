from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPKMixin


class User(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    username: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    bio: Mapped[str | None] = mapped_column(String(280), default=None)
    avatar_url: Mapped[str | None] = mapped_column(String(512), default=None)
    # Embedded in every issued JWT and checked in `get_current_user`; bumping this
    # invalidates every outstanding token for the user ("log out everywhere") without
    # needing a denylist or a shared JWT secret rotation.
    token_version: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
