import uuid
from typing import Annotated

from fastapi import APIRouter, Form, Query, UploadFile

from app.core.deps import CurrentUser, DbSession
from app.models.post_audience import AudienceType
from app.schemas.comments import CommentCreate, CommentOut
from app.schemas.memes import FeedPage, MemeOut
from app.schemas.reactions import ReactionOut
from app.services import comments as comments_service
from app.services import memes as memes_service
from app.services import reactions as reactions_service

router = APIRouter(prefix="/memes", tags=["memes"])


@router.post("", response_model=MemeOut, status_code=201)
async def create_meme(
    image: UploadFile,
    current_user: CurrentUser,
    db: DbSession,
    audiences: Annotated[list[AudienceType], Form()] = [],
    caption: Annotated[str | None, Form(max_length=500)] = None,
) -> MemeOut:
    return await memes_service.create_meme(db, current_user, caption, audiences, image)


@router.get("/feed", response_model=FeedPage)
async def get_feed(
    current_user: CurrentUser,
    db: DbSession,
    cursor: str | None = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
) -> FeedPage:
    return await memes_service.get_feed(db, current_user, cursor, limit)


@router.post("/{meme_id}/reactions", response_model=ReactionOut, status_code=201)
async def add_reaction(meme_id: uuid.UUID, current_user: CurrentUser, db: DbSession) -> ReactionOut:
    return await reactions_service.add_reaction(db, current_user, meme_id)


@router.delete("/{meme_id}/reactions", status_code=204)
async def remove_reaction(meme_id: uuid.UUID, current_user: CurrentUser, db: DbSession) -> None:
    await reactions_service.remove_reaction(db, current_user, meme_id)


@router.post("/{meme_id}/comments", response_model=CommentOut, status_code=201)
async def add_comment(
    meme_id: uuid.UUID, data: CommentCreate, current_user: CurrentUser, db: DbSession
) -> CommentOut:
    return await comments_service.add_comment(db, current_user, meme_id, data)


@router.get("/{meme_id}/comments", response_model=list[CommentOut])
async def list_comments(
    meme_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> list[CommentOut]:
    return await comments_service.list_comments(db, current_user, meme_id)
