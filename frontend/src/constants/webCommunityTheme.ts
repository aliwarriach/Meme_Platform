/**
 * Visual-identity tokens for the desktop/web-only Communities section
 * (`CommunitiesScreen.web.tsx`, `CommunityDetailScreen.web.tsx`, `CreateCommunityScreen.web.tsx`
 * + their `components/web/WebCommunity*`/`WebMemberCard`/`WebJoinRequestCard`/`WebPillButton`/
 * `WebTextField`/`WebSegmentedControl` siblings ONLY).
 *
 * Colors recolored onto "Neon Plum" (see `webFeedThemeVapor.ts`'s header) — the same six-hue
 * pink/purple/gold/cyan system every other web screen uses, so this is no longer an independent
 * palette, just an independent *structure* (own key names, own Fredoka/Nunito typography, own
 * light/dark provider). See each palette's own comment below for the value-copy mapping.
 * Never import this file from a native-resolved component.
 */

/** Fredoka (headings) / Nunito (body) — converged 2/2 across a direct `--domain typography`
 * query ("Playful Creative" pairing) and the blended `--design-system` roll. Fallback stack
 * keeps the page legible before the web fonts load. */
export const COMMUNITY_WEB_HEADING_FONT_STACK = "'Fredoka', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
export const COMMUNITY_WEB_BODY_FONT_STACK = "'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

/** Full (non-truncated) Google Fonts URL, copied verbatim from the skill's raw query output —
 * never hand-typed, per the ASCII-box-truncation gotcha. */
export const COMMUNITY_WEB_FONT_IMPORT_URL =
  'https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Nunito:wght@300;400;500;600;700&display=swap';

const COMMUNITY_WEB_FONT_LINK_ID = 'community-web-fredoka-nunito-font';

/** Injects the Fredoka+Nunito <link> into <head> exactly once (web only, id-guarded against
 * duplicate mounts/HMR). No-op if `document` doesn't exist or the link is already present. */
export function injectCommunityWebFont(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(COMMUNITY_WEB_FONT_LINK_ID)) return;

  const link = document.createElement('link');
  link.id = COMMUNITY_WEB_FONT_LINK_ID;
  link.rel = 'stylesheet';
  link.href = COMMUNITY_WEB_FONT_IMPORT_URL;
  document.head.appendChild(link);
}

/** react-native-web extends Pressable's style-callback state with `hovered`/`focused` at
 * runtime, but core `react-native`'s `PressableStateCallbackType` type only declares `pressed`
 * — annotate web-only Pressable style callbacks with this type instead of relying on inference. */
export interface WebPressableState {
  pressed: boolean;
  hovered?: boolean;
  focused?: boolean;
}

export interface CommunityWebPalette {
  background: string;
  card: string;
  cardForeground: string;
  elevated: string;
  elevatedHover: string;
  border: string;
  primary: string;
  onPrimary: string;
  secondary: string;
  onSecondary: string;
  accent: string;
  onAccent: string;
  /** Share/send-action hue — same role `accentCyan` plays in the Vaporwave/Neon Plum system
   * (`WebMemeCard`'s send/share icons, `WebFeedTopBar`'s Instagram-link icon). */
  shareAccent: string;
  foreground: string;
  foregroundMuted: string;
  destructive: string;
  onDestructive: string;
  ring: string;
}

/**
 * Light palette — recolored onto "Neon Plum" (see `webFeedThemeVapor.ts`), the same six-hue
 * system every other web screen uses, so Communities no longer runs a fourth independent
 * palette. Every value below is the literal hex Neon Plum uses for the equivalent role (`primary`
 * = `indigoSecondary`, `secondary` = `accentPurple`, `accent` = `success`, `ring` =
 * `indigoPrimary`) — not a new derivation, a value copy, so a change to one system's brand colors
 * doesn't silently drift the other out of sync. Structure/key names and the Fredoka/Nunito
 * typography are unchanged; this is a color-only pass.
 *
 * Fixed a real pre-existing bug while in here: the old `accent` (`#16A34A`, "join green") measured
 * only 3.30:1 against its own `onAccent` white — fails WCAG AA, despite this file's prior comment
 * claiming 5.42:1 (that number was fill-vs-background contrast, not fill-vs-text). `success`
 * (`#15803D`) replaces it, verified 5.01:1+.
 */
export const COMMUNITY_LIGHT: CommunityWebPalette = {
  background: '#FFF7FB',
  card: '#FFFFFF',
  cardForeground: '#2A1220',
  elevated: '#FFF0F7',
  elevatedHover: 'rgba(255, 240, 247, 0.9)',
  border: '#F3D9E7',
  primary: '#BE185D',
  onPrimary: '#FFFFFF',
  secondary: '#6D28D9',
  onSecondary: '#FFFFFF',
  accent: '#15803D',
  onAccent: '#FFFFFF',
  shareAccent: '#155E75',
  foreground: '#2A1220',
  foregroundMuted: '#6B4A5C',
  destructive: '#DC2626',
  onDestructive: '#FFFFFF',
  ring: '#EC4899',
};

/** Dark palette — same Neon Plum value-copy approach as light, mapped onto this file's own
 * `background`/`card`/`elevated` roles instead of Vaporwave's `gradient*`/`surface*` names. */
export const COMMUNITY_DARK: CommunityWebPalette = {
  background: '#1A0E1B',
  card: '#241328',
  cardForeground: '#FDF2F8',
  elevated: '#2E1930',
  elevatedHover: 'rgba(255, 214, 236, 0.12)',
  border: 'rgba(255, 255, 255, 0.10)',
  primary: '#DB2777',
  onPrimary: '#FFFFFF',
  secondary: '#7C3AED',
  onSecondary: '#FFFFFF',
  accent: '#15803D',
  onAccent: '#FFFFFF',
  shareAccent: '#0E7490',
  foreground: '#FDF2F8',
  foregroundMuted: '#C9A9BA',
  destructive: '#DC2626',
  onDestructive: '#FFFFFF',
  ring: '#FF5CA0',
};

export const COMMUNITY_WEB_RADIUS = {
  card: 18,
  chip: 14,
  pill: 999,
} as const;

export const COMMUNITY_WEB_SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  section: 40,
} as const;

/** Type scale — Fredoka for display/heading roles, Nunito for everything else, per the
 * "Playful Creative" pairing's own dual-font intent (rounded display face + a legible workhorse
 * body face), scaled down from that reference's landing-page sizes for card/list density. */
export const COMMUNITY_WEB_TYPE = {
  display: { fontFamily: COMMUNITY_WEB_HEADING_FONT_STACK, fontWeight: '700' as const, fontSize: 30, letterSpacing: -0.4 },
  h2: { fontFamily: COMMUNITY_WEB_HEADING_FONT_STACK, fontWeight: '600' as const, fontSize: 20 },
  cardTitle: { fontFamily: COMMUNITY_WEB_HEADING_FONT_STACK, fontWeight: '600' as const, fontSize: 16 },
  title: { fontFamily: COMMUNITY_WEB_BODY_FONT_STACK, fontWeight: '700' as const, fontSize: 15 },
  body: { fontFamily: COMMUNITY_WEB_BODY_FONT_STACK, fontWeight: '400' as const, fontSize: 15, lineHeight: 21 },
  meta: { fontFamily: COMMUNITY_WEB_BODY_FONT_STACK, fontWeight: '500' as const, fontSize: 12.5 },
  label: {
    fontFamily: COMMUNITY_WEB_BODY_FONT_STACK,
    fontWeight: '700' as const,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },
} as const;
