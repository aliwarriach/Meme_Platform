# Voting Web Page Overrides

> **PROJECT:** Meme Platform
> **Generated:** 2026-08-11 (original independent RESKIN pass — hand-authored)
> **Migrated:** 2026-08-19 — consolidated onto the project-standard Vaporwave/Luminous system
> **Page Type:** Desktop/web-only screen — `VotingScreen.web.tsx` (Meme of the Day/Week/Month
> competitions)
> **Mode:** FULL MODE pass, screen 1 of 5 in an ordered Vaporwave migration sequence (Voting →
> Challenges → Leaderboard → Profile → Inbox). Voting is the pilot that promotes Vaporwave/
> Luminous from a Feed/Friends-only pilot to the **standing default design system for all web
> rendering in this project** — see `design-system/meme-platform/MASTER.md`'s new "Web Design
> System" section, which this file's rules feed into.

> ⚠️ **IMPORTANT:** Rules in this file **override** `design-system/meme-platform/MASTER.md` and
> apply **only** to the web-only voting tree (`VotingScreen.web.tsx`,
> `components/web/WebVotingTopBar.tsx`, `components/web/WebVotingTabs.tsx`,
> `components/web/WebStandingRow.tsx`, `components/web/WebWinnerBanner.tsx`,
> `components/web/WebCompetitionEntryModal.tsx`). MASTER.md's "Vivid Meme Culture" system is
> untouched and still governs every native screen. `pages/community-web.md`, `pages/compete-web.md`,
> and `pages/profile-web.md` are untouched and still govern their own independent, not-yet-migrated
> trees (Communities/Challenges/Profile) — expected, not a contradiction requiring reconciliation.

---

## Migration record (2026-08-19)

The voting screen previously ran its own **fourth, fully independent** theme
(`constants/webVotingTheme.ts` + `constants/VotingWebTheme.tsx`, rose-crimson `#E11D48` / gold
`#F59E0B`, Anton/Epilogue typography) built by an earlier RESKIN pass — see git history for that
system's full reconciliation log if it's ever needed again. That system and every component that
depended on it (`WebVotingTopBar`, `WebVotingTabs`, `WebStandingRow`, `WebWinnerBanner`,
`WebCompetitionEntryModal` in `components/web/`) has been **fully retired and deleted**
(`webVotingTheme.ts` and `VotingWebTheme.tsx` removed outright; the five `Web*` component files
were rewritten in place with new Vaporwave-based implementations, same filenames). Nothing else
in the codebase imported the deleted theme files or their exports — verified by grep before
deletion.

The screen now mounts its own `VaporwaveThemeProvider` instance (`constants/VaporwaveWebTheme.tsx`)
and reads all tokens from `constants/webFeedThemeVapor.ts` — the same source of truth already
governing `FeedScreen.web.tsx` and `FriendsScreen.web.tsx`. Light/dark mode is still persisted to
the same shared `localStorage` key (`vaporwave-web-theme`), so a mode chosen on Feed or Friends
now carries over to Voting automatically (previously it had its own separate `voting-web-theme`
key and would NOT stay in sync with Feed/Friends — this migration fixes that inconsistency as a
side effect, not just a palette swap).

**No skill re-query was run for this pass.** Per the task's explicit instruction, Vaporwave/
Luminous is being *promoted*, not *regenerated* — re-rolling the skill here would produce a
fifth independent palette, defeating the point of a project-wide default. Every value cited below
is read directly from `webFeedThemeVapor.ts`'s existing, already-sourced tokens.

---

## Tokens actually used (sourced from `constants/webFeedThemeVapor.ts`, not re-typed from memory)

### Typography
Quicksand (`QUICKSAND_STACK`, `VAPOR_TYPE_DARK` / `LUMINOUS_TYPE_LIGHT` — byte-identical scale
across modes), loaded via `injectFeedWebFont()` (same `<link>` injection call, same font, already
used by Feed/Friends — no new font import needed for Voting).

### Color roles used on this screen
| Role | Dark value | Light value | Used for |
|---|---|---|---|
| `gradientTop/Mid/Bottom` | `#12121f`/`#1a1a28`/`#0d0d1a` | `#f8f9ff`/`#f2f3f9`/`#ffffff` | Page background gradient |
| `surfaceGlass` | `rgba(255,255,255,0.1)` | `rgba(255,255,255,0.75)` | Standing row card, winner banner card |
| `surfaceElevated` | `#292937` | `rgba(255,255,255,0.9)` | Rank-badge default fill, thumbnail fallback, tab track |
| `surfaceHover` | `rgba(41,41,55,0.85)` | `rgba(242,243,249,0.9)` | Row/tab hover state |
| `border` | `rgba(255,255,255,0.15)` | `#bac9cb` | Card/row/tab-track borders |
| `hoverTint` | `rgba(255,255,255,0.06)` | `rgba(0,219,233,0.08)` | Icon-button hover |
| `indigoSecondary` | `#8c016b` | `#a72683` | Selected tab fill, top-3 rank badge fill, trophy badge fill, "Live" pill fill — always paired with `onAccent` |
| `indigoGlow` | `rgba(0,240,255,0.45)` | `rgba(0,219,233,0.4)` | Winner banner decorative shadow only (not foreground content) |
| `indigoPrimary` | `#00f0ff` | `#00dbe9` | Focus ring in dark mode only (see Accessibility) |
| `foreground` / `foregroundMuted` | `#e3e0f3` / `#b9cacb` | `#191c20` / `#3b494b` | All body/label/score text |
| `onAccent` | `#FFFFFF` | `#FFFFFF` | Text/icons on `indigoSecondary` fills |
| `error` | `#ffb4ab` | `#ba1a1a` | Standings-load error text |

### Radius / spacing
`radius.card` (24 dark / 16 light), `radius.chip` (16 both), `radius.pill` (999) — all from
`VAPOR_RADIUS_DARK`/`LUMINOUS_RADIUS_LIGHT`. `FEED_WEB_SPACING` (4/8/12/16/20/24) — same shared
scale as every other Vaporwave screen, not a bespoke Voting scale (the retired system's bespoke
16px-tight-radius-for-Anton reasoning no longer applies now that the display face is Quicksand,
not Anton).

---

## Accessibility — contrast decisions made this pass (measured, not eyeballed)

Reusing an existing token isn't automatically safe just because it's "the brand color" — two real
contrast failures were found and designed around while building this screen's new components,
computed with the standard WCAG relative-luminance formula against this file's own token values:

1. **`indigoPrimary` (bright cyan) fails as a solid fill with white text in both modes** — 1.41:1
   dark, 1.70:1 light (it's a light, glow-oriented hue, not a text-bearing fill color). Every
   place the retired gold-based system would have used a "primary accent fill + white text" (top-3
   rank badge, trophy badge, selected tab, "Live" status pill) uses `indigoSecondary` instead,
   which measures **9.0:1 dark / 6.46:1 light** with `onAccent` — both comfortably clear 4.5:1 AA.
2. **`indigoPrimary` also fails as a foreground color (icon or text) directly on the light-mode
   canvas** — 1.70:1 against white, under even the 3:1 non-text minimum. It's used in this build
   **only** as: (a) the dark-mode-only focus ring color, since it measures ~11.7:1 against the
   dark canvas; and (b) the winner banner's decorative `shadowColor` glow, which is exempt from
   text/icon contrast rules because nothing is rendered as content on top of it. The light-mode
   focus ring uses `indigoSecondary` instead (6.46:1), computed the same way.
3. **No color-coded text ever sits directly on a neutral card/background in this build** — score
   numbers, the winner's "1" numeral, and all labels use `foreground`/`foregroundMuted`
   exclusively. Differentiation (top-3 rows, the winner entry) is carried by badge *fills*
   (solid `indigoSecondary` + `onAccent`) and by weight/size, never by tinting body text — this
   sidesteps the exact failure mode the retired system's own audit found and had to patch with
   dedicated `primaryText`/`goldText` roles (tinted-background-plus-colored-text pairs kept
   measuring under 4.5:1). Simpler and provably safer than reproducing that same escape hatch
   under new hex values.

Touch targets (44×44 minimum), 8px+ spacing between adjacent controls, and visible keyboard focus
rings (this is a `Platform.OS==='web'` screen — required, not optional) were grounded via:
```
python "$HOME/.claude/skills/ui-ux-pro-max/scripts/search.py" "contrast focus keyboard touch target" --domain ux -n 5
```
All four (Focus States/High, Touch Target Size/High, Contrast Readability/High, Touch
Spacing/Medium) are satisfied: every icon button is 40-44px in a ≥44px hit area, row/tab gaps use
the 8/12/16px spacing scale, and every interactive element (back button, toggle, tabs, rows, entry
thumbnails) carries a `focused` outline ring (a real gap in the retired build's sibling components
Feed/Friends currently have — `WebFeedTopBar`/`WebFriendsTopBar` don't implement `focused` styling
at all; this is flagged as a finding, not silently fixed there, since those files are out of scope
for a Voting-only pass).

---

## Page-Specific Rules

### Layout — one structural change this pass (Phase 2.5, not cosmetic)
Previous structure passed period tabs + winner banner + "Top Contenders" label as the `FlatList`'s
`ListHeaderComponent`, so all of it **scrolled away** with the standings list past a handful of
rows — forcing a scroll back to the top to re-check the winner or switch periods, and visually
blurring the distinction between "yesterday's decided winner" and "today's still-live ranking"
since both lived in one continuously-scrolling region.

**Change made:** tabs + winner banner + label/status-badge row now render in a **persistent
(non-scrolling) header** above the `FlatList`, exactly like `WebVotingTopBar` already is — only
the standings rows scroll. This required no new breakpoint or `DesktopShell` change; it's a
self-contained restructure of `VotingScreen.web.tsx`'s own layout tree.

**Alternatives considered and rejected** (see this agent's final report for the full one-line
optimize/cost breakdown):
- **Keep the original all-in-`ListHeaderComponent` structure** — simplest, but doesn't fix the
  scroll-away/ambiguity problem above.
- **Merge the winner into the list as a pinned rank-0 row** — a single unified scannable list, but
  sacrifices the winner's distinct celebratory visual weight and reads MORE like "part of today's
  ranking," the opposite of what's needed.
- **Two-pane desktop layout (winner in a persistent right rail, à la `WebFeedRail`)** — would
  fully separate past-winner from live-standings and use the wider desktop surface, but requires
  widening this route's `DesktopShell` content column (currently capped at the shared 680px, only
  `/feed` gets the wider 1040px) — a shared-file change affecting every route's layout switch,
  judged out of proportion for what the simpler persistent-header fix already solves.

### Navigation
No `FloatingBottomNav` — Voting isn't in that component's `NavDestination` union (`'feed' |
'communities' | 'compete' | 'profile'`), matching `FriendsScreen.web.tsx`'s identical no-bottom-nav
precedent. Reached via `DesktopSidebarNav`'s own "Voting" link; back-button-only chrome on narrow
viewports, same as Friends.

### Component Notes
`WebVotingTopBar`, `WebVotingTabs`, `WebStandingRow`, `WebWinnerBanner`,
`WebCompetitionEntryModal` — all in `components/web/`, all Vaporwave-only now (no page-specific
theme file of their own; they import `useVaporwaveTheme()` directly, same as Feed/Friends'
components).

### Known seam (carried forward, unchanged)
`WebCompetitionEntryModal`'s entry body still reuses the shared native `MemeCard`/`ContainerCard`
components unrestyled (old NativeWind tokens) inside a themed close-header + `WebModalFrame`.
Unchanged from the retired system — see that component's own doc comment for the full rationale.
Voting itself (tabs, winner banner, standings list, badges) is fully migrated; only this specific
drill-in modal body remains an accepted, pre-existing seam.

---

## Next steps

Voting is the first of five screens migrating onto Vaporwave/Luminous (Challenges → Leaderboard →
Profile → Inbox follow, in that order, as separate passes). Per the PILOT-SCREEN precedent this
system already established on Feed/Friends, `pages/community-web.md`/`pages/compete-web.md`/
`pages/profile-web.md`'s independent systems remain untouched until each of those screens gets its
own migration pass.
