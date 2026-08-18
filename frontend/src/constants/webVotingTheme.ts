/**
 * Visual-identity tokens for the desktop/web-only Voting/Competitions screen RESKIN
 * (`VotingScreen.web.tsx` + its `components/web/WebVoting*`/`WebCompetitionEntryModal` siblings
 * ONLY).
 *
 * Scope: RESKIN-mode pass, page-scoped to `design-system/meme-platform/pages/voting-web.md` —
 * it deliberately does NOT reuse `tailwind.config.js`'s "Vivid Meme Culture" tokens (native,
 * untouched), `webFeedTheme.ts`'s "Dark Cinema" indigo tokens, or `webCommunityTheme.ts`'s
 * "Vibrant & Block-based" violet tokens — all three remain the systems for their own trees,
 * untouched. This is a fourth, independent system with full light + dark support.
 *
 * COLOR-DIRECTION CORRECTION (see this task's brief): the previous two web passes both landed on
 * generic muted violet/indigo via the skill's blended `--design-system` roll and were rejected by
 * the user as "corporate SaaS" / "boring" / "soulless". This pass deliberately steered every query
 * toward warm/electric hues and discarded every violet/indigo-primary result even when it
 * recurred — see voting-web.md's Reconciliation section for the full query log. Final primary hue
 * is rose-crimson `#E11D48` (both modes, cross-mode-identical — see palette notes below for why an
 * earlier hot-pink `#EC4899` draft was replaced on accessibility grounds) + gold/amber `#F59E0B`
 * (both modes) — zero violet, zero indigo, zero muted-blue-as-primary.
 *
 * Every value below is grounded in ui-ux-pro-max skill query output (see voting-web.md's
 * "Reconciliation" section for the exact commands + convergence), not invented from memory.
 * Never import this file from a native-resolved component.
 */

/** Anton (display/headings, rank numerals) / Epilogue (body) — "Gen Z Brutal" pairing, the only
 * pairing in this dataset whose own mood keywords literally include "meme" ("brutal, loud,
 * shouty, meme, internet, bold"; Best For: "Gen Z marketing, streetwear, viral campaigns") —
 * confirmed 2/2 across an independent `--domain typography` query and the cross-check
 * `--design-system` roll. Anton's condensed, high-impact numerals are also a direct functional
 * fit for this screen's rank digits ("#1", "#2"...), not just a mood match. */
export const VOTING_WEB_HEADING_FONT_STACK = "'Anton', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
export const VOTING_WEB_BODY_FONT_STACK = "'Epilogue', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

/** Full (non-truncated) Google Fonts URL, copied verbatim from the skill's raw query output —
 * never hand-typed, per the ASCII-box-truncation gotcha. */
export const VOTING_WEB_FONT_IMPORT_URL =
  'https://fonts.googleapis.com/css2?family=Anton&family=Epilogue:wght@400;500;600;700&display=swap';

const VOTING_WEB_FONT_LINK_ID = 'voting-web-anton-epilogue-font';

/** Injects the Anton+Epilogue <link> into <head> exactly once (web only, id-guarded against
 * duplicate mounts/HMR). No-op if `document` doesn't exist or the link is already present. */
export function injectVotingWebFont(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(VOTING_WEB_FONT_LINK_ID)) return;

  const link = document.createElement('link');
  link.id = VOTING_WEB_FONT_LINK_ID;
  link.rel = 'stylesheet';
  link.href = VOTING_WEB_FONT_IMPORT_URL;
  document.head.appendChild(link);
}

/** react-native-web extends Pressable's style-callback state with `hovered`/`focused` at
 * runtime, but core `react-native`'s `PressableStateCallbackType` type only declares `pressed`
 * — annotate web-only Pressable style callbacks with this type instead of relying on inference.
 * (Defined independently here rather than imported from `webCommunityTheme.ts` — this tree must
 * not couple to the communities tree per this task's explicit scope boundary.) */
export interface WebPressableState {
  pressed: boolean;
  hovered?: boolean;
  focused?: boolean;
}

export interface VotingWebPalette {
  background: string;
  card: string;
  cardForeground: string;
  elevated: string;
  elevatedHover: string;
  border: string;
  primary: string;
  onPrimary: string;
  /** Brand-hue text color for use ON `card`/`background` (never on `elevated` — see note below).
   * Distinct from `primary` because `primary` is tuned for FILLS (paired with `onPrimary`), and
   * the raw fill hue does not clear 4.5:1 as body text against every surface this pass uses —
   * see the accessibility-driven amendment note in `voting-web.md`. */
  primaryText: string;
  gold: string;
  onGold: string;
  /** Gold-hue text color for use ON `card`/`background` — same reasoning as `primaryText`: raw
   * `gold` fails contrast as body text in light mode (2.15:1 on white, measured), so a distinct,
   * separately-grounded darker amber is used wherever gold needs to be TEXT rather than a fill. */
  goldText: string;
  foreground: string;
  foregroundMuted: string;
  destructive: string;
  onDestructive: string;
  ring: string;
}

/**
 * Light palette. Primary/onPrimary is `#E11D48`/`#FFFFFF` — this is the EXACT grounded pairing
 * from the "Social Media App" and "Dating App" rows (`Primary #E11D48 / On Primary #FFFFFF`),
 * not `#EC4899` (an earlier draft of this palette used the "Meme & Sticker Maker" row's hot-pink
 * primary instead, but `#EC4899` measures only 3.53:1 against white — fails 4.5:1 AA body text;
 * `#E11D48` measures 4.70:1, verified). `#EC4899`'s own light tints (`Muted #FDF4F8`, `Border
 * #FCE9F2`, same row) are still used for `elevated`/decorative purposes below, just not as the
 * primary text/fill hue. Gold `#F59E0B` recurred 3x independently (Trivia & Quiz Game accent —
 * literal note "gold leaderboard"; Meme & Sticker Maker secondary; the blended `--design-system`
 * cross-check roll's accent) — the highest-confidence single token in this file, kept for FILLS
 * (trophy badge, top-3 rank badge) and for dark-mode text; `goldText` below covers light-mode
 * text specifically.
 *
 * `goldText: #A16207` is the "Architecture / Interior" row's own Accent field (itself already
 * WCAG-adjusted per that row's own dataset note) — independently verified here at 4.92:1 against
 * `#FFFFFF`, safely clearing 4.5:1 AA where raw `#F59E0B` (2.15:1) cannot.
 */
export const VOTING_LIGHT: VotingWebPalette = {
  // Pure white, not a tinted wash — an earlier draft used the Meme & Sticker Maker row's own
  // Muted token (`#FDF4F8`) as a warmer page canvas, but that background is close enough to
  // white in luminance that several text/background pairings measured just under 4.5:1 against
  // it (e.g. `foregroundMuted` measured 4.41:1). Flat white removes that margin risk entirely
  // and is itself the same row's own literal Background field — still fully grounded, not a
  // downgrade in groundedness, just the safer field from the same row.
  background: '#FFFFFF',
  card: '#FFFFFF', // Meme & Sticker Maker row, exact — kept clean/neutral so meme thumbnails
  // stay the visual focus, energy lives in accents laid on top, not the card surface itself.
  cardForeground: '#0F172A',
  elevated: '#FCE9F2', // Meme & Sticker Maker row's own Border token, reused as a light elevated
  // wash (chips, tab track, hover states). IMPORTANT: only ever paired with `foreground` (full
  // contrast) or icons here, never `foregroundMuted`/`primaryText`/`goldText` — measured contrast
  // for those against this specific tint falls to ~4.0-4.2:1, under 4.5:1 AA.
  elevatedHover: 'rgba(225, 29, 72, 0.08)', // primary-tinted hover overlay, alpha-derived, decorative only (no text sits directly on it)
  border: '#FCE9F2', // Meme & Sticker Maker row, exact
  primary: '#E11D48',
  onPrimary: '#FFFFFF',
  primaryText: '#E11D48', // same hex as `primary` in light mode — passes as text-on-card (4.70:1)
  gold: '#F59E0B',
  onGold: '#0F172A', // dark text on gold fill — exact pairing from both grounded rows that use
  // this accent as a fill (Trivia & Quiz Game "On Accent", Meme & Sticker Maker "On Secondary").
  goldText: '#A16207',
  foreground: '#0F172A',
  foregroundMuted: '#64748B', // recurred in every converged row across every query run this pass
  destructive: '#DC2626', // consistent across every row, every query, this pass and every prior one
  onDestructive: '#FFFFFF',
  ring: '#E11D48',
};

/**
 * Dark palette. Background/card sourced from "Video Streaming/OTT" (`#000000`/`#0C0C0D`) rather
 * than reusing `feed-web.md`'s or `community-web.md`'s exact near-black tokens (`#0F0F23`/
 * `#1B1B30` and `#0F172A`/`#192134` respectively) — deliberately distinct per the same
 * "independently-generated system, not a variation" precedent `community-web.md` itself used
 * against `feed-web.md`. True-black also directly matches this pass's #1 style-query hit,
 * "Dark Mode (OLED)" (deep black, "vibrant neon accents", WCAG AAA), independently reconfirmed by
 * the cross-check `--design-system` roll landing on the same style. Primary rose-crimson #E11D48
 * recurred 3x independently (Video Streaming/OTT accent "play red"; Social Media App primary;
 * Dating App primary) — zero violet, zero indigo. Gold #F59E0B is kept cross-mode-identical to
 * light mode (same status-color reasoning `community-web.md` used for its own accent): verified
 * contrast against this background is 9.1:1, far exceeding 4.5:1 body-text AA.
 *
 * `primaryText: #FB7185` — measured contrast check found raw `#E11D48` fails as TEXT directly on
 * this dark card (`#0C0C0D`): 4.16:1, under 4.5:1 (it's fine as a FILL with white text on top —
 * `onPrimary` on `primary` measures 4.70:1 regardless of surrounding page — the failure is
 * specifically the "colored text sitting on a neutral card" use case, e.g. standings row score
 * numbers). `#FB7185` is grounded, not invented: it's the exact Secondary field in BOTH rows that
 * gave `#E11D48` as Primary ("Social Media App" and "Dating App," 2/2 convergence for this
 * specific pairing) — a lighter companion tint from the same two source rows, not a separate
 * search. Measures 7.26:1 against the dark card, comfortably clearing AA.
 */
export const VOTING_DARK: VotingWebPalette = {
  background: '#000000',
  card: '#0C0C0D', // Video Streaming/OTT row, exact
  cardForeground: '#F8FAFC',
  elevated: '#181818', // Video Streaming/OTT row's own Muted token, exact
  elevatedHover: 'rgba(255, 255, 255, 0.05)',
  border: 'rgba(255, 255, 255, 0.08)', // recurred identically across every dark row this pass and
  // prior passes queried — highest-confidence dark hairline border in the dataset. Deliberately
  // NOT the Video Streaming row's own indigo-tinted `#312E81` border, to keep this dark palette
  // free of indigo in every role, not just primary/secondary.
  primary: '#E11D48',
  onPrimary: '#FFFFFF',
  primaryText: '#FB7185',
  gold: '#F59E0B',
  onGold: '#0F172A',
  goldText: '#F59E0B', // same hex as `gold` in dark mode — already measures 9.1:1 as text on the
  // dark card, no separate darker/lighter variant needed here (unlike light mode).
  foreground: '#F8FAFC',
  foregroundMuted: '#94A3B8', // recurred in every converged dark row across every query this pass
  destructive: '#EF4444', // Video Streaming/OTT row's own dark-surface destructive, exact
  onDestructive: '#FFFFFF',
  ring: '#E11D48',
};

export const VOTING_WEB_RADIUS = {
  card: 16, // Deliberately tighter than feed-web's 20px and community-web's 18px — Anton is a
  // hard-edged, condensed display face (see typography note above); a tighter corner radius
  // reads more consistent with that blockier, high-impact letterform than a soft/pillowy round.
  chip: 12,
  pill: 999,
} as const;

export const VOTING_WEB_SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/** Type scale — Anton for display/rank-numeral roles (all-caps, condensed, used sparingly and at
 * large sizes only per its own face design), Epilogue for everything else. Scaled down from the
 * typography reference's landing-page sizes for in-app list/card density, same reasoning
 * `feed-web.md`/`community-web.md` both used for their own scales. */
export const VOTING_WEB_TYPE = {
  display: { fontFamily: VOTING_WEB_HEADING_FONT_STACK, fontWeight: '400' as const, fontSize: 26, letterSpacing: 0.2 },
  h2: {
    fontFamily: VOTING_WEB_BODY_FONT_STACK,
    fontWeight: '700' as const,
    fontSize: 18,
  },
  rankNumeral: { fontFamily: VOTING_WEB_HEADING_FONT_STACK, fontWeight: '400' as const, fontSize: 20, letterSpacing: 0.2 },
  cardTitle: { fontFamily: VOTING_WEB_BODY_FONT_STACK, fontWeight: '700' as const, fontSize: 16 },
  title: { fontFamily: VOTING_WEB_BODY_FONT_STACK, fontWeight: '600' as const, fontSize: 15 },
  body: { fontFamily: VOTING_WEB_BODY_FONT_STACK, fontWeight: '400' as const, fontSize: 15, lineHeight: 21 },
  meta: { fontFamily: VOTING_WEB_BODY_FONT_STACK, fontWeight: '500' as const, fontSize: 12.5 },
  label: {
    fontFamily: VOTING_WEB_BODY_FONT_STACK,
    fontWeight: '700' as const,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },
} as const;
