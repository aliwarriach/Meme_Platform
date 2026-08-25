import uuid
from typing import Annotated

from fastapi import APIRouter, Query

from app.core.deps import CurrentUser, ReadDbSession
from app.schemas.memes import FeedPage
from app.schemas.profiles import UserProfileOut
from app.services import profiles as profiles_service

router = APIRouter(prefix="/users", tags=["profiles"])


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
