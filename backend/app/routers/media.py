from fastapi import APIRouter, Request

from app.core.deps import CurrentUser
from app.core.rate_limit import limiter
from app.schemas.media import UploadSignatureOut, UploadSignatureRequest
from app.services import media as media_service

router = APIRouter(prefix="/media", tags=["media"])


@router.post("/upload-signature", response_model=UploadSignatureOut)
@limiter.limit("30/minute")
async def create_upload_signature(
    request: Request, data: UploadSignatureRequest, current_user: CurrentUser
) -> UploadSignatureOut:
    """Roadmap_Scaling.md A4 — signs a direct-to-Cloudinary upload. The client uploads
    straight to Cloudinary with these params, then posts the returned `public_id` back
    to the creating endpoint (e.g. `POST /memes`) to confirm it."""
    return await media_service.create_upload_signature(current_user.id, data.context)
