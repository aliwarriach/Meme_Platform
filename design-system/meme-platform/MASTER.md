# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/meme-platform/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** Meme Platform
**Generated:** 2026-08-07 (initial persist, hand-corrected same day — see Reconciliation below)
**Category:** Native community/social app (React Native + Expo, NativeWind) — not a web landing page
**Style Name:** "Neon Plum" (ported 2026-08-21 from the web app's already-shipped "Vaporwave Glass
Evolution"/"Luminous Vapor Glass" system — see Reconciliation below) — supersedes the original
"Vivid Meme Culture" tokens (Stitch-generated 2026-07-26), which shipped dark-only and had no
light/dark toggle.

**2026-08-21 — Native light/dark port:** Native (iOS/Android) gained a real light/dark toggle for
the first time, porting web's "Neon Plum" palette via `frontend/tailwind.config.js` +
`frontend/src/global.css` CSS-variable theming (`darkMode: 'class'`, NativeWind's `colorScheme`).
Every section below is updated for this — **native is no longer dark-mode-only**, superseding
every "dark-mode-only"/"never introduce light mode" statement that was in this file before this
date. See "Color Palette" and the new "Light/Dark Mode Mechanism" subsection below.

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

### Color Palette (source of truth: `frontend/src/global.css` CSS variables, mirrored into
`frontend/tailwind.config.js`'s `theme.extend.colors`; values themselves ported verbatim from
`frontend/src/constants/webFeedThemeVapor.ts`'s `VAPOR_COLORS_DARK`/`LUMINOUS_COLORS_LIGHT`)

Every role below now has **two** values — dark (`.dark` selector in `global.css`) and light (`:root`,
default). Both are driven by the same className (`bg-surface`, `text-ink-muted`, etc.) — the CSS
variable swaps underneath when `colorScheme.set()` toggles, so component code never branches on
mode itself.

| Role | Token | Dark | Light | Usage |
|------|-------|------|-------|-------|
| Background | `bg` | `#1A0E1B` | `#FFF7FB` | Screen background |
| Surface (lowest → bright, elevation scale) | `surface-lowest` | `#120A11` | `#F3D9E7` | Deepest recess (e.g. input wells) |
| | `surface-low` | `#1A0E1B` | `#FDF3F8` | |
| | `surface` | `#241328` | `#FFFFFF` | Default card/panel surface |
| | `surface-high` | `#2E1930` | `#FFF0F7` | Raised elements, unselected chips |
| | `surface-highest` | `#381F38` | `#FFFFFF` | |
| | `surface-bright` | `#422540` | `#FFFFFF` | Highest elevation before primary |
| Primary | `primary` | `#FF5CA0` | `#EC4899` | Bright pink — ring/icon/border/active-tab-indicator/upvote-arrow. **Not** a safe white-text fill in either mode. |
| | `primary-container` | `#DB2777` | `#BE185D` | Fill-safe deep pink — solid buttons/badges/chips paired with white text (`PillButton` primary variant, `Chip` selected, notification badges) |
| | `primary-dim` | `#FF5CA0` | `#BE185D` | Text-on-tinted-primary (e.g. pending badge label, `bg-primary/20` + this text) |
| | `on-primary` | `#1A0E18` | `#1A0E18` | Dark ink text/icon on top of a bright accent fill (gold/amber/etc., not `primary` itself) |
| Secondary | `secondary` | `#C084FC` | `#6D28D9` | Purple accent |
| | `secondary-container` | `#6A498B` | `#6D28D9` | |
| | `secondary-light` | `#C084FC` | `#A77EE8` | |
| Tertiary | `tertiary` | `#15803D` | `#15803D` | Success/positive green — single AA-safe green, replaces the old dual-green pair (old `#16A34A`-family measured only ~3.3:1 vs white, failed AA) |
| | `tertiary-container` | `#15803D` | `#15803D` | |
| Error | `error` | `#FF9B9B` | `#BA1A1A` | Error text/icons |
| | `error-container` | `#BA1A1A` | `#821212` | Solid error-fill badges |
| Outline | `outline` | `#4A2C42` | `#C98FB0` | Borders needing more contrast (dashed pickers, outline buttons) |
| | `outline-variant` | white base, `/NN` modifier for opacity | `#F3D9E7` | Default hairline borders/dividers |
| Heading | `heading` | `#FDF2F8` | `#2A1220` | Headings, high-emphasis titles |
| Ink | `ink` | `#FDF2F8` | `#2A1220` | Primary body text |
| Ink muted | `ink-muted` | `#C9A9BA` | `#6B4A5C` | Secondary/meta text, placeholders, disabled labels, loading spinners |
| Achievement/rank (net-new) | `accent-gold` | `#F59E0B` | `#F59E0B` | Rank-1 medal, achievement badges — **fill-safe with dark ink (`on-accent-ink`) text only**, never white |
| | `accent-amber` | `#EA580C` | `#EA580C` | Pending/in-progress — deliberately distinct from gold ("you won" vs. "still moving") |
| | `accent-cyan` | `#0E7490` | `#155E75` | Share/send actions |
| | `accent-upvote` / `accent-downvote` | `#4ADE80` / `#FF8080` | `#15803D` / `#DC2626` | Dedicated vote-arrow colors (`VotePill`) — no longer reuses `primary`/`secondary` |
| | `rank-gold` / `rank-silver` / `rank-bronze` | `#F59E0B` / `#CBD5E1` / `#B45309` | `#F59E0B` / `#94A3B8` / `#92400E` | Leaderboard top-3 medal fills (`RankBadge`) |
| | `surface-glass` / `surface-press` / `press-tint` / `border-highlight` | translucent, see `global.css` | translucent, see `global.css` | Glass-card surfaces, native's press-state equivalent of web's hover |

**Color role notes:**
- **No longer dark-mode-only.** Native has a real light/dark toggle (Redux `theme` slice,
  `frontend/src/store/themeSlice.ts`, persisted via `expo-secure-store`) — see "Light/Dark Mode
  Mechanism" below.
- `primary` vs. `primary-container` is a real, enforced distinction (unlike the old system, which
  used one hex for both roles): `primary` is bright and ring/icon/border-safe but **not** a safe
  white-text fill; `primary-container` is the deep, fill-safe pink. Any `bg-primary` (unmodified,
  no `/NN`) paired with white text/icon content is a bug — use `bg-primary-container` instead. This
  was an actual pre-existing contrast issue in several components (`PillButton`, `Chip`,
  `ChallengeRow`, notification badges, etc.), fixed as part of the port.
- Color is never the only signal: membership/status states (active/pending/owner) pair a text label with their
  color treatment (see CommunityDetailScreen's `renderActionButton`), not color alone.
- `ActivityIndicator`'s `color` prop cannot take a NativeWind className (RN native prop, not a style). Source it
  from `frontend/src/constants/theme.ts`'s mode-aware `NEON_PLUM_DARK`/`NEON_PLUM_LIGHT` objects via
  `useColorScheme()` from `nativewind` (kept in sync with the Redux `theme` slice), not a static
  hex literal or the old single-mode `INK_MUTED`/`PRIMARY_DIM` constants (removed — they didn't
  vary by mode and are gone from `theme.ts`). Same applies to `placeholderTextColor`, `shadowColor`,
  and any other native-only color prop.

### Light/Dark Mode Mechanism (net-new, 2026-08-21)

- **Tokens:** CSS variables in `frontend/src/global.css` (`:root` = light default, `.dark` = dark
  override), consumed by `tailwind.config.js` via `rgb(var(--color-x) / <alpha-value>)` — this
  preserves every existing `/NN` opacity-modifier className (`bg-primary/10`, etc.) with zero
  component-level edits. `darkMode: 'class'` is set so NativeWind's `colorScheme.set()` (not OS
  `prefers-color-scheme` alone) is the deterministic source of truth.
- **Preference state:** `frontend/src/store/themeSlice.ts` (Redux Toolkit), `mode: 'light' | 'dark'`.
  `hydrateThemeMode()` runs once at boot (`app/_layout.tsx`, alongside `bootstrapAuth()`), reading
  `frontend/src/services/themeStorage.ts` (an `expo-secure-store`-backed helper, mirroring
  `tokenStorage.ts`'s exact web/native-split pattern — **not** AsyncStorage, which isn't a
  dependency of this project) with an `Appearance.getColorScheme()` OS-preference fallback for a
  first launch. `toggleThemeMode()` persists + calls `colorScheme.set()` on every toggle. The splash
  screen stays up until both auth and theme are hydrated, so there is no light/dark flash on boot.
- **Toggle UI:** `frontend/src/features/auth/components/ThemeModeToggle.tsx`, a segmented pill
  control (not a bare `Switch`, to carry over the pill-control convention) in `SessionScreen.tsx`
  (Profile), above `ENTRY_LINKS`.
- **Navigation chrome:** `expo-router`'s `ThemeProvider` (from `@react-navigation`) is no longer
  hardcoded to `DarkTheme` — `app/_layout.tsx` picks `NEON_PLUM_NAV_DARK`/`NEON_PLUM_NAV_LIGHT`
  (custom themes built on `DarkTheme`/`DefaultTheme`) based on the Redux mode, and `expo-status-bar`
  flips `style="light"`/`"dark"` to match.
- **Typography — kept Be Vietnam Pro, did not adopt web's Quicksand.** A deliberate call, not an
  oversight: (1) the meme Creator/Editor renders identically on web and native via shared NativeWind
  classes bound to this file's tokens (see `webFeedThemeVapor.ts`'s own header) — introducing a
  second font family natively would fork that shared rendering path; (2) Be Vietnam Pro is already
  fully loaded (`@expo-google-fonts/be-vietnam-pro`) and used across every native screen — adding
  Quicksand as a second native font bundle costs load time/splash duration for a purely aesthetic
  swap; (3) this file's own Reconciliation section already validated Be Vietnam Pro as the shipped,
  correct native identity — the light/dark port changes color, not typography.

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
- **`rounded-card`** (mode-aware: `24px` dark / `16px` light, via the `--radius-card` CSS variable —
  matches web's `VAPOR_RADIUS_DARK`/`LUMINOUS_RADIUS_LIGHT`) on card-level containers (`GlassCard`, community icon
  fallback tile, privacy-option cards).

### Component Conventions (existing shared components — reuse, don't reinvent)

- `PillButton` — primary interactive control; `primary`/`secondary`/`outline`/`ghost` variants, built-in loading state,
  min-height 44px. `primary` variant fills with `primary-container` (not `primary` — see Color role notes) and
  carries a soft `primaryGlow` shadow, matching web's gradient/glow CTA treatment.
- `Chip` — filter/tab/toggle control; translucent `surface-high/60` unselected → opaque `primary-container` selected.
- `GlassCard` — frosted glass elevation, `bg-surface-glass` fill, `BlurView` `tint` now mode-aware (`dark`/`light`
  based on `useColorScheme()`). **Must use the `StyleSheet.absoluteFill` sibling-layer pattern**
  (`BlurView` as an absolute-fill sibling, real content in a separate normal-flow `View`) — never put layout-bearing
  classNames directly on `<BlurView>`. `BlurView` is not NativeWind-registered and has a confirmed Android sizing bug
  when nested with real content; it was fully removed from `FloatingBottomNav.tsx` after three failed fix attempts.
  Current `GlassCard.tsx` nests real children inside `<BlurView>` directly — flagged as a latent risk, out of scope
  for this pass (not touched by the communities screens; see report).
- `TopBar` — back arrow + centered title (mode-aware `heading` color) + right actions, safe-area aware.
- `Avatar` — circular, initials fallback on `primary-container`.
- `RankBadge` (net-new, `features/leaderboards/components/RankBadge.tsx`) — gold/silver/bronze medal fill (`on-accent-ink`
  text) for leaderboard ranks 1-3, plain `heading` text otherwise; paired with `rankTintClassName()` for a
  medal-tinted row background. Shared by `IndividualLeaderboardRow`/`CommunityLeaderboardRow`.
- `ThemeModeToggle` (net-new, `features/auth/components/ThemeModeToggle.tsx`) — the light/dark segmented pill in
  Profile settings. See "Light/Dark Mode Mechanism" above.
- `VotePill` — Reddit-style ▲score▼, never a heart/like icon.
- `TextField` — pill-shaped input, `border-error` on validation failure.
- `FloatingBottomNav` — absolute-overlay dock, **plain inline `StyleSheet`, not NativeWind, not `BlurView`** (same
  Android sizing bug as above) — this is intentional and must not be "fixed" back to className/blur. Mode-aware via
  a hand-mirrored `NATIVE_TOKENS: Record<'dark'|'light', ...>` object (reads `useColorScheme()`), not CSS variables,
  since this component can't use classNames at all.

### Challenge Status Color Convention (established, reuse — don't reinvent per screen)

`ChallengeRow.tsx` established: `active` → `bg-tertiary` (success green), `evaluated` → `bg-primary-container`
(fill-safe deep pink, paired with white text), `setup` → `bg-surface-high` (neutral, labeled "Pending"). The 2026-08-07
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

- A second, parallel theming mechanism (e.g. a hand-rolled Context/StyleSheet theme system like web's) instead of
  NativeWind's CSS-variable + `colorScheme` mechanism already wired up — native has one light/dark mechanism, not two.
- `dark:`-prefixed NativeWind variant classNames for new mode-specific styling — this system uses CSS variables
  (one className resolves to different values per mode), not `dark:bg-x` pairs; adding the latter would create two
  competing theming approaches in the same codebase.
- Web-only affordances that don't exist on native: `cursor-pointer`, CSS `:hover`, fixed breakpoints for a phone-first
  native screen.
- Raw hex literals inline in component code for anything NativeWind can express via a token — use the
  `tailwind.config.js` color tokens (className) or, for native-only color props, `frontend/src/constants/theme.ts`'s
  mode-aware `NEON_PLUM_DARK`/`NEON_PLUM_LIGHT` via `useColorScheme()`.
- `bg-primary` (unmodified) paired with white text/icon content — `primary` is not a safe white-text fill in either
  mode; use `bg-primary-container`.
- `BlurView` with layout-bearing classNames directly on it, or nested inside real content without the
  absolute-fill-sibling pattern (confirmed Android sizing bug).
- Heart/like icons for reactions — this app uses the ▲▼ `VotePill` exclusively.

---

## Pre-Delivery Checklist

Use `references/pro-rules.md` (native-scoped: icon discipline, interaction feedback, light/dark contrast, safe-area
layout, accessibility) in place of the skill's `--design-system` inline checklist, which is web-flavored
(`cursor-pointer`, hover states, CSS breakpoints) and does not apply to this native app.

---

## Web Design System (Platform.OS==='web' rendering only — everything above this section is native-only)

**Everything above this line governs native screens exclusively** (`ThemeProvider` hardcoded to
`DarkTheme`, "Vivid Meme Culture" tokens via `tailwind.config.js`). It does not apply to any
`.web.tsx` platform-extension sibling.

**Status (as of 2026-08-19):** "Vaporwave Glass Evolution" (dark) / "Luminous Vapor Glass" (light)
is the **standing default design system for all web rendering in this project** — i.e. the system
any future FULL MODE pass on any other web screen should extend, not re-roll the skill for. It was
originally a Feed/Friends-only pilot and has now been promoted to the project default, starting
with the Voting screen (see `pages/voting-web.md` for that migration's full record).

- **Token/provider source of truth:** `frontend/src/constants/webFeedThemeVapor.ts` (color roles,
  type scale, radius, spacing, font stack — both modes, with inline sourcing comments; read this
  file first, never re-derive values from memory) + `frontend/src/constants/VaporwaveWebTheme.tsx`
  (`VaporwaveThemeProvider` / `useVaporwaveTheme()` — light/dark toggle, persisted to
  `localStorage` under `vaporwave-web-theme`, OS-preference fallback). Each consuming screen
  mounts its own provider instance; the shared storage key is what keeps the mode choice
  consistent across screens on revisit.
- **Reference implementations** (follow this exact pattern — provider mount, `injectFeedWebFont()`
  on mount, `LinearGradient` background from `colors.gradientTop/Mid/Bottom`, `createStyles(colors,
  radius, spacing)` factories, no page-specific theme file of its own):
  - `frontend/src/features/feed/FeedScreen.web.tsx` (+ `WebFeedTopBar`, `WebFeedRail`,
    `WebMergedFeedList`, `WebMemeCard`, `WebVotePill`, `WebAvatar`, `WebContainerCard`)
  - `frontend/src/features/friends/FriendsScreen.web.tsx` (+ `WebFriendsTopBar`, `WebFriendRow`,
    `WebFriendRequestRow`)
  - `frontend/src/features/voting/VotingScreen.web.tsx` (+ `WebVotingTopBar`, `WebVotingTabs`,
    `WebStandingRow`, `WebWinnerBanner`, `WebCompetitionEntryModal`)
  - `frontend/src/features/challenges/CompeteScreen.web.tsx` (hub) +
    `CreateChallengeScreen.web.tsx`/`CreateOpenChallengeScreen.web.tsx`/
    `ProposeVsChallengeScreen.web.tsx` (create/propose forms) +
    `ChallengeDetailScreen.web.tsx`/`DuelDetailScreen.web.tsx` (detail) — the whole
    Compete/Challenges flow, migrated as one consolidated pass (+ `WebCompeteTopBar`,
    `WebCompeteTabs`, `WebCompeteButton`, `WebCompeteTextField`, `WebDurationPresets`,
    `WebChallengeStatusBadge`, `WebCountdownTimer`, `WebChallengeCard`, `WebChallengeSideCard`,
    `WebResultBanner`, `WebSubmissionThumb`, `WebSubmissionPicker`, `WebSideMemberPicker`)
  - `frontend/src/features/leaderboards/LeaderboardsScreen.web.tsx` (Individual/Communities
    ranked standings, net-new — no prior independent theme existed for this screen, see
    `pages/leaderboard-web.md`) (+ `WebLeaderboardsTopBar`, `WebLeaderboardTabs`,
    `WebLeaderboardRow` — a single shared row component for both tabs, reusing `WebAvatar` for
    both user avatars and community initials tiles rather than a second fallback
    implementation; rank-badge treatment reuses `WebStandingRow`'s established top-3 convention)
  - `frontend/src/features/auth/SessionScreen.web.tsx` (Profile/account/settings — identity block,
    stat cards, badges, settings-list groups, see `pages/profile-web.md`) (+ `WebProfileTopBar`,
    `WebScoreCard`, `WebBadgeChip`, `WebSettingsRow`, net-new `WebEmailVerificationBanner`; reuses
    `WebAvatar` for the identity-block avatar rather than a dedicated `WebProfileAvatar` — the
    prior independent-theme version of that component was retired outright, not rewritten)
  - `frontend/src/features/messaging/InboxScreen.web.tsx` (conversation list) +
    `ThreadScreen.web.tsx` (single-thread view) — the full Inbox flow, net-new (no prior
    independent theme existed for either screen), see `pages/inbox-web.md` (+ `WebInboxTopBar`,
    `WebThreadTopBar`, `WebConversationRow`, `WebNewChatModal`, `WebMessageBubble`,
    `WebMessageComposer`; reuses `WebAvatar` throughout). Distinct from
    `components/web/DesktopInboxPanel.tsx` (a Feed-only rail preview, now dead code — see
    `pages/inbox-web.md`'s relationship section) and from `components/web/WebFeedRail.tsx` (the
    rail preview's actual live implementation, which still renders its rows via the shared native
    `ConversationList` unstyled — a pre-existing seam out of this pass's scope).
- **Migrated screens so far:** Feed, Friends, Voting, Challenges/Compete, Leaderboard, Profile,
  Inbox — all five planned migration-sequence screens are now complete (see `pages/compete-web.md`,
  `pages/leaderboard-web.md`, `pages/profile-web.md`, and `pages/inbox-web.md` for those
  migrations' full records).
  **Not yet migrated** (still runs its own independent theme system, not Vaporwave — do not
  assume Vaporwave applies there until a dedicated FULL MODE pass migrates it): Communities
  (`pages/community-web.md`) — intentionally left as-is, per every prior pass's PILOT-SCREEN
  precedent, until it gets its own pass.
- **Accessibility discipline established by the Voting migration, apply on future migrations
  too:** not every token that "looks like the brand color" is safe as a text-bearing fill or
  foreground in both modes — `indigoPrimary` (bright cyan) fails 4.5:1 as a white-text fill in
  both modes and fails even 3:1 as light-mode foreground/icon content; it's a glow/border/
  dark-mode-only-foreground hue, not a universal fill color. `indigoSecondary` (magenta) is the
  token that actually clears 4.5:1 as a solid fill + `onAccent` text in both modes. See
  `pages/voting-web.md`'s Accessibility section for the full measured contrast table before
  reusing either as foreground content on a new screen.
- **Shared chrome note:** `DesktopShell`/`DesktopSidebarNav` (mounted app-wide in `app/_layout.tsx`)
  still render in the older pre-Vaporwave chrome (`#1e0f13`/`#372529`) — a known, accepted seam
  every Vaporwave screen so far has inherited, not something any single-screen migration pass
  should fix (that's shared, app-wide chrome, out of scope for a page-scoped pass).
- Page-specific rules/token tables for each migrated screen live in `pages/feed-web.md` (stale —
  predates the Vaporwave promotion, describes the earlier "Dark Cinema" pilot only),
  `pages/voting-web.md` (current, describes Vaporwave as actually used), `pages/compete-web.md`
  (current as of the Challenges/Compete migration — supersedes that file's own prior Neubrutalism
  RESKIN record), `pages/leaderboard-web.md` (current — net-new build, no prior system to
  supersede; also records a still-open app-level IA finding: `DesktopSidebarNav` has no
  "Leaderboards" link), and `pages/inbox-web.md` (current — net-new build for both the
  conversation-list and thread screens; also records the `DesktopInboxPanel`/`WebFeedRail`
  relationship and confirms the final old-system-file consolidation check across all five
  migration passes). Friends has no page doc yet (never generated one) — treat
  `FriendsScreen.web.tsx` itself plus this section as its documentation of record until one
  exists.
