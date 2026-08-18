# Voting Web Page Overrides

> **PROJECT:** Meme Platform
> **Generated:** 2026-08-11 (hand-authored — see "Why hand-authored" below)
> **Page Type:** Desktop/web-only RESKIN pass — `VotingScreen.web.tsx` (Meme of the Day/Week/Month
> competitions)
> **Mode:** RESKIN MODE — visual system replaced, existing screen structure (tabs → winner banner
> → standings list → entry modal) preserved. **Light + dark**, both grounded. Native is completely
> untouched.

> ⚠️ **IMPORTANT:** Rules in this file **override** `design-system/meme-platform/MASTER.md` and
> apply **only** to the web-only voting tree (`VotingScreen.web.tsx`, `components/web/WebVoting*.tsx`,
> `components/web/WebCompetitionEntryModal.tsx`, `constants/webVotingTheme.ts`,
> `constants/VotingWebTheme.tsx`). MASTER.md's "Vivid Meme Culture" system is untouched and still
> governs every native screen. `pages/feed-web.md`'s "Dark Cinema" system and
> `pages/community-web.md`'s "Vibrant & Block-based" (violet) system are untouched and still
> govern only their own trees. This is a fourth, independent system — expected divergence, not a
> contradiction requiring reconciliation.

---

## Color-direction correction (read first)

The prior two web passes (feed, then communities) both converged on generic muted violet/indigo
via the skill's blended `--design-system` roll and were explicitly rejected by the user:
"traditional corporate SaaS," "boring af," "soulless." This pass's brief required actively
steering every query toward warm/electric hues and treating a recurring violet/indigo *primary*
result as a signal to keep searching, not a signal to accept — while keeping meme content itself
(thumbnails, entry images) the visual focus, with the new energy concentrated in accents, CTAs,
badges, winner states, and borders/glows rather than card/content backgrounds.

**Result: zero violet, zero indigo, zero muted-blue-as-primary in the final palette** — rose-crimson
`#E11D48` (both modes, cross-mode-identical) as primary, gold `#F59E0B` (both modes,
cross-mode-identical) as the competition/winner accent. See Reconciliation below for the full
query log, including violet/indigo rows that recurred and were deliberately discarded.

> **Accessibility-driven amendment (post-build, before delivery):** an earlier draft used the
> "Meme & Sticker Maker" row's hot-pink `#EC4899` as primary instead of `#E11D48`. A full contrast
> audit (see Accessibility section below) found `#EC4899` measures only **3.53:1** against white —
> fails 4.5:1 AA body text — while `#E11D48` (already grounded in this same reconciliation, as the
> dark-mode primary) measures **4.70:1**. Swapped before delivery; `#EC4899`'s own light tints
> (`#FDF4F8` muted, `#FCE9F2` border) are still used for decorative/elevated surfaces, just not as
> the primary text/fill hue. Two more raw-fill hues (`gold` as text, and `primary` as text
> specifically on the dark card) had the same problem and were given dedicated `goldText`/
> `primaryText` roles — see Accessibility section for the full audit and every measured pair.

---

## Why hand-authored, not `--persist --page`

Same tooling gate as `feed-web.md`/`community-web.md`: `design_system.py::persist_design_system`
returns `status: "skipped_exists"` whenever `MASTER.md` already exists and `--force` isn't
passed. Since this task explicitly forbids `--force`, everything below is transcribed by hand from
raw query output actually returned by the CLI — nothing invented from memory.

---

## Reconciliation — multi-query convergence (RESKIN's "Generating the new system" discipline)

Per this agent's own rule (never trust a single `--design-system` roll — non-deterministic, blends
in the `landing` domain), split-domain queries were run with different phrasings, plus one
cross-check `--design-system` roll, and only what **converged across independent runs** was kept.

### Style (`--domain style -n 5`, 2 phrasings)
"competition leaderboard voting gamified energetic warm electric dark mode celebration winner" /
"gaming esports leaderboard competition trophy vibrant warm orange gold energetic dark mode".

- **"Dark Mode (OLED)"** (deep black `#000000`/`#121212`, "vibrant neon accents", WCAG AAA,
  dark-only) appeared as the **#1 result in both** independent style queries, **and** was
  independently returned by the cross-check `--design-system` roll's STYLE field (query below) —
  3/3 convergence, the strongest signal in this whole reconciliation.
- **"Vibrant & Block-based"** (Neon Green/Electric Purple/Vivid Pink/Bright Cyan/Sunburst orange;
  bold, energetic, playful; **Light ✓ Full / Dark ✓ Full**) also appeared 2/2 — kept as the
  *light-mode-capable* half of this system, since "Dark Mode (OLED)" itself has no light variant
  and this page needs both.
- **Discarded despite recurring:** "Modern Dark (Cinema Mobile)" (indigo `#5E6AD2` accent, 2/2) —
  this is `feed-web.md`'s own family; reusing it would blur two supposedly-independent page
  systems, exactly the reasoning `community-web.md` used to reject the same style for itself.
- **Kept:** deep-black/near-black dark canvas (OLED) + vibrant, non-muted accent colors, full
  light+dark support via the Vibrant & Block-based family for the light half.

### Color (`--domain color -n 5`, 4 phrasings, explicitly steering warm/gold/pink and away from
violet/indigo)
"gamified leaderboard trophy competition warm coral orange gold vibrant dark mode app not violet
not indigo" / "meme entertainment gen-z vibrant neon pink orange electric competition light mode
app" / "meme sticker viral pink orange gold dark mode background near black entertainment gen-z
app" / "streaming music entertainment app dark background hot pink rose orange gold accent card
surface".

- **Violet/indigo rows that recurred and were explicitly discarded**: Sleep Tracker
  (`#4338CA`/`#7C3AED`/`#0F172A`), Wallpaper & Theme App (`#7C3AED`/`#EC4899`), Gaming
  (`#7C3AED`/`#A78BFA`) — all rejected as primary/secondary despite appearing multiple times,
  per this task's explicit steering rule.
- **Primary — hot pink `#EC4899`**: recurred in **3 independent rows** — "Meme & Sticker Maker"
  (Primary, exact product-type semantic match for this app), "Magazine/Blog" (Accent), "Wardrobe &
  Outfit Planner" (Secondary, `#EC4899` exact). The Meme & Sticker Maker row was taken as the base
  light-mode set (Background/Card/Border/Foreground) since it's a single coherent grounded row,
  not a patchwork.
- **Dark-mode primary — rose-crimson `#E11D48`**: recurred in **3 independent dark-capable rows**
  — "Video Streaming/OTT" (Accent, note "play red"), "Social Media App" (Primary), "Dating App"
  (Primary). No violet/indigo dark row was used for any role.
- **Gold/amber accent `#F59E0B`**: the highest-confidence single token in this reconciliation —
  recurred **3 times independently**: "Trivia & Quiz Game" (Accent, literal note **"gold
  leaderboard"** — names this screen's exact use case), "Meme & Sticker Maker" (Secondary), and
  the cross-check `--design-system` roll's own Accent field (below). Kept cross-mode-identical
  (light and dark both `#F59E0B`), same reasoning `community-web.md` used for its own accent:
  gold on `#000000` measures **8.9:1** (exceeds 4.5:1 AA by a wide margin), so no separate dark
  variant was needed.
- **Dark background — `#000000`/`#0C0C0D`** ("Video Streaming/OTT" row) chosen over `#0F0F23`
  (Music Streaming — this is `feed-web.md`'s own exact background) and `#0F172A` (this is
  `community-web.md`'s own exact background) specifically to keep this system visibly distinct
  from both prior pages, not a coincidence of grounding — true-black also directly matches the
  "Dark Mode (OLED)" style convergence above.
- **Cross-check `--design-system` roll** (query: "meme competition leaderboard voting gold trophy
  hot pink warm energetic gen-z light and dark mode", `-p "Meme Platform"`):
  ```
  STYLE: Dark Mode (OLED) — Light ✗ No / Dark ✓ Only
  COLORS: Primary #2563EB / Secondary #7C3AED / Accent #F59E0B / Background #EFF6FF /
    Foreground #0F172A / Muted #F1F5FD / Border #E4ECFC / Destructive #DC2626
  TYPOGRAPHY: Anton / Epilogue — "Gen Z Brutal"
  ```
  This independently reconfirmed the **STYLE** choice (Dark Mode OLED, 3rd confirmation) and the
  **Accent gold `#F59E0B`** (3rd confirmation) and the **TYPOGRAPHY** pairing (2nd confirmation,
  see below). Its own Primary (`#2563EB`, blue) and Secondary (`#7C3AED`, violet) were **both
  discarded** — blue reads corporate/cool-adjacent and violet is the exact rejected family from
  the prior two passes; this roll's own gold accent is the only piece of its COLORS block that
  was kept.

### Typography (`--domain typography -n 5`, 2 phrasings)
"bold energetic gaming competition trophy leaderboard display sans typography app" / "playful meme
entertainment casual bold rounded display typography app not Fredoka not Inter".

- **"Gen Z Brutal" (Anton / Epilogue)** — mood keywords "brutal, loud, shouty, **meme**, internet,
  bold"; Best For: "Gen Z marketing, streetwear, viral campaigns" — the only pairing in either
  query whose own mood keywords literally say "meme." Appeared in the second direct query **and**
  independently in the cross-check `--design-system` roll above — 2/2 convergence, tie-broken
  over "Music/Entertainment" (Righteous/Poppins, also 2/2 but no direct semantic "meme" match) on
  product-fit grounds. Anton's condensed, high-impact numerals are also a direct functional fit
  for rank digits, not just a mood choice.
- Google Fonts URL (verbatim, non-truncated, from raw output):
  `https://fonts.googleapis.com/css2?family=Anton&family=Epilogue:wght@400;500;600;700&display=swap`

### UX/accessibility grounding (`--domain ux -n 5`, "contrast focus keyboard touch target spacing
grouping icon")
Returned: 44×44px minimum touch targets (High), 8px minimum gap between adjacent touch targets
(Medium), visible focus rings for keyboard users (High — this page is `Platform.OS==='web'`),
body-text contrast 4.5:1 minimum (High). All four directly inform the Accessibility section below.

### Accessibility — full contrast audit (measured, not eyeballed)
Every text/background pair actually used in the shipped components was computed with the standard
WCAG relative-luminance formula (not estimated) after the initial draft failed three pairs — see
the Accessibility-driven amendment note above. Final measured set, all ≥4.5:1 AA:

| Pair | Light | Dark |
|---|---|---|
| `primaryText` on `card` | 4.70:1 | 7.26:1 (`#FB7185`, not raw `primary` — see palette notes) |
| `goldText` on `card` | 4.92:1 (`#A16207`, not raw `gold`) | 9.10:1 |
| `onPrimary` on `primary` fill | 4.70:1 | 4.70:1 |
| `onGold` on `gold` fill | 8.31:1 | 8.31:1 |
| `foreground` on `background`/`elevated` | 17.85:1 / 15.37:1 | 20.07:1 / 16.97:1 |
| `foregroundMuted` on `card` | 4.76:1 | 7.63:1 |
| `destructive` on `background` | 4.83:1 | 5.58:1 |

Two structural decisions came directly out of this audit, not out of taste:
1. **`elevated` (`#FCE9F2` light) is never paired with `foregroundMuted`/`primaryText`/`goldText`**
   — those combinations measured ~4.0–4.2:1, under AA. Anywhere a badge/chip needed a colored
   accent, it became a **solid fill + `onColor` text** (the top-3 rank badge, the trophy badge, the
   "Live" status pill) rather than a tinted background with colored text on top.
2. **Light-mode page `background` is flat `#FFFFFF`, not the initially-drafted `#FDF4F8` tint** —
   that tint's luminance was close enough to white that several pairs (e.g. `foregroundMuted`)
   measured just under 4.5:1 against it specifically. Flat white removes the margin risk; visually
   the difference is negligible since `#FDF4F8` was already near-white.
3. **Unselected tab labels use `foreground`, not `foregroundMuted`** — `foregroundMuted` against
   the tab track's `elevated` background measured 4.10:1. Selection hierarchy still reads clearly
   from the selected segment's solid fill.

### React Native stack grounding (`--stack react-native -n 5`, "list ranking rows flatlist tabs
segmented control leaderboard")
Returned: `FlatList` over `ScrollView.map()` for 50+ items, memoized `renderItem`, stable
`keyExtractor`. Standings are capped at `limit=20` by the existing `getCurrentStandingsRequest`
default, but `FlatList` was used anyway for consistency with every other list in this app
(native and web), not because this specific list needs virtualization.

---

## Page-Specific Rules

### Layout Overrides
- **Structure:** `DesktopShell` (untouched, shared) supplies the sidebar at ≥900px and the 680px
  content column. This page's own structure is **preserved from native, not restructured**: top
  bar (back + title + toggle) → period tabs → winner banner → "Top Contenders" label (+ new
  live/final badge, see UX Improvements) → standings list → entry detail modal. RESKIN mode keeps
  this arrangement deliberately; no Phase 2.5 structural alternatives were generated.
- **No `FloatingBottomNav`**: Voting is not one of that component's five destinations (feed /
  communities / create / compete / profile) — it's a drill-in screen reached via the desktop
  sidebar's own "Voting" link or an in-app menu entry, matching the native screen's own
  navigation model (back button only, no bottom tab). Confirmed by checking
  `DesktopSidebarNav.tsx` (has its own "Voting" item) and `FloatingBottomNav.tsx`'s
  `NavDestination` union (does not include voting).
- **Breakpoint:** reuses `DESKTOP_FRAME_MIN_WIDTH` (900px), same as every other web page and
  `DesktopShell` itself.

### Light/Dark mechanism
- `constants/webVotingTheme.ts` exports both palettes (`VOTING_LIGHT`, `VOTING_DARK`) plus shared
  spacing/radius/type-scale/font constants.
- `constants/VotingWebTheme.tsx` exports `VotingThemeProvider` + `useVotingWebTheme()`, mounted
  locally by `VotingScreen.web.tsx` only (not global, not coupled to `CommunityWebTheme.tsx` —
  independent file per this task's explicit scope boundary). Same resolution order as the other
  two web trees: `localStorage` (`voting-web-theme` key) → `Appearance.getColorScheme()` → light
  fallback. Toggle lives in `WebVotingTopBar`.

### Spacing / Radius
- 4/8/12/16/24/32px scale (`VOTING_WEB_SPACING`) — standard functional scale, not a brand
  signature (same numeric family every page in this app uses).
- Card radius **16px** — deliberately distinct from `feed-web.md`'s 20px and
  `community-web.md`'s 18px. Reasoned, not arbitrary: Anton is a hard-edged, condensed display
  face; a tighter corner radius reads more consistent with that blockier letterform than a
  soft/pillowy round would. Pill 999px for tabs/badges (accessible tap-target convention).

### Component Notes
New standalone `components/web/` components, none reusing another page's tree:
`WebVotingTopBar`, `WebVotingTabs`, `WebWinnerBanner`, `WebStandingRow`,
`WebCompetitionEntryModal`.

### UX improvements made this pass (and why — RESKIN mode only permits "genuine" ones)
1. **Live/Final period badge** next to "Top Contenders" — surfaces `StandingsPageResponse.is_closed`,
   a field the backend already returns but the native screen never rendered. Real information
   gap: standings are live-computed with no snapshot (`voting-system.md`: "a closed period can
   still drift if late votes land"), so a viewer had no way to tell "this can still change" from
   "this is decided." Additive only — no new fetch, no structural change.
2. **Top-3 rank emphasis** in `WebStandingRow` — gold numeral + badge chip for ranks 1–3, plain
   muted numeral for the rest. The native row renders every rank identically regardless of
   position, which is a real scan-speed gap for a screen whose entire primary action is "seeing
   standings." Ranks 4+ intentionally stay visually quiet so the top of the list keeps priority
   (visual-weight principle from the UX grounding above, not decoration).
   No other changes were made to the interaction model — voting itself, entry navigation, and tab
   switching all work exactly as before.

---

## Known seams (accepted, out of scope for this pass)

- `DesktopShell`/`DesktopSidebarNav` render in `feed-web.md`'s already-diverged old chrome
  (`#1e0f13`/`#372529`) — the same accepted shell-boundary seam every prior web pilot has
  documented. Reskinning shared app chrome would propagate a system app-wide before manual
  review, which the PILOT-SCREEN RULE forbids.
- **Entry detail modal body** (`WebCompetitionEntryModal`) reuses the native `MemeCard`/
  `ContainerCard` components unrestyled (old NativeWind tokens) inside a themed close-header +
  `WebModalFrame`. Deliberate, not an oversight — mirrors `community-web.md`'s own precedent of
  reusing native rows as-is for secondary, out-of-primary-scope content (there: Leaderboard/
  Challenges tabs; here: the full entry detail, a drill-in from the actual in-scope surface —
  tabs/winner banner/standings). Voting itself is unaffected: those cards carry their own live
  vote pill (▲score▼), functionally unchanged. Rebuilding full share/comment/send parity in the
  new theme was judged out of proportion for a RESKIN-scoped pass explicitly described as
  "lighter touch than communities."

---

## Next steps (do not do this automatically)

Voting is the pilot for this system only. Do not propagate this palette/typography to Challenges,
Leaderboards, Feed, or any other screen until a human has reviewed the rendered result and
explicitly approved the direction.
