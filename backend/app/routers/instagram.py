import uuid

from fastapi import APIRouter, Request

from app.core.deps import CurrentUser, DbSession
from app.core.rate_limit import limiter
from app.schemas.instagram import (
    ContainerCommentCreate,
    ContainerCommentOut,
    ContainerReactionOut,
    MemeContainerCreate,
    MemeContainerOut,
)
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


@router.post(
    "/containers/{container_id}/reactions", response_model=ContainerReactionOut, status_code=201
)
async def add_container_reaction(
    container_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> ContainerReactionOut:
    return await instagram_service.add_container_reaction(db, current_user, container_id)


@router.delete("/containers/{container_id}/reactions", status_code=204)
async def remove_container_reaction(
    container_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> None:
    await instagram_service.remove_container_reaction(db, current_user, container_id)


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
