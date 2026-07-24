import uuid

from fastapi import APIRouter, Request

from app.core.deps import CurrentUser, DbSession
from app.core.rate_limit import limiter
from app.schemas.instagram import (
    ContainerCommentCreate,
    ContainerCommentOut,
    ContainerViewOut,
    MemeContainerCreate,
    MemeContainerOut,
)
from app.schemas.votes import VoteCast
from app.services import instagram as instagram_service

router = APIRouter(prefix="/instagram", tags=["instagram"])


# Capped tighter than most write endpoints — each call spawns a fire-and-forget
# background task calling the external oEmbed integration (see services/instagram.py).
@router.post("/containers", response_model=MemeContainerOut, status_code=201)
@limiter.limit("10/minute")
async def create_container(
    request: Request, body: MemeContainerCreate, current_user: CurrentUser, db: DbSession
) -> MemeContainerOut:
    return await instagram_service.create_container(db, current_user, body.source_url)


@router.get("/containers/{container_id}", response_model=MemeContainerOut)
async def get_container(
    container_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> MemeContainerOut:
    return await instagram_service.get_container(db, current_user, container_id)


@router.post("/containers/{container_id}/votes", response_model=MemeContainerOut, status_code=201)
@limiter.limit("60/minute")
async def cast_container_vote(
    request: Request,
    container_id: uuid.UUID,
    data: VoteCast,
    current_user: CurrentUser,
    db: DbSession,
) -> MemeContainerOut:
    return await instagram_service.cast_container_vote(db, current_user, container_id, data.value)


@router.post("/containers/{container_id}/views", response_model=ContainerViewOut, status_code=201)
@limiter.limit("120/minute")
async def record_container_view(
    request: Request,
    container_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> ContainerViewOut:
    """Records one impression on a container — the reach signal behind its MemeScore.
    Deduped per (container, user), same as native memes."""
    return await instagram_service.record_container_view(db, current_user, container_id)


@router.post(
    "/containers/{container_id}/comments", response_model=ContainerCommentOut, status_code=201
)
async def add_container_comment(
    container_id: uuid.UUID,
    data: ContainerCommentCreate,
    current_user: CurrentUser,
    db: DbSession,
) -> ContainerCommentOut:
    return await instagram_service.add_container_comment(db, current_user, container_id, data)


@router.get("/containers/{container_id}/comments", response_model=list[ContainerCommentOut])
async def list_container_comments(
    container_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> list[ContainerCommentOut]:
    return await instagram_service.list_container_comments(db, current_user, container_id)
