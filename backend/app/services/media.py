import time
import uuid

from fastapi import UploadFile

from app.core.config import settings
from app.core.exceptions import (
    EmptyUploadError,
    MediaTooLargeError,
    MediaUploadFailedError,
    UnsupportedMediaTypeError,
    UploadSignatureNotFoundError,
    UploadSignatureOwnerMismatchError,
)
from app.core.redis import get_arq_pool
from app.integrations.cloudinary_client import (
    MediaUploadError,
    delete_image,
    get_image_resource,
    sign_upload_params,
    upload_image,
)
from app.schemas.media import UploadContext, UploadSignatureOut

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
ALLOWED_IMAGE_FORMATS = {"jpg", "jpeg", "png", "webp", "gif"}
MAX_IMAGE_BYTES = 10 * 1024 * 1024

# Comma-separated, in the format Cloudinary's upload API expects for a signed
# `allowed_formats` param — genuinely enforced by Cloudinary at upload time.
_ALLOWED_FORMATS_PARAM = ",".join(sorted(ALLOWED_IMAGE_FORMATS))

# The server picks the real Cloudinary folder from a closed set of feature names — never
# a client-supplied path (Roadmap_Scaling.md A4 step 2).
_UPLOAD_FOLDERS: dict[str, str] = {
    "memes": "memes",
    "templates": "templates",
    "avatars": "avatars",
    "communities": "communities",
    "challenges": "challenges",
}

MEDIA_PENDING_KEY_PREFIX = "media:pending:"
MEDIA_PENDING_TTL_SECONDS = 15 * 60


async def validate_and_upload_image(image: UploadFile, folder: str) -> tuple[str, str]:
    """Shared image-upload gate for any feature accepting user image uploads
    (memes, templates, ...) — content-type/size validation, then Cloudinary upload.

    Proxies bytes through this process — kept only for the upload paths
    Roadmap_Scaling.md A4 hasn't migrated yet (templates, community icon/banner,
    challenges, avatars); `POST /memes` uses `create_upload_signature` +
    `confirm_pending_upload` below instead. Delete this once every caller has moved.
    """
    if image.content_type not in ALLOWED_IMAGE_TYPES:
        raise UnsupportedMediaTypeError(f"Unsupported image type: {image.content_type}")

    file_bytes = await image.read()
    if not file_bytes:
        raise EmptyUploadError("Uploaded image is empty")
    if len(file_bytes) > MAX_IMAGE_BYTES:
        raise MediaTooLargeError("Image exceeds the 10MB upload limit")

    try:
        return await upload_image(file_bytes, folder=folder)
    except MediaUploadError as exc:
        raise MediaUploadFailedError(str(exc)) from exc


async def delete_uploaded_image(public_id: str) -> None:
    """Best-effort Cloudinary cleanup, called after a meme/template/etc. is soft-deleted
    (SecurityFeatures.md F-4) — never raises, see `integrations/cloudinary_client.py`."""
    await delete_image(public_id)


async def create_upload_signature(user_id: uuid.UUID, context: UploadContext) -> UploadSignatureOut:
    """Roadmap_Scaling.md A4 — signs a direct-to-Cloudinary upload so image bytes never
    pass through this process. **The server chooses `public_id` and `folder`, never the
    client** — a naive direct-upload flow would otherwise let a client claim any
    arbitrary URL as their image (this phase's whole reason to exist). Records the
    issued id in Redis so `confirm_pending_upload` can verify it was genuinely issued to
    this user, and that it's only ever confirmed once.
    """
    folder = _UPLOAD_FOLDERS[context]
    public_id = str(uuid.uuid4())
    timestamp = int(time.time())

    params_to_sign = {
        "folder": folder,
        "public_id": public_id,
        "timestamp": timestamp,
        "allowed_formats": _ALLOWED_FORMATS_PARAM,
    }
    signature = sign_upload_params(params_to_sign)

    # `folder` rides along with `user_id` in the stored value — `confirm_pending_upload`
    # needs it to reconstruct Cloudinary's *real* identifier for this asset (see there).
    redis = await get_arq_pool()
    await redis.set(
        f"{MEDIA_PENDING_KEY_PREFIX}{public_id}",
        f"{user_id}:{folder}",
        ex=MEDIA_PENDING_TTL_SECONDS,
    )

    return UploadSignatureOut(
        signature=signature,
        timestamp=timestamp,
        api_key=settings.cloudinary_api_key,
        cloud_name=settings.cloudinary_cloud_name,
        folder=folder,
        public_id=public_id,
        allowed_formats=_ALLOWED_FORMATS_PARAM,
    )


async def confirm_pending_upload(user_id: uuid.UUID, public_id: str) -> tuple[str, str]:
    """Verifies a client-claimed `public_id` was genuinely issued to `user_id` — never
    trusts a client-supplied URL/size/format directly (the security trap this phase
    exists around) — then does a real server-side check against Cloudinary's own record
    of what actually got uploaded. Returns `(secure_url, public_id)`.

    `GETDEL` makes every signature single-use: a second confirm with the same
    `public_id` always finds nothing and 400s, same as one that was never issued.

    **2026-08-27 fix**: Cloudinary prefixes `folder` onto an asset's real identifier at
    upload time (verified live against the real account — uploading with
    `folder="x", public_id="y"` produces an asset only resolvable as `"x/y"`, never bare
    `"y"`) — the bare `public_id` this function used to look up and return was never
    actually resolvable, so every confirm here failed with "No image was actually
    uploaded for this signature" even on a fully successful upload. Every A4 caller
    (personal/community memes, challenge submissions, templates, avatars, community
    icon/banner) shares this one function, so the fix lives here only.
    """
    redis = await get_arq_pool()
    raw_owner = await redis.getdel(f"{MEDIA_PENDING_KEY_PREFIX}{public_id}")
    if raw_owner is None:
        raise UploadSignatureNotFoundError("Upload signature not found or expired")

    owner_str = raw_owner.decode() if isinstance(raw_owner, bytes) else raw_owner
    owner_id_str, _, folder = owner_str.partition(":")
    if owner_id_str != str(user_id):
        raise UploadSignatureOwnerMismatchError("This upload was not issued to you")

    resource = await get_image_resource(f"{folder}/{public_id}")
    if resource is None:
        raise UploadSignatureNotFoundError("No image was actually uploaded for this signature")

    if resource.get("bytes", 0) > MAX_IMAGE_BYTES:
        await delete_image(resource["public_id"])
        raise MediaTooLargeError("Image exceeds the 10MB upload limit")
    if resource.get("format") not in ALLOWED_IMAGE_FORMATS:
        await delete_image(resource["public_id"])
        raise UnsupportedMediaTypeError(f"Unsupported image format: {resource.get('format')}")

    return resource["secure_url"], resource["public_id"]
