import uuid

from sqlalchemy import and_, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    CannotFriendSelfError,
    FriendshipAlreadyExistsError,
    FriendshipNotFoundError,
    FriendshipNotPendingError,
    NotFriendshipParticipantError,
    UserBlockedError,
    UserNotFoundError,
)
from app.models.friendship import Friendship, FriendshipStatus
from app.models.user import User
from app.schemas.auth import PublicUserOut
from app.schemas.friends import FriendOut, FriendRequestCreate
from app.services import blocks as blocks_service
from app.services import users as users_service


async def _get_friendship_between(
    db: AsyncSession, user_a_id: uuid.UUID, user_b_id: uuid.UUID
) -> Friendship | None:
    result = await db.execute(
        select(Friendship).where(
            or_(
                and_(Friendship.requester_id == user_a_id, Friendship.addressee_id == user_b_id),
                and_(Friendship.requester_id == user_b_id, Friendship.addressee_id == user_a_id),
            )
        )
    )
    return result.scalar_one_or_none()


async def send_friend_request(
    db: AsyncSession, current_user: User, data: FriendRequestCreate
) -> Friendship:
    if data.username == current_user.username:
        raise CannotFriendSelfError("You can't send a friend request to yourself")

    target = await users_service.get_user_by_username(db, data.username)
    if target is None:
        raise UserNotFoundError("No user with that username exists")

    if await blocks_service.is_blocked(db, current_user.id, target.id):
        raise UserBlockedError("Unable to send a friend request to this user")

    if await _get_friendship_between(db, current_user.id, target.id) is not None:
        raise FriendshipAlreadyExistsError(
            "A friendship or pending request already exists between these users"
        )

    friendship = Friendship(
        requester_id=current_user.id, addressee_id=target.id, status=FriendshipStatus.pending
    )
    db.add(friendship)
    try:
        await db.commit()
    except IntegrityError:
        # Two concurrent requests between the same pair both passed the check above.
        await db.rollback()
        raise FriendshipAlreadyExistsError(
            "A friendship or pending request already exists between these users"
        ) from None
    await db.refresh(friendship)
    return friendship


async def accept_friend_request(
    db: AsyncSession, current_user: User, friendship_id: uuid.UUID
) -> Friendship:
    friendship = await db.get(Friendship, friendship_id)
    if friendship is None:
        raise FriendshipNotFoundError("Friend request not found")
    if friendship.addressee_id != current_user.id:
        raise NotFriendshipParticipantError("Only the request's recipient can accept it")
    if friendship.status != FriendshipStatus.pending:
        raise FriendshipNotPendingError("This request is no longer pending")

    friendship.status = FriendshipStatus.accepted
    await db.commit()
    await db.refresh(friendship)
    return friendship


async def remove_friendship(db: AsyncSession, current_user: User, friendship_id: uuid.UUID) -> None:
    friendship = await db.get(Friendship, friendship_id)
    if friendship is None:
        raise FriendshipNotFoundError("Friendship not found")
    if current_user.id not in (friendship.requester_id, friendship.addressee_id):
        raise NotFriendshipParticipantError("You are not part of this friendship")

    await db.delete(friendship)
    await db.commit()


async def list_friends(db: AsyncSession, current_user: User) -> list[FriendOut]:
    result = await db.execute(
        select(Friendship).where(
            Friendship.status == FriendshipStatus.accepted,
            or_(
                Friendship.requester_id == current_user.id,
                Friendship.addressee_id == current_user.id,
            ),
        )
    )
    friendships = result.scalars().all()
    return [
        FriendOut(
            friendship_id=f.id,
            user=PublicUserOut.model_validate(
                f.addressee if f.requester_id == current_user.id else f.requester
            ),
        )
        for f in friendships
    ]


async def are_friends(db: AsyncSession, user_a_id: uuid.UUID, user_b_id: uuid.UUID) -> bool:
    """False if either side has blocked the other, even for an existing accepted
    friendship — blocking gates every friend-gated interaction going forward (messaging,
    duel challenges), not just new friend requests. See SecurityFeatures.md F-5."""
    if await blocks_service.is_blocked(db, user_a_id, user_b_id):
        return False
    friendship = await _get_friendship_between(db, user_a_id, user_b_id)
    return friendship is not None and friendship.status == FriendshipStatus.accepted


async def list_incoming_requests(db: AsyncSession, current_user: User) -> list[Friendship]:
    result = await db.execute(
        select(Friendship).where(
            Friendship.addressee_id == current_user.id,
            Friendship.status == FriendshipStatus.pending,
        )
    )
    return list(result.scalars().all())
