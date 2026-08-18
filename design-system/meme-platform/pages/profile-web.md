# Profile/Session Web Page Overrides

> **PROJECT:** Meme Platform
> **Generated:** 2026-08-11 (hand-authored — see "Why hand-authored" below)
> **Page Type:** Desktop/web-only pass — `SessionScreen.web.tsx` (profile/account/settings)
> **Mode:** FULL MODE — this screen's UX was audited (identity block → stats → badges →
> settings-list → danger zone) and the `voting-web` visual system was reused verbatim per this
> task's explicit brief, not re-generated. Native `SessionScreen.tsx` is completely untouched.
> **Light + dark**, both inherited from voting-web, both grounded there.

> ⚠️ **IMPORTANT:** Rules in this file **override** `design-system/meme-platform/MASTER.md` and
> apply **only** to the web-only profile tree (`SessionScreen.web.tsx`, `components/web/WebProfile*`,
> `components/web/WebScoreCard.tsx`, `components/web/WebBadgeChip.tsx`,
> `components/web/WebSettingsRow.tsx`, `constants/webProfileTheme.ts`,
> `constants/ProfileWebTheme.tsx`). MASTER.md's "Vivid Meme Culture" system is untouched and still
> governs every native screen. `pages/feed-web.md`, `pages/community-web.md`, `pages/compete-web.md`,
> and `pages/voting-web.md` are untouched and still govern only their own trees.

---

## Why this page reuses voting-web's palette verbatim, not a fresh reconciliation

This task's brief explicitly instructed: "Reuse the 'voting-web' design system... same palette,
typography, and shape language as that prior web pass, extended/adapted to fit a profile/settings
screen's needs." Unlike `compete-web.md`/`community-web.md`/`voting-web.md`, this pass did **not**
run a new multi-query convergence — the color/typography grounding already exists and re-rolling it
would either (a) coincidentally match and add no information, or (b) diverge and contradict an
explicit instruction to reuse. A cross-check `--design-system` roll was still run (see command below)
to confirm no adaptation was needed — see "Cross-check roll" below for why its result was discarded
rather than adopted.

Rose-crimson `#E11D48` (both modes) as primary, gold `#F59E0B` (both modes) as the
badge/achievement accent — same values, same accessibility audit, as `voting-web.md`. Zero violet,
zero indigo, zero muted-blue-as-primary, consistent with this project's own established web-palette
guidance (avoid corporate-SaaS violet/indigo convergence; push toward energetic meme-culture colors).

### Cross-check roll (discarded, logged per this agent's own transparency rule)
```
python search.py "profile settings account danger zone logout gold trophy hot pink warm energetic gen-z light and dark mode" --design-system -p "Meme Platform"
STYLE: Dark Mode (OLED) — Light ✗ No / Dark ✓ Only
COLORS: Primary #EA580C / Secondary #F97316 / Accent #059669 / Background #0F172A
TYPOGRAPHY: Space Grotesk / Inter — "web3, bitcoin, defi, digital gold, fintech, crypto"
```
Discarded in full: orange/green reads fintech/crypto (the typography mood keywords literally say
"web3, bitcoin, defi"), a semantic mismatch for a meme-platform profile screen, and light mode is
unsupported outright — this screen needs both. `--design-system` is non-deterministic and blends
the `landing` domain per this agent's own documented gotcha; a single roll is not grounds to deviate
from an explicit brief instruction to reuse an already-converged, already-audited system.

### Accessibility grounding (re-confirmed for this page's new component types)
```
python search.py "contrast focus keyboard touch target spacing grouping icon" --domain ux -n 5
```
Returned: 44×44px minimum touch targets (High), 8px minimum gap between adjacent touch targets
(Medium), visible focus rings for keyboard users (High), body-text contrast 4.5:1 minimum (High).
Directly informs `WebSettingsRow` (52px row height, full-row hit target, focus ring) and
`WebScoreCard`/`WebBadgeChip` (solid-fill + `onColor` text, never a tinted background with
`goldText`/`primaryText` on top — same structural rule `voting-web.md`'s audit established).

```
python search.py "settings list row toggle switch danger action press feedback" --stack react-native -n 5
```
Returned: touch feedback on press (opacity/hover — applied via each row's `hovered`/`focused`
Pressable states), `FlatList` for 50+ items. This screen's lists (5 entry links, ≤~6 badges) stay
well under that threshold, so `.map()` inside `ScrollView` was kept — same reasoning
`CompeteScreen.web.tsx` used for its own bounded Active/Open/Results sections.

---

## Page-Specific Rules

### Layout
- **Structure:** identity block (avatar + username + email + bio) → two-up stat cards (Meme
  Score, Badge count) → badge chip row → "Explore" settings group (Friends/Communities/Compete/
  Competitions/Inbox, same five entries the native screen already links) → "Account" settings
  group (Log Out, danger-zone styled). Renders inside `DesktopShell`'s content column (mounted
  app-wide in `app/_layout.tsx`, untouched by this pass) — no fixed-width mobile card.
- **No back button** in `WebProfileTopBar`: Profile is a primary sidebar destination
  (`DesktopSidebarNav` has its own "Profile" item) and a `FloatingBottomNav` tab, matching the
  native screen's own navigation model (bottom-tab entry, no drill-in back affordance).
- **Breakpoint:** reuses `DESKTOP_FRAME_MIN_WIDTH` (900px), same as every other web page.

### Light/Dark mechanism
- `constants/webProfileTheme.ts` exports `PROFILE_LIGHT`/`PROFILE_DARK` — same hex values as
  `webVotingTheme.ts`'s `VOTING_LIGHT`/`VOTING_DARK`, copied not imported (independent file per
  this task's explicit scope boundary: this tree must not couple to the voting tree).
- `constants/ProfileWebTheme.tsx` exports `ProfileThemeProvider` + `useProfileWebTheme()`,
  mounted locally by `SessionScreen.web.tsx` only. Same resolution order as every prior web
  tree: `localStorage` (`profile-web-theme` key) → `Appearance.getColorScheme()` → light
  fallback. Toggle lives in `WebProfileTopBar`.

### Spacing / Radius / Type
- Same 4/8/12/16/24/32px scale and 16px card radius as voting-web (`PROFILE_WEB_SPACING`,
  `PROFILE_WEB_RADIUS`) — deliberately identical, not independently re-derived, since this page
  is explicitly the same shape language as that pass.
- **Font family switched post-launch** from voting-web's Anton/Epilogue to Fredoka/Nunito — the
  same pairing `webCommunityTheme.ts` uses — per explicit user request to unify the font system
  across web sections and fix sizing/legibility issues (Anton's condensed all-caps face read too
  small/cramped at settings-row and meta sizes). `display`/`stat`/`h2`/`cardTitle` now use
  Fredoka; `title`/`body`/`meta`/`label` stay on the body face (now Nunito). Sizes and weights
  were re-tuned for Fredoka's rounder, wider glyphs: `display` 26→24px, `stat` 34→30px (both now
  `600`/`700` weight instead of Anton's single 400, since Fredoka has real weight variants).
  `stat` remains this page's one size not present in voting-web/community-web's scale, for the
  Meme Score hero number's own hierarchy need (see UX improvements below).

### Component Notes
New standalone `components/web/` components, following the established `Web*` naming
convention, none reusing another page's tree: `WebProfileTopBar`, `WebProfileAvatar`,
`WebScoreCard`, `WebBadgeChip`, `WebSettingsRow`.

### UX improvements made this pass
1. **Two-up stat cards (Meme Score + Badge count)** replace the native screen's single
   centered-text score block. Real information gap: the native screen shows badge count only as
   an uncounted row of chips a viewer has to tally by eye; a "returning core user" checking their
   standing wants both numbers at a glance. Additive only — both values come from queries the
   native screen already runs (`useProfileScore`, `useMyBadges`), no new fetch.
2. **Danger-zone visual separation for Log Out** — a dedicated "Account" settings group,
   destructive-colored row (icon + text in `colors.destructive`, no chevron) instead of the
   native screen's plain outline `PillButton` floated below the link list with no visual
   grouping from the links above it. Color is not the only signal: the missing chevron and
   section separation are a second, non-color cue, per the accessibility rule that color alone
   must never carry the distinction.
3. **Settings-list rows for entry links** replace the native screen's bare `Pressable` rows with
   a shared `WebSettingsRow` component — same visual treatment for every row (Explore links +
   danger zone), giving the screen one consistent settings-list language instead of two
   different implicit patterns for structurally similar rows.

No structural/IA changes were made beyond the above (no new destinations, no removed
functionality) — this is a FULL MODE incremental pass on an existing screen's arrangement, not a
GREENFIELD rebuild.

---

## Known seams (accepted, out of scope for this pass)

- `DesktopShell`/`DesktopSidebarNav` render in `feed-web.md`'s already-diverged old chrome
  (`#1e0f13`/`#372529`) — the same accepted shell-boundary seam every prior web pilot has
  documented. Reskinning shared app chrome is out of scope for a single-screen pass.

---

## Next steps (do not do this automatically)

Profile is not itself a pilot for a new system — it reuses `voting-web`'s already-approved
palette. No further propagation action is implied by this file.
