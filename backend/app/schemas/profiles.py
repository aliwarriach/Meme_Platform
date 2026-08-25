from pydantic import BaseModel

from app.schemas.auth import PublicUserOut
from app.schemas.badges import BadgeOut


class UserProfileOut(BaseModel):
    """Instagram-style profile header: score/badges/friend count are always visible to
    any authenticated user (matches the existing `GET /leaderboards/profile/{id}`
    stance), but `posts_locked` tells the client whether it's even worth calling
    `GET /users/{id}/posts` — that endpoint enforces the same friends-only gate itself,
    this flag just saves the client a guaranteed-403 round trip and drives the "Add as
    friend to see their posts" placeholder."""

    user: PublicUserOut
    score: int
    # Every badge the user has earned, newest first — the client renders up to 3 and a
    # "+N" overflow chip for the rest. `badge_count` stays a separate field (rather than
    # making the client do `len(badges)`) so the count is still correct if this list is
    # ever capped server-side later.
    badges: list[BadgeOut]
    badge_count: int
    friend_count: int
    is_self: bool
    is_friend: bool
    posts_locked: bool
