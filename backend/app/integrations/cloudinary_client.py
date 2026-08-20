import asyncio
import logging
import uuid

import cloudinary
import cloudinary.uploader

from app.core.config import settings

logger = logging.getLogger(__name__)

cloudinary.config(
    cloud_name=settings.cloudinary_cloud_name,
    api_key=settings.cloudinary_api_key,
    api_secret=settings.cloudinary_api_secret,
    secure=True,
)


class MediaUploadError(Exception):
    pass


async def upload_image(file_bytes: bytes, folder: str) -> tuple[str, str]:
    """Uploads image bytes to Cloudinary under `folder`, returns (secure_url, public_id).

    Runs the (blocking) Cloudinary SDK call in a worker thread so it never blocks
    the event loop — there's no background-task queue in this codebase yet to
    hand it off to, and the response needs the resulting URL immediately anyway.
    """
    try:
        result = await asyncio.to_thread(
            cloudinary.uploader.upload,
            file_bytes,
            folder=folder,
            public_id=str(uuid.uuid4()),
            resource_type="image",
        )
    except Exception as exc:
        raise MediaUploadError("Failed to upload image to media storage") from exc

    return result["secure_url"], result["public_id"]


async def delete_image(public_id: str) -> None:
    """Best-effort cleanup — never raises. A soft-deleted row (SecurityFeatures.md F-4)
    is already excluded from every read the moment `deleted_at` is set, which is the
    part that actually matters; Cloudinary asset cleanup is secondary and must never
    block or fail the delete request itself."""
    try:
        await asyncio.to_thread(cloudinary.uploader.destroy, public_id, resource_type="image")
    except Exception:
        logger.exception("Failed to delete Cloudinary asset %s", public_id)
