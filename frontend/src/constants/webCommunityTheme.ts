/**
 * Visual-identity tokens for the desktop/web-only Communities section redesign
 * (`CommunitiesScreen.web.tsx`, `CommunityDetailScreen.web.tsx`, `CreateCommunityScreen.web.tsx`
 * + their `components/web/WebCommunity*`/`WebMemberCard`/`WebJoinRequestCard`/`WebPillButton`/
 * `WebTextField`/`WebSegmentedControl` siblings ONLY).
 *
 * Scope: GREENFIELD-mode pilot for a new "Vibrant & Block-based" visual system, page-scoped to
 * `design-system/meme-platform/pages/community-web.md` — it deliberately does NOT reuse
 * `tailwind.config.js`'s "Vivid Meme Culture" tokens (neon pink/purple/green, dark-only), nor
 * `webFeedTheme.ts`'s "Dark Cinema" tokens (indigo, dark-only) — both remain the systems for
 * their own trees, untouched. This is a third, independent system with full light + dark support.
 * Never import this file from a native-resolved component.
 *
 * Every value below is grounded in ui-ux-pro-max skill query output (see community-web.md's
 * "Reconciliation" section for the exact commands + convergence), not invented from memory.
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
  foreground: string;
  foregroundMuted: string;
  destructive: string;
  onDestructive: string;
  ring: string;
}

/**
 * Light palette — "Membership/Community" product-type row, returned as an EXACT identical match
 * in 3 of 4 `--domain color` queries plus the cross-check `--design-system` roll (4/4 total
 * convergence, the highest-confidence token set in this file). See community-web.md.
 */
export const COMMUNITY_LIGHT: CommunityWebPalette = {
  background: '#FAF5FF',
  card: '#FFFFFF',
  cardForeground: '#4C1D95',
  elevated: '#ECEEF9', // Muted token, exact
  elevatedHover: 'rgba(124, 58, 237, 0.06)', // primary-tinted hover overlay, alpha-derived
  border: '#DDD6FE',
  primary: '#7C3AED',
  onPrimary: '#FFFFFF',
  secondary: '#A78BFA',
  onSecondary: '#0F172A',
  accent: '#16A34A', // "join green" — WCAG-adjusted per the row's own note
  onAccent: '#FFFFFF',
  foreground: '#4C1D95',
  foregroundMuted: '#64748B',
  destructive: '#DC2626',
  onDestructive: '#FFFFFF',
  ring: '#7C3AED',
};

/**
 * Dark palette — derived from three dark-background rows (Sleep Tracker, Photo Editor & Filters,
 * Card & Board Game) that share the same exact Primary #7C3AED as the light row above, or an
 * identical surface trio (#94A3B8 muted-foreground + rgba(255,255,255,0.08) border recurred in
 * EVERY dark row across both dark-phrased queries). Accent is deliberately kept identical to
 * light mode (#16A34A) — verified 5.42:1 contrast against this background, see community-web.md.
 */
export const COMMUNITY_DARK: CommunityWebPalette = {
  background: '#0F172A',
  card: '#192134', // Photo Editor & Filters / Sleep Tracker dark row, exact
  cardForeground: '#FFFFFF',
  elevated: '#171939', // Muted token, exact (Photo Editor & Filters row)
  elevatedHover: 'rgba(255, 255, 255, 0.04)',
  border: 'rgba(255, 255, 255, 0.08)', // identical across every converged dark row
  primary: '#7C3AED', // exact match to light-mode primary across rows
  onPrimary: '#FFFFFF',
  secondary: '#6366F1', // recurred 3x in dark rows sharing #7C3AED as primary
  onSecondary: '#FFFFFF',
  accent: '#16A34A', // kept cross-mode for a consistent "active/joined" status hue
  onAccent: '#FFFFFF',
  foreground: '#FFFFFF',
  foregroundMuted: '#94A3B8', // identical across every converged dark row — highest confidence
  destructive: '#DC2626', // consistent across every row, light and dark
  onDestructive: '#FFFFFF',
  ring: '#7C3AED',
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
