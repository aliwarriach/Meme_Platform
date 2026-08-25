import uuid

from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import InvalidImageSourceError
from app.models.user import User
from app.services.media import confirm_pending_upload, delete_uploaded_image, validate_and_upload_image


async def get_user_by_id(db: AsyncSession, user_id: uuid.UUID) -> User | None:
    return await db.get(User, user_id)


async def update_profile(
    db: AsyncSession,
    current_user: User,
    bio: str | None,
    clear_bio: bool,
    avatar: UploadFile | None,
    avatar_public_id: str | None = None,
) -> User:
    """`clear_bio` distinguishes "clear the bio" from "leave it alone" (`bio` omitted) —
    see routers/auth.py::update_me for why a plain empty-string `bio` can't signal this
    itself (SecurityFeatures.md F-4). `avatar` (legacy multipart upload) and
    `avatar_public_id` (Roadmap_Scaling.md A4's direct-to-Cloudinary flow) are mutually
    exclusive; either, if given, always replaces the current avatar."""
    if clear_bio:
        current_user.bio = None
    elif bio:
        current_user.bio = bio

    old_public_id = current_user.avatar_public_id
    avatar_changed = avatar is not None or avatar_public_id is not None

    if avatar_public_id is not None:
        if avatar is not None:
            raise InvalidImageSourceError("Provide either an avatar file or avatar_public_id, not both")
        avatar_url, avatar_public_id = await confirm_pending_upload(current_user.id, avatar_public_id)
        current_user.avatar_url = avatar_url
        current_user.avatar_public_id = avatar_public_id
    elif avatar is not None:
        avatar_url, avatar_public_id = await validate_and_upload_image(avatar, folder="avatars")
        current_user.avatar_url = avatar_url
        current_user.avatar_public_id = avatar_public_id

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
