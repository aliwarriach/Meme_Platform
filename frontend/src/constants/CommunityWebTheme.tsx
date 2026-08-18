import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { Appearance } from 'react-native';

import { COMMUNITY_DARK, COMMUNITY_LIGHT, type CommunityWebPalette } from '@/constants/webCommunityTheme';

export type CommunityWebThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'community-web-theme';

interface CommunityWebThemeContextValue {
  mode: CommunityWebThemeMode;
  colors: CommunityWebPalette;
  toggleMode: () => void;
}

const CommunityWebThemeContext = createContext<CommunityWebThemeContextValue | null>(null);

function readStoredMode(): CommunityWebThemeMode | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'light' || stored === 'dark' ? stored : null;
}

function resolveInitialMode(): CommunityWebThemeMode {
  const stored = readStoredMode();
  if (stored) return stored;
  // `Appearance.getColorScheme()` is backed by `prefers-color-scheme` under react-native-web.
  return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
}

/**
 * Self-contained light/dark mechanism scoped ONLY to the web-only Communities tree — mounted
 * locally by each of the three `*.web.tsx` screens (not global, per this task's explicit
 * instruction; native's `app/_layout.tsx` `DarkTheme` hardcoding is untouched). Resolution
 * order: `localStorage` override -> OS `prefers-color-scheme` -> `'light'` fallback. Each of the
 * three screens is a separate Expo Router route (full unmount/remount on navigation), so
 * persistence across screens is handled by `localStorage`, not by keeping this provider mounted
 * app-wide.
 */
export function CommunityThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<CommunityWebThemeMode>(resolveInitialMode);

  const value = useMemo<CommunityWebThemeContextValue>(
    () => ({
      mode,
      colors: mode === 'dark' ? COMMUNITY_DARK : COMMUNITY_LIGHT,
      toggleMode: () =>
        setMode((current) => {
          const next: CommunityWebThemeMode = current === 'dark' ? 'light' : 'dark';
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(STORAGE_KEY, next);
          }
          return next;
        }),
    }),
    [mode]
  );

  return <CommunityWebThemeContext.Provider value={value}>{children}</CommunityWebThemeContext.Provider>;
}

export function useCommunityWebTheme(): CommunityWebThemeContextValue {
  const ctx = useContext(CommunityWebThemeContext);
  if (!ctx) {
    throw new Error('useCommunityWebTheme must be used within a CommunityThemeProvider');
  }
  return ctx;
}
