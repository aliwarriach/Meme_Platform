// Shared real-upload helper: gets a signed-upload signature from the backend
// (Roadmap_Scaling.md A4), then performs the actual direct-to-Cloudinary upload with
// exactly the params the backend signed (backend/app/services/media.py::
// create_upload_signature - folder, public_id, timestamp, allowed_formats; anything
// else would invalidate the signature). A tiny embedded 1x1 PNG stands in for a real
// meme image - this is exercising the upload *path* (signature issuance, the real
// network round trip to Cloudinary, and confirm-on-the-backend), not testing image
// processing.
import http from 'k6/http';
import encoding from 'k6/encoding';
import { authHeaders } from './users.js';

const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const TINY_PNG_BYTES = encoding.b64decode(TINY_PNG_B64);

// direct from backend/app/core/config.py's setting - hardcode the known-public value
// used in every signature response rather than re-fetching it every call.
let cachedCloudName = null;

export function uploadRealImage(baseUrl, token, context) {
  const sigRes = http.post(
    `${baseUrl}/media/upload-signature`,
    JSON.stringify({ context }),
    { headers: authHeaders(token) }
  );
  if (sigRes.status !== 200) return null;
  let sig;
  try {
    sig = JSON.parse(sigRes.body);
  } catch {
    return null;
  }
  cachedCloudName = sig.cloud_name;

  const uploadRes = http.post(
    `https://api.cloudinary.com/v1_1/${sig.cloud_name}/image/upload`,
    {
      file: http.file(TINY_PNG_BYTES, 'loadtest.png', 'image/png'),
      api_key: sig.api_key,
      timestamp: String(sig.timestamp),
      signature: sig.signature,
      public_id: sig.public_id,
      folder: sig.folder,
      allowed_formats: sig.allowed_formats,
    }
  );
  if (uploadRes.status !== 200) return null;

  return sig.public_id;
}
