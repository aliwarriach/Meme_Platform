/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // "Neon Plum" (dark) / "Luminous Vapor" (light) — values live as CSS variables in
        // `src/global.css` (`:root` = light, `.dark` = dark), source of truth
        // `constants/webFeedThemeVapor.ts`. `rgb(var(--x) / <alpha-value>)` keeps every existing
        // `/NN` opacity-modifier className (`bg-primary/10`, `border-outline-variant/30`, etc.)
        // working unchanged — mode switching is a single class toggle via NativeWind's
        // `colorScheme.set()`, not a per-component edit.
        bg: 'rgb(var(--color-bg) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        'surface-lowest': 'rgb(var(--color-surface-lowest) / <alpha-value>)',
        'surface-low': 'rgb(var(--color-surface-low) / <alpha-value>)',
        'surface-high': 'rgb(var(--color-surface-high) / <alpha-value>)',
        'surface-highest': 'rgb(var(--color-surface-highest) / <alpha-value>)',
        'surface-bright': 'rgb(var(--color-surface-bright) / <alpha-value>)',
        primary: 'rgb(var(--color-primary) / <alpha-value>)',
        'primary-container': 'rgb(var(--color-primary-container) / <alpha-value>)',
        'primary-dim': 'rgb(var(--color-primary-dim) / <alpha-value>)',
        'on-primary': 'rgb(var(--color-on-primary) / <alpha-value>)',
        secondary: 'rgb(var(--color-secondary) / <alpha-value>)',
        'secondary-container': 'rgb(var(--color-secondary-container) / <alpha-value>)',
        'secondary-light': 'rgb(var(--color-secondary-light) / <alpha-value>)',
        tertiary: 'rgb(var(--color-tertiary) / <alpha-value>)',
        'tertiary-container': 'rgb(var(--color-tertiary-container) / <alpha-value>)',
        error: 'rgb(var(--color-error) / <alpha-value>)',
        'error-container': 'rgb(var(--color-error-container) / <alpha-value>)',
        outline: 'rgb(var(--color-outline) / <alpha-value>)',
        'outline-variant': 'rgb(var(--color-outline-variant) / <alpha-value>)',
        heading: 'rgb(var(--color-heading) / <alpha-value>)',
        ink: 'rgb(var(--color-ink) / <alpha-value>)',
        'ink-muted': 'rgb(var(--color-ink-muted) / <alpha-value>)',

        // Net-new Neon Plum roles (achievement gold, share/send cyan, vote colors, rank medals) —
        // see `constants/webFeedThemeVapor.ts` header for the one-job-per-color reasoning.
        'accent-gold': 'rgb(var(--color-accent-gold) / <alpha-value>)',
        'accent-amber': 'rgb(var(--color-accent-amber) / <alpha-value>)',
        'accent-cyan': 'rgb(var(--color-accent-cyan) / <alpha-value>)',
        'accent-upvote': 'rgb(var(--color-accent-upvote) / <alpha-value>)',
        'accent-downvote': 'rgb(var(--color-accent-downvote) / <alpha-value>)',
        'on-accent-ink': 'rgb(var(--color-on-accent-ink) / <alpha-value>)',
        'rank-gold': 'rgb(var(--color-rank-gold) / <alpha-value>)',
        'rank-silver': 'rgb(var(--color-rank-silver) / <alpha-value>)',
        'rank-bronze': 'rgb(var(--color-rank-bronze) / <alpha-value>)',

        // Already-translucent tokens (glass surfaces, press states, rank tints) — full CSS color
        // functions, not RGB triplets, so no `/NN` modifier support (none of these are used with
        // one).
        'surface-glass': 'var(--color-surface-glass)',
        'surface-press': 'var(--color-surface-press)',
        'press-tint': 'var(--color-press-tint)',
        'border-highlight': 'var(--color-border-highlight)',
        'rank-gold-tint': 'var(--color-rank-gold-tint)',
        'rank-silver-tint': 'var(--color-rank-silver-tint)',
        'rank-bronze-tint': 'var(--color-rank-bronze-tint)',
      },
      fontFamily: {
        display: ['BeVietnamPro_700Bold'],
        heading: ['BeVietnamPro_700Bold'],
        title: ['BeVietnamPro_600SemiBold'],
        body: ['BeVietnamPro_400Regular'],
        medium: ['BeVietnamPro_500Medium'],
        label: ['BeVietnamPro_600SemiBold'],
      },
      borderRadius: {
        card: 'var(--radius-card)',
      },
    },
  },
  plugins: [],
};
