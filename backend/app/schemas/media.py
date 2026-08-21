from typing import Literal

from pydantic import BaseModel

# The server maps this to an actual Cloudinary folder (services/media.py) — the client
# picks a feature, never a raw folder path (Roadmap_Scaling.md A4 step 2).
UploadContext = Literal["memes", "templates", "avatars", "communities", "challenges"]


class UploadSignatureRequest(BaseModel):
    context: UploadContext


class UploadSignatureOut(BaseModel):
    signature: str
    timestamp: int
    api_key: str
    cloud_name: str
    folder: str
    public_id: str
    allowed_formats: str
