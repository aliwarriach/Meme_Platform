# Leaderboard Web Page Overrides

> **PROJECT:** Meme Platform
> **Generated:** 2026-08-20 — net-new build, no prior page doc to supersede.
> **Page Type:** Desktop/web-only screen — `LeaderboardsScreen.web.tsx` (Individual / Communities
> global standings). Screen 3 of 5 in the ordered Vaporwave migration sequence (Voting →
> Challenges → **Leaderboard** → Profile → Inbox).
> **Mode:** FULL MODE pass. Per this task's explicit instruction, Phase 1 was **promoted, not
> generated** — Vaporwave/Luminous is the project's already-persisted standing default (see
> `MASTER.md`'s "Web Design System" section), so no skill re-query was run for tokens. Phase 0
> (primary action), Phase 2 (UX/accessibility audit), Phase 2.5 (layout alternatives), and Phase 3
> (score) all ran normally against those fixed tokens.

> ⚠️ **IMPORTANT:** Rules in this file **override** `design-system/meme-platform/MASTER.md` for
> anything page-specific but **inherit** MASTER's "Web Design System" section for all shared
> tokens/mechanism, same relationship `voting-web.md`/`compete-web.md` already have. Applies to
> the web-only leaderboards tree (`features/leaderboards/LeaderboardsScreen.web.tsx`,
> `components/web/WebLeaderboardsTopBar.tsx`/`WebLeaderboardTabs.tsx`/`WebLeaderboardRow.tsx`).
> MASTER.md's "Vivid Meme Culture" system (above the Web Design System section) is untouched and
> still governs every native screen, including `features/leaderboards/LeaderboardsScreen.tsx`,
> `LeaderboardsPanel.tsx`, and both native row components — none of those files were touched.

---

## Build record — net-new, nothing retired (2026-08-20)

Unlike Voting/Challenges, this screen had **no prior independent web theme file and no prior
`.web.tsx` sibling** — there was nothing to consolidate or delete. `app/leaderboards.tsx` needed
zero changes; Expo Router's platform-extension resolution now prefers the new
`LeaderboardsScreen.web.tsx` for the web bundle automatically.

Four new files, all reading tokens from `constants/webFeedThemeVapor.ts` via
`useVaporwaveTheme()`, same source of truth already governing Feed/Friends/Voting/Challenges:
- `features/leaderboards/LeaderboardsScreen.web.tsx` — screen shell (provider mount, gradient
  background, tabs, list).
- `components/web/WebLeaderboardsTopBar.tsx` — back button + title + light/dark toggle, built
  from `WebVotingTopBar`'s pattern (the newer, focus-ring-carrying version, not the older
  `WebFriendsTopBar`/`WebFeedTopBar` copies that never got one — see Accessibility below).
- `components/web/WebLeaderboardTabs.tsx` — Individual/Communities segmented control, a local
  copy of `WebVotingTabs`'s pattern re-typed to this screen's own `LeaderboardTabKey` union
  (`'individual' | 'communities'`, not `CompetitionPeriodType`) — same "independent tree, no
  cross-theme-coupled shared primitive" precedent every prior Vaporwave screen follows (not
  reusing `WebSegmentedControl.tsx`, which is still hard-coupled to the un-migrated Communities
  theme, not Vaporwave).
- `components/web/WebLeaderboardRow.tsx` — one shared row for **both** tabs (see Component Notes
  below for why this replaces native's two-component split).

**Reused, not duplicated:** `WebAvatar` (Feed/Friends/Voting's own avatar primitive) renders
every row's leading visual — for individual rows it's a real user avatar/initials, for community
rows the same component's initials-fallback path renders the community name's initials, since
`WebAvatar` already falls back to `username.slice(0,2).toUpperCase()` for any string passed in.
No second initials-fallback implementation was written.

**No skill re-query was run for this pass.** Per the task's explicit instruction, Vaporwave/
Luminous is being *extended*, not *regenerated* — every token cited below is read directly from
`webFeedThemeVapor.ts`, or is a direct carry-forward of a contrast decision `voting-web.md`/
`compete-web.md` already made and grounded.

---

## Phase 0 — primary action

The **viewer quickly locates their own standing** — both where they personally rank and, if they
care, how their communities stack up platform-wide — and sees who's currently leading, without
extra taps. This is a read-only screen (per `.claude/memory/leaderboards.md`: "no write endpoint
exists anywhere in this feature"), so unlike Voting/Challenges there's no task to *complete* here
— the primary action is a lookup, and every decision below is judged against how fast that lookup
resolves.

---

## Tokens actually used (sourced from `constants/webFeedThemeVapor.ts`, not re-typed from memory)

### Typography
Quicksand (`QUICKSAND_STACK`, `VAPOR_TYPE_DARK`/`LUMINOUS_TYPE_LIGHT`), loaded via
`injectFeedWebFont()` — same as every other Vaporwave screen.

### Color roles used on this screen
| Role | Dark value | Light value | Used for |
|---|---|---|---|
| `gradientTop/Mid/Bottom` | `#12121f`/`#1a1a28`/`#0d0d1a` | `#f8f9ff`/`#f2f3f9`/`#ffffff` | Page background gradient |
| `surfaceGlass` | `rgba(255,255,255,0.1)` | `rgba(255,255,255,0.75)` | Default row card fill |
| `surfaceElevated` | `#292937` | `rgba(255,255,255,0.9)` | Tab track fill, rank-badge default fill (rank 4+), viewer's own row fill |
| `hoverTint` | `rgba(255,255,255,0.06)` | `rgba(0,219,233,0.08)` | Tab hover, top-bar icon-button hover |
| `border` | `rgba(255,255,255,0.15)` | `#bac9cb` | Row/tab-track/top-bar borders |
| `indigoSecondary` | `#8c016b` | `#a72683` | Selected tab fill, top-3 rank badge fill, "You" badge fill, viewer row's left accent border, `WebAvatar` initials-fallback fill — always paired with `onAccent` |
| `indigoPrimary` | `#00f0ff` | — (dark-mode-only) | Top-bar focus ring, dark mode only |
| `indigoSecondary` (foreground role) | — | `#a72683` | Top-bar focus ring, light mode only |
| `foreground` / `foregroundMuted` | `#e3e0f3` / `#b9cacb` | `#191c20` / `#3b494b` | All name/score text; `foregroundMuted` also carries the per-tab context line |
| `onAccent` | `#FFFFFF` | `#FFFFFF` | Text/icons on `indigoSecondary` fills |
| `error` | `#ffb4ab` | `#ba1a1a` | Load-error text |

### Radius / spacing
`radius.card` (24 dark / 16 light) on rows, `radius.chip` (16 both) on the rank-badge circle,
`radius.pill` (999) on tabs/badges — all from `VAPOR_RADIUS_DARK`/`LUMINOUS_RADIUS_LIGHT`.
`FEED_WEB_SPACING` (4/8/12/16/20/24) — same shared scale as every other Vaporwave screen.

---

## Accessibility — decisions made this pass (measured/grounded, not eyeballed)

No new contrast pairing was invented this pass — every color use above is a **direct reuse** of a
pairing already measured and recorded by `voting-web.md`/`compete-web.md`:
1. **Top-3 rank badge / selected tab / "You" badge**: solid `indigoSecondary` fill + `onAccent`
   text — the same 9.0:1 dark / 6.46:1 light pairing `voting-web.md` computed via the standard
   WCAG relative-luminance formula. Not re-measured here since the token values are unchanged.
2. **Top-bar focus ring**: mode-conditional (`indigoPrimary` dark / `indigoSecondary` light) — the
   same ~11.7:1 dark / ~6.5:1 light pairing `voting-web.md`/`compete-web.md` established, carried
   forward unchanged. Built into `WebLeaderboardsTopBar` from the start, following the newer
   `WebVotingTopBar` pattern rather than the older `WebFriendsTopBar`/`WebFeedTopBar` copies that
   `voting-web.md` flagged as missing this (those two files are still out of scope for this pass —
   not touched).
3. **No color-coded text sits directly on a background in this build** — rank numerals, names,
   and scores all use `foreground`/`foregroundMuted` exclusively; differentiation (top-3, the
   viewer's own row) is carried by badge/border *fills*, never by tinting body text. Same rule
   `voting-web.md` (its rule #3) and `compete-web.md` established, applied here without
   modification.

**One real, new finding this pass (Phase 2, fixed in the build):** native's `IndividualLeaderboardRow`
marks the viewer's own row with a background tint **only** (`bg-primary/10`, no text/shape signal)
— a color-only cue a colorblind or low-vision viewer can miss, especially against a translucent
glass card where a 10%-alpha tint reads faintly. `WebLeaderboardRow` pairs that tint (translated
to the already-established `surfaceElevated` elevation-differentiation token, not a hand-mixed
alpha) with a solid **"You" text badge** (the already-verified `indigoSecondary`/`onAccent` pair)
and a 3px `indigoSecondary` left border — the row is now identifiable by shape and text, not color
alone, per the accessibility checklist's "color is never the only signal" rule. Grounded via:
```
python "$HOME/.claude/skills/ui-ux-pro-max/scripts/search.py" "contrast focus keyboard touch target" --domain ux -n 5
python "$HOME/.claude/skills/ui-ux-pro-max/scripts/search.py" "list density scanning hierarchy rank" --domain ux -n 5
```
Both grounded: Focus States/High, Touch Target Size/High, Contrast Readability/High, Touch
Spacing/Medium, Font Size Scale/Medium. Touch targets (tabs 40px in a ≥44px row, top-bar icon
buttons 40×40 in a 44px+ hit area), 8/12/16px spacing between adjacent controls, and a visible
keyboard focus ring on every interactive element (back button, mode toggle, both tabs) all verify
against this result set.

---

## Page-Specific Rules

### Layout — Phase 2.5 (structural alternatives considered)

**Baseline / recommended: segmented tabs + single scrolling list**, matching native's own
Individual/Communities toggle and `VotingScreen.web.tsx`'s own tab-driven pattern (the closest
structural analog — another standalone, no-bottom-nav, ranked-list screen).

Two structurally different alternatives were considered and rejected:

- **Stacked sections (both lists render on one continuously scrolling page, Individual then
  Communities, no tab-switching).** Optimizes: first-time discoverability — a viewer unsure tabs
  exist sees both boards without an extra tap. **Costs:** breaks cleanly with this screen's
  infinite-scroll pagination — a second independently-paginating `FlatList` can't sit below a
  first one without an artificial page-1-only cutoff for the top list, which would need new
  fetching logic (a "View all" escape hatch) not currently in the data layer. Rejected: the fix
  needed is disproportionate to the discoverability gain, and no other Vaporwave screen has
  needed it.
- **Two-pane side-by-side split (Individual left, Communities right, both visible at once, no
  tab-switching needed to compare).** Optimizes: lets a viewer compare both boards at a glance,
  uses the wide desktop surface. **Costs:** every row's avatar/name/score column would compress to
  fit half the width, and this route currently sits in the shared `DesktopShell` content column
  capped at 680px (only `/feed` gets the wider 1040px) — widening it is a shared-file change
  affecting every route's layout switch. This is the **identical rejection** `voting-web.md`
  already recorded for its own two-pane winner-rail alternative; applying the same reasoning here
  rather than re-deriving it.

**Recommended and implemented:** segmented tabs. Matches the primary action (a fast, focused,
per-board lookup, not a side-by-side comparison task) and the established Voting precedent,
without either alternative's cost.

**One additive change, not a rearrangement (Phase 2 finding, addressed as content):** neither this
screen nor its native counterpart ever states the ranking window on screen, despite a genuinely
different, unwindowed number existing one screen away (the profile's lifetime "Snapchat Score" —
see `.claude/memory/leaderboards.md`'s explicit "distinct from the 30-day competitive individual
leaderboard" note). A returning user has no on-screen way to tell "this resets" from "this only
grows." A one-line context label under the tabs, sourced from the same memory doc's own language
("last 30 days" / "breadth-weighted... last 30 days"), closes that gap without adding a new
structural element.

### STRUCTURAL FLAG — app-level IA, not fixed this pass

`DesktopSidebarNav.tsx`'s `NAV_ITEMS` list (Feed, Communities, Inbox, Friends, Voting, Compete,
Profile) has **no "Leaderboards" entry** — confirmed by reading the file, not assumed. The
`/leaderboards` route exists and now renders a fully migrated Vaporwave screen, but on desktop web
it is reachable only by a direct URL, or indirectly via `CompeteScreen.web.tsx`'s own "Leaderboards"
segmented tab (which currently embeds the **native** `LeaderboardsPanel` unrestyled — see Known
Seam below, a pre-existing gap `compete-web.md` already documented, not new this pass).
Leaderboards is one of this project's named core services (root `CLAUDE.md`: "Leaderboards
(individual + community)"), tightly coupled to the scoring engine that also drives Challenges — a
user browsing the sidebar has no visible path to it at all. This is shared, app-level chrome
(`DesktopSidebarNav` is mounted once, app-wide, by `DesktopShell`) — out of scope for a
page-scoped pass per this agent's own rules, flagged here rather than fixed.

### Navigation
No `FloatingBottomNav` destination — `Leaderboards`/`'leaderboards'` isn't in that component's
`NavDestination` union (`'feed' | 'communities' | 'compete' | 'profile'`), matching
Friends'/Voting's identical precedent for a drill-in web screen. `WebLeaderboardsTopBar`'s back
button is the only way back on this route, same as Voting.

### Component Notes
`WebLeaderboardRow` is **one component covering both tabs**, unlike native's split
`IndividualLeaderboardRow`/`CommunityLeaderboardRow` — the two native components only ever
differed by "user avatar" vs. "community initials tile," and `WebAvatar` already renders a plain
initials fallback for any string, so one row component with an optional `avatarUrl` prop covers
both shapes without duplicating a second fallback implementation. Rank-badge treatment (solid
`indigoSecondary` fill for rank 1-3, muted numeral for rank 4+) is `WebStandingRow`'s own
established convention from Voting, reused verbatim per the cross-screen consistency check rather
than inventing a second ranked-row language for what is structurally the same kind of screen.

### Known seam (pre-existing, not touched this pass)
`CompeteScreen.web.tsx`'s "Leaderboards" segment still embeds the **native** `LeaderboardsPanel`
unrestyled inside a fixed dark surface (`compete-web.md`'s own documented seam, carried forward
unchanged — that file is out of the scope named for this pass, which was limited to
`features/leaderboards/*` and its own new `Web*` components). Pointing `CompeteScreen.web.tsx` at
the new `LeaderboardsScreen.web.tsx`'s content instead of the native panel would be a natural
follow-up, but touching `CompeteScreen.web.tsx` was not in this task's named scope.

---

## Next steps

Leaderboard is screen 3 of 5 in the ordered Vaporwave migration sequence (Voting → Challenges →
**Leaderboard** → Profile → Inbox). Per the standing-default status this system already has (see
MASTER.md), no further approval gate is required before Profile's own migration pass — but per the
PILOT-SCREEN precedent this system established on Feed/Friends and re-confirmed on Voting/
Challenges, `pages/community-web.md`/`pages/profile-web.md`'s independent systems remain untouched
until each of those screens gets its own dedicated migration pass.
