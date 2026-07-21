import { Platform } from 'react-native';

interface ImageFile {
  uri: string;
  name: string;
  type: string;
}

/**
 * The RN {uri,name,type} file convention only works on native — the native XHR
 * bridge special-cases objects with a `uri` key. On web, FormData.append coerces
 * any non-Blob value via String(), so the image must be fetched into a real Blob.
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
    form.append(field, { uri: image.uri, name: image.name, type: image.type } as unknown as Blob);
  }
}
