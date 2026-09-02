"""Global search aggregator (Roadmap_Search.md S3) — the API behind the search screen's
five-scope tabbed results (Challenges · Posts · People · Communities · Tags).

Fans out to the five underlying queries **sequentially, never `asyncio.gather`** — a single
SQLAlchemy `AsyncSession` can't service concurrent operations; `gather`ing five queries on
one session raises `InvalidRequestError` at runtime. These are five short indexed reads on
`ReadDbSession`; if this ever becomes a latency problem the fix is separate sessions, not
`gather`.
"""

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.challenge import Challenge
from app.models.hashtag import MemeHashtag
from app.models.meme import Meme
from app.models.user import User
from app.schemas.auth import PublicUserOut
from app.schemas.challenges import ChallengeOut
from app.schemas.communities import CommunityOut
from app.schemas.hashtags import HashtagSuggestion
from app.schemas.memes import MemeOut
from app.schemas.search import SearchAllOut, SearchScope, SearchSection
from app.services import communities as communities_service
from app.services import hashtags as hashtags_service
from app.services import users as users_service
from app.services.challenges import _build_challenge_out, challenge_visibility_clause
from app.services.hashtags import _NON_ALNUM
from app.services.memes import get_hot_ranked_memes, meme_visibility_clause

PREVIEW_LIMIT = 10
MAX_QUERY_TOKENS = 6
MIN_TOKEN_LENGTH = 2
MIN_QUERY_LENGTH = 2
DEFAULT_LIMIT = 20
MAX_LIMIT = 50


def tokenize_query(query: str) -> list[str]:
    """Split on whitespace and normalize each token independently — the bug this whole
    phase exists to fix: the old whole-query normalization (`_NON_ALNUM.sub("", <entire
    query>)`) collapsed "Barcelona vs Real Madrid" into "barcelonavsrealmadrid" and matched
    nothing. Stopwords are deliberately **not** stripped — "vs" is load-bearing for a tag
    like `#barcavsmadrid`.
    """
    tokens = [_NON_ALNUM.sub("", piece.lower()) for piece in query.split()]
    tokens = [t for t in tokens if len(t) >= MIN_TOKEN_LENGTH]
    return tokens[:MAX_QUERY_TOKENS]


def _section(items: list, has_more: bool) -> SearchSection:
    return SearchSection(items=items, count=len(items), capped=has_more, has_more=has_more)


async def _search_tags(
    db: AsyncSession, tokens: list[str], limit: int, offset: int
) -> SearchSection[HashtagSuggestion]:
    items, has_more = await hashtags_service.search_hashtags_by_tokens(db, tokens, limit, offset)
    return _section(items, has_more)


async def _search_posts(
    db: AsyncSession, viewer: User, tokens: list[str], limit: int, offset: int
) -> SearchSection[MemeOut]:
    """Posts = memes carrying a matching tag **∪** memes whose caption matches. Tag-only
    would be empty for most searches — most memes have no hashtag, and community posts
    can't carry one at all. Going through `meme_visibility_clause` is not optional — a
    search result must never widen who can see a meme.
    """
    if not tokens:
        return _section([], False)

    matched_tag_ids = hashtags_service.matched_hashtag_ids_subquery(tokens)
    tagged = select(MemeHashtag.meme_id).where(MemeHashtag.hashtag_id.in_(matched_tag_ids))
    caption_match = or_(*(Meme.caption.ilike(f"%{t}%") for t in tokens))
    clause = meme_visibility_clause(viewer.id) & or_(Meme.id.in_(tagged), caption_match)

    page = await get_hot_ranked_memes(db, viewer, clause, offset, limit)
    return _section(page.items, page.has_more)


async def _search_challenges(
    db: AsyncSession, viewer: User, tokens: list[str], limit: int, offset: int
) -> SearchSection[ChallengeOut]:
    """Every `open` challenge, plus anything the caller could already fetch directly — never
    more. `challenge_visibility_clause` is the same clause a list endpoint would use; do not
    filter client-side, or result counts/pagination would leak the existence of private
    challenges even when the rows themselves are hidden.
    """
    if not tokens:
        return _section([], False)

    title_match = or_(*(Challenge.title.ilike(f"%{t}%") for t in tokens))
    stmt = (
        select(Challenge)
        .where(challenge_visibility_clause(viewer.id), title_match)
        .order_by(Challenge.created_at.desc(), Challenge.id.desc())
        .offset(offset)
        .limit(limit + 1)
    )
    rows = (await db.execute(stmt)).scalars().all()
    has_more = len(rows) > limit
    rows = rows[:limit]

    items = [await _build_challenge_out(db, c, viewer_id=viewer.id) for c in rows]
    return _section(items, has_more)


async def _search_people(
    db: AsyncSession, viewer: User, query: str, limit: int, offset: int
) -> SearchSection[PublicUserOut]:
    """Reuses `users_service.search_users` exactly as it stands — matches `username` only."""
    users = await users_service.search_users(db, viewer, query, offset + limit + 1)
    page = users[offset : offset + limit]
    has_more = len(users) > offset + limit
    return _section([PublicUserOut.model_validate(u) for u in page], has_more)


async def _search_communities(
    db: AsyncSession, viewer: User, query: str, limit: int, offset: int
) -> SearchSection[CommunityOut]:
    """Reuses `communities_service.list_communities` exactly as it stands — its privacy
    behaviour is already shipped and tested, and offsetting into its cursor-paginated result
    (rather than forking it to accept an offset) is one extra query, not a new code path.
    """
    community_page = await communities_service.list_communities(
        db, viewer, cursor=None, limit=offset + limit, query=query
    )
    page = community_page.items[offset : offset + limit]
    has_more = community_page.next_cursor is not None
    return _section(page, has_more)


async def search_all(db: AsyncSession, viewer: User, q: str) -> SearchAllOut:
    """The single request that powers the search screen's chip counts — each scope capped
    at `PREVIEW_LIMIT` so this never costs five unbounded queries."""
    qn = q.strip()
    if len(qn) < MIN_QUERY_LENGTH:
        empty = _section([], False)
        return SearchAllOut(
            challenges=empty, posts=empty, people=empty, communities=empty, tags=empty
        )

    tokens = tokenize_query(qn)

    # Sequential, not asyncio.gather — see module docstring.
    tags = await _search_tags(db, tokens, PREVIEW_LIMIT, 0)
    posts = await _search_posts(db, viewer, tokens, PREVIEW_LIMIT, 0)
    challenges = await _search_challenges(db, viewer, tokens, PREVIEW_LIMIT, 0)
    people = await _search_people(db, viewer, qn, PREVIEW_LIMIT, 0)
    communities = await _search_communities(db, viewer, qn, PREVIEW_LIMIT, 0)

    return SearchAllOut(
        challenges=challenges, posts=posts, people=people, communities=communities, tags=tags
    )


async def search_scope(
    db: AsyncSession, viewer: User, q: str, scope: SearchScope, limit: int, offset: int
) -> SearchSection:
    qn = q.strip()
    if len(qn) < MIN_QUERY_LENGTH:
        return _section([], False)

    tokens = tokenize_query(qn)

    if scope == SearchScope.tags:
        return await _search_tags(db, tokens, limit, offset)
    if scope == SearchScope.posts:
        return await _search_posts(db, viewer, tokens, limit, offset)
    if scope == SearchScope.challenges:
        return await _search_challenges(db, viewer, tokens, limit, offset)
    if scope == SearchScope.people:
        return await _search_people(db, viewer, qn, limit, offset)
    if scope == SearchScope.communities:
        return await _search_communities(db, viewer, qn, limit, offset)
    raise ValueError(f"Unknown search scope: {scope}")
