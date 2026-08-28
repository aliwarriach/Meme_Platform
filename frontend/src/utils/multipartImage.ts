import { File } from 'expo-file-system';
import { Platform } from 'react-native';

interface ImageFile {
  uri: string;
  name: string;
  type: string;
}

/**
 * 2026-08-27: the old RN {uri,name,type} convention (still documented in React Native's own
 * FormData.js as "the body part is a blob, which in React Native just means an object with a
 * `uri` attribute") is NOT what actually handles requests at runtime here — Expo SDK 52+
 * replaces global `fetch`/`FormData` with its own WinterCG implementation
 * (`expo/src/winter/fetch/convertFormData.ts`), and that converter only accepts a string, a
 * real `Blob`, or an object exposing `.bytes()` (its own docstring says outright: "`uri` is not
 * supported for React Native's FormData"). A plain `{uri,name,type}` object matches none of
 * those, so every multipart POST — meme/community posts, challenge submissions, template
 * uploads, avatar/community icon/banner — threw "Unsupported FormDataPart implementation" the
 * instant it hit that check. `expo-file-system`'s `File` class is the one built for this case:
 * it exposes `.bytes()`, which `convertFormDataAsync` explicitly special-cases (see its
 * `'bytes' in entry` branch, guarded by a `@ts-expect-error` noting "File or ExpoBlob don't
 * extend Blob but implement the interface"). Note `File` has no `.type` getter, so the
 * per-part Content-Type header is omitted on native — harmless here since Cloudinary verifies
 * the actual format server-side from the uploaded bytes regardless (see services/media.py).
 */
export async function appendImageToFormData(
  form: FormData,
  field: string,
  image: ImageFile
): Promise<void> {
  if (Platform.OS === 'web') {
    const fileResponse = await fetch(image.uri);
    const blob = await fileResponse.blob();
    form.append(field, blob, image.name);
  } else {
    form.append(field, new File(image.uri) as unknown as Blob, image.name);
  }
}
