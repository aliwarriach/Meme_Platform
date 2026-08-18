import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { Appearance } from 'react-native';

import { PROFILE_DARK, PROFILE_LIGHT, type ProfileWebPalette } from '@/constants/webProfileTheme';

export type ProfileWebThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'profile-web-theme';

interface ProfileWebThemeContextValue {
  mode: ProfileWebThemeMode;
  colors: ProfileWebPalette;
  toggleMode: () => void;
}

const ProfileWebThemeContext = createContext<ProfileWebThemeContextValue | null>(null);

function readStoredMode(): ProfileWebThemeMode | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'light' || stored === 'dark' ? stored : null;
}

function resolveInitialMode(): ProfileWebThemeMode {
  const stored = readStoredMode();
  if (stored) return stored;
  // `Appearance.getColorScheme()` is backed by `prefers-color-scheme` under react-native-web.
  return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
}

/**
 * Self-contained light/dark mechanism scoped ONLY to the web-only Profile/Session screen —
 * mounted locally by `SessionScreen.web.tsx` (not global; native's `app/_layout.tsx` `DarkTheme`
 * hardcoding is untouched, and this file is intentionally independent of `VotingWebTheme.tsx`/
 * `CompeteWebTheme.tsx`/`CommunityWebTheme.tsx` — this pass must not couple to those trees, even
 * though the palette values themselves are intentionally identical to voting-web's). Resolution
 * order: `localStorage` override -> OS `prefers-color-scheme` -> `'light'` fallback — same
 * pattern as every prior web pass.
 */
export function ProfileThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ProfileWebThemeMode>(resolveInitialMode);

  const value = useMemo<ProfileWebThemeContextValue>(
    () => ({
      mode,
      colors: mode === 'dark' ? PROFILE_DARK : PROFILE_LIGHT,
      toggleMode: () =>
        setMode((current) => {
          const next: ProfileWebThemeMode = current === 'dark' ? 'light' : 'dark';
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(STORAGE_KEY, next);
          }
          return next;
        }),
    }),
    [mode]
  );

  return <ProfileWebThemeContext.Provider value={value}>{children}</ProfileWebThemeContext.Provider>;
}

export function useProfileWebTheme(): ProfileWebThemeContextValue {
  const ctx = useContext(ProfileWebThemeContext);
  if (!ctx) {
    throw new Error('useProfileWebTheme must be used within a ProfileThemeProvider');
  }
  return ctx;
}
