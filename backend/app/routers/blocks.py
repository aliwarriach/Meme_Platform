import uuid

from fastapi import APIRouter, Request

from app.core.deps import CurrentUser, DbSession
from app.core.rate_limit import limiter
from app.schemas.blocks import BlockCreate, BlockOut
from app.services import blocks as blocks_service

router = APIRouter(prefix="/blocks", tags=["blocks"])


@router.post("", response_model=BlockOut, status_code=201)
@limiter.limit("20/minute")
async def block_user(
    request: Request, data: BlockCreate, current_user: CurrentUser, db: DbSession
) -> BlockOut:
    return await blocks_service.block_user(db, current_user, data.user_id)


@router.delete("/{user_id}", status_code=204)
async def unblock_user(user_id: uuid.UUID, current_user: CurrentUser, db: DbSession) -> None:
    await blocks_service.unblock_user(db, current_user, user_id)


@router.get("", response_model=list[BlockOut])
async def list_blocked(current_user: CurrentUser, db: DbSession) -> list[BlockOut]:
    return await blocks_service.list_blocked(db, current_user)
