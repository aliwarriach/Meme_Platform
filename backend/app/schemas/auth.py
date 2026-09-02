import datetime
import uuid

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=32, pattern=r"^[a-zA-Z0-9_]+$")
    password: str = Field(min_length=8, max_length=128)
    # Required for every new registration — services/auth.py::register_user rejects an
    # under-13 signup before creating any row (SecurityFeatures.md F-13).
    date_of_birth: datetime.date


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")
    new_password: str = Field(min_length=8, max_length=128)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


class PublicUserOut(BaseModel):
    """Every other user's public profile fields — no email. Used for authors, senders,
    members, leaderboard entries and every other embedded-user position. Never add email
    here: it is nested into ~16 response shapes across the API, including the public feed."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    username: str
    bio: str | None
    avatar_url: str | None
    avatar_preset: str | None


class UserOut(PublicUserOut):
    """The signed-in user's own view of their account. Carries email — use this only for
    `GET /auth/me` and `TokenResponse`, never for representing another user."""

    email: EmailStr
    email_verified_at: datetime.datetime | None
    date_of_birth: datetime.date | None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class EmailOtpConfirm(BaseModel):
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class GoogleAuthRequest(BaseModel):
    id_token: str


class GooglePendingRegistrationOut(BaseModel):
    """Returned (202) when a Google sign-in has no matching account yet — the client
    still needs to collect a username and date of birth (Google doesn't reliably supply
    the latter) before an account can be created. See `POST /auth/google/complete`."""

    pending_token: str
    email: EmailStr


class GoogleCompleteRegistrationRequest(BaseModel):
    pending_token: str
    username: str = Field(min_length=3, max_length=32, pattern=r"^[a-zA-Z0-9_]+$")
    date_of_birth: datetime.date
