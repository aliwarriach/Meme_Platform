/**
 * Visual-identity tokens for the desktop/web-only Profile/Session screen
 * (`SessionScreen.web.tsx` + its `components/web/Web*` siblings ONLY).
 *
 * Scope: FULL MODE pass, reusing the `design-system/meme-platform/pages/voting-web.md` system
 * verbatim per this task's explicit brief ("reuse the voting-web design system... same palette,
 * typography, and shape language"). It deliberately does NOT reuse `tailwind.config.js`'s
 * "Vivid Meme Culture" tokens (native, untouched), `webFeedTheme.ts`'s "Dark Cinema" indigo
 * tokens, or `webCommunityTheme.ts`'s "Vibrant & Block-based" violet tokens — this tree is a
 * sibling of the voting-web tree, not those.
 *
 * Every value below is copied from `webVotingTheme.ts` (itself fully grounded in ui-ux-pro-max
 * skill query output — see `voting-web.md`'s Reconciliation section for the exact commands +
 * convergence) — nothing invented from memory for this pass either. Rose-crimson `#E11D48` +
 * gold `#F59E0B`, zero violet, zero indigo — the same warm/electric meme-culture direction this
 * project's web palette guidance requires, not a generic SaaS gradient.
 *
 * Defined independently here (not imported from `webVotingTheme.ts`) per this task's explicit
 * scope boundary: new code only goes in this file, `SessionScreen.web.tsx`, and
 * `components/web/`. Never import this file from a native-resolved component.
 */

/** Fredoka (headings) / Nunito (body) — switched from the original Anton/Epilogue pass to match
 * `webCommunityTheme.ts`'s font family per explicit user request, for visual consistency across
 * web sections and to resolve sizing/legibility issues Anton's condensed all-caps face caused at
 * small sizes (settings-row labels, meta text). */
export const PROFILE_WEB_HEADING_FONT_STACK = "'Fredoka', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
export const PROFILE_WEB_BODY_FONT_STACK = "'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

/** Full (non-truncated) Google Fonts URL, copied verbatim — never hand-typed, per the
 * ASCII-box-truncation gotcha. Same weights as `webCommunityTheme.ts`'s import. */
export const PROFILE_WEB_FONT_IMPORT_URL =
  'https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Nunito:wght@300;400;500;600;700&display=swap';

const PROFILE_WEB_FONT_LINK_ID = 'profile-web-fredoka-nunito-font';

/** Injects the Fredoka+Nunito <link> into <head> exactly once (web only, id-guarded against
 * duplicate mounts/HMR). No-op if `document` doesn't exist or the link is already present. */
export function injectProfileWebFont(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(PROFILE_WEB_FONT_LINK_ID)) return;

  const link = document.createElement('link');
  link.id = PROFILE_WEB_FONT_LINK_ID;
  link.rel = 'stylesheet';
  link.href = PROFILE_WEB_FONT_IMPORT_URL;
  document.head.appendChild(link);
}

/** react-native-web extends Pressable's style-callback state with `hovered`/`focused` at
 * runtime, but core `react-native`'s `PressableStateCallbackType` type only declares `pressed`
 * — annotate web-only Pressable style callbacks with this type instead of relying on inference.
 * (Defined independently here rather than imported from another tree's theme file — this tree
 * must not couple to voting-web/compete-web/community-web per this task's explicit scope
 * boundary, even though the palette itself is intentionally identical.) */
export interface WebPressableState {
  pressed: boolean;
  hovered?: boolean;
  focused?: boolean;
}

export interface ProfileWebPalette {
  background: string;
  card: string;
  cardForeground: string;
  elevated: string;
  elevatedHover: string;
  border: string;
  primary: string;
  onPrimary: string;
  primaryText: string;
  gold: string;
  onGold: string;
  goldText: string;
  foreground: string;
  foregroundMuted: string;
  destructive: string;
  onDestructive: string;
  ring: string;
}

/** Light palette — identical values to `VOTING_LIGHT` (`webVotingTheme.ts`), reused verbatim per
 * this task's explicit brief. See that file's inline notes for the full grounding/contrast-audit
 * reasoning behind each token; not re-derived here to avoid re-litigating an already-settled
 * palette. */
export const PROFILE_LIGHT: ProfileWebPalette = {
  background: '#FFFFFF',
  card: '#FFFFFF',
  cardForeground: '#0F172A',
  elevated: '#FCE9F2',
  elevatedHover: 'rgba(225, 29, 72, 0.08)',
  border: '#FCE9F2',
  primary: '#E11D48',
  onPrimary: '#FFFFFF',
  primaryText: '#E11D48',
  gold: '#F59E0B',
  onGold: '#0F172A',
  goldText: '#A16207',
  foreground: '#0F172A',
  foregroundMuted: '#64748B',
  destructive: '#DC2626',
  onDestructive: '#FFFFFF',
  ring: '#E11D48',
};

/** Dark palette — identical values to `VOTING_DARK` (`webVotingTheme.ts`). See that file's
 * inline notes for the measured-contrast reasoning (`primaryText`/`goldText` split etc.). */
export const PROFILE_DARK: ProfileWebPalette = {
  background: '#000000',
  card: '#0C0C0D',
  cardForeground: '#F8FAFC',
  elevated: '#181818',
  elevatedHover: 'rgba(255, 255, 255, 0.05)',
  border: 'rgba(255, 255, 255, 0.08)',
  primary: '#E11D48',
  onPrimary: '#FFFFFF',
  primaryText: '#FB7185',
  gold: '#F59E0B',
  onGold: '#0F172A',
  goldText: '#F59E0B',
  foreground: '#F8FAFC',
  foregroundMuted: '#94A3B8',
  destructive: '#EF4444',
  onDestructive: '#FFFFFF',
  ring: '#E11D48',
};

export const PROFILE_WEB_RADIUS = {
  card: 16,
  chip: 12,
  pill: 999,
} as const;

export const PROFILE_WEB_SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/** Type scale — Fredoka for display roles, Nunito for everything else, matching
 * `webCommunityTheme.ts`'s `COMMUNITY_WEB_TYPE` scale/weights exactly (community's `display`/`h2`
 * doubling as this screen's `display`/`h2`, `cardTitle`/`title`/`body`/`meta`/`label` identical).
 * Anton's single 400 weight and condensed all-caps face is gone, so sizes/weights are re-tuned
 * for Fredoka's rounder, wider glyphs — smaller display/stat sizes read correctly at the same
 * visual weight, and `stat` steps up to `700` since Fredoka (unlike Anton) has real weight
 * variants to lean on for hero-number emphasis. */
export const PROFILE_WEB_TYPE = {
  display: { fontFamily: PROFILE_WEB_HEADING_FONT_STACK, fontWeight: '600' as const, fontSize: 24, letterSpacing: -0.2 },
  stat: { fontFamily: PROFILE_WEB_HEADING_FONT_STACK, fontWeight: '700' as const, fontSize: 30, letterSpacing: -0.2 },
  h2: { fontFamily: PROFILE_WEB_HEADING_FONT_STACK, fontWeight: '600' as const, fontSize: 20 },
  cardTitle: { fontFamily: PROFILE_WEB_HEADING_FONT_STACK, fontWeight: '600' as const, fontSize: 16 },
  title: { fontFamily: PROFILE_WEB_BODY_FONT_STACK, fontWeight: '700' as const, fontSize: 15 },
  body: { fontFamily: PROFILE_WEB_BODY_FONT_STACK, fontWeight: '400' as const, fontSize: 15, lineHeight: 21 },
  meta: { fontFamily: PROFILE_WEB_BODY_FONT_STACK, fontWeight: '500' as const, fontSize: 12.5 },
  label: {
    fontFamily: PROFILE_WEB_BODY_FONT_STACK,
    fontWeight: '700' as const,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },
} as const;
