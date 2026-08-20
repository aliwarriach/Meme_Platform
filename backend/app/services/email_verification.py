"""Email OTP verification (SecurityFeatures.md F-1). A 6-digit code, hashed at rest in
Redis (not the raw code — defense-in-depth against a Redis compromise, even though a
short-lived OTP is lower-stakes than a password), single-use, 10-minute TTL, capped
attempts. Sending the actual email is a background arq job
(`workers/tasks/email_verification.py`), per backend/CLAUDE.md — never inline in the
request/response cycle.
"""

import datetime
import hashlib
import secrets

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    EmailAlreadyVerifiedError,
    InvalidVerificationCodeError,
    NoVerificationCodeRequestedError,
    TooManyVerificationAttemptsError,
)
from app.core.redis import get_arq_pool
from app.models.user import User

OTP_KEY_PREFIX = "email-otp:"
OTP_ATTEMPTS_KEY_PREFIX = "email-otp-attempts:"
OTP_TTL_SECONDS = 600
OTP_LENGTH = 6
MAX_OTP_ATTEMPTS = 5


def _hash_otp(otp: str) -> str:
    return hashlib.sha256(otp.encode("utf-8")).hexdigest()


def _as_str(value: str | bytes | None) -> str | None:
    if value is None:
        return None
    return value.decode() if isinstance(value, bytes) else value


async def request_email_otp(current_user: User) -> None:
    if current_user.email_verified_at is not None:
        raise EmailAlreadyVerifiedError("Your email is already verified")

    otp = f"{secrets.randbelow(10 ** OTP_LENGTH):0{OTP_LENGTH}d}"
    redis = await get_arq_pool()
    await redis.set(f"{OTP_KEY_PREFIX}{current_user.id}", _hash_otp(otp), ex=OTP_TTL_SECONDS)
    await redis.set(f"{OTP_ATTEMPTS_KEY_PREFIX}{current_user.id}", "0", ex=OTP_TTL_SECONDS)

    await redis.enqueue_job(
        "send_email_otp_job", str(current_user.id), current_user.email, otp
    )


async def confirm_email_otp(db: AsyncSession, current_user: User, code: str) -> None:
    if current_user.email_verified_at is not None:
        raise EmailAlreadyVerifiedError("Your email is already verified")

    redis = await get_arq_pool()
    otp_key = f"{OTP_KEY_PREFIX}{current_user.id}"
    attempts_key = f"{OTP_ATTEMPTS_KEY_PREFIX}{current_user.id}"

    stored_hash = _as_str(await redis.get(otp_key))
    if stored_hash is None:
        raise NoVerificationCodeRequestedError(
            "No verification code on file — request a new one"
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
    current_user.email_verified_at = datetime.datetime.now(datetime.timezone.utc)
    await db.commit()
