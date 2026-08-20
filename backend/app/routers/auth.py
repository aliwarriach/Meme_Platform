from typing import Annotated

from fastapi import APIRouter, Form, Request, UploadFile
from fastapi.responses import JSONResponse

from app.core.deps import CurrentUser, DbSession
from app.core.rate_limit import limiter
from app.schemas.auth import (
    ChangePasswordRequest,
    EmailOtpConfirm,
    GoogleAuthRequest,
    GoogleCompleteRegistrationRequest,
    LoginRequest,
    PasswordResetConfirm,
    PasswordResetRequest,
    RegisterRequest,
    TokenResponse,
    UserOut,
)
from app.schemas.badges import BadgeOut
from app.services import auth as auth_service
from app.services import badges as badges_service
from app.services import email_verification as email_verification_service
from app.services import google_auth as google_auth_service
from app.services import password_reset as password_reset_service
from app.services import users as users_service

router = APIRouter(prefix="/auth", tags=["auth"])


# Auth endpoints are keyed by IP (no user yet), guarding against credential-stuffing
# and mass account creation rather than any one account's behavior.
@router.post("/register", response_model=TokenResponse, status_code=201)
@limiter.limit("5/minute")
async def register(request: Request, data: RegisterRequest, db: DbSession) -> TokenResponse:
    return await auth_service.register_user(db, data)


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(request: Request, data: LoginRequest, db: DbSession) -> TokenResponse:
    return await auth_service.authenticate_user(db, data)


@router.post("/logout", status_code=204)
async def logout(current_user: CurrentUser, db: DbSession) -> None:
    # Invalidates every token currently issued to this user (this one included) —
    # there's no per-device session tracking, so "logout" is always "logout everywhere".
    await auth_service.logout_everywhere(db, current_user)


@router.get("/me", response_model=UserOut)
async def me(current_user: CurrentUser) -> UserOut:
    return UserOut.model_validate(current_user)


@router.patch("/me", response_model=UserOut)
async def update_me(
    current_user: CurrentUser,
    db: DbSession,
    bio: Annotated[str | None, Form(max_length=280)] = None,
    clear_bio: Annotated[bool, Form()] = False,
    avatar: UploadFile | None = None,
) -> UserOut:
    """`bio` omitted = leave it alone; `clear_bio=true` clears it. A separate flag
    rather than an empty-string sentinel: Starlette's form parsing collapses an empty
    submitted string to `None`, indistinguishable from an omitted field, so `bio=""`
    alone can't signal "clear" (confirmed empirically). `avatar`, if given, always
    replaces the current one and cleans up the old Cloudinary asset (SecurityFeatures.md F-4)."""
    user = await users_service.update_profile(
        db, current_user, bio, clear_bio=clear_bio, avatar=avatar
    )
    return UserOut.model_validate(user)


@router.get("/me/badges", response_model=list[BadgeOut])
async def my_badges(current_user: CurrentUser, db: DbSession) -> list[BadgeOut]:
    return await badges_service.list_user_badges(db, current_user.id)


@router.post("/email/verify/request", status_code=204)
@limiter.limit("3/hour")
async def request_email_verification(request: Request, current_user: CurrentUser) -> None:
    await email_verification_service.request_email_otp(current_user)


@router.post("/email/verify/confirm", status_code=204)
@limiter.limit("10/hour")
async def confirm_email_verification(
    request: Request, data: EmailOtpConfirm, current_user: CurrentUser, db: DbSession
) -> None:
    await email_verification_service.confirm_email_otp(db, current_user, data.code)


# No auth — this is exactly the path a locked-out user has no other way to reach.
@router.post("/password-reset/request", status_code=204)
@limiter.limit("3/hour")
async def request_password_reset(
    request: Request, data: PasswordResetRequest, db: DbSession
) -> None:
    await password_reset_service.request_password_reset(db, data.email)


@router.post("/password-reset/confirm", status_code=204)
@limiter.limit("10/hour")
async def confirm_password_reset(
    request: Request, data: PasswordResetConfirm, db: DbSession
) -> None:
    await password_reset_service.confirm_password_reset(
        db, data.email, data.code, data.new_password
    )


@router.post("/change-password", status_code=204)
@limiter.limit("10/hour")
async def change_password(
    request: Request, data: ChangePasswordRequest, current_user: CurrentUser, db: DbSession
) -> None:
    await password_reset_service.change_password(
        db, current_user, data.current_password, data.new_password
    )


# response_model intentionally omitted: this returns either a 200 TokenResponse (an
# existing account, logged in) or a 202 GooglePendingRegistrationOut (no account yet —
# call /auth/google/complete next), and FastAPI's response_model doesn't cleanly express
# "one of two shapes, discriminated by status code."
@router.post("/google")
@limiter.limit("10/minute")
async def google_auth(request: Request, data: GoogleAuthRequest, db: DbSession) -> JSONResponse:
    result = await google_auth_service.authenticate_or_start_registration(db, data.id_token)
    if isinstance(result, TokenResponse):
        return JSONResponse(status_code=200, content=result.model_dump(mode="json"))
    return JSONResponse(status_code=202, content=result.model_dump(mode="json"))


@router.post("/google/complete", response_model=TokenResponse, status_code=201)
async def complete_google_registration(
    data: GoogleCompleteRegistrationRequest, db: DbSession
) -> TokenResponse:
    return await google_auth_service.complete_google_registration(
        db, data.pending_token, data.username, data.date_of_birth
    )
