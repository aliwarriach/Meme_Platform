from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    EmailAlreadyExistsError,
    InvalidCredentialsError,
    UsernameAlreadyExistsError,
)
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserOut
from app.services import users as users_service


async def register_user(db: AsyncSession, data: RegisterRequest) -> TokenResponse:
    if await users_service.get_user_by_email(db, data.email) is not None:
        raise EmailAlreadyExistsError("An account with this email already exists")
    if await users_service.get_user_by_username(db, data.username) is not None:
        raise UsernameAlreadyExistsError("This username is already taken")

    user = User(
        email=data.email,
        username=data.username,
        hashed_password=hash_password(data.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return _issue_token(user)


async def authenticate_user(db: AsyncSession, data: LoginRequest) -> TokenResponse:
    user = await users_service.get_user_by_email(db, data.email)
    if user is None or not verify_password(data.password, user.hashed_password):
        raise InvalidCredentialsError("Incorrect email or password")

    return _issue_token(user)


def _issue_token(user: User) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(user.id),
        user=UserOut.model_validate(user),
    )
