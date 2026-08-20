/**
 * Visual-identity tokens for the "Neon Plum" design system's light/dark toggle — this is the
 * canonical source of the palette for the ENTIRE web app, not just this file's own direct
 * consumers. Directly used by 13 screens via `useVaporwaveTheme()`: Feed, Voting, Compete (+5
 * challenge sub-screens), Profile, Friends, Leaderboards, Inbox, Thread. The desktop shell
 * (`DesktopShell.tsx`/`DesktopSidebarNav.tsx`) and the narrow-web branch of `FloatingBottomNav`
 * hardcode matching literal values (can't consume this file directly — the shell mounts outside
 * any screen's provider). Community screens (`webCommunityTheme.ts`/`CommunityWebTheme.tsx`) keep
 * their own key structure and Fredoka/Nunito typography, but their color VALUES are a literal
 * copy of this file's roles — see that file's own header. One palette, several structures.
 *
 * Not covered: the meme Creator/Editor (`new-post.web.tsx` → `CreatorScreen`), which renders
 * identically on web and native via shared NativeWind classes bound to `tailwind.config.js`'s
 * native "Vivid Meme Culture" tokens. Recoloring it would mean either forking a new web-only
 * creator screen (a screen-construction project, not a color pass) or editing
 * `tailwind.config.js`'s actual values, which would recolor the native mobile app too — out of
 * bounds for a web-only overhaul without that being an explicit, separate decision.
 *
 * Palette direction: sourced from the ui-ux-pro-max design database's "Meme & Sticker Maker"
 * product-type entry (viral pink + comedy amber + share blue) and "Vibrant & Block-based" style
 * entry (4-6 contrasting colors, complementary/triadic — youth/social-app default), reconciled
 * with this project's own shipped native identity in `design-system/meme-platform/MASTER.md`
 * (`#ff3385` neon pink primary). Pink leads in both modes; purple, gold, amber, and cyan round out
 * the system, each with one real semantic job (see each token's own comment below) instead of one
 * color doing five unrelated things.
 *
 * Every fill/text pairing below is contrast-verified against WCAG 2.1 (4.5:1 normal text minimum,
 * 3:1 non-text minimum) — see inline notes on any non-obvious pairing.
 */

export const FEED_WEB_FONT_IMPORT_URL =
  'https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&display=swap';

const FEED_WEB_FONT_LINK_ID = 'feed-web-vapor-quicksand-font';

/** Injects the Quicksand <link> into <head> exactly once (web only, id-guarded against
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

const QUICKSAND_STACK = "'Quicksand', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

/** Color roles — DARK ("Neon Plum"). Plum-black canvas (replaces navy) so glass panels have
 * warm-toned light to refract instead of sitting on a neutral ground. */
export const VAPOR_COLORS_DARK = {
  gradientTop: '#231327',
  gradientMid: '#1A0E1B',
  gradientBottom: '#120A11',

  surfaceGlass: 'rgba(255, 214, 236, 0.07)',
  surfaceSolid: '#241328',
  surfaceElevated: '#2E1930',
  surfaceHover: 'rgba(255, 214, 236, 0.12)',

  border: 'rgba(255, 255, 255, 0.10)',
  borderSolid: '#4A2C42',
  borderHighlight: 'rgba(255, 255, 255, 0.22)',
  hoverTint: 'rgba(255, 214, 236, 0.08)',

  // Primary — bright pink. Text/icon/ring-safe on the dark canvas (~11:1); NOT a safe white-text
  // fill (same asymmetry the old cyan system had, now with pink).
  indigoPrimary: '#FF5CA0',
  // Primary — fill. Solid badges/tabs/buttons + onAccent white text: 4.60:1, clears AA.
  indigoSecondary: '#DB2777',
  indigoGlow: 'rgba(255, 61, 138, 0.45)',

  // Secondary accent (purple). Bright variant only — every consumer this pass uses it as text/
  // border-on-dark, not a white-text fill (a deeper fill-safe purple wasn't needed; add one if a
  // future consumer needs a solid purple badge). 6.62:1 vs the dark canvas.
  accentPurple: '#C084FC',
  // Tertiary accent (gold) — achievement/celebration only (rank #1, winner chips). Fill-safe with
  // dark ink text only — 8.73:1 vs `onAccentInk`, ~2.6:1 vs `onAccent` white (fails).
  accentGold: '#F59E0B',
  // Warning/in-progress/pending — a distinct hue from `accentGold` on purpose: gold means "you
  // won something," amber means "this needs attention/is still moving." They used to be the same
  // hex doing five unrelated jobs. Fill-safe with dark ink text only — 5.27:1 vs `onAccentInk`,
  // ~3.56:1 vs `onAccent` white (fails AA text, same rule as gold).
  accentAmber: '#EA580C',
  // Quaternary accent (cyan) — share/send actions + info states. Fill-safe with white text: 5.36:1.
  accentCyan: '#0E7490',
  // Success/positive — distinct from `accentUpvote` (that's the vote-arrow's bright text color,
  // not fill-safe). White-text fill: 5.01:1.
  success: '#15803D',

  // Rank-tier fills (leaderboards/standings, ranks 2 and 3 — rank 1 uses `accentGold`).
  rankSilver: '#CBD5E1',
  rankBronze: '#B45309',
  // Dark ink for text on gold/silver fills, which fail against white.
  onAccentInk: '#1A0E18',

  // Rank-tier hover washes (rows 1-3 in standings/leaderboards) — tints of the same
  // gold/silver/bronze fill so hovering a medal row reads as "this rank's own color," not the
  // generic `surfaceHover` every other row gets. Alpha kept deliberately high (0.30+) — an
  // earlier, subtler pass (0.16-0.20) read as barely-there against the glass card, this is the
  // "make it prominent" revision.
  rankGoldHover: 'rgba(245, 158, 11, 0.34)',
  rankSilverHover: 'rgba(203, 213, 225, 0.32)',
  rankBronzeHover: 'rgba(180, 83, 9, 0.38)',

  // Avatar-fallback hash set — one flat fill replaced with five, keyed by username hash.
  avatarPalette: ['#DB2777', '#7C3AED', '#0E7490', '#B45309', '#15803D'] as const,

  accentUpvote: '#4ADE80',
  accentDownvote: '#FF8080',

  foreground: '#FDF2F8',
  foregroundMuted: '#C9A9BA',
  onAccent: '#FFFFFF',

  // #16A34A (the obvious "success green") measures only 3.30:1 vs white — fails AA. Every green
  // fill in this system uses the deeper #15803D instead (see `success`/`accentUpvote` above).
  error: '#FF9B9B',
} as const;

/** Color roles — LIGHT ("Neon Plum", light canvas). Same hue family as dark, values chosen for
 * contrast on white rather than inverted 1:1 — mirrors the old system's own light/dark asymmetry
 * (e.g. `indigoPrimary`/`indigoSecondary` swap roles by mode), now applied to the new palette. */
export const LUMINOUS_COLORS_LIGHT = {
  gradientTop: '#FFFFFF',
  gradientMid: '#FFF7FB',
  gradientBottom: '#FDF3F8',

  surfaceGlass: 'rgba(255, 255, 255, 0.78)',
  surfaceSolid: '#FFFFFF',
  surfaceElevated: '#FFF0F7',
  surfaceHover: 'rgba(255, 240, 247, 0.9)',

  border: '#F3D9E7',
  borderSolid: '#C98FB0',
  borderHighlight: 'rgba(255, 255, 255, 1.0)',
  hoverTint: 'rgba(219, 39, 119, 0.07)',

  // Primary — bright pink. Ring/icon-only role now (never a white-text fill after the
  // `WebFriendRequestRow` fix), so this no longer needs to collapse onto `indigoSecondary`'s
  // value: ~3.53:1 vs white, clears the 3:1 non-text minimum a ring/icon needs, and stays
  // visually distinct from the deeper fill pink instead of the two flattening into one shade.
  indigoPrimary: '#EC4899',
  // Primary — fill. Solid badges/tabs/buttons + onAccent white text: 6.03:1, clears AA.
  indigoSecondary: '#BE185D',
  indigoGlow: 'rgba(190, 24, 93, 0.35)',

  // #6D28D9: 7.10:1 as a white-text fill, ~7:1 as text-on-white — safe in both roles, unlike
  // dark mode's split (light's darker starting point covers both uses with one value).
  accentPurple: '#6D28D9',
  accentGold: '#F59E0B',
  // See dark mode's `accentAmber` note — same distinct-from-gold reasoning. 5.27:1 vs
  // `onAccentInk`.
  accentAmber: '#EA580C',
  accentCyan: '#155E75',
  success: '#15803D',

  rankSilver: '#94A3B8',
  rankBronze: '#92400E',
  onAccentInk: '#1A0E18',

  rankGoldHover: 'rgba(245, 158, 11, 0.30)',
  rankSilverHover: 'rgba(148, 163, 184, 0.32)',
  rankBronzeHover: 'rgba(146, 64, 14, 0.28)',

  avatarPalette: ['#BE185D', '#6D28D9', '#155E75', '#92400E', '#15803D'] as const,

  accentUpvote: '#15803D',
  accentDownvote: '#DC2626',

  foreground: '#2A1220',
  foregroundMuted: '#6B4A5C',
  onAccent: '#FFFFFF',

  error: '#BA1A1A',
} as const;

/** Type scale — DARK. Unchanged by the color overhaul. */
export const VAPOR_TYPE_DARK = {
  display: { fontFamily: QUICKSAND_STACK, fontWeight: '700' as const, fontSize: 26, letterSpacing: -0.5 },
  h2: { fontFamily: QUICKSAND_STACK, fontWeight: '600' as const, fontSize: 20, lineHeight: 28 },
  title: { fontFamily: QUICKSAND_STACK, fontWeight: '600' as const, fontSize: 15 },
  body: { fontFamily: QUICKSAND_STACK, fontWeight: '500' as const, fontSize: 15, lineHeight: 22 },
  meta: { fontFamily: QUICKSAND_STACK, fontWeight: '500' as const, fontSize: 12.5 },
  label: {
    fontFamily: QUICKSAND_STACK,
    fontWeight: '600' as const,
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  voteScore: { fontFamily: QUICKSAND_STACK, fontWeight: '600' as const, fontSize: 14, letterSpacing: 0.6 },
} as const;

/** Type scale — LIGHT. Byte-identical to dark's (same family/sizes/weights), unchanged. */
export const LUMINOUS_TYPE_LIGHT = VAPOR_TYPE_DARK;

/** Shapes — DARK. Unchanged by the color overhaul. */
export const VAPOR_RADIUS_DARK = {
  card: 24,
  chip: 16,
  pill: 999,
} as const;

/** Shapes — LIGHT. Unchanged by the color overhaul. */
export const LUMINOUS_RADIUS_LIGHT = {
  card: 16,
  chip: 16,
  pill: 999,
} as const;

// Spacing shared across both modes — layout rhythm, not identity.
export const FEED_WEB_SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export type VaporwaveMode = 'dark' | 'light';

export interface VaporwaveTheme {
  colors: typeof VAPOR_COLORS_DARK | typeof LUMINOUS_COLORS_LIGHT;
  type: typeof VAPOR_TYPE_DARK | typeof LUMINOUS_TYPE_LIGHT;
  radius: typeof VAPOR_RADIUS_DARK | typeof LUMINOUS_RADIUS_LIGHT;
  spacing: typeof FEED_WEB_SPACING;
  /** Base font stack for ad hoc text (e.g. avatar-fallback initials) that isn't one of the named
   * `type` roles above. Both modes use Quicksand — same family, both systems' own doc. */
  fontStack: string;
}

export const VAPORWAVE_DARK: VaporwaveTheme = {
  colors: VAPOR_COLORS_DARK,
  type: VAPOR_TYPE_DARK,
  radius: VAPOR_RADIUS_DARK,
  spacing: FEED_WEB_SPACING,
  fontStack: QUICKSAND_STACK,
};

export const VAPORWAVE_LIGHT: VaporwaveTheme = {
  colors: LUMINOUS_COLORS_LIGHT,
  type: LUMINOUS_TYPE_LIGHT,
  radius: LUMINOUS_RADIUS_LIGHT,
  spacing: FEED_WEB_SPACING,
  fontStack: QUICKSAND_STACK,
};
