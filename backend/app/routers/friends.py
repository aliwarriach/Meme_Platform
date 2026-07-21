import uuid

from fastapi import APIRouter

from app.core.deps import CurrentUser, DbSession
from app.schemas.friends import FriendOut, FriendRequestCreate, FriendshipOut
from app.services import friends as friends_service

router = APIRouter(prefix="/friends", tags=["friends"])


@router.post("/requests", response_model=FriendshipOut, status_code=201)
async def send_request(
    data: FriendRequestCreate, current_user: CurrentUser, db: DbSession
) -> FriendshipOut:
    return await friends_service.send_friend_request(db, current_user, data)


@router.get("/requests", response_model=list[FriendshipOut])
async def list_requests(current_user: CurrentUser, db: DbSession) -> list[FriendshipOut]:
    return await friends_service.list_incoming_requests(db, current_user)


@router.post("/requests/{friendship_id}/accept", response_model=FriendshipOut)
async def accept_request(
    friendship_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> FriendshipOut:
    return await friends_service.accept_friend_request(db, current_user, friendship_id)


@router.delete("/{friendship_id}", status_code=204)
async def remove_friendship(
    friendship_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> None:
    await friends_service.remove_friendship(db, current_user, friendship_id)


@router.get("", response_model=list[FriendOut])
async def list_friends(current_user: CurrentUser, db: DbSession) -> list[FriendOut]:
    return await friends_service.list_friends(db, current_user)
