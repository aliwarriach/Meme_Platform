import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance, View } from 'react-native';
import { vars } from 'nativewind';

import { CSS_VARS_DARK, CSS_VARS_LIGHT } from '@/constants/cssThemeVars';
import {
  getStoredThemePreference,
  setStoredThemePreference,
  type ThemeMode as ResolvedThemeMode,
  type ThemePreference,
} from '@/services/themeStorage';

export type ThemeMode = ResolvedThemeMode;
export type { ThemePreference };

interface ThemeModeContextValue {
  /** Resolved mode components actually render with — never `'system'`. */
  mode: ThemeMode;
  /** The user's actual choice, including `'system'`. Drives the 3-way picker UI. */
  preference: ThemePreference;
  setPreference: (next: ThemePreference) => void;
  /** Flips the resolved mode to its explicit opposite — for the simple binary toggle buttons in
   * web's top bars. Never lands on `'system'`; use `setPreference('system')` for that. */
  toggleMode: () => void;
  /** Re-reads the OS's current appearance. Only call this from a genuine "reload" moment (the
   * main feed's mount, its pull-to-refresh) — see the no-live-tracking note below for why this
   * isn't automatic. */
  refreshSystemScheme: () => void;
  isHydrated: boolean;
}

const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

function resolveMode(preference: ThemePreference, systemScheme: ThemeMode): ThemeMode {
  return preference === 'system' ? systemScheme : preference;
}

/**
 * Single app-wide light/dark/system mode — the one source of truth for both platforms, mounted
 * once at the app root in `app/_layout.tsx`.
 *
 * This replaces two things that used to exist separately and drift: the old `WebThemeModeProvider`
 * (web-only, explicit-but-non-live-system Context) and `store/themeSlice.ts` (Redux, drove
 * NativeWind's `colorScheme.set()`/`Appearance.setColorScheme()` on native). The Redux path was
 * removed outright rather than fixed in place: `react-native-css-interop`'s native runtime (the
 * engine NativeWind v4 runs on) hard-wires its dark/light CSS-variable resolution to the OS's real
 * `Appearance` setting — the "manual override" observable it falls back to
 * (`colorSchemeObservable` in its `appearance-observables.ts`) is only ever actually *set* inside
 * `process.env.NODE_ENV === "test"`, never in a real dev/production build. So `colorScheme.set()`
 * on native was never capable of reliably making the in-app toggle win over the phone's system
 * setting, no matter how it was called — a real, reported symptom ("toggling dark mode in-app does
 * nothing until the phone's own theme changes").
 *
 * The fix: stop asking NativeWind to resolve light/dark from `Appearance` at all. Every
 * `bg-bg`/`text-ink`/`bg-surface-*`/etc. Tailwind className across the whole app resolves its
 * `--color-*` custom properties from whatever is nearest in the component tree — normally that's
 * `global.css`'s static `:root`/`.dark` blocks, but `vars()` (NativeWind's own supported API for
 * this) lets a component override those variables for its entire subtree via a plain style prop,
 * independent of `Appearance`/`colorScheme` entirely. Wrapping the whole app in one `vars(...)`
 * View here, fed by *this* provider's own resolved `mode`, makes every existing className usage —
 * native and web alike — correctly follow the in-app choice, with zero JSX changes needed anywhere
 * else in the app. `constants/cssThemeVars.ts` holds the actual light/dark values, hand-synced with
 * `global.css` (same value set, so web keeps rendering pixel-identical colors to what it always did
 * — this wrapper is additive on web, not a replacement of the `:root`/`.dark` CSS that already
 * renders correctly there).
 *
 * `useVaporwaveTheme()`/`useCommunityWebTheme()` and any `NEON_PLUM_DARK`/`NEON_PLUM_LIGHT`
 * consumer (native color props NativeWind classNames can't reach — `ActivityIndicator`,
 * `MaterialIcons`, etc.) read `mode` from this same provider, so every color anywhere in the app —
 * Tailwind className, `vars()`-driven, or a hand-picked hex constant — traces back to this one
 * value.
 */
export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [systemScheme, setSystemScheme] = useState<ThemeMode>(
    Appearance.getColorScheme() === 'light' ? 'light' : 'dark'
  );
  const [isHydrated, setIsHydrated] = useState(false);

  // Load the persisted preference once at startup — same splash-screen-gated hydration timing
  // `store/themeSlice.ts` used to provide via its `isThemeHydrated` flag.
  useEffect(() => {
    let cancelled = false;
    getStoredThemePreference().then((stored) => {
      if (cancelled) return;
      if (stored) setPreferenceState(stored);
      setIsHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Deliberately *not* a live `Appearance.addChangeListener` subscription — explicit product
  // decision: if the OS flips light/dark while the app is already open (a sunset/sunrise
  // automation firing mid-session), the app should keep rendering whatever it already resolved
  // until the next genuine "reload" moment, not flicker the whole UI live. `refreshSystemScheme`
  // below is that reload hook — wired to the main feed's mount + pull-to-refresh.
  const refreshSystemScheme = () => {
    setSystemScheme(Appearance.getColorScheme() === 'light' ? 'light' : 'dark');
  };

  const mode = resolveMode(preference, systemScheme);

  const setPreference = (next: ThemePreference) => {
    // Freshen immediately when the user explicitly picks "System" — otherwise switching to it
    // could show a stale scheme from whenever the app last refreshed, which would look like the
    // toggle itself did nothing.
    if (next === 'system') refreshSystemScheme();
    setPreferenceState(next);
    setStoredThemePreference(next);
  };

  const toggleMode = () => setPreference(mode === 'dark' ? 'light' : 'dark');

  const value = useMemo<ThemeModeContextValue>(
    () => ({ mode, preference, setPreference, toggleMode, refreshSystemScheme, isHydrated }),
    [mode, preference, isHydrated]
  );

  const cssVars = mode === 'dark' ? CSS_VARS_DARK : CSS_VARS_LIGHT;

  return (
    <ThemeModeContext.Provider value={value}>
      <View style={[{ flex: 1 }, vars(cssVars)]}>{children}</View>
    </ThemeModeContext.Provider>
  );
}

/** Throws outside `ThemeModeProvider` — it's always mounted at the app root, so a missing
 * provider is a real bug, not a valid standalone-usage case. */
export function useThemeMode(): ThemeModeContextValue {
  const ctx = useContext(ThemeModeContext);
  if (!ctx) {
    throw new Error('useThemeMode must be used within a ThemeModeProvider');
  }
  return ctx;
}
