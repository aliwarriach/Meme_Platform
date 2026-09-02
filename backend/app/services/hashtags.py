"""Hashtags as first-class entities (Phase 20).

Free-text tags parsed out of a caption were the obvious design and are the wrong one: a
typo, wrong casing or a missing tag would silently drop a meme out of the challenge it was
meant to enter, with no feedback to the poster, and nothing would stop two challenges
claiming the same tag. So a tag is a row, a challenge *reserves* one (unique FK), and the
creator resolves what the user types against this table before publish — entering a
challenge is then an explicit confirmed action, not a string match. An unresolved tag is
still a perfectly good discovery tag; it just never counts as a challenge entry.
"""

import datetime
import re
import uuid

from sqlalchemy import case, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import HashtagInvalidError, HashtagNotFoundError
from app.models.challenge import Challenge, ChallengeStatus
from app.models.hashtag import Hashtag, MemeHashtag
from app.models.meme import Meme
from app.models.user import User
from app.schemas.hashtags import HashtagOut, HashtagSuggestion
from app.schemas.memes import FeedPage

MAX_HASHTAGS_PER_MEME = 5
_NON_ALNUM = re.compile(r"[^a-z0-9]")

# A finished challenge's result card stays on the tag screen for 24h, then disappears
# (Roadmap_Search.md §1.4).
RESULT_CARD_GRACE_HOURS = 24


def normalize_hashtag(raw: str) -> str:
    """"#Dogs-Vs-Cats" -> "dogsvscats". Case, punctuation and the leading '#' must not
    fork a tag, or an open challenge's entry tag would split into several dead variants.
    """
    slug = _NON_ALNUM.sub("", raw.strip().lstrip("#").lower())
    if not slug:
        raise HashtagInvalidError("A hashtag needs at least one letter or number")
    if len(slug) > 100:
        raise HashtagInvalidError("A hashtag can be at most 100 characters")
    return slug


async def get_or_create_hashtag(db: AsyncSession, raw: str) -> Hashtag:
    """Not committed — the caller owns the transaction. Races on the unique slug are
    resolved by re-reading rather than failing, since two people tagging the same thing at
    once is normal, not an error.
    """
    slug = normalize_hashtag(raw)
    existing = await db.scalar(select(Hashtag).where(Hashtag.slug == slug))
    if existing is not None:
        return existing

    hashtag = Hashtag(slug=slug, display_text=raw.strip().lstrip("#")[:100] or slug)
    db.add(hashtag)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        hashtag = await db.scalar(select(Hashtag).where(Hashtag.slug == slug))
        if hashtag is None:
            raise
    return hashtag


async def attach_hashtags(db: AsyncSession, meme_id: uuid.UUID, raws: list[str]) -> list[Hashtag]:
    """Stages `MemeHashtag` rows without committing, deduping by normalized slug so
    "#Cats #cats" doesn't produce two rows and trip the unique constraint.
    """
    seen: dict[str, Hashtag] = {}
    for raw in raws:
        hashtag = await get_or_create_hashtag(db, raw)
        seen.setdefault(hashtag.slug, hashtag)

    if len(seen) > MAX_HASHTAGS_PER_MEME:
        raise HashtagInvalidError(f"A meme can carry at most {MAX_HASHTAGS_PER_MEME} hashtags")

    for hashtag in seen.values():
        db.add(MemeHashtag(meme_id=meme_id, hashtag_id=hashtag.id))
    return list(seen.values())


async def _meme_count(db: AsyncSession, hashtag_id: uuid.UUID) -> int:
    return int(
        await db.scalar(
            select(func.count(MemeHashtag.id)).where(MemeHashtag.hashtag_id == hashtag_id)
        )
        or 0
    )


async def _build_hashtag_out(
    db: AsyncSession, hashtag: Hashtag, viewer_id: uuid.UUID | None = None
) -> HashtagOut:
    """A tag can now be reserved by at most one *live* challenge at a time, but a tag screen
    can show two challenges at once — the currently-active one and one that finished within
    the last 24h (Roadmap_Search.md §1.4/S1 step 5). Building a full `ChallengeOut` needs
    `services/challenges.py`, which imports `get_or_create_hashtag` from this module at
    module scope — imported lazily here, the same way `_paginated_feed` is imported lazily
    in `get_hashtag_feed`, to avoid a circular import.
    """
    from app.services.challenges import _build_challenge_out

    active_challenge_row = await db.scalar(
        select(Challenge).where(
            Challenge.hashtag_id == hashtag.id, Challenge.status != ChallengeStatus.evaluated
        )
    )
    active_challenge = (
        await _build_challenge_out(db, active_challenge_row, viewer_id=viewer_id)
        if active_challenge_row
        else None
    )

    result_cutoff = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(
        hours=RESULT_CARD_GRACE_HOURS
    )
    recent_result_row = await db.scalar(
        select(Challenge)
        .where(
            Challenge.hashtag_id == hashtag.id,
            Challenge.status == ChallengeStatus.evaluated,
            Challenge.end_time >= result_cutoff,
        )
        .order_by(Challenge.end_time.desc())
        .limit(1)
    )
    recent_result_challenge = (
        await _build_challenge_out(db, recent_result_row, viewer_id=viewer_id)
        if recent_result_row
        else None
    )

    return HashtagOut(
        id=hashtag.id,
        slug=hashtag.slug,
        display_text=hashtag.display_text,
        meme_count=await _meme_count(db, hashtag.id),
        active_challenge=active_challenge,
        recent_result_challenge=recent_result_challenge,
    )


async def get_hashtag(db: AsyncSession, slug: str, viewer_id: uuid.UUID) -> HashtagOut:
    hashtag = await db.scalar(select(Hashtag).where(Hashtag.slug == normalize_hashtag(slug)))
    if hashtag is None:
        raise HashtagNotFoundError("Hashtag not found")
    return await _build_hashtag_out(db, hashtag, viewer_id=viewer_id)


async def search_hashtags(db: AsyncSession, query: str, limit: int) -> list[HashtagSuggestion]:
    """Backs the creator's `#` autocomplete. Challenge-owning tags are surfaced first —
    that's the whole point of the autocomplete, turning a typed tag into a real entry.
    """
    prefix = _NON_ALNUM.sub("", query.strip().lstrip("#").lower())
    if not prefix:
        return []

    rows = (
        await db.execute(
            select(Hashtag, Challenge.id, Challenge.title)
            .outerjoin(Challenge, Challenge.hashtag_id == Hashtag.id)
            .where(Hashtag.slug.startswith(prefix))
            .order_by(Challenge.id.is_(None), Hashtag.slug)
            .limit(limit)
        )
    ).all()

    return [
        HashtagSuggestion(
            id=hashtag.id,
            slug=hashtag.slug,
            display_text=hashtag.display_text,
            challenge_id=challenge_id,
            challenge_title=challenge_title,
        )
        for hashtag, challenge_id, challenge_title in rows
    ]


def _tokens_matched_expr(tokens: list[str]):
    """`Hashtag`-scoped column expression: how many *distinct* tokens match this row's
    slug, display text, or (outer-joined) owning-challenge title — one point per token
    regardless of how many of the three fields it happens to hit, so a token that matches
    both slug and title still only counts once. Shared by `search_hashtags_by_tokens` (Tags
    scope) and `matched_hashtag_ids_subquery` (used by the Posts scope, so a post tagged
    with a challenge-owned tag matches on the challenge's title too — the whole reason
    `#ElClasico` is findable via "Barcelona vs Real Madrid").

    `ILIKE '%token%'` can't use a b-tree index — acceptable at current scale for the same
    reason documented at `services/users.py:92`. The scale-up path is a `pg_trgm` GIN index
    on `hashtags.slug` and `challenges.title`.
    """
    match_terms = [
        case(
            (
                or_(
                    Hashtag.slug.ilike(f"%{t}%"),
                    Hashtag.display_text.ilike(f"%{t}%"),
                    Challenge.title.ilike(f"%{t}%"),
                ),
                1,
            ),
            else_=0,
        )
        for t in tokens
    ]
    tokens_matched = match_terms[0]
    for term in match_terms[1:]:
        tokens_matched = tokens_matched + term
    return tokens_matched


def matched_hashtag_ids_subquery(tokens: list[str]):
    """`SELECT Hashtag.id WHERE <any token matches>` — an unpaginated companion to
    `search_hashtags_by_tokens`, for callers that need the matched id set to filter another
    table (`services/search.py`'s Posts scope) rather than to render a Tags result page.
    """
    tokens_matched = _tokens_matched_expr(tokens)
    return (
        select(Hashtag.id)
        .outerjoin(Challenge, Challenge.hashtag_id == Hashtag.id)
        .where(tokens_matched > 0)
    )


async def search_hashtags_by_tokens(
    db: AsyncSession, tokens: list[str], limit: int, offset: int
) -> tuple[list[HashtagSuggestion], bool]:
    """Tags scope of the global search screen (Roadmap_Search.md S3) — token *substring*
    matching against the slug, the display text, **and** the title of a challenge that owns
    the tag, so `#ElClasico` is findable via "Barcelona vs Real Madrid" even though neither
    word appears in the tag itself. Deliberately separate from `search_hashtags` (whole-query
    prefix match, challenge-tags-first) — that one backs the creator's `#` autocomplete, a
    different job: completing a tag someone is mid-typing, not finding a topic.
    """
    if not tokens:
        return [], False

    tokens_matched = _tokens_matched_expr(tokens)

    meme_count_subq = (
        select(func.count(MemeHashtag.id))
        .where(MemeHashtag.hashtag_id == Hashtag.id)
        .correlate(Hashtag)
        .scalar_subquery()
    )

    stmt = (
        select(Hashtag, Challenge.id, Challenge.title, tokens_matched.label("tokens_matched"))
        .outerjoin(Challenge, Challenge.hashtag_id == Hashtag.id)
        .where(tokens_matched > 0)
        .order_by(
            tokens_matched.desc(),
            (Challenge.status == ChallengeStatus.active).desc(),
            meme_count_subq.desc(),
            Hashtag.slug.asc(),
        )
        .offset(offset)
        .limit(limit + 1)
    )
    rows = (await db.execute(stmt)).all()
    has_more = len(rows) > limit
    rows = rows[:limit]

    return [
        HashtagSuggestion(
            id=hashtag.id,
            slug=hashtag.slug,
            display_text=hashtag.display_text,
            challenge_id=challenge_id,
            challenge_title=challenge_title,
        )
        for hashtag, challenge_id, challenge_title, _tokens_matched in rows
    ], has_more


async def get_hashtag_feed(
    db: AsyncSession, current_user: User, slug: str, cursor: str | None, limit: int
) -> FeedPage:
    """The discovery surface that makes an open challenge spread — everything tagged with
    `slug` that this viewer is allowed to see.

    Reuses the feed's own pagination engine (private by name, but duplicating keyset
    pagination + the vote/comment count subqueries here would be strictly worse) and, more
    importantly, its visibility clause — a tag must never widen who can see a meme.
    """
    # Imported here rather than at module scope: services.memes imports nothing from this
    # module today, but keeping the edge one-directional and lazy avoids a cycle if the
    # meme service ever wants hashtag helpers.
    from app.services.memes import _paginated_feed, meme_visibility_clause

    hashtag = await db.scalar(select(Hashtag).where(Hashtag.slug == normalize_hashtag(slug)))
    if hashtag is None:
        raise HashtagNotFoundError("Hashtag not found")

    tagged = select(MemeHashtag.meme_id).where(MemeHashtag.hashtag_id == hashtag.id)
    return await _paginated_feed(
        db,
        current_user,
        meme_visibility_clause(current_user.id) & Meme.id.in_(tagged),
        cursor,
        limit,
    )


async def get_hashtag_feed_hot(
    db: AsyncSession, current_user: User, slug: str, offset: int, limit: int
):
    """Hot-ranked variant of the tag feed (Roadmap_Search.md S5) — a second route rather
    than a `sort=` parameter on `get_hashtag_feed`: Hot is offset-paginated and Latest is
    keyset-paginated (a Hot score drifts every second and has no stable cursor), so the two
    are genuinely different pagination contracts. One endpoint returning a union response
    type would be a permanent source of client bugs. `GET /hashtags/{slug}/memes` (Latest)
    is unchanged.
    """
    from app.services.memes import get_hot_ranked_memes, meme_visibility_clause

    hashtag = await db.scalar(select(Hashtag).where(Hashtag.slug == normalize_hashtag(slug)))
    if hashtag is None:
        raise HashtagNotFoundError("Hashtag not found")

    tagged = select(MemeHashtag.meme_id).where(MemeHashtag.hashtag_id == hashtag.id)
    return await get_hot_ranked_memes(
        db,
        current_user,
        meme_visibility_clause(current_user.id) & Meme.id.in_(tagged),
        offset,
        limit,
    )
