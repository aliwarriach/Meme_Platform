import asyncio
import logging
import uuid

import cloudinary
import cloudinary.api
import cloudinary.exceptions
import cloudinary.uploader
import cloudinary.utils

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


def sign_upload_params(params_to_sign: dict) -> str:
    """Signs a direct-upload request (Roadmap_Scaling.md A4) — the client uploads straight
    to Cloudinary using these params plus this signature, so image bytes never pass
    through a FastAPI route. `params_to_sign` must exactly match what the client actually
    sends (Cloudinary recomputes the signature from the received params and rejects a
    mismatch), so the caller and the client must agree on the param set."""
    return cloudinary.utils.api_sign_request(params_to_sign, settings.cloudinary_api_secret)


async def get_image_resource(public_id: str) -> dict | None:
    """Fetches Cloudinary's own record of what actually got uploaded — the genuine
    server-side check a direct-upload flow needs (A4 step 5), since nothing the client
    claims about size/format can be trusted. `None` if Cloudinary has no such resource
    (the client never actually completed the upload there either)."""
    try:
        return await asyncio.to_thread(
            cloudinary.api.resource, public_id, resource_type="image"
        )
    except cloudinary.exceptions.NotFound:
        return None
    except Exception as exc:
        raise MediaUploadError("Failed to verify the uploaded image") from exc


async def delete_image(public_id: str) -> None:
    """Best-effort cleanup — never raises. A soft-deleted row (SecurityFeatures.md F-4)
    is already excluded from every read the moment `deleted_at` is set, which is the
    part that actually matters; Cloudinary asset cleanup is secondary and must never
    block or fail the delete request itself."""
    try:
        await asyncio.to_thread(cloudinary.uploader.destroy, public_id, resource_type="image")
    except Exception:
        logger.exception("Failed to delete Cloudinary asset %s", public_id)
