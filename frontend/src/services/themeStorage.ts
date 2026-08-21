import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export type ThemeMode = 'light' | 'dark';
// The user's actual choice: an explicit mode, or "follow the OS/browser setting live."
// `ThemeMode` (resolved) is what components render with; `ThemePreference` is what's stored.
export type ThemePreference = ThemeMode | 'system';

const THEME_MODE_KEY = 'meme_platform_theme_mode';

// Same web/native split as `tokenStorage.ts` (expo-secure-store has no web implementation).
// Not sensitive data, but reusing the codebase's one storage primitive avoids adding
// AsyncStorage as a second dependency for a single string preference.
export async function getStoredThemePreference(): Promise<ThemePreference | null> {
  const value =
    Platform.OS === 'web'
      ? typeof window === 'undefined'
        ? null
        : window.localStorage.getItem(THEME_MODE_KEY)
      : await SecureStore.getItemAsync(THEME_MODE_KEY);
  return value === 'light' || value === 'dark' || value === 'system' ? value : null;
}

export async function setStoredThemePreference(preference: ThemePreference): Promise<void> {
  if (Platform.OS === 'web') {
    window.localStorage.setItem(THEME_MODE_KEY, preference);
    return;
  }
  await SecureStore.setItemAsync(THEME_MODE_KEY, preference);
}
