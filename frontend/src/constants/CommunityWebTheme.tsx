import { useMemo } from 'react';

import { COMMUNITY_DARK, COMMUNITY_LIGHT, type CommunityWebPalette } from '@/constants/webCommunityTheme';
import { useThemeMode } from '@/constants/ThemeMode';

export type CommunityThemeMode = 'light' | 'dark';

interface CommunityWebThemeContextValue {
  mode: CommunityThemeMode;
  colors: CommunityWebPalette;
  toggleMode: () => void;
}

/**
 * Reads the single app-wide light/dark mode (`useThemeMode`, provided once at the app root)
 * and maps it onto the Community palette. No longer owns mode state itself — see
 * `VaporwaveWebTheme.tsx`'s identical rationale (this and that file used to each own a completely
 * independent, separately-persisted mode, which is what let the shell and other screens disagree
 * with whatever Community had chosen). Same external shape as before, so every existing consumer
 * (`CommunitiesScreen.web.tsx`, `CommunityDetailScreen.web.tsx`, `CreateCommunityScreen.web.tsx` +
 * their `WebCommunity*` components) works unmodified.
 */
export function useCommunityWebTheme(): CommunityWebThemeContextValue {
  const { mode, toggleMode } = useThemeMode();

  return useMemo(
    () => ({
      mode,
      colors: mode === 'dark' ? COMMUNITY_DARK : COMMUNITY_LIGHT,
      toggleMode,
    }),
    [mode, toggleMode],
  );
}
