import uuid
from typing import Annotated

from fastapi import APIRouter, Form, Query, Request, UploadFile

from app.core.deps import CurrentUser, CurrentVerifiedUser, DbSession, ReadDbSession
from app.core.rate_limit import limiter
from app.models.post_audience import AudienceType
from app.schemas.comments import CommentCreate, CommentOut
from app.schemas.instagram import MergedFeedPage
from app.schemas.memes import MemeOut, MemeViewOut
from app.schemas.votes import VoteCast, VoteOut
from app.services import comments as comments_service
from app.services import instagram as instagram_service
from app.services import memes as memes_service
from app.services import votes as votes_service

router = APIRouter(prefix="/memes", tags=["memes"])


@router.post("", response_model=MemeOut, status_code=201)
@limiter.limit("20/minute")
async def create_meme(
    request: Request,
    current_user: CurrentUser,
    db: DbSession,
    image: UploadFile | None = None,
    image_public_id: Annotated[str | None, Form()] = None,
    audiences: Annotated[list[AudienceType], Form()] = [],
    caption: Annotated[str | None, Form(max_length=500)] = None,
    hashtags: Annotated[list[str], Form()] = [],
) -> MemeOut:
    """`image` (legacy multipart upload) and `image_public_id` (Roadmap_Scaling.md A4's
    direct-to-Cloudinary flow — confirm the `public_id` from
    `POST /media/upload-signature`) are mutually exclusive; exactly one is required."""
    return await memes_service.create_meme(
        db, current_user, caption, audiences, image, hashtags, image_public_id=image_public_id
    )


@router.delete("/{meme_id}", status_code=204)
async def delete_meme(meme_id: uuid.UUID, current_user: CurrentUser, db: DbSession) -> None:
    """Author-only soft delete (SecurityFeatures.md F-4) — the meme drops out of every
    feed/read immediately; a DM referencing it degrades to a null-meme placeholder."""
    await memes_service.delete_meme(db, current_user, meme_id)


@router.get("/feed", response_model=MergedFeedPage)
async def get_feed(
    current_user: CurrentUser,
    db: ReadDbSession,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
) -> MergedFeedPage:
    """Merges native memes with externally-shared `MemeContainer`s (Instagram Companion
    Mode, Project_Requirements §13) into one feed, ranked by Reddit-style Hot score
    (vote score vs. age) — see `services/instagram.py::get_merged_feed`. Offset-paginated
    since Hot score has no stable pagination cursor (it drifts continuously with age).
    """
    return await instagram_service.get_merged_feed(db, current_user, offset, limit)


@router.post("/{meme_id}/votes", response_model=VoteOut, status_code=201)
@limiter.limit("60/minute")
async def cast_vote(
    request: Request,
    meme_id: uuid.UUID,
    data: VoteCast,
    current_user: CurrentVerifiedUser,
    db: DbSession,
) -> VoteOut:
    """Reddit-style upvote/downvote. Casting the same value again removes the vote;
    casting the opposite value flips it. Requires a verified email (SecurityFeatures.md
    F-1) — vote farming with unlimited free accounts is a named abuse scenario."""
    return await votes_service.cast_vote(db, current_user, meme_id, data.value)


@router.post("/{meme_id}/views", response_model=MemeViewOut, status_code=201)
@limiter.limit("120/minute")
async def record_view(
    request: Request,
    meme_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> MemeViewOut:
    """Records one impression on a meme — the reach signal behind its MemeScore. Gated to
    memes the caller can actually see (404 otherwise). Deduped per (meme, user): a repeat
    view from the same caller doesn't move the counter."""
    return await memes_service.record_meme_view(db, current_user, meme_id)


@router.post("/{meme_id}/comments", response_model=CommentOut, status_code=201)
@limiter.limit("30/minute")
async def add_comment(
    request: Request,
    meme_id: uuid.UUID,
    data: CommentCreate,
    current_user: CurrentUser,
    db: DbSession,
) -> CommentOut:
    return await comments_service.add_comment(db, current_user, meme_id, data)


@router.get("/{meme_id}/comments", response_model=list[CommentOut])
async def list_comments(
    meme_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> list[CommentOut]:
    return await comments_service.list_comments(db, current_user, meme_id)


@router.delete("/{meme_id}/comments/{comment_id}", status_code=204)
async def delete_comment(
    meme_id: uuid.UUID, comment_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> None:
    """Author-only soft delete (SecurityFeatures.md F-4)."""
    await comments_service.delete_comment(db, current_user, meme_id, comment_id)
