import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { Appearance } from 'react-native';

import { VAPORWAVE_DARK, VAPORWAVE_LIGHT, type VaporwaveMode, type VaporwaveTheme } from '@/constants/webFeedThemeVapor';

const STORAGE_KEY = 'vaporwave-web-theme';

interface VaporwaveThemeContextValue extends VaporwaveTheme {
  mode: VaporwaveMode;
  toggleMode: () => void;
}

const VaporwaveThemeContext = createContext<VaporwaveThemeContextValue | null>(null);

function readStoredMode(): VaporwaveMode | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'light' || stored === 'dark' ? stored : null;
}

function resolveInitialMode(): VaporwaveMode {
  const stored = readStoredMode();
  if (stored) return stored;
  // `Appearance.getColorScheme()` is backed by `prefers-color-scheme` under react-native-web.
  return Appearance.getColorScheme() === 'light' ? 'light' : 'dark';
}

/**
 * Self-contained light/dark mechanism for the Vaporwave/Luminous glass design system — mounted
 * locally by each web screen that uses it (`features/feed/FeedScreen.web.tsx`,
 * `features/friends/FriendsScreen.web.tsx`), same pattern as the sibling
 * `constants/CommunityWebTheme.tsx`. Not global — native's `app/_layout.tsx` `DarkTheme`
 * hardcoding is untouched. Resolution order: `localStorage` override -> OS
 * `prefers-color-scheme` -> `'dark'` fallback (this system's native/default mode). Each mounting
 * screen is a separate Expo Router route (full unmount/remount on navigation), so the toggle
 * choice persisting across screens is handled by `localStorage`, not by keeping one provider
 * instance mounted app-wide.
 */
export function VaporwaveThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<VaporwaveMode>(resolveInitialMode);

  const value = useMemo<VaporwaveThemeContextValue>(() => {
    const theme = mode === 'dark' ? VAPORWAVE_DARK : VAPORWAVE_LIGHT;
    return {
      ...theme,
      mode,
      toggleMode: () =>
        setMode((current) => {
          const next: VaporwaveMode = current === 'dark' ? 'light' : 'dark';
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(STORAGE_KEY, next);
          }
          return next;
        }),
    };
  }, [mode]);

  return <VaporwaveThemeContext.Provider value={value}>{children}</VaporwaveThemeContext.Provider>;
}

/** Throws outside `VaporwaveThemeProvider` — every consumer is a private component of one of
 * this system's screens, always mounted inside that screen's provider, so a missing provider is
 * a real bug, not a valid standalone-usage case. */
export function useVaporwaveTheme(): VaporwaveThemeContextValue {
  const ctx = useContext(VaporwaveThemeContext);
  if (!ctx) {
    throw new Error('useVaporwaveTheme must be used within a VaporwaveThemeProvider');
  }
  return ctx;
}
