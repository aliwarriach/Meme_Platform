import datetime

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    EmailAlreadyExistsError,
    InvalidCredentialsError,
    UnderMinimumAgeError,
    UsernameAlreadyExistsError,
)
from app.core.logging import log_security_event
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserOut
from app.services import users as users_service

# COPPA / UK AADC — the proportionate control for a platform with no evidence of
# deliberately targeting children is an age gate at signup, not a full parental-consent
# apparatus (SecurityFeatures.md F-13).
MINIMUM_AGE_YEARS = 13


def age_in_years(date_of_birth: datetime.date, today: datetime.date) -> int:
    had_birthday_this_year = (today.month, today.day) >= (date_of_birth.month, date_of_birth.day)
    return today.year - date_of_birth.year - (0 if had_birthday_this_year else 1)

# Blocks impersonation of the platform's own voice/system surfaces via a user-registerable
# username (SecurityIssues.md M-6). "memeversehq" must be kept in sync with
# `PLATFORM_USERNAME` in services/challenges.py — not imported directly to avoid a core
# auth module depending on a specific feature module. Matched case-insensitively;
# `RegisterRequest.username` is already restricted to `^[a-zA-Z0-9_]+$`, so no unicode
# confusable/normalization concern here.
RESERVED_USERNAMES = frozenset(
    {
        "memeversehq",
        "admin",
        "administrator",
        "moderator",
        "mod",
        "support",
        "help",
        "official",
        "system",
        "root",
        "staff",
        "memeverse",
        "security",
        "api",
        "null",
        "undefined",
    }
)


async def register_user(db: AsyncSession, data: RegisterRequest) -> TokenResponse:
    today = datetime.datetime.now(datetime.timezone.utc).date()
    if age_in_years(data.date_of_birth, today) < MINIMUM_AGE_YEARS:
        # No row is created — nothing about this attempt is persisted anywhere.
        raise UnderMinimumAgeError(
            f"You must be {MINIMUM_AGE_YEARS} or older to create an account."
        )
    if data.username.lower() in RESERVED_USERNAMES:
        raise UsernameAlreadyExistsError("This username is already taken")
    if await users_service.get_user_by_email(db, data.email) is not None:
        # Deliberately generic — doesn't confirm whether the email is registered, so
        # POST /auth/register can't be used to enumerate accounts by email
        # (SecurityIssues.md L-1). Username-taken stays specific: usernames are public
        # throughout the app, so there's nothing sensitive to protect there.
        raise EmailAlreadyExistsError(
            "Couldn't complete registration. If you already have an account with this "
            "email, try logging in instead."
        )
    if await users_service.get_user_by_username(db, data.username) is not None:
        raise UsernameAlreadyExistsError("This username is already taken")

    user = User(
        email=data.email,
        username=data.username,
        hashed_password=hash_password(data.password),
        date_of_birth=data.date_of_birth,
    )
    db.add(user)
    try:
        await db.commit()
    except IntegrityError:
        # Two concurrent registrations both passed the checks above before either committed.
        await db.rollback()
        if await users_service.get_user_by_email(db, data.email) is not None:
            # Deliberately generic — see the matching comment above.
            raise EmailAlreadyExistsError(
                "Couldn't complete registration. If you already have an account with this "
                "email, try logging in instead."
            ) from None
        raise UsernameAlreadyExistsError("This username is already taken") from None
    await db.refresh(user)

    log_security_event("auth.register_success", user_id=str(user.id), username=user.username)
    return _issue_token(user)


async def authenticate_user(db: AsyncSession, data: LoginRequest) -> TokenResponse:
    user = await users_service.get_user_by_email(db, data.email)
    if user is None or not verify_password(data.password, user.hashed_password):
        raise InvalidCredentialsError("Incorrect email or password")
    if not user.is_active:
        # Same generic message as a wrong password — "your account is disabled" is not
        # something a locked-out caller needs confirmed (SecurityFeatures.md F-3).
        raise InvalidCredentialsError("Incorrect email or password")

    log_security_event("auth.login_success", user_id=str(user.id), username=user.username)
    return _issue_token(user)


async def logout_everywhere(db: AsyncSession, current_user: User) -> None:
    """Bumps `token_version`, invalidating every JWT issued before this call — the only
    revocation granularity a stateless JWT (no denylist/refresh-token store) supports."""
    current_user.token_version += 1
    await db.commit()
    log_security_event("auth.logout", user_id=str(current_user.id))


def _issue_token(user: User) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(user.id, user.token_version),
        user=UserOut.model_validate(user),
    )
