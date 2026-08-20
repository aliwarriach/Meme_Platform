import { useMemo } from 'react';

import { useWebThemeMode } from '@/constants/WebThemeMode';
import { VAPORWAVE_DARK, VAPORWAVE_LIGHT, type VaporwaveMode, type VaporwaveTheme } from '@/constants/webFeedThemeVapor';

interface VaporwaveThemeHookValue extends VaporwaveTheme {
  mode: VaporwaveMode;
  toggleMode: () => void;
}

/**
 * Reads the single app-wide light/dark mode (`useWebThemeMode`, provided once at the app root in
 * `app/_layout.tsx`) and maps it onto the Vaporwave/Luminous "Neon Plum" color/type/radius/
 * spacing objects. No longer owns mode state itself — every Vaporwave-consuming screen used to
 * mount its own `VaporwaveThemeProvider` instance (separately persisted, synced only on next
 * mount), which is what let the shell and individual screens disagree about which mode was
 * active. Same external shape (`{colors, type, radius, spacing, mode, toggleMode, fontStack}`) as
 * before, so every existing consumer works unmodified.
 */
export function useVaporwaveTheme(): VaporwaveThemeHookValue {
  const { mode, toggleMode } = useWebThemeMode();

  return useMemo(() => {
    const theme = mode === 'dark' ? VAPORWAVE_DARK : VAPORWAVE_LIGHT;
    return { ...theme, mode, toggleMode };
  }, [mode, toggleMode]);
}
