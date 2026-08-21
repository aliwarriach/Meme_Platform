/**
 * The `--color-*` CSS custom-property values from `src/global.css`'s `:root` (light) and
 * `.dark` (dark) blocks, duplicated here as plain JS objects (space-separated RGB triplets,
 * matching the format `nativewind`'s `vars()` expects) — the same hand-synced-with-a-comment
 * convention `constants/theme.ts` already uses for its own hex mirror of these same values.
 *
 * Why this file exists: NativeWind's native dark/light CSS-variable resolution is hard-wired
 * to the OS's real `Appearance` setting (confirmed by reading `react-native-css-interop`'s
 * native runtime source — the "manual override" observable it falls back to is never actually
 * set outside a test environment), so it can never reflect this app's own in-app light/dark/
 * system picker. `constants/ThemeMode.tsx` sidesteps that entirely by injecting these values
 * itself via `vars()`, keyed to its own resolved mode — every existing `bg-bg`/`text-ink`/
 * `bg-surface-*`/etc. Tailwind className usage across the whole app (native and web) keeps
 * working completely unchanged, now correctly driven by the in-app mode instead of the OS one.
 *
 * Keep in sync by hand with `global.css` and `constants/theme.ts` — there is no build-time link
 * between any of these three.
 */

export const CSS_VARS_LIGHT: Record<string, string> = {
  '--color-bg': '255 247 251',
  '--color-surface-lowest': '243 217 231',
  '--color-surface-low': '253 243 248',
  '--color-surface': '255 255 255',
  '--color-surface-high': '255 240 247',
  '--color-surface-highest': '255 255 255',
  '--color-surface-bright': '255 255 255',

  '--color-primary': '236 72 153',
  '--color-primary-container': '190 24 93',
  '--color-primary-dim': '190 24 93',
  '--color-on-primary': '26 14 24',

  '--color-secondary': '109 40 217',
  '--color-secondary-container': '109 40 217',
  '--color-secondary-light': '167 126 232',

  '--color-tertiary': '21 128 61',
  '--color-tertiary-container': '21 128 61',

  '--color-error': '186 26 26',
  '--color-error-container': '130 18 18',

  '--color-outline': '201 143 176',
  '--color-outline-variant': '243 217 231',

  '--color-heading': '42 18 32',
  '--color-ink': '42 18 32',
  '--color-ink-muted': '107 74 92',

  '--color-accent-gold': '245 158 11',
  '--color-accent-amber': '234 88 12',
  '--color-accent-cyan': '21 94 117',
  '--color-accent-upvote': '21 128 61',
  '--color-accent-downvote': '220 38 38',
  '--color-on-accent-ink': '26 14 24',

  '--color-rank-gold': '245 158 11',
  '--color-rank-silver': '148 163 184',
  '--color-rank-bronze': '146 64 14',

  '--color-surface-glass': 'rgba(255, 255, 255, 0.78)',
  '--color-surface-press': 'rgba(255, 240, 247, 0.9)',
  '--color-press-tint': 'rgba(219, 39, 119, 0.07)',
  '--color-border-highlight': 'rgba(255, 255, 255, 1)',
  '--color-rank-gold-tint': 'rgba(245, 158, 11, 0.3)',
  '--color-rank-silver-tint': 'rgba(148, 163, 184, 0.32)',
  '--color-rank-bronze-tint': 'rgba(146, 64, 14, 0.28)',

  '--radius-card': '16px',
};

export const CSS_VARS_DARK: Record<string, string> = {
  '--color-bg': '26 14 27',
  '--color-surface-lowest': '18 10 17',
  '--color-surface-low': '26 14 27',
  '--color-surface': '36 19 40',
  '--color-surface-high': '46 25 48',
  '--color-surface-highest': '56 31 56',
  '--color-surface-bright': '66 37 64',

  '--color-primary': '255 92 160',
  '--color-primary-container': '219 39 119',
  '--color-primary-dim': '255 92 160',
  '--color-on-primary': '26 14 24',

  '--color-secondary': '192 132 252',
  '--color-secondary-container': '106 73 139',
  '--color-secondary-light': '192 132 252',

  '--color-tertiary': '21 128 61',
  '--color-tertiary-container': '21 128 61',

  '--color-error': '255 155 155',
  '--color-error-container': '186 26 26',

  '--color-outline': '74 44 66',
  // NOT a low-alpha white (`rgba(255,255,255,0.10)`, the value `constants/theme.ts`'s
  // `outlineVariant` uses for style-prop consumers) — Tailwind's `rgb(var(--x) / <alpha-value>)`
  // pattern needs this CSS var to hold ONLY a flat RGB triplet, with alpha supplied per usage
  // site via the utility's own `/NN` modifier (or no modifier at all, i.e. full opacity). Baking
  // in `255 255 255` meant every `border-outline-variant` usage without an explicit low `/NN`
  // (e.g. `Chip.tsx`'s unselected state, plain `border-outline-variant`) rendered a solid white
  // border in dark mode instead of a subtle divider — this solid muted plum is the flat-RGB
  // equivalent of that same "faint hairline over the dark canvas" role.
  '--color-outline-variant': '91 63 70',

  '--color-heading': '253 242 248',
  '--color-ink': '253 242 248',
  '--color-ink-muted': '201 169 186',

  '--color-accent-gold': '245 158 11',
  '--color-accent-amber': '234 88 12',
  '--color-accent-cyan': '14 116 144',
  '--color-accent-upvote': '74 222 128',
  '--color-accent-downvote': '255 128 128',
  '--color-on-accent-ink': '26 14 24',

  '--color-rank-gold': '245 158 11',
  '--color-rank-silver': '203 213 225',
  '--color-rank-bronze': '180 83 9',

  '--color-surface-glass': 'rgba(255, 214, 236, 0.07)',
  '--color-surface-press': 'rgba(255, 214, 236, 0.12)',
  '--color-press-tint': 'rgba(255, 214, 236, 0.08)',
  '--color-border-highlight': 'rgba(255, 255, 255, 0.22)',
  '--color-rank-gold-tint': 'rgba(245, 158, 11, 0.34)',
  '--color-rank-silver-tint': 'rgba(203, 213, 225, 0.32)',
  '--color-rank-bronze-tint': 'rgba(180, 83, 9, 0.38)',

  '--radius-card': '24px',
};
