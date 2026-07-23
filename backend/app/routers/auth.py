from fastapi import APIRouter, Request

from app.core.deps import CurrentUser, DbSession
from app.core.rate_limit import limiter
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserOut
from app.schemas.badges import BadgeOut
from app.services import auth as auth_service
from app.services import badges as badges_service

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


@router.get("/me", response_model=UserOut)
async def me(current_user: CurrentUser) -> UserOut:
    return UserOut.model_validate(current_user)


@router.get("/me/badges", response_model=list[BadgeOut])
async def my_badges(current_user: CurrentUser, db: DbSession) -> list[BadgeOut]:
    return await badges_service.list_user_badges(db, current_user.id)
