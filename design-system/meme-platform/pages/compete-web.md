# Compete/Challenges Web Page Overrides

> **PROJECT:** Meme Platform
> **Generated:** 2026-08-11 (hand-authored — see "Why hand-authored" below)
> **Page Type:** Desktop/web-only RESKIN pass — all six `features/challenges/*.web.tsx` screens
> (`CompeteScreen`, `CreateOpenChallengeScreen`, `DuelDetailScreen`, `CreateChallengeScreen`,
> `ProposeVsChallengeScreen`, `ChallengeDetailScreen`).
> **Mode:** RESKIN MODE — visual system replaced, existing screen structure/flows preserved
> (setup → active window → evaluation → results lifecycle unchanged). **Light + dark**, both
> grounded. Native is completely untouched.

> ⚠️ **IMPORTANT:** Rules in this file **override** `design-system/meme-platform/MASTER.md` and
> apply **only** to the web-only challenges tree (`features/challenges/*.web.tsx`,
> `components/web/WebCompete*.tsx`/`WebChallenge*.tsx`/`WebCountdownTimer.tsx`/
> `WebSubmission*.tsx`/`WebSideMemberPicker.tsx`/`WebResultBanner.tsx`,
> `constants/webCompeteTheme.ts`, `constants/CompeteWebTheme.tsx`). MASTER.md's "Vivid Meme
> Culture" system is untouched and still governs every native screen. `pages/feed-web.md`
> (indigo "Dark Cinema"), `pages/community-web.md` (violet "Vibrant & Block-based"), and
> `pages/voting-web.md` (rose-crimson + gold "OLED"/"Gen Z Brutal") are untouched and still
> govern only their own trees. This is a fifth, independent system — expected divergence, not a
> contradiction requiring reconciliation.

---

## Color-direction correction (read first)

Both the feed and communities passes landed on generic muted violet/indigo and were rejected by
the user as "corporate SaaS"/"boring"/"soulless." Voting corrected that with rose-crimson + gold
("energetic, not corporate" — approved). This pass's brief explicitly asks for something
distinct from **all three** prior palettes, not violet/indigo, and not a copy of voting's
crimson/gold — steered instead toward "crispy," "refreshing," and this app's **humorous**,
playful team-vs-team meme-battle tone (punchy/citrus/playful, not competitive-crimson).

**Result: burnt-orange `#F97316` (both modes, cross-mode-identical) as primary, lime-green
`#22C55E` (both modes, cross-mode-identical) as the secondary/citrus accent** — a literal
orange+lime citrus pairing, zero violet, zero indigo, and not a reuse of voting's rose/gold.
See Reconciliation below for the full query log, including a documented case where the
higher-confidence grounded accent (blue, "trust"-flavored) was deliberately swapped for a
less-frequent but better-fitting grounded alternative (green, "energy"-flavored) — a real
design decision, not an invented value.

> **Accessibility-driven amendments (post-contrast-audit, before delivery):** three raw
> brand-fill hues initially planned as *text* colors failed AA and were given dedicated
> `*Text` roles instead (`primaryText`, `accentText`, `destructiveText` — see Accessibility
> section). The light-mode page background was also flattened from an initially-drafted warm
> cream tint (`#FFF7ED`) to flat `#FFFFFF` after `foregroundMuted` measured **4.48:1** against
> it — under 4.5:1 AA — mirroring `voting-web.md`'s own identical fix for the identical reason.
> The cream tint is still used, just demoted to `elevated` (chip/badge wash) instead of the page
> canvas.

---

## Why hand-authored, not `--persist --page`

Same tooling gate as every prior web pass: `design_system.py::persist_design_system` returns
`status: "skipped_exists"` whenever `MASTER.md` already exists and `--force` isn't passed. Since
this task explicitly forbids `--force`, everything below is transcribed by hand from raw query
output actually returned by the CLI — nothing invented from memory.

---

## Reconciliation — multi-query convergence (RESKIN's "Generating the new system" discipline)

Per this agent's own rule (never trust a single `--design-system` roll — non-deterministic,
blends in the `landing` domain), split-domain queries were run with multiple phrasings per
domain, and only what **converged across independent runs** was kept.

### Style (`--domain style -n 5`, 6 phrasings)
Phrasings run: "playful citrus punchy team battle challenge competition gen-z humorous light and
dark mode" / "meme battle team vs team playful fun energetic app not violet not indigo bold" /
"sports scoreboard competition team battle citrus orange playful bold app light dark mode" /
"meme battle countdown timer challenge scoreboard fun humor app" / "gen z youth playful bold
thick border sticker collage app light and dark mode" / "esports gaming tournament bracket team
battle vibrant colorful app".

- **"Neubrutalism"** (general — bold borders, black outlines, primary colors, thick hard-offset
  shadows, no gradients, flat colors, "playful, Gen Z"; **Light ✓ Full / Dark ✓ Full**) and its
  mobile sibling **"Neo Brutalism (Mobile)"** (pop-art, stickers, thick 4px borders, hard offset
  shadows, mechanical press, collage, light-only) together recurred **4 of 6** independent style
  queries — the strongest combined signal in this reconciliation. Only the general variant has
  full dark support, so it's the one actually adopted; the mobile variant's own CSS/effects
  fields (hard offset shadow via an extra View, mechanical press hiding the shadow on tap) are
  used as direct implementation guidance regardless.
- **Discarded despite recurring:** "Dark Mode (OLED)" (3/6, dark-only — this is `voting-web.md`'s
  own family), "Modern Dark (Cinema Mobile)" (3/6, indigo accent — `feed-web.md`'s own family),
  "Vibrant & Block-based" (2/6 — `community-web.md`'s own family; also independently reconfirmed
  during the color-domain queries below, same reasoning, discarded again there).
- **Kept:** Neubrutalism — hard black/bright outlines, flat saturated fills, offset (non-blurred)
  shadows as the primary depth cue instead of glass/blur, playful "ugly-cute" energy. A direct
  semantic fit for "team battle" + "crispy/punchy": the style's own effect language (comic-panel
  hard shadows, bold flat color blocking) reads as scoreboard/sticker-badge energy without
  needing a new metaphor invented for this page.

### Color (`--domain color -n 5`, 6 phrasings, explicitly steering citrus/orange/lime and away
from violet/indigo/crimson)
"playful gen z bold competition team battle citrus orange lime yellow app light mode not violet
not indigo not crimson" / same phrase with "dark mode" / "orange citrus lime energetic
competition scoreboard app dark background card surface" / "fresh citrus lime green playful fun
food entertainment app light mode vibrant" / "warm dark charcoal background not navy orange
citrus accent competition app card surface" / "streetwear sticker gen z bold competition dark
mode orange yellow app not navy not black pure".

- **Violet/indigo/crimson rows that recurred and were explicitly discarded**: Educational App
  (`#4F46E5`/`#7C3AED`), Sleep Tracker (`#4338CA`/`#7C3AED`), Podcast Platform (`#1E1B4B`,
  `feed-web.md`'s own exact row), Dating App/Social Media App (`#E11D48` — `voting-web.md`'s own
  exact primary) — all rejected per this task's explicit steering rule and the "not a copy of
  voting's crimson" instruction.
- **Primary — burnt orange `#F97316`**: the "Pet Tech App" row (`Primary #F97316 / Secondary
  #FB923C / Background #FFF7ED / Foreground #9A3412 / Border #FED7AA`) recurred as an **exact
  identical row in 4 of 4** independent light/citrus-phrased queries — the single
  highest-confidence row in this whole reconciliation. The same `#F97316` primary also recurred
  independently in two dark-background rows (`Running & Cycling GPS`, `Fitness/Gym App`),
  supporting a cross-mode-identical primary the way `voting-web.md`'s crimson and
  `community-web.md`'s violet both were.
- **Dark background — `#1F2937`** ("Fitness/Gym App" row, `Primary #F97316 / Secondary #FB923C /
  Accent #22C55E / Background #1F2937 / Card #313742 / Muted #37414F / Border #374151`) — chosen
  over the far more common `#0F172A`/`#192134` navy-tinted dark pairing (which recurred in
  nearly every other dark row across every query this pass **and** every prior pass, including
  `community-web.md`'s own exact dark background) specifically to keep this system visibly
  distinct from all three priors, not a coincidence of grounding: `#1F2937` is a warm-neutral
  slate, not navy-tinted, and is also distinct from `voting-web.md`'s true-black OLED background
  and `feed-web.md`'s indigo-black. Same same-row pairing gives `Card #313742`/`Muted #37414F`/
  `Border #374151`, all exact, all from this one grounded row.
- **Accent — lime-green `#22C55E`, a deliberate swap from the higher-frequency grounded
  alternative.** The "Pet Tech App" row's own Accent field is blue (`#2563EB`, "playful orange +
  **trust** blue"), and blue recurred as the accent paired with this exact orange primary in two
  more rows (`Coworking Space`, `Translator App`). That blue was **discarded anyway**: this
  task's brief explicitly asks for "citrus" and "humorous," and blue reads
  trust/corporate-adjacent, not citrus. Green was chosen instead because it is *also* directly
  grounded — independently paired with this **exact** `#F97316` primary in two dark-mode rows
  (`Running & Cycling GPS`: accent `#059669` "pace green"; `Fitness/Gym App`: accent `#22C55E`
  "energy orange + success green") — i.e. every row that used this app's specific orange
  alongside a *non-blue* accent picked green, not a third color. `#22C55E` (the more saturated of
  the two grounded greens) was kept for a stronger citrus-lime read; `Card & Board Game`'s
  `#15803D` (a darker green from the same reconciliation) was kept as the dedicated `accentText`
  role instead of being discarded (see Accessibility). This is a documented substitution between
  two already-grounded candidates, not an invented value — the same category of decision
  `community-web.md` made picking `#6366F1` over `#A78BFA` for its own dark secondary.
- **Destructive — `#DC2626`/`#EF4444`**, consistent across virtually every row in every query run
  this pass and every prior pass — no change from established convention.

### Typography (`--domain typography -n 5`, 2 phrasings)
"bold playful chunky display sans competition battle team app typography not Anton not Fredoka
not Inter" / "neubrutalism gen z bold rounded chunky friendly display readable body typography
app".

- **"Neubrutalist Bold" (Lexend Mega / Public Sans)** — mood keywords "bold, neubrutalist, loud,
  strong, geometric, quirky" — the only pairing in either query whose own **name** is the style
  category itself, a direct semantic match to the Style convergence above (the same reasoning
  `voting-web.md` used picking "Gen Z Brutal" for its literal "meme" mood match). Appeared once
  (query 2) alongside a second Neubrutalism-flavored pairing, "Neo Brutalism Mobile" (Space
  Grotesk Heavy, used for both heading *and* body at 700/900 only) — that second pairing was
  discarded specifically because using one heavy-only face for body text as well would hurt
  readability on this page's denser in-app content (submission lists, results, member pickers),
  unlike a landing page. Lexend Mega (loud, wide, display-only) + Public Sans (a genuinely
  readable, accessibility-designed body sans) gives the loud brutalist headline character without
  sacrificing body-copy legibility — a functional reason for the choice, not just a mood
  preference. Also discarded: "Gen Z Brutal" (Anton/Epilogue, 2/2) — `voting-web.md`'s own exact
  pairing, avoided for the same distinctiveness reasoning `community-web.md` used against
  `feed-web.md`'s Inter.
- Google Fonts URL (verbatim, non-truncated, from raw output):
  `https://fonts.googleapis.com/css2?family=Lexend+Mega:wght@100..900&family=Public+Sans:wght@100..900&display=swap`

### UX/accessibility grounding (`--domain ux -n 5`, "contrast focus keyboard touch target
spacing grouping icon")
Returned: 44×44px minimum touch targets (High), 8px minimum gap between adjacent touch targets
(Medium), visible focus rings for keyboard users (High — every screen in this pass is
`Platform.OS==='web'`), body-text contrast 4.5:1 minimum (High), keyboard tab order matches
visual order (High). All directly inform the Accessibility section below and every `Pressable`'s
`focused` outline treatment across the new components.

### React Native stack grounding (`--stack react-native -n 5`, "countdown timer list flatlist
tabs segmented control status badge team scoreboard")
Returned: `FlatList` over `ScrollView.map()` for 50+ items, memoized `renderItem`, stable
`keyExtractor`, `resizeMode`/`contentFit` on images. None of this pass's lists are large (a
user's own active/open/results challenges, or a handful of team members), but `FlatList` is used
anyway in `CompeteScreen.web.tsx` for consistency with every other list in this app (native and
web) — same reasoning `voting-web.md` used for its own capped-at-20 standings list.

### Accessibility — full contrast audit (measured, not eyeballed)
Every text/background pair actually used in the shipped components was computed with the
standard WCAG relative-luminance formula. Final measured set, all ≥4.5:1 AA unless noted:

| Pair | Light | Dark |
|---|---|---|
| `onPrimary` on `primary` fill | 6.37:1 | 6.37:1 |
| `onAccent` on `accent` fill | 7.83:1 | 7.83:1 |
| `primaryText` on `card`/`background` | 5.18:1 (`#C2410C`, not raw `primary`) | 6.49:1 (`#FB923C`, not raw `primary`) |
| `accentText` on `card`/`background` | 5.02:1 (`#15803D`, not raw `accent`) | 5.25:1 (raw `accent` itself passes in dark mode — no substitute needed) |
| `cardForeground`/`foreground` on `card` | 7.31:1 | 11.43:1 |
| `foreground` on `background` | 7.31:1 (bg flattened to `#FFFFFF`, same as `card`) | 14.03:1 |
| `foregroundMuted` on `card`/`background` | 4.76:1 | 4.66:1 |
| `destructive`/`destructiveText` on `card`/`background` | 4.83:1 (`#DC2626`, raw value passes in light mode) | 6.30–7.73:1 (`#FCA5A5`, not raw `destructive` — raw `#EF4444`/`#DC2626` measured only 2.5–3.9:1 against this dark background/card) |
| `onDestructive` (white) on `destructive` fill (`#DC2626`) | 4.83:1 | 4.83:1 (fill kept cross-mode-identical; raw `#EF4444` was tested as a fill and rejected — white text on it measures only 3.76:1) |

Three structural decisions came directly out of this audit, not out of taste:
1. **`elevated` (the citrus-cream `#FED7AA` tint, light mode / `#37414F`, dark mode) is never
   paired with `foregroundMuted`/`primaryText`/`accentText`/`destructiveText`** — every one of
   those measured 3.5–4.6:1 against `elevated` in at least one mode, under AA. `elevated` is only
   ever paired with `cardForeground` (full-contrast ink) or icons. Anywhere a badge/chip needed a
   colored accent, it became a **solid fill + `onColor` text** instead — the exact same
   structural fix `voting-web.md` and `community-web.md` both independently arrived at for their
   own tinted surfaces.
2. **Light-mode page `background` is flat `#FFFFFF`, not the initially-drafted `#FFF7ED` citrus
   cream** — `foregroundMuted` measured 4.48:1 against that tint, under 4.5:1 AA. The cream tint
   is kept, just demoted to `elevated` only. Identical fix, identical reasoning, to
   `voting-web.md`'s own background flattening.
3. **Dark-mode `destructive` is never used raw as text** — `#DC2626`/`#EF4444` both measured
   under 4:1 against this page's specific dark background/card (a genuinely worse result than
   `voting-web.md` saw against *its* dark background, since this page's dark surfaces are
   several steps lighter/warmer than voting's near-black OLED canvas). A dedicated
   `destructiveText: '#FCA5A5'` role (a lighter red-300 tint, itself grounded as a standard
   step in the same red family already used for `destructive`) is used for any error text sitting
   directly on `background`/`card` in dark mode; the solid-fill destructive badge (`#DC2626` +
   white text) is unaffected since fill/text-on-fill contrast doesn't depend on the page
   background.

---

## Page-Specific Rules

### Layout Overrides
- **Structure preserved from native** on all six screens, per RESKIN mode — no tab
  restructuring, no navigation changes: `CompeteScreen` keeps its Challenges/Leaderboards
  segmented view with Active/Open-to-join/Results sections; the three create/propose screens
  keep their single-column form shape; the two detail screens keep status → countdown → sides →
  action → submissions/results.
- **Shell:** `DesktopShell` (untouched, shared) supplies the sidebar at ≥900px and the 680px
  content column — same as every other in-app (non-feed) web page.
- **`FloatingBottomNav active="compete"`** is reused unmodified on `CompeteScreen.web.tsx` (the
  only one of the six screens that's a `FloatingBottomNav` destination — `feed`/`communities`/
  `compete`/`profile` are the only entries in that component's own `NavDestination` union). It
  already self-hides at ≥900px (`Platform.OS === 'web' && width >= DESKTOP_FRAME_MIN_WIDTH`), so
  it needs zero changes for this pass, matching `feed-web.md`'s and `community-web.md`'s own
  precedent of reusing it as-is. The other five screens are drill-in/form screens with no bottom
  nav on native either (back button only via `TopBar`), so `WebCompeteTopBar`'s back button is
  their only way back, same precedent `voting-web.md` used for its own single drill-in screen.
- **Breakpoint:** reuses `DESKTOP_FRAME_MIN_WIDTH` (900px), same as every other web page.

### Light/Dark mechanism
- `constants/webCompeteTheme.ts` exports both palettes (`COMPETE_LIGHT`, `COMPETE_DARK`) plus
  shared spacing/radius/type-scale/font/shadow constants.
- `constants/CompeteWebTheme.tsx` exports `CompeteThemeProvider` + `useCompeteWebTheme()`, mounted
  independently by each of the six `.web.tsx` screens (not global, not coupled to
  `VotingWebTheme.tsx`/`CommunityWebTheme.tsx` — independent file per this task's explicit scope
  boundary). Same resolution order as every prior web tree: `localStorage`
  (`compete-web-theme` key) → `Appearance.getColorScheme()` → light fallback. Toggle lives in
  `WebCompeteTopBar`, present on all six screens for a consistent cross-screen toggle.

### Spacing / Radius / Shape signature
- 4/8/12/16/24/32px scale (`COMPETE_WEB_SPACING`) — same numeric family every page in this app
  uses.
- Card radius **12px** — deliberately the sharpest of the four web systems so far (`feed-web`
  20px, `community-web` 18px, `voting-web` 16px, this page 12px), reasoned not arbitrary:
  Neubrutalism's own style notes call for sharp/minimal corners as part of its flat, hard-edged
  language; 12px keeps touch-friendly rounding without softening the brutalist read into a
  pillowy card. Pill 999px for buttons/badges (accessible tap-target convention, unchanged
  cross-page convention).
- **Two distinct border roles, not one** — a first for this app's web systems, directly following
  from the Neubrutalism style's own "black outlines" language: `border` (a normal 1px hairline —
  `#FED7AA` light / `#374151` dark — used for everyday dividers: list rows, inputs, member-picker
  rows) vs. `outline` (a **2px solid** signature border — `#000000` light / `#F8FAFC` dark — used
  **only** on emphasis surfaces: the primary CTA button, the win-result banner, the countdown/
  status cluster, and the "Active" section's challenge cards). This directly implements the
  brief's energy-placement instruction: chrome/CTAs/badges/countdown get the loud brutalist
  treatment, while plain list rows, member rows, and — critically — meme/submission thumbnails
  stay on the quiet `border` role so they remain the calm visual focus.
- **Hard offset shadow** (`COMPETE_WEB_SHADOW.hard`: `shadowColor:'#000000', shadowOffset:{width:3,
  height:3}, shadowOpacity:1, shadowRadius:0, elevation:3`) is the style's signature depth cue,
  applied only alongside `outline` on the same emphasis surfaces above — never blurred, per the
  style's own "no gradients, no blur" implementation note. Kept a flat black shadow in **both**
  modes rather than inventing a separate dark-mode shadow color: a shadow reads by being *darker*
  than its surrounding surface, not by passing a text-contrast ratio, and `#313742`(card)/`
  #1F2937`(bg) are both lighter than pure black, so the same value still reads correctly as a
  shadow in dark mode without a mode-specific substitute.

### Component Notes
New standalone `components/web/` components, none reusing another page's theme-coupled tree:
`WebCompeteTopBar`, `WebCompeteButton`, `WebCompeteTextField`, `WebDurationPresets`,
`WebChallengeStatusBadge`, `WebCountdownTimer` (replaces native `CountdownTimer`),
`WebChallengeCard` (replaces native `ChallengeRow`), `WebChallengeSideCard`, `WebResultBanner`,
`WebSubmissionThumb`, `WebSubmissionPicker` (replaces native `SubmissionPicker`),
`WebSideMemberPicker` (replaces native `SideMemberPicker`), `WebCompeteTabs`.

**Scoping note on the native component list in the task brief**: `HashtagInput.tsx` and
`DuelProposeModal.tsx` were read in full per instruction, but neither is actually imported by any
of the six in-scope screens (`HashtagInput` is used only by `features/creator/CreatorScreen.tsx`;
`DuelProposeModal` only by `features/friends/components/FriendRow.tsx` — both out of this pass's
six-screen scope, confirmed by grep). No web equivalents were built for those two; building them
would be scope creep into screens this task doesn't cover.

### UX improvements made this pass (and why — RESKIN mode only permits "genuine" ones)
1. **Duration quick-select presets** (`WebDurationPresets`, chips: 1 hour / 6 hours / 1 day / 3
   days) on all three create/propose screens (`CreateOpenChallengeScreen`, `CreateChallengeScreen`,
   `ProposeVsChallengeScreen`). Real, identical gap on all three native screens: each requires
   typing a raw minutes value (e.g. "1440" for one day) with no unit hint beyond the field label
   — the exact kind of mental-math friction this app's own `DuelProposeModal` already solved with
   presets for the fourth challenge-creation entry point. Applied identically across all three
   (per the cross-screen-consistency check — a settled pattern, not re-invented per screen);
   additive only, the manual minutes field is kept for custom durations, so no capability is
   removed.
2. **Live/Final-equivalent status clarity via `WebChallengeStatusBadge`** — the native
   `STATUS_STYLES` map already exists (`ChallengeRow`, `ChallengeDetailScreen`,
   `DuelDetailScreen` each redeclare their own copy) but its only text-vs-color the status is
   never disambiguated for `setup`-status proposals beyond a plain "Pending" chip. This pass's
   badge keeps that exact behavior/copy (no informational change) but centralizes the three
   duplicated `STATUS_STYLES` maps into one themed component, and pairs `active` with the
   `outline`+hard-shadow emphasis treatment (see Shape signature above) so a live challenge visibly
   outranks a pending/evaluated one in the Active/Open-to-join/Results stacked list on
   `CompeteScreen` — a real scan-priority gap on the native screen, which renders all three
   sections with identical row chrome regardless of urgency.
3. **No changes to the interaction model** beyond the two additions above — accept/decline,
   join-a-side, submit-a-meme, and the evaluated-results view all work exactly as before, per
   RESKIN mode's mandate to leave UX/structure/placement alone.

---

## Known seams (accepted, out of scope for this pass)

- `DesktopShell`/`DesktopSidebarNav` render in `feed-web.md`'s already-diverged old-token chrome
  (`#1e0f13`/`#372529`) — the same accepted shell-boundary seam every prior web pilot has
  documented.
- **`CompeteScreen.web.tsx`'s Leaderboards segment** reuses the native `LeaderboardsPanel`
  (→ `IndividualLeaderboardRow`/`CommunityLeaderboardRow`) unrestyled — explicitly out of this
  six-screen scope (Leaderboards is its own `features/leaderboards/` tree, not one of the six
  named target files). Because those rows assume MASTER.md's dark-only palette, the container
  wrapping them uses a **fixed dark surface sourced verbatim from MASTER.md's own `bg`/`surface`/
  `outline-variant`/`ink-muted`/`error`/`primary` tokens** (not this page's light/dark toggle) —
  identical precedent to `community-web.md`'s own Leaderboard/Challenges-tab seam, verified by the
  same reasoning (this page's own orange/green measured well under 4.5:1 against that fixed dark
  card; MASTER's own pink primary and error token were already verified legible there).
- The `/new-post` (creator) route, reached via the "Create a meme for this challenge" CTA on both
  detail screens, is native-resolved and renders unstyled on web — out of scope, same accepted
  seam `community-web.md` documented for the same route.

---

## Next steps (do not do this automatically)

Compete/Challenges is the pilot for this system only. Do not propagate this palette/typography to
Feed, Communities, Voting, Leaderboards, or any other screen until a human has reviewed the
rendered result and explicitly approved the direction.
