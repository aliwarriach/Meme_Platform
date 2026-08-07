from fastapi import APIRouter, Query

from app.core.deps import CurrentUser, DbSession
from app.schemas.hashtags import HashtagOut, HashtagSuggestion
from app.schemas.memes import FeedPage
from app.services import hashtags as hashtags_service

router = APIRouter(prefix="/hashtags", tags=["hashtags"])


@router.get("/search", response_model=list[HashtagSuggestion])
async def search_hashtags(
    current_user: CurrentUser,
    db: DbSession,
    q: str = Query(min_length=1, max_length=100),
    limit: int = Query(10, ge=1, le=25),
) -> list[HashtagSuggestion]:
    """Creator autocomplete. Tags owned by a challenge sort first."""
    return await hashtags_service.search_hashtags(db, q, limit)


@router.get("/{slug}", response_model=HashtagOut)
async def get_hashtag(slug: str, current_user: CurrentUser, db: DbSession) -> HashtagOut:
    return await hashtags_service.get_hashtag(db, slug)


@router.get("/{slug}/memes", response_model=FeedPage)
async def get_hashtag_feed(
    slug: str,
    current_user: CurrentUser,
    db: DbSession,
    cursor: str | None = None,
    limit: int = Query(20, ge=1, le=50),
) -> FeedPage:
    return await hashtags_service.get_hashtag_feed(db, current_user, slug, cursor, limit)
