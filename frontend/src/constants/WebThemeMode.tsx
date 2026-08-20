import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { Appearance } from 'react-native';

export type WebThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'web-theme-mode';

interface WebThemeModeContextValue {
  mode: WebThemeMode;
  toggleMode: () => void;
}

const WebThemeModeContext = createContext<WebThemeModeContextValue | null>(null);

function readStoredMode(): WebThemeMode | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'light' || stored === 'dark' ? stored : null;
}

function resolveInitialMode(): WebThemeMode {
  const stored = readStoredMode();
  if (stored) return stored;
  // `Appearance.getColorScheme()` is backed by `prefers-color-scheme` under react-native-web.
  return Appearance.getColorScheme() === 'light' ? 'light' : 'dark';
}

/**
 * Single global light/dark mode for the entire web app. Mounted once in `app/_layout.tsx`,
 * wrapping `DesktopShell` — so the shell (sidebar, content-column divider, the space between
 * them) and every screen (Vaporwave via `useVaporwaveTheme()`, Community via
 * `useCommunityWebTheme()`) all read the exact same mode and update together, instantly, when
 * either toggle is pressed anywhere in the app.
 *
 * Replaces the prior per-screen-mounted `VaporwaveThemeProvider`/`CommunityThemeProvider`
 * pattern, where each of ~16 screens owned its own independent mode state (synced only
 * eventually, via localStorage, on next mount) and the shell had no mode awareness at all —
 * toggling light mode on one screen never touched the sidebar, and simultaneously-mounted shell +
 * screen could show mismatched modes. One provider, one source of truth now.
 *
 * Inert on native: nothing native reads `useWebThemeMode()`, and `Appearance`/`localStorage` are
 * both safe to touch there (guarded/no-op), so mounting this unconditionally at the app root
 * costs nothing on the mobile app.
 */
export function WebThemeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<WebThemeMode>(resolveInitialMode);

  const value = useMemo<WebThemeModeContextValue>(
    () => ({
      mode,
      toggleMode: () =>
        setMode((current) => {
          const next: WebThemeMode = current === 'dark' ? 'light' : 'dark';
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(STORAGE_KEY, next);
          }
          return next;
        }),
    }),
    [mode],
  );

  return <WebThemeModeContext.Provider value={value}>{children}</WebThemeModeContext.Provider>;
}

/** Throws outside `WebThemeModeProvider` — every consumer (shell components, `useVaporwaveTheme`,
 * `useCommunityWebTheme`) is always mounted inside the app-root provider, so a missing provider is
 * a real bug, not a valid standalone-usage case. */
export function useWebThemeMode(): WebThemeModeContextValue {
  const ctx = useContext(WebThemeModeContext);
  if (!ctx) {
    throw new Error('useWebThemeMode must be used within a WebThemeModeProvider');
  }
  return ctx;
}
