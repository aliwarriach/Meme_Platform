# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/meme-platform/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** Meme Platform
**Generated:** 2026-08-07 (initial persist, hand-corrected same day — see Reconciliation below)
**Category:** Native community/social app (React Native + Expo, NativeWind) — not a web landing page
**Style Name:** "Vivid Meme Culture" (Stitch-generated 2026-07-26, already shipped and in production use across the app)

---

## Reconciliation with the ui-ux-pro-max skill

Two skill queries were run for this pass:

```
python "$HOME/.claude/skills/ui-ux-pro-max/scripts/search.py" "vibrant neon dark mode community social meme culture" --design-system --persist -p "Meme Platform" --output-dir "C:\Users\Newuser\Desktop\Meme_Platform"
python "$HOME/.claude/skills/ui-ux-pro-max/scripts/search.py" "vibrant neon dark mode youth social entertainment community" --domain style -n 3
```

`--design-system` returned **"Dark Mode (OLED)"** (Orbitron/JetBrains Mono, `#000000`/`#121212`) on one run and
**"Vibrant & Block-based"** with a **light** palette (`background #FFF1F2`) on another — the tool is non-deterministic
across runs for this query and, per the skill's own DOMAIN GOTCHA, blends in the `landing` domain (its PATTERN block
here was "Community/Forum Landing" — a marketing page pattern, not an in-app screen — and its Pre-Delivery Checklist
is web-flavored: `cursor-pointer`, hover transitions, breakpoints up to 1440px). None of this applies to a native
in-app screen.

The split `--domain style` query is the one actually useful for validation: its **"Vibrant & Block-based"** result
(Neon Green `#39FF14`, Electric Purple `#BF00FF`, Vivid Pink `#FF1493`, dark-mode-full-support, "youth-focused,
entertainment, consumer") is directionally the same formula already shipped — three neon hues (pink/purple/green) on
a dark surface — just with different exact hex values and a generic, unbranded swatch. This **validates** the shipped
direction rather than contradicting it.

Where the skill's output does **conflict** with what's shipped, the shipped direction wins outright, since it's already
implemented and in production:
- **Typography**: no skill query returned Be Vietnam Pro (closest matches were Orbitron/JetBrains Mono, Russo One/Chakra
  Petch, Righteous/Poppins — none fit). The shipped Be Vietnam Pro family stands as-is; not a contradiction, just a font
  the skill's database doesn't carry a matching pairing for.
- **Exact palette**: skill swatches (`#7C3AED`/`#E11D48`/etc.) are generic starting points; the shipped exact hexes
  (`#ff3385`/`#8a2be2`/`#5ee060`) are more refined and already used across every existing screen (feed, creator,
  auth). Reusing the skill's generic hex over the shipped one would visually fracture the app.
- **Mode**: several skill results defaulted to light backgrounds despite "dark mode" in the query text (a known skew
  in the underlying database — see DOMAIN GOTCHA). This app's `ThemeProvider` is hardcoded to `DarkTheme`; there is no
  light mode. Skill output favoring light mode is disregarded.
- **Pattern/checklist**: the `landing`-blended PATTERN block and web checklist (`cursor-pointer`, hover states,
  1440px breakpoint) do not apply to native in-app screens and are replaced below with `references/pro-rules.md`
  (native pre-delivery checklist) per this agent's own instructions.

**Net conclusion:** skill validates the general direction (dark-only, multi-neon-hue-on-dark, "Vibrant & Block-based"
style family, youth/social/entertainment product fit). Shipped exact tokens win on specifics. No unresolved conflict.

---

## Global Rules

### Color Palette (source of truth: `frontend/tailwind.config.js`)

| Role | Token | Hex | Usage |
|------|-------|-----|-------|
| Background | `bg` | `#1e0f13` | Screen background |
| Surface (lowest → bright, elevation scale) | `surface-lowest` | `#180a0e` | Deepest recess (e.g. input wells) |
| | `surface-low` | `#27171b` | |
| | `surface` | `#2c1b1f` | Default card/panel surface |
| | `surface-high` | `#372529` | Raised elements, unselected chips |
| | `surface-highest` | `#433034` | |
| | `surface-bright` | `#473438` | Highest elevation before primary |
| Primary | `primary` | `#ff3385` | Neon pink — primary CTAs, active tab indicator, upvote |
| | `primary-container` | `#ff4a8c` | Avatar fallback bg, filled containers |
| | `primary-dim` | `#ffb1c4` | Text-on-tinted-primary (e.g. pending badge label) |
| | `on-primary` | `#65002e` | Text/icon on top of solid primary fill |
| Secondary | `secondary` | `#8a2be2` | Electric purple — secondary actions, downvote |
| | `secondary-container` | `#7701d0` | |
| | `secondary-light` | `#dcb8ff` | |
| Tertiary | `tertiary` | `#5ee060` | Electric green — success/positive accents |
| | `tertiary-container` | `#16a72e` | |
| Error | `error` | `#ffb4ab` | Error text/icons on dark surfaces |
| | `error-container` | `#93000a` | |
| Outline | `outline` | `#aa888f` | Borders needing more contrast (dashed pickers, outline buttons) |
| | `outline-variant` | `#5b3f46` | Default hairline borders/dividers |
| Heading | `heading` | `#ffffff` | Pure white — headings, high-emphasis titles |
| Ink | `ink` | `#f9dbe1` | Primary body text on dark surfaces |
| Ink muted | `ink-muted` | `#e3bdc5` | Secondary/meta text, placeholders, disabled labels, loading spinners |

**Color role notes:**
- This is a **dark-mode-only** system — `ThemeProvider` is hardcoded to `DarkTheme`. Never introduce a light
  background token or branch.
- Color is never the only signal: membership/status states (active/pending/owner) pair a text label with their
  color treatment (see CommunityDetailScreen's `renderActionButton`), not color alone.
- `ActivityIndicator`'s `color` prop cannot take a NativeWind className (RN native prop, not a style). Source it from
  `frontend/src/constants/theme.ts` → `INK_MUTED`, not an inline hex literal. Same applies to `placeholderTextColor`
  and any other native-only color prop.

### Typography

- **Font family:** Be Vietnam Pro (already loaded via `@expo-google-fonts/be-vietnam-pro` or equivalent — do not add
  the skill's Orbitron/JetBrains Mono suggestion).
- **Weights → NativeWind classes** (from `tailwind.config.js`):
  - `font-display` / `font-heading` → `BeVietnamPro_700Bold` — screen titles, hero numbers
  - `font-title` → `BeVietnamPro_600SemiBold` — card titles, button labels, section headers
  - `font-label` → `BeVietnamPro_600SemiBold` — small uppercase meta labels (tracked-out, `text-xs`)
  - `font-body` → `BeVietnamPro_400Regular` — body copy, descriptions
  - `font-medium` → `BeVietnamPro_500Medium` — secondary emphasis between body and title
- **Type scale in practice** (Tailwind default scale via NativeWind, as already used): `text-xs` (12px) labels/meta →
  `text-sm` (14px) body/secondary → `text-base` (16px) primary body/buttons → `text-lg` (18px) TopBar titles →
  `text-xl`/`text-2xl` (20/24px) screen/card headline numbers.

### Spacing Scale

Standard Tailwind spacing scale via NativeWind (4px increments), used consistently as: `gap-1`/`gap-2` for inline
icon/text groups, `px-4`/`px-6` for screen-edge padding, `py-3` for touch-target-height padding on pills, `mb-4`/`mb-6`
between stacked sections, `pb-100`+ content-container bottom padding on lists sitting under `FloatingBottomNav`.

### Shape

- **Full pill roundness** (`rounded-full`) on all interactive controls — buttons, chips, badges, avatars, vote pill,
  text inputs.
- **`rounded-card`** (`24px`, defined in `tailwind.config.js`) on card-level containers (`GlassCard`, community icon
  fallback tile, privacy-option cards).

### Component Conventions (existing shared components — reuse, don't reinvent)

- `PillButton` — primary interactive control; `primary`/`secondary`/`outline`/`ghost` variants, built-in loading state,
  min-height 44px.
- `Chip` — filter/tab/toggle control; translucent `surface-high/60` unselected → opaque `primary` selected.
- `GlassCard` — frosted glass elevation. **Must use the `StyleSheet.absoluteFill` sibling-layer pattern**
  (`BlurView` as an absolute-fill sibling, real content in a separate normal-flow `View`) — never put layout-bearing
  classNames directly on `<BlurView>`. `BlurView` is not NativeWind-registered and has a confirmed Android sizing bug
  when nested with real content; it was fully removed from `FloatingBottomNav.tsx` after three failed fix attempts.
  Current `GlassCard.tsx` nests real children inside `<BlurView>` directly — flagged as a latent risk, out of scope
  for this pass (not touched by the communities screens; see report).
- `TopBar` — back arrow + centered white title + right actions, safe-area aware.
- `Avatar` — circular, initials fallback on `primary-container`.
- `VotePill` — Reddit-style ▲score▼, never a heart/like icon.
- `TextField` — pill-shaped input, `border-error` on validation failure.
- `FloatingBottomNav` — absolute-overlay dock, **plain inline `StyleSheet`, not NativeWind, not `BlurView`** (same
  Android sizing bug as above) — this is intentional and must not be "fixed" back to className/blur.

### Challenge Status Color Convention (established, reuse — don't reinvent per screen)

`ChallengeRow.tsx` established: `active` → `bg-tertiary` (electric green), `evaluated` → `bg-primary`
(neon pink), `setup` → `bg-surface-high` (neutral, labeled "Pending"). The 2026-08-07
active-challenge banner (`CommunityDetailScreen`'s Feed tab) and hub badge (`CommunityCard`)
reuse `tertiary` for "live/active" specifically — any future challenge/compete-surface work
(Phase B) should pull from this same three-color mapping rather than introducing a new one.

### Native Interaction Conventions

- Touch targets ≥44×44pt on every interactive element (buttons, chips, list rows, icon-only actions).
- Every interactive element has `accessibilityRole` + `accessibilityLabel` (+ `accessibilityState` for
  toggle/selected/disabled where applicable) — this is a native app, so screen-reader exposure replaces "focus states,"
  which is a web/keyboard concept that doesn't apply here.
- Respect safe-area insets via `react-native-safe-area-context` — never hardcoded top/bottom padding.
- Loading/error/empty states required for every data-driven view (no happy-path-only screens).

---

## Anti-Patterns (Do NOT Use)

- Light backgrounds / light mode — this app is dark-only.
- Web-only affordances that don't exist on native: `cursor-pointer`, CSS `:hover`, fixed breakpoints for a phone-first
  native screen.
- Raw hex literals inline in component code for anything NativeWind can express via a token — use the
  `tailwind.config.js` color tokens (className) or, for native-only color props, the single sourced constant in
  `frontend/src/constants/theme.ts`.
- `BlurView` with layout-bearing classNames directly on it, or nested inside real content without the
  absolute-fill-sibling pattern (confirmed Android sizing bug).
- Heart/like icons for reactions — this app uses the ▲▼ `VotePill` exclusively.

---

## Pre-Delivery Checklist

Use `references/pro-rules.md` (native-scoped: icon discipline, interaction feedback, light/dark contrast, safe-area
layout, accessibility) in place of the skill's `--design-system` inline checklist, which is web-flavored
(`cursor-pointer`, hover states, CSS breakpoints) and does not apply to this native app.
