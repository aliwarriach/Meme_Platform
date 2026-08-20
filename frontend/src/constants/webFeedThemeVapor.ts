/**
 * Visual-identity tokens for the Vaporwave/Luminous glass design system's light/dark toggle.
 * Used by `features/feed/FeedScreen.web.tsx` and `features/friends/FriendsScreen.web.tsx` (each
 * mounts its own `constants/VaporwaveWebTheme.tsx` provider instance — see that file), plus their
 * private `Web*` component trees. Not used by any other web screen (Community/Compete/Voting/
 * Profile each have their own independent design system + provider).
 *
 * DARK = Stitch design system "Vaporwave Glass Evolution" (project "Meme Platform Visual
 * Systems", asset `assets/a823e27d762549abaf73aa346bf5c9c8`, colorMode: DARK). Hyper-Glassmorphism:
 * nocturnal navy-black base, electric cyan + sunset pink accents, 24px card radius, full-pill
 * buttons, Quicksand type. UNCHANGED — untouched by this pass, per explicit instruction.
 *
 * LIGHT = "Luminous Vapor Glass" (same project, asset
 * `assets/fe569c6963d54888845fbc4916b79b79`, colorMode: LIGHT natively). Replaces the previous
 * "Radical Meme Narrative" import — this one is the same Vaporwave-glass family as dark (byte-
 * identical Quicksand typography block, same cyan/pink accent lineage), purpose-built for a light
 * canvas rather than a stylistically unrelated system. "Frosted Porcelain": crisp cool-white
 * background, 75-90% opacity white glass panels with iridescent 1px inner-glow edges, cyan
 * (`#00dbe9`) + pink (`#ff71ce`/`#fd6fcc`) accents. Every hex/rgba below is copied verbatim from
 * that asset's `namedColors`/`designMd`.
 *
 * SCOPE: sibling to `webFeedTheme.ts` (the shipped "Dark Cinema" indigo system, NOT touched).
 * Only files that import this module (via `useVaporwaveTheme()`) are touched: FeedScreen.web.tsx
 * + WebFeedTopBar/WebFeedRail/WebMergedFeedList/WebMemeCard/WebVotePill/WebAvatar/WebContainerCard,
 * and FriendsScreen.web.tsx + WebFriendsTopBar/WebFriendRow/WebFriendRequestRow.
 * `WebCommunityFeedCard` (Community Detail web screen) keeps importing `webFeedTheme.ts` — do not
 * repoint it. Never import this file from a native-resolved component.
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

/** Color roles — DARK ("Vaporwave Glass Evolution"). UNCHANGED. */
export const VAPOR_COLORS_DARK = {
  gradientTop: '#12121f', // colors.surface / colors.background
  gradientMid: '#1a1a28', // colors.surface-container-low
  gradientBottom: '#0d0d1a', // colors.surface-container-lowest

  surfaceGlass: 'rgba(255, 255, 255, 0.1)',
  surfaceSolid: '#1e1e2c', // colors.surface-container
  surfaceElevated: '#292937', // colors.surface-container-high
  surfaceHover: 'rgba(41, 41, 55, 0.85)',

  border: 'rgba(255, 255, 255, 0.15)', // colors.inner-glow, verbatim
  borderSolid: '#3b494b', // colors.outline-variant
  borderHighlight: 'rgba(255, 255, 255, 0.2)',
  hoverTint: 'rgba(255, 255, 255, 0.06)',

  indigoPrimary: '#00f0ff', // theme.overridePrimaryColor
  indigoSecondary: '#8c016b', // colors.secondary-container
  indigoGlow: 'rgba(0, 240, 255, 0.45)',

  accentUpvote: '#22C55E',
  accentDownvote: '#EF4444',

  foreground: '#e3e0f3', // colors.on-background
  foregroundMuted: '#b9cacb', // colors.on-surface-variant
  onAccent: '#FFFFFF',

  error: '#ffb4ab', // colors.error
} as const;

/**
 * Color roles — LIGHT ("Luminous Vapor Glass", colorMode: LIGHT natively). Mapped onto the same
 * role names `VAPOR_COLORS_DARK` uses so every consuming component works unmodified.
 */
export const LUMINOUS_COLORS_LIGHT = {
  // "Frosted Porcelain... crisp, cool-toned white (#f8f9ff) foundation" — literal surface tokens,
  // no dramatic gradient (this system is airy/flat, not a corner mesh-gradient like dark's).
  gradientTop: '#f8f9ff', // colors.surface / colors.background
  gradientMid: '#f2f3f9', // colors.surface-container-low
  gradientBottom: '#ffffff', // colors.surface-container-lowest

  // "Frosted Porcelain Surfaces: white fill at 70-80% opacity + backdrop-filter: blur(25px)" —
  // literal `glass-porcelain` token.
  surfaceGlass: 'rgba(255, 255, 255, 0.75)',
  surfaceSolid: '#ffffff', // colors.surface-container-lowest
  surfaceElevated: 'rgba(255, 255, 255, 0.9)', // colors.glass-edge, verbatim ("Level 2" panels)
  surfaceHover: 'rgba(242, 243, 249, 0.9)', // surface-container-low + alpha

  // Borders — the system's own `inner-glow` (rgba(255,255,255,1.0)) is a top/left highlight, not
  // a visible border on a near-white canvas, so the actual dividing edge uses the literal
  // `outline-variant` token instead; `inner-glow` is reserved for `borderHighlight` below, its
  // real documented role ("inset 1px box shadow on top/left edges to simulate light catching glass").
  border: '#bac9cb', // colors.outline-variant
  borderSolid: '#6b7a7b', // colors.outline
  borderHighlight: 'rgba(255, 255, 255, 1.0)', // colors.inner-glow, verbatim
  hoverTint: 'rgba(0, 219, 233, 0.08)', // overridePrimaryColor + low alpha

  // Brand accent — this system's own primary/secondary (cyan-teal `#00dbe9`, distinct from but
  // harmonious with dark's pure electric cyan `#00f0ff` — each mode uses its own system's literal
  // accent, not a forced match).
  indigoPrimary: '#00dbe9', // theme.overridePrimaryColor
  // colors.secondary ('#a72683'), not secondary-container ('#fd6fcc') — the container tone is
  // paired with dark text per this system's own M3 roles (on-secondary-container: '#700056'), too
  // light for the white icon/text every consumer here overlays on this fill.
  indigoSecondary: '#a72683',
  indigoGlow: 'rgba(0, 219, 233, 0.4)',

  // Engagement accents — cross-app vote semantics, unchanged (not a brand-identity token).
  accentUpvote: '#22C55E',
  accentDownvote: '#EF4444',

  // Text — "use slightly darker text colors for body copy and labels" (verbatim), literal tokens.
  foreground: '#191c20', // colors.on-background / colors.on-surface
  foregroundMuted: '#3b494b', // colors.on-surface-variant
  onAccent: '#FFFFFF',

  error: '#ba1a1a', // colors.error — this system's own literal light-mode error token
} as const;

/** Type scale — DARK, unchanged. */
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

/**
 * Type scale — LIGHT ("Luminous Vapor Glass"). Its `typography` block is BYTE-IDENTICAL to
 * "Vaporwave Glass Evolution"'s (same family, same sizes/weights/line-heights/tracking down to
 * the px) — both systems share the same evolution lineage — so this is the same role-mapping as
 * `VAPOR_TYPE_DARK`, not a coincidence or a copy-paste shortcut.
 */
export const LUMINOUS_TYPE_LIGHT = VAPOR_TYPE_DARK;

/** Shapes — DARK: 24px card / 16px media / full pill. Unchanged. */
export const VAPOR_RADIUS_DARK = {
  card: 24,
  chip: 16,
  pill: 999,
} as const;

/** Shapes — LIGHT: "Standard Cards: 16px (rounded-lg) for standard feed items... Main
 * Containers/Modals: 24px (rounded-xl)... In-Set Media: 16px... Interactive UI: full pill-shape"
 * (verbatim) — this system explicitly calls out feed cards as the smaller 16px tier, distinct
 * from dark's 24px "global standard," so this is a deliberate, literal difference, not rounding. */
export const LUMINOUS_RADIUS_LIGHT = {
  card: 16,
  chip: 16,
  pill: 999,
} as const;

// Spacing shared across both modes — layout rhythm, not identity, and numerically compatible with
// both systems' own base-unit tokens (both: 8px base, 24px gutter).
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
