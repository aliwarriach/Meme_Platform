/**
 * Visual-identity tokens for the desktop/web-only Compete/Challenges RESKIN
 * (`features/challenges/*.web.tsx` + their `components/web/WebCompete*`/`WebChallenge*`/
 * `WebCountdownTimer`/`WebSubmission*`/`WebSideMemberPicker`/`WebResultBanner` siblings ONLY).
 *
 * Scope: RESKIN-mode pass, page-scoped to `design-system/meme-platform/pages/compete-web.md` —
 * it deliberately does NOT reuse `tailwind.config.js`'s "Vivid Meme Culture" tokens (native,
 * untouched), `webFeedTheme.ts`'s "Dark Cinema" indigo tokens, `webCommunityTheme.ts`'s
 * "Vibrant & Block-based" violet tokens, or `webVotingTheme.ts`'s "OLED"/"Gen Z Brutal"
 * rose-crimson+gold tokens — all three remain the systems for their own trees, untouched. This
 * is a fifth, independent system with full light + dark support.
 *
 * COLOR-DIRECTION CORRECTION (see this task's brief): the prior three web passes landed on
 * violet/indigo (rejected) or rose-crimson+gold (approved, but not to be reused here — this page
 * needs its own distinct identity). This pass deliberately steered toward a citrus orange+lime
 * pairing fitting this app's humorous, playful team-battle tone. Final primary hue is burnt-orange
 * `#F97316` (both modes) + lime-green accent `#22C55E` (both modes) — zero violet, zero indigo,
 * zero reuse of voting's crimson/gold.
 *
 * Every value below is grounded in ui-ux-pro-max skill query output (see compete-web.md's
 * "Reconciliation" section for the exact commands + convergence), not invented from memory.
 * Never import this file from a native-resolved component.
 */

/** Lexend Mega (display/headings, loud brutalist labels) / Public Sans (body, readable at
 * in-app density) — "Neubrutalist Bold" pairing, the only pairing in this dataset whose own name
 * IS the style category itself ("bold, neubrutalist, loud, strong, geometric, quirky"),
 * confirmed against the Neubrutalism style convergence. Public Sans (not a second heavy-only
 * face) was chosen for body text specifically for in-app readability at list/form density. */
export const COMPETE_WEB_HEADING_FONT_STACK =
  "'Lexend Mega', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
export const COMPETE_WEB_BODY_FONT_STACK =
  "'Public Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

/** Full (non-truncated) Google Fonts URL, copied verbatim from the skill's raw query output —
 * never hand-typed, per the ASCII-box-truncation gotcha. */
export const COMPETE_WEB_FONT_IMPORT_URL =
  'https://fonts.googleapis.com/css2?family=Lexend+Mega:wght@100..900&family=Public+Sans:wght@100..900&display=swap';

const COMPETE_WEB_FONT_LINK_ID = 'compete-web-lexendmega-publicsans-font';

/** Injects the Lexend Mega + Public Sans <link> into <head> exactly once (web only, id-guarded
 * against duplicate mounts/HMR). No-op if `document` doesn't exist or the link is already
 * present. */
export function injectCompeteWebFont(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(COMPETE_WEB_FONT_LINK_ID)) return;

  const link = document.createElement('link');
  link.id = COMPETE_WEB_FONT_LINK_ID;
  link.rel = 'stylesheet';
  link.href = COMPETE_WEB_FONT_IMPORT_URL;
  document.head.appendChild(link);
}

/** react-native-web extends Pressable's style-callback state with `hovered`/`focused` at
 * runtime, but core `react-native`'s `PressableStateCallbackType` type only declares `pressed`
 * — annotate web-only Pressable style callbacks with this type instead of relying on inference.
 * (Defined independently here rather than imported from another page's theme file — this tree
 * must not couple to any other web tree per this task's explicit scope boundary.) */
export interface WebPressableState {
  pressed: boolean;
  hovered?: boolean;
  focused?: boolean;
}

export interface CompeteWebPalette {
  background: string;
  card: string;
  cardForeground: string;
  /** Citrus-cream (light) / warm-slate (dark) tint — chip/badge wash ONLY. Never paired with
   * `foregroundMuted`/`primaryText`/`accentText`/`destructiveText` (see contrast audit in
   * compete-web.md) — those measured under 4.5:1 AA against this specific tint in at least one
   * mode. Only safe with `cardForeground` (full-contrast ink) or icons. */
  elevated: string;
  elevatedHover: string;
  /** Everyday 1px hairline — list rows, inputs, member-picker rows. */
  border: string;
  /** Signature 2px solid brutalist border — emphasis surfaces ONLY (primary CTA, win banner,
   * countdown/status cluster, "Active" challenge cards). See Shape signature note in
   * compete-web.md for why energy is deliberately concentrated here and kept off meme/submission
   * thumbnails. */
  outline: string;
  primary: string;
  onPrimary: string;
  /** Brand-hue text color for use ON `card`/`background` — distinct from `primary` because the
   * raw fill hue does not clear 4.5:1 as body/label text (measured 2.80:1 light / 4.27:1 dark,
   * both under AA — see compete-web.md's Accessibility section). */
  primaryText: string;
  accent: string;
  onAccent: string;
  /** Citrus-lime text color for use ON `card`/`background`. Raw `accent` fails as light-mode text
   * (2.28:1) but passes in dark mode (5.25:1) — this value differs by mode for that reason (see
   * palette notes below). */
  accentText: string;
  foreground: string;
  foregroundMuted: string;
  destructive: string;
  onDestructive: string;
  /** Text-safe destructive color for error copy sitting directly on `card`/`background`. Equals
   * raw `destructive` in light mode (passes at 4.83:1) but is a separate lighter tint in dark
   * mode, where raw `destructive`/`#EF4444` measured only 2.5–3.9:1 against this page's warm
   * (not near-black) dark surfaces. */
  destructiveText: string;
  ring: string;
}

/**
 * Light palette. Primary/onPrimary is `#F97316`/`#0F172A` — the exact grounded pairing from the
 * "Pet Tech App" row, which recurred as an identical row in 4 of 4 independent citrus/light
 * color queries (see compete-web.md Reconciliation), the single highest-confidence row in this
 * reconciliation. `accent`/`onAccent` (`#22C55E`/`#0F172A`) is a deliberate swap from that same
 * row's own blue accent (`#2563EB`, "trust blue") to a green independently grounded in two other
 * rows pairing this exact orange primary with green, not blue — chosen for a citrus, not
 * corporate-trust, read (see Reconciliation for the full reasoning).
 *
 * `background`/`card` are both flat `#FFFFFF`, NOT the initially-drafted `#FFF7ED` citrus-cream
 * tint from the same grounded row — `foregroundMuted` measured 4.48:1 against that tint, under
 * 4.5:1 AA (see compete-web.md's Accessibility section, identical fix/reasoning to
 * `voting-web.md`'s own background flattening). The cream tint is kept as `elevated` instead.
 */
export const COMPETE_LIGHT: CompeteWebPalette = {
  background: '#FFFFFF',
  card: '#FFFFFF',
  cardForeground: '#9A3412', // Pet Tech App row's own Foreground field, exact — warm ink,
  // keeps the citrus identity even in body headings rather than a generic slate.
  elevated: '#FED7AA', // Pet Tech App row's own Border field, reused as the light elevated wash —
  // ONLY ever paired with cardForeground/icons, see interface doc + compete-web.md audit.
  elevatedHover: 'rgba(249, 115, 22, 0.08)', // primary-tinted hover overlay, alpha-derived, decorative only
  border: '#FED7AA', // Pet Tech App row, exact
  outline: '#000000', // literal "black outlines" from the Neubrutalism style convergence itself
  primary: '#F97316',
  onPrimary: '#0F172A',
  primaryText: '#C2410C', // Recipe & Cooking App row's own Secondary field, exact — measured
  // 5.18:1 on card/background, safely clears AA where raw #F97316 (2.80:1) cannot.
  accent: '#22C55E',
  onAccent: '#0F172A', // Fitness/Gym App row's own On Accent field, exact
  accentText: '#15803D', // Card & Board Game row's own Primary field, exact — measured 5.02:1 on
  // card/background, where raw #22C55E (2.28:1) fails.
  foreground: '#9A3412',
  foregroundMuted: '#64748B', // recurred in every converged row across every query this pass and every prior pass
  destructive: '#DC2626', // consistent across every row, every query, this pass and every prior one
  onDestructive: '#FFFFFF',
  destructiveText: '#DC2626', // passes as text in light mode (4.83:1), no substitute needed
  ring: '#F97316',
};

/**
 * Dark palette. Background/card sourced from the "Fitness/Gym App" row
 * (`#1F2937`/`#313742`/`#37414F`/`#374151`) — chosen over the far more common `#0F172A`/`#192134`
 * navy pairing (which recurred in nearly every other dark row this pass AND is
 * `community-web.md`'s own exact dark background) specifically to stay visibly distinct from
 * every prior web page: this is a warm-neutral slate, not navy-tinted, and distinct from
 * `voting-web.md`'s true-black OLED canvas and `feed-web.md`'s indigo-black. Primary
 * `#F97316`/accent `#22C55E` are kept cross-mode-identical to light mode, same reasoning
 * `voting-web.md` and `community-web.md` both used for their own brand hues.
 */
export const COMPETE_DARK: CompeteWebPalette = {
  background: '#1F2937',
  card: '#313742',
  cardForeground: '#F8FAFC',
  elevated: '#37414F', // Fitness/Gym App row's own Muted field, exact — same "cardForeground/icons only" rule
  elevatedHover: 'rgba(255, 255, 255, 0.06)',
  border: '#374151', // Fitness/Gym App row, exact
  outline: '#F8FAFC', // near-white signature border — measured 14.03:1 against this background,
  // comfortably visible; a flat black outline (the light-mode value) would be invisible here.
  primary: '#F97316',
  onPrimary: '#0F172A',
  primaryText: '#FB923C', // Pet Tech/Fitness rows' own Secondary field, exact — measured 6.49:1 on
  // background / 5.28:1 on card, where raw #F97316 (4.27:1 on card) falls just under AA.
  accent: '#22C55E',
  onAccent: '#0F172A',
  accentText: '#22C55E', // raw accent already measures 5.25:1 against this dark card — no
  // separate lighter/darker variant needed here, unlike light mode.
  foreground: '#F8FAFC',
  foregroundMuted: '#94A3B8', // recurred in every converged dark row across every query this pass and every prior pass
  destructive: '#DC2626', // fill kept cross-mode-identical (white text on it measures 4.83:1;
  // the mode-appropriate #EF4444 fill was tested and rejected — white text on it measures only 3.76:1)
  onDestructive: '#FFFFFF',
  destructiveText: '#FCA5A5', // dedicated lighter tint — raw destructive measured only 2.5–3.9:1
  // as TEXT against this page's warm (not near-black) dark surfaces, under 4.5:1 AA.
  ring: '#F97316',
};

export const COMPETE_WEB_RADIUS = {
  card: 12, // Deliberately the sharpest corner radius of this app's four web systems so far
  // (feed 20px, community 18px, voting 16px) — Neubrutalism's own style notes call for
  // sharp/minimal corners; 12px keeps touch-friendly rounding without softening the brutalist
  // read into a pillowy card.
  chip: 10,
  pill: 999,
} as const;

export const COMPETE_WEB_SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/** Signature hard-offset (non-blurred) shadow — the style's primary depth cue, used ONLY
 * alongside `outline` on emphasis surfaces (primary CTA, win banner, countdown/status cluster,
 * "Active" challenge cards). Kept flat black in BOTH modes rather than a mode-specific color: a
 * shadow reads by being darker than its surrounding surface, not by clearing a text-contrast
 * ratio, and both `COMPETE_DARK.card`/`background` are lighter than pure black, so the same
 * value still reads correctly as a shadow without a dark-mode substitute. */
export const COMPETE_WEB_SHADOW = {
  hard: {
    shadowColor: '#000000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
} as const;

/** Type scale — Lexend Mega for display/heading/loud-label roles (used sparingly, at larger
 * sizes, per its own wide/heavy face design), Public Sans for everything else. Scaled down from
 * the typography reference's landing-page sizes for in-app list/card density, same reasoning
 * every prior web page's own scale used. */
export const COMPETE_WEB_TYPE = {
  display: { fontFamily: COMPETE_WEB_HEADING_FONT_STACK, fontWeight: '700' as const, fontSize: 22, letterSpacing: 0 },
  h2: { fontFamily: COMPETE_WEB_HEADING_FONT_STACK, fontWeight: '700' as const, fontSize: 16, letterSpacing: 0 },
  vsText: { fontFamily: COMPETE_WEB_HEADING_FONT_STACK, fontWeight: '700' as const, fontSize: 15, letterSpacing: 0 },
  cardTitle: { fontFamily: COMPETE_WEB_BODY_FONT_STACK, fontWeight: '700' as const, fontSize: 16 },
  title: { fontFamily: COMPETE_WEB_BODY_FONT_STACK, fontWeight: '600' as const, fontSize: 15 },
  body: { fontFamily: COMPETE_WEB_BODY_FONT_STACK, fontWeight: '400' as const, fontSize: 15, lineHeight: 21 },
  meta: { fontFamily: COMPETE_WEB_BODY_FONT_STACK, fontWeight: '500' as const, fontSize: 12.5 },
  label: {
    fontFamily: COMPETE_WEB_BODY_FONT_STACK,
    fontWeight: '700' as const,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },
} as const;
