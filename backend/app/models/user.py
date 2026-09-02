import datetime

from sqlalchemy import Boolean, Date, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPKMixin


class User(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    username: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    bio: Mapped[str | None] = mapped_column(String(280), default=None)
    avatar_url: Mapped[str | None] = mapped_column(String(512), default=None)
    # Tracked so a replaced avatar's old Cloudinary asset can actually be cleaned up
    # (services/users.py::update_profile) — symmetric with Meme.image_public_id.
    avatar_public_id: Mapped[str | None] = mapped_column(String(255), default=None)
    # One of `services/users.py::ALLOWED_AVATAR_PRESETS`, set when the user picks a built-in
    # avatar instead of uploading a photo. Mutually exclusive with `avatar_url`/
    # `avatar_public_id` — picking a preset clears any uploaded photo and vice versa
    # (services/users.py::update_profile). Rendered client-side only (constants/
    # avatarPresets.ts); the server never resolves it to an image.
    avatar_preset: Mapped[str | None] = mapped_column(String(32), default=None)
    # Embedded in every issued JWT and checked in `get_current_user`; bumping this
    # invalidates every outstanding token for the user ("log out everywhere") without
    # needing a denylist or a shared JWT secret rotation.
    token_version: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    # Marks the single seeded system account used as `creator_id` for platform-run
    # challenges (services/challenges.py::_get_or_create_platform_user). Never settable
    # through any user-facing endpoint — resolving the platform account by this flag
    # instead of by its username closes the account-squatting gap where registering that
    # username before the seed ran would have made an attacker's account "the platform"
    # (SecurityIssues.md M-6).
    is_platform_account: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false"
    )
    # A disabled account is fully locked out (`get_current_user` rejects it like an
    # invalid token) — the prerequisite for suspending an account at all. No self-service
    # or admin endpoint sets this yet (there is no staff role); it's a manual/ops action
    # until F-5's moderation surface lands. See SecurityFeatures.md F-3.
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    # Null until the user completes email OTP verification (services/email_verification.py).
    # Gates AI captions, voting, starting a new DM, and community creation — not login
    # itself, so the first-run experience survives unverified (SecurityFeatures.md F-1).
    email_verified_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), default=None
    )
    # Required for every new registration (services/auth.py::register_user rejects
    # under-13 signups outright, storing nothing for them) — nullable only because
    # accounts created before this field existed have no value on file
    # (SecurityFeatures.md F-13).
    date_of_birth: Mapped[datetime.date | None] = mapped_column(Date, default=None)
    # Google's stable per-account subject id — set the first time a user signs in with
    # Google, whether that links an existing password account or creates a new one.
    # Never a password substitute for local accounts; only ever populated via a verified
    # Google ID token (SecurityFeatures.md F-7).
    google_sub: Mapped[str | None] = mapped_column(String(255), unique=True, default=None)
