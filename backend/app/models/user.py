from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPKMixin


class User(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    username: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    bio: Mapped[str | None] = mapped_column(String(280), default=None)
    avatar_url: Mapped[str | None] = mapped_column(String(512), default=None)
