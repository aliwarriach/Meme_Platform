"""Instagram-style user profile: score + badge count + friend count are public to any
authenticated user (matches the existing `leaderboards.get_profile_score` stance), but the
post grid itself is friends-only — a deliberate product decision distinct from a post's own
`audience` (a stranger's `public` meme still surfaces in the main feed; it just doesn't show
on their profile grid to a non-friend). `get_user_posts` enforces that gate itself rather
than trusting `UserProfileOut.posts_locked` as anything more than a client-side hint to skip
a guaranteed-403 call.
"""

import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFriendsError, UserNotFoundError
from app.models.friendship import Friendship, FriendshipStatus
from app.models.user import User
from app.schemas.auth import PublicUserOut
from app.schemas.memes import FeedPage
from app.schemas.profiles import UserProfileOut
from app.services import badges as badges_service
from app.services import memes as memes_service
from app.services.friends import are_friends, has_pending_outgoing_request
from app.services.leaderboards import get_profile_score


async def _get_user_or_404(db: AsyncSession, user_id: uuid.UUID) -> User:
    user = await db.get(User, user_id)
    if user is None:
        raise UserNotFoundError("User not found")
    return user


async def get_user_profile(
    db: AsyncSession, current_user: User, user_id: uuid.UUID
) -> UserProfileOut:
    target = await _get_user_or_404(db, user_id)
    is_self = target.id == current_user.id
    is_friend = is_self or await are_friends(db, current_user.id, target.id)
    friend_request_sent = (
        not is_self
        and not is_friend
        and await has_pending_outgoing_request(db, current_user.id, target.id)
    )

    profile_score = await get_profile_score(db, user_id)
    badges = await badges_service.list_user_badges(db, user_id)
    friend_count = await db.scalar(
        select(func.count(Friendship.id)).where(
            Friendship.status == FriendshipStatus.accepted,
            or_(Friendship.requester_id == user_id, Friendship.addressee_id == user_id),
        )
    )

    return UserProfileOut(
        user=PublicUserOut.model_validate(target),
        score=profile_score.score,
        badges=badges,
        badge_count=len(badges),
        friend_count=friend_count or 0,
        is_self=is_self,
        is_friend=is_friend,
        posts_locked=not is_friend,
        friend_request_sent=friend_request_sent,
    )


async def get_user_posts(
    db: AsyncSession, current_user: User, user_id: uuid.UUID, cursor: str | None, limit: int
) -> FeedPage:
    target = await _get_user_or_404(db, user_id)
    is_self = target.id == current_user.id
    if not is_self and not await are_friends(db, current_user.id, target.id):
        raise NotFriendsError("Add this user as a friend to see their posts")
    return await memes_service.get_author_posts(db, current_user, user_id, cursor, limit)
