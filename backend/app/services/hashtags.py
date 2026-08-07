"""Hashtags as first-class entities (Phase 20).

Free-text tags parsed out of a caption were the obvious design and are the wrong one: a
typo, wrong casing or a missing tag would silently drop a meme out of the challenge it was
meant to enter, with no feedback to the poster, and nothing would stop two challenges
claiming the same tag. So a tag is a row, a challenge *reserves* one (unique FK), and the
creator resolves what the user types against this table before publish — entering a
challenge is then an explicit confirmed action, not a string match. An unresolved tag is
still a perfectly good discovery tag; it just never counts as a challenge entry.
"""

import re
import uuid

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import HashtagInvalidError, HashtagNotFoundError
from app.models.challenge import Challenge
from app.models.hashtag import Hashtag, MemeHashtag
from app.models.meme import Meme
from app.models.user import User
from app.schemas.hashtags import HashtagOut, HashtagSuggestion
from app.schemas.memes import FeedPage

MAX_HASHTAGS_PER_MEME = 5
_NON_ALNUM = re.compile(r"[^a-z0-9]")


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


async def _build_hashtag_out(db: AsyncSession, hashtag: Hashtag) -> HashtagOut:
    challenge_id = await db.scalar(
        select(Challenge.id).where(Challenge.hashtag_id == hashtag.id)
    )
    return HashtagOut(
        id=hashtag.id,
        slug=hashtag.slug,
        display_text=hashtag.display_text,
        meme_count=await _meme_count(db, hashtag.id),
        challenge_id=challenge_id,
    )


async def get_hashtag(db: AsyncSession, slug: str) -> HashtagOut:
    hashtag = await db.scalar(select(Hashtag).where(Hashtag.slug == normalize_hashtag(slug)))
    if hashtag is None:
        raise HashtagNotFoundError("Hashtag not found")
    return await _build_hashtag_out(db, hashtag)


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
