from fastapi import APIRouter, Query, Request

from app.core.deps import CurrentUser, ReadDbSession
from app.core.rate_limit import limiter
from app.schemas.search import SearchAllOut, SearchScope, SearchSection
from app.services import search as search_service

router = APIRouter(prefix="/search", tags=["search"])


@router.get("", response_model=SearchAllOut | SearchSection)
@limiter.limit("60/minute")
async def search(
    request: Request,
    current_user: CurrentUser,
    db: ReadDbSession,
    q: str = Query(default="", max_length=200),
    scope: SearchScope = SearchScope.all,
    limit: int = Query(search_service.DEFAULT_LIMIT, ge=1, le=search_service.MAX_LIMIT),
    offset: int = Query(0, ge=0),
) -> SearchAllOut | SearchSection:
    if scope == SearchScope.all:
        return await search_service.search_all(db, current_user, q)
    return await search_service.search_scope(db, current_user, q, scope, limit, offset)
