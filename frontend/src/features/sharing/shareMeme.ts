import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export class ShareUnavailableError extends Error {}
export class ShareDownloadError extends Error {}

/** Downloads a meme's remote image to a local cache file, then opens the native
 * OS share sheet (WhatsApp/Instagram/X/etc. resolve as targets automatically — the
 * app never hardcodes a target list, per Project_Requirements.md §12). The cache file
 * is a fresh temp copy each time; the OS/`expo-file-system` cache dir is periodically
 * cleared by the system, so no manual cleanup is needed here.
 */
export async function shareMemeImage(imageUrl: string, memeId: string): Promise<void> {
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new ShareUnavailableError('Sharing is not available on this device.');
  }

  const extension = imageUrl.split('.').pop()?.split('?')[0] || 'png';
  const destination = new File(Paths.cache, `meme-${memeId}.${extension}`);

  let localFile: File;
  try {
    localFile = await File.downloadFileAsync(imageUrl, destination);
  } catch {
    throw new ShareDownloadError('Could not download the meme to share.');
  }

  await Sharing.shareAsync(localFile.uri, { mimeType: 'image/*' });
}
