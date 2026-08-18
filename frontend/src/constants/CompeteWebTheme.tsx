import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { Appearance } from 'react-native';

import { COMPETE_DARK, COMPETE_LIGHT, type CompeteWebPalette } from '@/constants/webCompeteTheme';

export type CompeteWebThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'compete-web-theme';

interface CompeteWebThemeContextValue {
  mode: CompeteWebThemeMode;
  colors: CompeteWebPalette;
  toggleMode: () => void;
}

const CompeteWebThemeContext = createContext<CompeteWebThemeContextValue | null>(null);

function readStoredMode(): CompeteWebThemeMode | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'light' || stored === 'dark' ? stored : null;
}

function resolveInitialMode(): CompeteWebThemeMode {
  const stored = readStoredMode();
  if (stored) return stored;
  // `Appearance.getColorScheme()` is backed by `prefers-color-scheme` under react-native-web.
  return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
}

/**
 * Self-contained light/dark mechanism scoped ONLY to the web-only Compete/Challenges screens —
 * mounted independently by each of the six `*.web.tsx` screens (not global; native's
 * `app/_layout.tsx` `DarkTheme` hardcoding is untouched, and this file is intentionally
 * independent of `VotingWebTheme.tsx`/`CommunityWebTheme.tsx` — this pass must not couple to
 * those trees). Resolution order: `localStorage` override -> OS `prefers-color-scheme` ->
 * `'light'` fallback.
 */
export function CompeteThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<CompeteWebThemeMode>(resolveInitialMode);

  const value = useMemo<CompeteWebThemeContextValue>(
    () => ({
      mode,
      colors: mode === 'dark' ? COMPETE_DARK : COMPETE_LIGHT,
      toggleMode: () =>
        setMode((current) => {
          const next: CompeteWebThemeMode = current === 'dark' ? 'light' : 'dark';
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(STORAGE_KEY, next);
          }
          return next;
        }),
    }),
    [mode]
  );

  return <CompeteWebThemeContext.Provider value={value}>{children}</CompeteWebThemeContext.Provider>;
}

export function useCompeteWebTheme(): CompeteWebThemeContextValue {
  const ctx = useContext(CompeteWebThemeContext);
  if (!ctx) {
    throw new Error('useCompeteWebTheme must be used within a CompeteThemeProvider');
  }
  return ctx;
}
