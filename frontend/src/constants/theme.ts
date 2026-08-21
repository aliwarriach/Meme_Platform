/**
 * Mode-aware hex values for native color props that can't take a NativeWind className
 * (e.g. `ActivityIndicator`'s `color`, `TextInput`'s `placeholderTextColor`, `MaterialIcons`'s
 * `color`, `shadowColor`). These must mirror the matching CSS variable in `src/global.css` (and
 * `constants/cssThemeVars.ts`) — keep in sync by hand, there is no build-time link between them.
 *
 * Get the active palette via the one app-wide `useThemeMode()` (`constants/ThemeMode.tsx`), not
 * NativeWind's own `useColorScheme()` — that one always tracks the OS's real appearance on
 * native, never this app's own light/dark/system choice:
 *   const { mode } = useThemeMode();
 *   const c = mode === 'dark' ? NEON_PLUM_DARK : NEON_PLUM_LIGHT;
 *   <MaterialIcons color={c.inkMuted} />
 */

export const NEON_PLUM_DARK = {
  ink: '#FDF2F8',
  inkMuted: '#C9A9BA',
  heading: '#FDF2F8',
  primary: '#FF5CA0',
  primaryContainer: '#DB2777',
  primaryDim: '#FF5CA0',
  onPrimary: '#1A0E18',
  outline: '#4A2C42',
  outlineVariant: 'rgba(255, 255, 255, 0.10)',
  error: '#FF9B9B',
  white: '#FFFFFF',
  accentGold: '#F59E0B',
  accentAmber: '#EA580C',
  accentCyan: '#0E7490',
  accentUpvote: '#4ADE80',
  accentDownvote: '#FF8080',
  onAccentInk: '#1A0E18',
  rankGold: '#F59E0B',
  rankSilver: '#CBD5E1',
  rankBronze: '#B45309',
  primaryGlow: 'rgba(255, 61, 138, 0.45)',
} as const;

export const NEON_PLUM_LIGHT = {
  ink: '#2A1220',
  inkMuted: '#6B4A5C',
  heading: '#2A1220',
  primary: '#EC4899',
  primaryContainer: '#BE185D',
  primaryDim: '#BE185D',
  onPrimary: '#1A0E18',
  outline: '#C98FB0',
  outlineVariant: '#F3D9E7',
  error: '#BA1A1A',
  white: '#FFFFFF',
  accentGold: '#F59E0B',
  accentAmber: '#EA580C',
  accentCyan: '#155E75',
  accentUpvote: '#15803D',
  accentDownvote: '#DC2626',
  onAccentInk: '#1A0E18',
  rankGold: '#F59E0B',
  rankSilver: '#94A3B8',
  rankBronze: '#92400E',
  primaryGlow: 'rgba(190, 24, 93, 0.35)',
} as const;

export type NeonPlumPalette = typeof NEON_PLUM_DARK;
