import { api, throwApiError } from '@/services/api';
import { appendImageToFormData } from '@/utils/multipartImage';

// Mirrors the backend's UploadContext (app/schemas/media.py) — the server maps this to
// an actual Cloudinary folder; the client never picks a raw folder path.
export type UploadContext = 'memes' | 'templates' | 'avatars' | 'communities' | 'challenges';

interface UploadSignatureResponse {
  signature: string;
  timestamp: number;
  api_key: string;
  cloud_name: string;
  folder: string;
  public_id: string;
  allowed_formats: string;
}

function requestUploadSignatureRequest(context: UploadContext) {
  return api.post<UploadSignatureResponse>('/media/upload-signature', { context });
}

export interface ImageFile {
  uri: string;
  name: string;
  type: string;
}

/**
 * Roadmap_Scaling.md A4 — uploads an image straight to Cloudinary using a server-issued,
 * single-use signature, so image bytes never pass through this app's own backend.
 * Returns the confirmed `public_id`; the creating endpoint (`POST /memes`,
 * `POST /templates`, etc.) verifies and consumes it server-side via its own
 * `image_public_id`/`icon_public_id`/`avatar_public_id` field.
 */
export async function uploadImageDirect(image: ImageFile, context: UploadContext): Promise<string> {
  const sigResponse = await requestUploadSignatureRequest(context);
  if (!sigResponse.ok || !sigResponse.data) {
    throwApiError(sigResponse, 'request upload signature');
  }
  const sig = sigResponse.data;

  const form = new FormData();
  await appendImageToFormData(form, 'file', image);
  form.append('api_key', sig.api_key);
  form.append('timestamp', String(sig.timestamp));
  form.append('signature', sig.signature);
  form.append('public_id', sig.public_id);
  form.append('folder', sig.folder);
  form.append('allowed_formats', sig.allowed_formats);

  // Direct to Cloudinary, not through `api` — this call has no auth header and isn't
  // pointed at our own backend at all, which is the entire point of this phase.
  const response = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloud_name}/image/upload`, {
    method: 'POST',
    body: form,
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Image upload failed (${response.status}). ${body}`);
  }

  return sig.public_id;
}
