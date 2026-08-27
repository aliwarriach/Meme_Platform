from fastapi import APIRouter, Query, Request

from app.core.deps import CurrentUser, DbSession
from app.core.rate_limit import limiter
from app.schemas.hashtags import HashtagOut, HashtagSuggestion
from app.schemas.memes import FeedPage, HotFeedPage
from app.schemas.trending import TrendingResponse
from app.services import hashtags as hashtags_service
from app.services import trending as trending_service

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


# Registered before /{slug} — otherwise "/hashtags/trending" would be captured by the
# dynamic slug route instead.
@router.get("/trending", response_model=TrendingResponse)
@limiter.limit("60/minute")
async def get_trending_hashtags(
    request: Request,
    current_user: CurrentUser,
    db: DbSession,
    limit: int = Query(trending_service.DEFAULT_LIMIT, ge=1, le=trending_service.MAX_LIMIT),
) -> TrendingResponse:
    return await trending_service.get_trending_hashtags(db, limit)


@router.get("/{slug}", response_model=HashtagOut)
async def get_hashtag(slug: str, current_user: CurrentUser, db: DbSession) -> HashtagOut:
    return await hashtags_service.get_hashtag(db, slug, current_user.id)


@router.get("/{slug}/memes", response_model=FeedPage)
async def get_hashtag_feed(
    slug: str,
    current_user: CurrentUser,
    db: DbSession,
    cursor: str | None = None,
    limit: int = Query(20, ge=1, le=50),
) -> FeedPage:
    """Latest — keyset-paginated. See `/memes/hot` for the Hot-ranked variant; they're
    separate routes rather than a `sort=` param because their pagination contracts differ
    (Roadmap_Search.md S5)."""
    return await hashtags_service.get_hashtag_feed(db, current_user, slug, cursor, limit)


@router.get("/{slug}/memes/hot", response_model=HotFeedPage)
async def get_hashtag_feed_hot(
    slug: str,
    current_user: CurrentUser,
    db: DbSession,
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=50),
) -> HotFeedPage:
    return await hashtags_service.get_hashtag_feed_hot(db, current_user, slug, offset, limit)
