"""Sign in with Google (SecurityFeatures.md F-7) — both login and full sign-up. Verifies
the ID token against Google's own tokeninfo endpoint via raw `httpx` (same "no heavy SDK"
precedent as `integrations/gmail_client.py`/`integrations/llm_client.py`; Google's ID
tokens are JWTs, but relying on their own verification endpoint rather than fetching and
caching their signing-key JWKS ourselves keeps this to one small module).

Flow:
1. `POST /auth/google` with a client-obtained Google ID token.
2. If `google_sub` already matches a user -> log them in.
3. Else if the verified email matches an existing password account -> link it (set
   `google_sub`, and mark the email verified since Google already proved it) and log in.
4. Else -> no account exists. Stage a short-lived pending-registration ticket in Redis
   and return it; the client collects a username + date of birth and calls
   `POST /auth/google/complete` to actually create the account, going through the exact
   same age-gate (F-13) and reserved-username (M-6) checks as normal registration.
"""

import datetime
import secrets

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import (
    InvalidGoogleTokenError,
    InvalidPendingRegistrationError,
    UnderMinimumAgeError,
    UsernameAlreadyExistsError,
)
from app.core.logging import log_security_event
from app.core.redis import get_arq_pool
from app.core.security import create_access_token, hash_password
from app.models.user import User
from app.schemas.auth import GooglePendingRegistrationOut, TokenResponse, UserOut
from app.services import users as users_service
from app.services.auth import MINIMUM_AGE_YEARS, RESERVED_USERNAMES, age_in_years

GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"
REQUEST_TIMEOUT_SECONDS = 8.0

PENDING_REG_KEY_PREFIX = "google-pending-reg:"
PENDING_REG_TTL_SECONDS = 600


class _GoogleIdentity:
    __slots__ = ("sub", "email")

    def __init__(self, sub: str, email: str) -> None:
        self.sub = sub
        self.email = email


async def _fetch_google_tokeninfo(id_token: str) -> dict | None:
    """Isolated so tests can stub the network call while still exercising the real
    aud/email_verified validation logic in `_verify_google_id_token` below."""
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS) as client:
        response = await client.get(GOOGLE_TOKENINFO_URL, params={"id_token": id_token})
    if response.status_code != 200:
        return None
    return response.json()


async def _verify_google_id_token(id_token: str) -> _GoogleIdentity:
    allowed_audiences = settings.google_signin_audiences
    if not allowed_audiences:
        raise InvalidGoogleTokenError("Google sign-in is not configured")

    payload = await _fetch_google_tokeninfo(id_token)
    if payload is None:
        raise InvalidGoogleTokenError("Invalid or expired Google token")

    # `aud` pins this to *our* app's OAuth client(s) — without it, an ID token Google
    # issued for a completely unrelated app would be accepted here too.
    if payload.get("aud") not in allowed_audiences:
        raise InvalidGoogleTokenError("Invalid or expired Google token")
    if str(payload.get("email_verified")).lower() != "true":
        raise InvalidGoogleTokenError("Google account email is not verified")

    email = payload.get("email")
    sub = payload.get("sub")
    if not email or not sub:
        raise InvalidGoogleTokenError("Invalid or expired Google token")
    return _GoogleIdentity(sub=sub, email=email)


async def authenticate_or_start_registration(
    db: AsyncSession, id_token: str
) -> TokenResponse | GooglePendingRegistrationOut:
    identity = await _verify_google_id_token(id_token)

    user = await db.scalar(select(User).where(User.google_sub == identity.sub))
    if user is None:
        existing = await users_service.get_user_by_email(db, identity.email)
        if existing is not None:
            # An existing password account, linking Google for the first time. Google
            # already proved ownership of this email, so this also satisfies F-1.
            existing.google_sub = identity.sub
            if existing.email_verified_at is None:
                existing.email_verified_at = datetime.datetime.now(datetime.timezone.utc)
            await db.commit()
            user = existing

    if user is not None:
        if not user.is_active:
            raise InvalidGoogleTokenError("This account is disabled")
        log_security_event("auth.google_login_success", user_id=str(user.id))
        return _issue_token(user)

    pending_token = secrets.token_urlsafe(32)
    redis = await get_arq_pool()
    await redis.set(
        f"{PENDING_REG_KEY_PREFIX}{pending_token}",
        f"{identity.sub}:{identity.email}",
        ex=PENDING_REG_TTL_SECONDS,
    )
    return GooglePendingRegistrationOut(pending_token=pending_token, email=identity.email)


async def complete_google_registration(
    db: AsyncSession, pending_token: str, username: str, date_of_birth: datetime.date
) -> TokenResponse:
    redis = await get_arq_pool()
    key = f"{PENDING_REG_KEY_PREFIX}{pending_token}"
    raw = await redis.getdel(key)
    if raw is None:
        raise InvalidPendingRegistrationError(
            "Registration session expired — sign in with Google again"
        )

    raw_str = raw.decode() if isinstance(raw, bytes) else raw
    google_sub, email = raw_str.split(":", 1)

    today = datetime.datetime.now(datetime.timezone.utc).date()
    if age_in_years(date_of_birth, today) < MINIMUM_AGE_YEARS:
        raise UnderMinimumAgeError(
            f"You must be {MINIMUM_AGE_YEARS} or older to create an account."
        )
    if username.lower() in RESERVED_USERNAMES:
        raise UsernameAlreadyExistsError("This username is already taken")
    if await users_service.get_user_by_username(db, username) is not None:
        raise UsernameAlreadyExistsError("This username is already taken")
    if await users_service.get_user_by_email(db, email) is not None:
        # An account with this email was created/linked between the two calls.
        raise UsernameAlreadyExistsError(
            "An account with this email already exists — try signing in with Google again"
        )

    user = User(
        email=email,
        username=username,
        # Never used to log in — this account only ever authenticates via Google. Random
        # and discarded, same precedent as the seeded platform account
        # (services/challenges.py::_get_or_create_platform_user).
        hashed_password=hash_password(secrets.token_urlsafe(32)),
        date_of_birth=date_of_birth,
        google_sub=google_sub,
        # Google already verified this email — no separate OTP round-trip needed.
        email_verified_at=datetime.datetime.now(datetime.timezone.utc),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    log_security_event(
        "auth.google_register_success", user_id=str(user.id), username=user.username
    )
    return _issue_token(user)


def _issue_token(user: User) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(user.id, user.token_version),
        user=UserOut.model_validate(user),
    )
