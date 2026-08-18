import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { Appearance } from 'react-native';

import { VOTING_DARK, VOTING_LIGHT, type VotingWebPalette } from '@/constants/webVotingTheme';

export type VotingWebThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'voting-web-theme';

interface VotingWebThemeContextValue {
  mode: VotingWebThemeMode;
  colors: VotingWebPalette;
  toggleMode: () => void;
}

const VotingWebThemeContext = createContext<VotingWebThemeContextValue | null>(null);

function readStoredMode(): VotingWebThemeMode | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'light' || stored === 'dark' ? stored : null;
}

function resolveInitialMode(): VotingWebThemeMode {
  const stored = readStoredMode();
  if (stored) return stored;
  // `Appearance.getColorScheme()` is backed by `prefers-color-scheme` under react-native-web.
  return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
}

/**
 * Self-contained light/dark mechanism scoped ONLY to the web-only Voting screen — mounted
 * locally by `VotingScreen.web.tsx` (not global; native's `app/_layout.tsx` `DarkTheme`
 * hardcoding is untouched, and this file is intentionally independent of
 * `CommunityWebTheme.tsx`/`community-web` — this pass must not couple to that tree). Resolution
 * order: `localStorage` override -> OS `prefers-color-scheme` -> `'light'` fallback.
 */
export function VotingThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<VotingWebThemeMode>(resolveInitialMode);

  const value = useMemo<VotingWebThemeContextValue>(
    () => ({
      mode,
      colors: mode === 'dark' ? VOTING_DARK : VOTING_LIGHT,
      toggleMode: () =>
        setMode((current) => {
          const next: VotingWebThemeMode = current === 'dark' ? 'light' : 'dark';
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(STORAGE_KEY, next);
          }
          return next;
        }),
    }),
    [mode]
  );

  return <VotingWebThemeContext.Provider value={value}>{children}</VotingWebThemeContext.Provider>;
}

export function useVotingWebTheme(): VotingWebThemeContextValue {
  const ctx = useContext(VotingWebThemeContext);
  if (!ctx) {
    throw new Error('useVotingWebTheme must be used within a VotingThemeProvider');
  }
  return ctx;
}
