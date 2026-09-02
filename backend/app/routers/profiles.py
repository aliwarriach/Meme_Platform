import uuid
from typing import Annotated

from fastapi import APIRouter, Query

from app.core.deps import CurrentUser, ReadDbSession
from app.schemas.auth import PublicUserOut
from app.schemas.memes import FeedPage
from app.schemas.profiles import UserProfileOut
from app.services import profiles as profiles_service
from app.services import users as users_service

router = APIRouter(prefix="/users", tags=["profiles"])


@router.get("/search", response_model=list[PublicUserOut])
async def search_users(
    current_user: CurrentUser,
    db: ReadDbSession,
    q: Annotated[str, Query(min_length=1, max_length=32)],
    limit: Annotated[int, Query(ge=1, le=30)] = 20,
) -> list[PublicUserOut]:
    users = await users_service.search_users(db, current_user, q, limit)
    return [PublicUserOut.model_validate(u) for u in users]


@router.get("/{user_id}/profile", response_model=UserProfileOut)
async def get_user_profile(
    user_id: uuid.UUID, current_user: CurrentUser, db: ReadDbSession
) -> UserProfileOut:
    return await profiles_service.get_user_profile(db, current_user, user_id)


@router.get("/{user_id}/posts", response_model=FeedPage)
async def get_user_posts(
    user_id: uuid.UUID,
    current_user: CurrentUser,
    db: ReadDbSession,
    cursor: str | None = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 24,
) -> FeedPage:
    """Friends-only (403 via `NotFriendsError` otherwise) — see `services/profiles.py`."""
    return await profiles_service.get_user_posts(db, current_user, user_id, cursor, limit)
