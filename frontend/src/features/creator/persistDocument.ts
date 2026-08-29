import type { MemeDocument } from '@/features/creator/document';
import { uploadImageDirectWithUrl } from '@/services/media';

// A document's `baseImageUri`/image-layer `uri` can be either a stable remote URL (a
// template picked from the library, or an image already resolved by a previous save) or a
// local device URI (gallery pick, `file://`/`content://`/`ph://`) that only this device, at
// this moment, can read. Publishing/editing must never store the latter as "the document" —
// re-opening it later (even on the same device, once the OS clears its picker cache) would
// have nothing to decode. `http(s)` is the one scheme this app ever produces for a remote
// asset, so it's the only one treated as already-stable.
function isRemoteUri(uri: string): boolean {
  return /^https?:\/\//i.test(uri);
}

/**
 * Uploads every local-device image referenced by the document (the base image, plus any
 * "+ Image" layers) to Cloudinary and returns an equivalent document with those URIs
 * rewritten to their stable `secure_url`s. Remote URIs (templates, or a document that's
 * already been through this once) are left untouched — no redundant re-upload.
 *
 * Called once, right before publish/save, on the exact document that produced the flattened
 * export — this is what makes a later edit able to rehydrate the real layers instead of only
 * ever having the flattened PNG to work from.
 */
export async function resolveDocumentForPersistence(doc: MemeDocument): Promise<MemeDocument> {
  const baseImageUri =
    doc.baseImageUri && !isRemoteUri(doc.baseImageUri)
      ? (await uploadImageDirectWithUrl({ uri: doc.baseImageUri, name: 'base.jpg', type: 'image/jpeg' }, 'memes'))
          .secureUrl
      : doc.baseImageUri;

  const layers = await Promise.all(
    doc.layers.map(async (layer) => {
      if (layer.kind !== 'image' || isRemoteUri(layer.uri)) return layer;
      const { secureUrl } = await uploadImageDirectWithUrl(
        { uri: layer.uri, name: 'layer.jpg', type: 'image/jpeg' },
        'memes'
      );
      return { ...layer, uri: secureUrl };
    })
  );

  return { ...doc, baseImageUri, layers };
}
