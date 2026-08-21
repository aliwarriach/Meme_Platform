from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import EmailNotVerifiedError
from app.core.security import InvalidTokenError, decode_access_token
from app.db.session import get_db_session, get_read_db_session
from app.models.user import User
from app.services import users as users_service

DbSession = Annotated[AsyncSession, Depends(get_db_session)]
# Only for routes that are read-only and safe against replica lag (leaderboards, feed) —
# see app/db/session.py::get_read_db_session (Roadmap_Scaling.md A2).
ReadDbSession = Annotated[AsyncSession, Depends(get_read_db_session)]

_bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    db: DbSession,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer_scheme)],
) -> User:
    if credentials is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")

    try:
        decoded = decode_access_token(credentials.credentials)
    except InvalidTokenError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token") from exc

    user = await users_service.get_user_by_id(db, decoded.user_id)
    if user is None or user.token_version != decoded.token_version:
        # A version mismatch means the token predates a logout-everywhere action.
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    if not user.is_active:
        # Same response as an invalid token — a disabled account shouldn't be able to
        # distinguish "my account was disabled" from "my token expired" (SecurityFeatures.md F-3).
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


async def get_current_verified_user(current_user: CurrentUser) -> User:
    """Gates the abuse-relevant capabilities named in SecurityFeatures.md F-1 (AI
    captions, voting, community creation) on email verification, without gating login
    itself. Messaging's own gate lives in `services/messaging.py::_get_or_create_conversation`
    instead, since both `/messaging/conversations` and the legacy `/meme-sending/send`
    shim funnel through that one function."""
    if current_user.email_verified_at is None:
        raise EmailNotVerifiedError("Verify your email to use this feature")
    return current_user


CurrentVerifiedUser = Annotated[User, Depends(get_current_verified_user)]
