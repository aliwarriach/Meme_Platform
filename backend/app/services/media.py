from fastapi import UploadFile

from app.core.exceptions import (
    EmptyUploadError,
    MediaTooLargeError,
    MediaUploadFailedError,
    UnsupportedMediaTypeError,
)
from app.integrations.cloudinary_client import MediaUploadError, upload_image

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_IMAGE_BYTES = 10 * 1024 * 1024


async def validate_and_upload_image(image: UploadFile, folder: str) -> tuple[str, str]:
    """Shared image-upload gate for any feature accepting user image uploads
    (memes, templates, ...) — content-type/size validation, then Cloudinary upload.
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
