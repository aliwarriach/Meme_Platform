import uuid

from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import InvalidAvatarPresetError, InvalidImageSourceError
from app.models.user import User
from app.services.media import confirm_pending_upload, delete_uploaded_image, validate_and_upload_image

# Mirrors `frontend/src/constants/avatarPresets.ts` — keep both lists in sync. The server
# is the real gate (never trusts a client-supplied id as-is); the frontend list is just
# what the picker offers.
ALLOWED_AVATAR_PRESETS = {"blaze", "chill", "goblin", "royal", "frog"}


async def get_user_by_id(db: AsyncSession, user_id: uuid.UUID) -> User | None:
    return await db.get(User, user_id)


async def update_profile(
    db: AsyncSession,
    current_user: User,
    bio: str | None,
    clear_bio: bool,
    avatar: UploadFile | None,
    avatar_public_id: str | None = None,
    avatar_preset: str | None = None,
    clear_avatar: bool = False,
) -> User:
    """`clear_bio` distinguishes "clear the bio" from "leave it alone" (`bio` omitted) —
    see routers/auth.py::update_me for why a plain empty-string `bio` can't signal this
    itself (SecurityFeatures.md F-4). Exactly one of `avatar` (legacy multipart upload),
    `avatar_public_id` (Roadmap_Scaling.md A4's direct-to-Cloudinary flow), `avatar_preset`
    (a built-in avatar) or `clear_avatar` (remove the avatar entirely, back to initials) may
    be given — whichever is, always replaces whatever avatar state currently exists."""
    if clear_bio:
        current_user.bio = None
    elif bio:
        current_user.bio = bio

    if avatar_public_id is not None and avatar is not None:
        raise InvalidImageSourceError("Provide either an avatar file or avatar_public_id, not both")
    if avatar_preset is not None and avatar_preset not in ALLOWED_AVATAR_PRESETS:
        raise InvalidAvatarPresetError(f"Unknown avatar preset: {avatar_preset}")

    old_public_id = current_user.avatar_public_id
    avatar_changed = (
        avatar is not None or avatar_public_id is not None or avatar_preset is not None or clear_avatar
    )

    if clear_avatar:
        current_user.avatar_url = None
        current_user.avatar_public_id = None
        current_user.avatar_preset = None
    elif avatar_preset is not None:
        current_user.avatar_url = None
        current_user.avatar_public_id = None
        current_user.avatar_preset = avatar_preset
    elif avatar_public_id is not None:
        avatar_url, avatar_public_id = await confirm_pending_upload(current_user.id, avatar_public_id)
        current_user.avatar_url = avatar_url
        current_user.avatar_public_id = avatar_public_id
        current_user.avatar_preset = None
    elif avatar is not None:
        avatar_url, avatar_public_id = await validate_and_upload_image(avatar, folder="avatars")
        current_user.avatar_url = avatar_url
        current_user.avatar_public_id = avatar_public_id
        current_user.avatar_preset = None

    await db.commit()
    await db.refresh(current_user)

    if avatar_changed and old_public_id:
        await delete_uploaded_image(old_public_id)

    return current_user


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def get_user_by_username(db: AsyncSession, username: str) -> User | None:
    result = await db.execute(select(User).where(User.username == username))
    return result.scalar_one_or_none()


async def search_users(db: AsyncSession, current_user: User, query: str, limit: int) -> list[User]:
    """Case-insensitive partial username match, e.g. for a community's "invite someone"
    picker — never returns the caller themself. Deliberately simple (`ILIKE`, no ranking/
    trigram index) at this scale; revisit if this ever needs to scale past a straightforward
    prefix/substring search."""
    stmt = (
        select(User)
        .where(User.username.ilike(f"%{query}%"), User.id != current_user.id, User.is_active.is_(True))
        .order_by(User.username)
        .limit(limit)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())
