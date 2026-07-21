from fastapi import APIRouter

from app.core.deps import CurrentUser, DbSession
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserOut
from app.services import auth as auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(data: RegisterRequest, db: DbSession) -> TokenResponse:
    return await auth_service.register_user(db, data)


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, db: DbSession) -> TokenResponse:
    return await auth_service.authenticate_user(db, data)


@router.get("/me", response_model=UserOut)
async def me(current_user: CurrentUser) -> UserOut:
    return UserOut.model_validate(current_user)
