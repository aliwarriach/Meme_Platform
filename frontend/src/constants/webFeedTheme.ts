/**
 * Visual-identity tokens for the desktop/web-only feed redesign
 * (`features/feed/FeedScreen.web.tsx` + `components/web/Web*` siblings ONLY).
 *
 * Scope: this file is a GREENFIELD-mode pilot for a new "Dark Cinema" visual system,
 * page-scoped to `design-system/meme-platform/pages/feed-web.md` — it deliberately does
 * NOT reuse `tailwind.config.js`'s "Vivid Meme Culture" tokens (neon pink/purple/green),
 * which remain the shared system for every native screen and must stay untouched.
 * Never import this file from a native-resolved component.
 *
 * Every value below is grounded in ui-ux-pro-max skill query output (see feed-web.md's
 * "Reconciliation" section for the exact commands + convergence), not invented from memory.
 */

/** Inter, converged 2/2 across a direct `--domain typography` query and the blended
 * `--design-system` roll ("Modern Dark Cinema (Inter System)" — explicitly "dark, cinematic,
 * ... streaming platforms"). Fallback stack keeps the page legible before the web font loads. */
export const FEED_WEB_FONT_STACK = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

/** Full (non-truncated) Google Fonts URL, copied verbatim from the skill's raw query output —
 * never hand-typed, per the ASCII-box-truncation gotcha. */
export const FEED_WEB_FONT_IMPORT_URL =
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap';

const FEED_WEB_FONT_LINK_ID = 'feed-web-inter-font';

/** Injects the Inter <link> into <head> exactly once (web only, id-guarded against
 * duplicate mounts/HMR). No-op if `document` doesn't exist or the link is already present. */
export function injectFeedWebFont(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(FEED_WEB_FONT_LINK_ID)) return;

  const link = document.createElement('link');
  link.id = FEED_WEB_FONT_LINK_ID;
  link.rel = 'stylesheet';
  link.href = FEED_WEB_FONT_IMPORT_URL;
  document.head.appendChild(link);
}

/**
 * Color roles. Every hex below is copied verbatim from a returned skill row (see
 * feed-web.md for which query/row each came from) — `rgba(...)` variants are alpha-derived
 * from those same grounded hexes for glass/glow layering, per the "Liquid Glass" /
 * "Modern Dark (Cinema Mobile)" style entries' own documented translucency technique, not
 * a separately invented hue.
 */
export const FEED_WEB_COLORS = {
  // Page canvas gradient stops — grounded exactly (Primary → Background → alt-Background,
  // all literal skill values), never a flat single fill.
  gradientTop: '#1E1B4B',
  gradientMid: '#0F0F23',
  gradientBottom: '#000000',

  // Card surfaces
  surfaceGlass: 'rgba(27, 27, 48, 0.55)', // Card #1B1B30 (Music Streaming row) + alpha
  surfaceSolid: '#1B1B30',
  surfaceElevated: '#27273B', // Muted token
  surfaceHover: 'rgba(39, 39, 59, 0.85)',

  // Borders / hairlines — Border token #312E81, alpha-derived for subtlety on near-black bg
  border: 'rgba(49, 46, 129, 0.55)',
  borderSolid: '#312E81',
  borderHighlight: 'rgba(255, 255, 255, 0.06)', // top-edge glass highlight, Cinema-Mobile convention

  // Brand / structural accent (indigo)
  indigoPrimary: '#1E1B4B',
  indigoSecondary: '#4338CA',
  indigoGlow: 'rgba(67, 56, 202, 0.45)', // Secondary #4338CA + alpha, for focus/hover glow

  // Engagement accents — never the only signal (always paired with ▲/▼ icon + label per a11y rule)
  accentUpvote: '#22C55E', // "play/positive green" — matches product's positive-vote semantics
  accentDownvote: '#EF4444', // Destructive token, doubles as error red

  // Text
  foreground: '#F8FAFC',
  foregroundMuted: '#94A3B8', // identical across every converged color-domain row — highest-confidence token here
  onAccent: '#FFFFFF',

  error: '#EF4444',
} as const;

/** Type scale, weights/tracking per "Modern Dark Cinema (Inter System)"'s notes. Display/H1
 * reserved for the brand wordmark; card-level roles are sized down from that same system,
 * not a separate invented scale. */
export const FEED_WEB_TYPE = {
  display: { fontFamily: FEED_WEB_FONT_STACK, fontWeight: '700' as const, fontSize: 28, letterSpacing: -0.8 },
  h2: { fontFamily: FEED_WEB_FONT_STACK, fontWeight: '600' as const, fontSize: 18, letterSpacing: -0.3 },
  title: { fontFamily: FEED_WEB_FONT_STACK, fontWeight: '600' as const, fontSize: 15 },
  body: { fontFamily: FEED_WEB_FONT_STACK, fontWeight: '400' as const, fontSize: 15, lineHeight: 21 },
  meta: { fontFamily: FEED_WEB_FONT_STACK, fontWeight: '400' as const, fontSize: 12.5 },
  label: {
    fontFamily: FEED_WEB_FONT_STACK,
    fontWeight: '500' as const,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
  },
  voteScore: { fontFamily: FEED_WEB_FONT_STACK, fontWeight: '700' as const, fontSize: 14 },
} as const;

export const FEED_WEB_RADIUS = {
  card: 20,
  chip: 14,
  pill: 999,
} as const;

export const FEED_WEB_SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;
