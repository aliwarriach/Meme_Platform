import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export type ThemeMode = 'light' | 'dark';

const THEME_MODE_KEY = 'meme_platform_theme_mode';

// Same web/native split as `tokenStorage.ts` (expo-secure-store has no web implementation).
// Not sensitive data, but reusing the codebase's one storage primitive avoids adding
// AsyncStorage as a second dependency for a single string preference.
export async function getStoredThemeMode(): Promise<ThemeMode | null> {
  const value =
    Platform.OS === 'web'
      ? typeof window === 'undefined'
        ? null
        : window.localStorage.getItem(THEME_MODE_KEY)
      : await SecureStore.getItemAsync(THEME_MODE_KEY);
  return value === 'light' || value === 'dark' ? value : null;
}

export async function setStoredThemeMode(mode: ThemeMode): Promise<void> {
  if (Platform.OS === 'web') {
    window.localStorage.setItem(THEME_MODE_KEY, mode);
    return;
  }
  await SecureStore.setItemAsync(THEME_MODE_KEY, mode);
}
