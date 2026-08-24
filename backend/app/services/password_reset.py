"""Password reset (SecurityFeatures.md F-2), same OTP mechanics as
`services/email_verification.py` (6-digit code, SHA-256 hashed at rest in Redis,
single-use, capped attempts) — duplicated rather than shared, since it's two call sites
and the two flows have genuinely different rules around it (reset must never confirm
whether an email is registered; verification always knows exactly who it's for).
"""

import hashlib
import secrets

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    InvalidCredentialsError,
    InvalidVerificationCodeError,
    NoVerificationCodeRequestedError,
    TooManyVerificationAttemptsError,
)
from app.core.redis import get_arq_pool
from app.core.security import hash_password, verify_password
from app.models.user import User
from app.services import users as users_service

OTP_KEY_PREFIX = "password-reset-otp:"
OTP_ATTEMPTS_KEY_PREFIX = "password-reset-otp-attempts:"
OTP_TTL_SECONDS = 600
OTP_LENGTH = 6
MAX_OTP_ATTEMPTS = 5


def _hash_otp(otp: str) -> str:
    return hashlib.sha256(otp.encode("utf-8")).hexdigest()


def _as_str(value: str | bytes | None) -> str | None:
    if value is None:
        return None
    return value.decode() if isinstance(value, bytes) else value


async def request_password_reset(db: AsyncSession, email: str) -> None:
    """Always succeeds from the caller's point of view, regardless of whether the email
    is registered, active, or the platform's own seeded account — the same
    account-existence-oracle rule SecurityIssues.md L-1 established for registration
    applies here too, and matters more here since this endpoint needs no auth at all."""
    user = await users_service.get_user_by_email(db, email)
    if user is None or not user.is_active or user.is_platform_account:
        return

    otp = f"{secrets.randbelow(10 ** OTP_LENGTH):0{OTP_LENGTH}d}"
    redis = await get_arq_pool()
    await redis.set(f"{OTP_KEY_PREFIX}{user.id}", _hash_otp(otp), ex=OTP_TTL_SECONDS)
    await redis.set(f"{OTP_ATTEMPTS_KEY_PREFIX}{user.id}", "0", ex=OTP_TTL_SECONDS)
    await redis.enqueue_job("send_password_reset_otp_job", str(user.id), user.email, otp)


async def confirm_password_reset(
    db: AsyncSession, email: str, code: str, new_password: str
) -> None:
    user = await users_service.get_user_by_email(db, email)
    if user is None:
        # Same failure as a wrong code — a nonexistent email must not be distinguishable
        # from a real one that just got the code wrong.
        raise InvalidVerificationCodeError("Incorrect code")

    redis = await get_arq_pool()
    otp_key = f"{OTP_KEY_PREFIX}{user.id}"
    attempts_key = f"{OTP_ATTEMPTS_KEY_PREFIX}{user.id}"

    stored_hash = _as_str(await redis.get(otp_key))
    if stored_hash is None:
        raise NoVerificationCodeRequestedError(
            "No reset code on file — request a new one"
        )

    attempts = int(_as_str(await redis.get(attempts_key)) or "0")
    if attempts >= MAX_OTP_ATTEMPTS:
        await redis.delete(otp_key)
        await redis.delete(attempts_key)
        raise TooManyVerificationAttemptsError(
            "Too many incorrect attempts — request a new code"
        )

    if _hash_otp(code) != stored_hash:
        await redis.set(attempts_key, str(attempts + 1), ex=OTP_TTL_SECONDS)
        raise InvalidVerificationCodeError("Incorrect code")

    await redis.delete(otp_key)
    await redis.delete(attempts_key)

    user.hashed_password = hash_password(new_password)
    # Every existing session dies — including a stuffed-credential attacker's, if that's
    # what prompted the reset (SecurityIssues.md M-3's scenario).
    user.token_version += 1
    await db.commit()


async def change_password(
    db: AsyncSession, current_user: User, current_password: str, new_password: str
) -> None:
    """Authenticated variant for a user who still has their current password and just
    wants to rotate it — no email round-trip needed."""
    if not verify_password(current_password, current_user.hashed_password):
        raise InvalidCredentialsError("Incorrect current password")

    current_user.hashed_password = hash_password(new_password)
    current_user.token_version += 1
    await db.commit()
