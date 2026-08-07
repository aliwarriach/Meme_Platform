import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Small persisted boolean flags (e.g. "has the user dismissed this explainer") — not
// sensitive, so SecureStore isn't required for its security guarantees, but reusing it
// (and its web/native split, same as `tokenStorage.ts`) avoids adding a new storage
// dependency for a couple of one-bit values.
function keyFor(flag: string): string {
  return `meme_platform_flag_${flag}`;
}

export async function getFlag(flag: string): Promise<boolean> {
  const key = keyFor(flag);
  const value =
    Platform.OS === 'web'
      ? typeof window === 'undefined'
        ? null
        : window.localStorage.getItem(key)
      : await SecureStore.getItemAsync(key);
  return value === 'true';
}

export async function setFlag(flag: string, value: boolean): Promise<void> {
  const key = keyFor(flag);
  if (Platform.OS === 'web') {
    window.localStorage.setItem(key, String(value));
    return;
  }
  await SecureStore.setItemAsync(key, String(value));
}
