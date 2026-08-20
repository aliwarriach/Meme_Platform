# Compete/Challenges Web Page Overrides

> **PROJECT:** Meme Platform
> **Generated:** 2026-08-11 (original independent Neubrutalism RESKIN pass — hand-authored, see
> git history for that system's full reconciliation log if it's ever needed again)
> **Migrated:** 2026-08-20 — consolidated onto the project-standard Vaporwave/Luminous system.
> Screen 2 of 5 in the ordered migration sequence (Voting → **Challenges** → Leaderboard →
> Profile → Inbox).
> **Page Type:** Desktop/web-only screen tree — all six `features/challenges/*.web.tsx` screens
> (`CompeteScreen` (hub), `CreateChallengeScreen`, `CreateOpenChallengeScreen`,
> `ProposeVsChallengeScreen`, `ChallengeDetailScreen`, `DuelDetailScreen`), migrated as one
> consolidated pass per the task's explicit scope (cross-screen consistency — status colors,
> countdown treatment, card shape — audited across all six, not just the hub).
> **Mode:** FULL MODE pass. Per this task's explicit instruction, Phase 1 was **promoted, not
> regenerated** — Vaporwave/Luminous is the project's already-persisted standing default (see
> `MASTER.md`'s "Web Design System" section), so no skill re-query was run for tokens; Phase 0
> (primary action), Phase 2 (UX/accessibility audit), Phase 2.5 (layout alternatives), and Phase 3
> (score) all ran normally against those fixed tokens.

> ⚠️ **IMPORTANT:** Rules in this file **override** `design-system/meme-platform/MASTER.md` for
> anything page-specific (component list, structural layout decision, this page's own contrast
> table) but **inherit** MASTER's "Web Design System" section for all shared tokens/mechanism —
> unlike the retired system this file used to describe, this tree is no longer visually
> independent from Feed/Friends/Voting. Applies to the web-only challenges tree
> (`features/challenges/*.web.tsx`, `components/web/WebCompete*.tsx`/`WebChallenge*.tsx`/
> `WebCountdownTimer.tsx`/`WebSubmission*.tsx`/`WebSideMemberPicker.tsx`/`WebResultBanner.tsx`).
> MASTER.md's "Vivid Meme Culture" system (above the Web Design System section) is untouched and
> still governs every native screen. `pages/community-web.md` and `pages/profile-web.md` are
> untouched and still govern their own independent, not-yet-migrated trees.

---

## Migration record (2026-08-20)

The Compete/Challenges tree previously ran its own **fifth, fully independent** theme
(`constants/webCompeteTheme.ts` + `constants/CompeteWebTheme.tsx`, burnt-orange `#F97316` / lime
`#22C55E` Neubrutalism — hard black 2px outlines, 3px offset shadows, Lexend Mega/Public Sans
typography) built by an earlier RESKIN pass. That system and every component that depended on it
has been **fully retired and deleted**: `webCompeteTheme.ts` and `CompeteWebTheme.tsx` removed
outright (confirmed dead by grep before deletion — every remaining match was a doc-comment
mention, not a real import); the thirteen `Web*` component files that carried the old theme's
`useCompeteWebTheme()` coupling were rewritten in place with new Vaporwave-based implementations,
same filenames: `WebCompeteTopBar`, `WebCompeteTabs`, `WebCompeteButton`, `WebCompeteTextField`,
`WebDurationPresets`, `WebChallengeStatusBadge`, `WebChallengeCard`, `WebChallengeSideCard`,
`WebResultBanner`, `WebSubmissionThumb`, `WebSubmissionPicker`, `WebSideMemberPicker`. One
component, `WebCountdownTimer`, needed **zero changes** — it was already theme-agnostic (a plain
`Text` wrapper taking a `style` prop from its caller, no internal theme import), so it carries
forward completely untouched.

All six screens now mount their own `VaporwaveThemeProvider` instance
(`constants/VaporwaveWebTheme.tsx`) and read all tokens from `constants/webFeedThemeVapor.ts` —
the same source of truth already governing `FeedScreen.web.tsx`, `FriendsScreen.web.tsx`, and
`VotingScreen.web.tsx`. Light/dark mode is now persisted to the same shared `localStorage` key
(`vaporwave-web-theme`), so a mode chosen on any other Vaporwave screen carries over to Compete
automatically — previously this tree had its own separate `compete-web-theme` key and would NOT
stay in sync with the rest of the app (the same inconsistency `voting-web.md`'s own migration
fixed for Voting).

**No skill re-query was run for this pass.** Per the task's explicit instruction, Vaporwave/
Luminous is being *extended*, not *regenerated* — re-rolling the skill here would produce a sixth
independent palette, defeating the point of a project-wide default. Every value cited below is
read directly from `webFeedThemeVapor.ts`'s existing, already-sourced tokens, or is a direct
carry-forward of a contrast decision `voting-web.md` already made and grounded.

---

## Phase 0 — primary action (per screen, since this is a six-screen flow)

- **`CompeteScreen` (hub, the primary entry point):** get the viewer into a challenge they can act
  on right now — resume something active, respond to something pending, or join something open.
- **`CreateChallengeScreen` / `CreateOpenChallengeScreen` / `ProposeVsChallengeScreen`:**
  successfully launch/send the challenge (fill the required fields, submit).
- **`ChallengeDetailScreen` / `DuelDetailScreen`:** take the one action available for the
  challenge's current lifecycle stage — accept/decline while pending, submit a meme while active,
  view the result once evaluated.

---

## Tokens actually used (sourced from `constants/webFeedThemeVapor.ts`, not re-typed from memory)

### Typography
Quicksand (`QUICKSAND_STACK`, `VAPOR_TYPE_DARK`/`LUMINOUS_TYPE_LIGHT` — byte-identical scale
across modes), loaded via `injectFeedWebFont()`, same as every other Vaporwave screen. Replaces
the retired system's Lexend Mega (display) / Public Sans (body) Neubrutalist pairing — a direct
consequence of the style-system swap (Neubrutalism → Vaporwave glass), not an oversight.

### Color roles used across this tree
| Role | Dark value | Light value | Used for |
|---|---|---|---|
| `gradientTop/Mid/Bottom` | `#12121f`/`#1a1a28`/`#0d0d1a` | `#f8f9ff`/`#f2f3f9`/`#ffffff` | Page background gradient, all 6 screens |
| `surfaceGlass` | `rgba(255,255,255,0.1)` | `rgba(255,255,255,0.75)` | Challenge/side cards, opponent rows, member-picker card, result banner |
| `surfaceElevated` | `#292937` | `rgba(255,255,255,0.9)` | Text-input fill, tab track, `setup`-status badge fill, duration-preset chip default |
| `surfaceHover` | `rgba(41,41,55,0.85)` | `rgba(242,243,249,0.9)` | Row/tab/chip hover state |
| `border` | `rgba(255,255,255,0.15)` | `#bac9cb` | Card/row/tab-track/thumbnail borders |
| `hoverTint` | `rgba(255,255,255,0.06)` | `rgba(0,219,233,0.08)` | Icon-button hover (top bar) |
| `indigoSecondary` | `#8c016b` | `#a72683` | Selected tab fill, primary-button fill, `active`-status badge fill, selected duration/member-picker/opponent-row fill, winner chip fill — always paired with `onAccent` |
| `indigoPrimary` | `#00f0ff` | — (dark-mode-only foreground use) | Focus ring / outline-button border+text / evaluated-status badge border+text, **dark mode only** |
| `indigoSecondary` (foreground role) | — (not used as foreground in dark mode) | `#a72683` | Focus ring / outline-button border+text / evaluated-status badge border+text, **light mode only** |
| `indigoGlow` | `rgba(0,240,255,0.45)` | `rgba(0,219,233,0.4)` | Primary-button shadow, active-challenge-card shadow, result-banner shadow — all decorative only |
| `foreground` / `foregroundMuted` | `#e3e0f3` / `#b9cacb` | `#191c20` / `#3b494b` | All body/label/score/winner-name text |
| `onAccent` | `#FFFFFF` | `#FFFFFF` | Text/icons on `indigoSecondary` fills |
| `error` | `#ffb4ab` | `#ba1a1a` | Form validation errors, load errors |

### Radius / spacing
`radius.card` (24 dark / 16 light), `radius.chip` (16 both), `radius.pill` (999) — from
`VAPOR_RADIUS_DARK`/`LUMINOUS_RADIUS_LIGHT`. `FEED_WEB_SPACING` (4/8/12/16/20/24) — same shared
scale as every other Vaporwave screen. Replaces the retired system's deliberately-sharp 12px/10px
Neubrutalism radius scale — again a direct, documented consequence of the style swap, not an
inconsistency: glass-panel languages read as pillowy/soft by design, hard-edged languages read as
sharp by design, and this migration's whole point is adopting the former.

---

## Accessibility — contrast decisions made this pass (measured, not eyeballed)

Every pairing below was computed with the standard WCAG relative-luminance formula against this
file's own token values (`webFeedThemeVapor.ts`), the same discipline `voting-web.md` established
first. Two real findings shaped this build:

1. **`indigoSecondary` fails as a foreground/border color directly on a dark canvas or dark
   card** — computed at only **~1.6–1.9:1** against `gradientMid`/`surfaceElevated` in dark mode
   (both the token and the background are dark-toned, so there's too little luminance
   difference), under even the 3:1 non-text minimum, let alone 4.5:1 for text. This rules out
   using `indigoSecondary` as an outline-button border/text color, a focus ring, or a "selected"
   row's border+text treatment **in dark mode**. Every such use in this tree is
   **mode-conditional** instead — `mode === 'dark' ? colors.indigoPrimary : colors.indigoSecondary`
   — the identical pattern `voting-web.md`'s `WebVotingTopBar`/`WebVotingTabs` already established
   for their own focus rings (dark canvas: `indigoPrimary` ~11.7:1; light canvas: `indigoSecondary`
   ~6.5:1; both comfortably clear AA in their own mode). Applied here to: `WebCompeteTopBar`'s
   focus ring, `WebCompeteButton`'s `outline` variant border+text,
   `WebChallengeStatusBadge`'s `evaluated` outline pill, `WebDurationPresets`'/
   `WebSideMemberPicker`'s/`ProposeVsChallengeScreen`'s opponent-row focus rings.
2. **`accentUpvote` (Vaporwave's other saturated hue, `#22C55E`) fails as a white-text solid fill
   in both modes** — measured **2.28:1** (identical failure mode to, and independently confirming
   via the same WCAG formula, the retired system's own finding that raw `#22C55E` fails as
   light-mode text at 2.28:1). Vaporwave has no dedicated text-safe derived tint for it the way
   the retired system's own `accentText` role did. Rather than inventing one (out of scope for a
   design-system *promotion* pass — see MASTER.md's FULL MODE TOKEN AMENDMENT discipline, which
   requires a scoped, justified per-token edit grounded in a skill query, not a same-pass
   invention), `accentUpvote`/green is **not used anywhere in this migration**. The native
   `ChallengeRow.tsx`'s `active → tertiary(green)` role is instead reused via `indigoSecondary`
   (see the status-badge mapping below) — a different hex, same semantic role, both already
   verified safe.
3. **No color-coded text ever sits directly on a card/background in this build** — challenge
   titles, side names, scores, and the evaluated winner's name all use `foreground`/
   `foregroundMuted` exclusively. Differentiation (the `active` status, the winning side, a
   selected duration preset/member/opponent) is carried by solid badge/chip *fills* (`indigoSecondary`
   + `onAccent`) or by a decorative glow shadow, never by tinting body text — the exact same rule
   `voting-web.md` established (its rule #3) and `compete-web.md`'s own retired system had to
   patch around with dedicated `primaryText`/`accentText` roles. Adopting the rule directly here
   sidesteps needing those extra roles at all.

Final measured set for every fill+text pairing actually used, both ≥4.5:1 AA:

| Pair | Dark | Light |
|---|---|---|
| `onAccent` on `indigoSecondary` fill | 9.0:1 | 6.46:1 |
| Mode-conditional accent (`indigoPrimary` dark / `indigoSecondary` light) as text/border on canvas | ~11.7:1 | ~6.5:1 |

Touch targets (44×44 minimum), 8px+ spacing between adjacent controls, and visible keyboard focus
rings (every screen in this pass is `Platform.OS==='web'`) were grounded via:
```
python "$HOME/.claude/skills/ui-ux-pro-max/scripts/search.py" "contrast focus keyboard touch target" --domain ux -n 5
```
Same result set `voting-web.md` already recorded (Focus States/High, Touch Target Size/High,
Contrast Readability/High, Touch Spacing/Medium) — not re-run as a fresh query since it's an
unchanged, already-grounded finding, per the "promote, don't re-roll" instruction covering token
queries specifically (this is a UX-checklist query, re-affirmed rather than re-derived). Every
icon button is 40–44px in a ≥44px hit area, row/tab/chip gaps use the 8/12/16px spacing scale,
and every interactive element (top-bar buttons, tabs, cards, form fields, duration presets,
member/opponent rows, submission thumbnails) carries a `focused` outline ring.

---

## Page-Specific Rules

### Layout — one structural change this pass (Phase 2.5, not cosmetic)

**Phase 2 finding:** `CompeteScreen`'s `useMyChallenges()` result was previously bucketed into a
single "Active" section covering BOTH `setup`-status challenges (pending vs-proposals/duels
awaiting the viewer's or the opponent-community-owner's accept/decline — something blocking on
the viewer) and `active`-status challenges (already running — action is "submit a meme").
Distinguishing them required reading each card's small status badge individually; a first-time
user scanning "what does this screen need from me right now" had no faster way to find it.

**Alternatives considered:**
- **Keep the current single "Active" bucket** (baseline). Optimizes: simplest, fewest sections.
  Costs: pending items needing the viewer's response are buried among already-running challenges,
  indistinguishable at a glance from something merely ongoing.
- **Split into "Needs your response" / "Active" / "Open to join" / "Results" — recommended,
  implemented.** Optimizes: matches the real priority order of attention (things blocking on
  you > things you can act on > things you can explore > history); each section renders only
  when non-empty, so a viewer with nothing pending sees no added clutter. Uses
  `challenge.status`, data already fetched — no new field, no new request. Costs: one more
  section label to scan past in the (common) case of nothing pending — minor, self-hiding.
- **Persistent non-scrolling "Needs your response" rail, à la Voting's persistent header for its
  winner banner/tabs.** Optimizes: a pending item can never be scrolled past unnoticed. Costs:
  new layout plumbing for what's usually a 0–1-item edge case (duel/vs-proposals are a
  comparatively rare event per `.claude/memory/challenges.md`) — disproportionate engineering for
  the actual frequency of this state; rejected as over-engineering relative to the simpler
  content-split fix, which already solves the actual scanning problem.

**Recommended and implemented:** the four-section split. `CompeteScreen.web.tsx`'s own top-level
comment documents this in full; no new component was needed, only a second `.filter()` on data
already being fetched.

No other structural change was made across the remaining five screens — their native
question→action shapes (status cluster → sides → accept/decline or submit → results) were
preserved as-is; this pass's other decisions are visual-system tokens, not layout.

### Navigation
Unchanged from the retired system: `FloatingBottomNav active="compete"` reused unmodified on
`CompeteScreen.web.tsx` (the only one of the six screens that's a `FloatingBottomNav`
destination — `feed`/`communities`/`compete`/`profile` are the only entries in that component's
`NavDestination` union); it already self-hides at ≥900px, so it needed zero changes. The other
five screens are drill-in/form screens with no bottom nav on native either — `WebCompeteTopBar`'s
back button is their only way back, same precedent `voting-web.md` used for its own single
drill-in screen.

### Component Notes
All thirteen `components/web/` files import `useVaporwaveTheme()` directly — no page-specific
theme file of their own, matching Feed/Friends/Voting's pattern exactly (this tree previously had
one, `CompeteWebTheme.tsx`; it's now deleted). `WebChallengeStatusBadge` centralizes the
status→treatment map that native still duplicates three times (`ChallengeRow`,
`ChallengeDetailScreen`, `DuelDetailScreen`) — no informational change, one source of truth,
carried forward from the retired system's own consolidation.

**Status→treatment mapping** (reuses MASTER.md's own established native semantic — `active` →
vivid, `evaluated` → brand/prominent, `setup` → neutral — translated onto Vaporwave's token set,
not its exact hexes):
- `active`: solid `indigoSecondary` fill + `onAccent` text — the same "solid fill = live/urgent"
  convention Voting's own "Live" period badge and `WebVotingTabs`' selected state use.
- `evaluated`: outline pill, mode-conditional accent border + text — matching Voting's own
  "Final" treatment for a settled/no-longer-live state. The celebratory emphasis for a win lives
  in the dedicated `WebResultBanner` instead of this small badge, so the two don't compete for
  "loudest element on screen."
- `setup`: neutral `surfaceElevated` fill + `foregroundMuted` text, labeled "Pending" — no
  informational change from native.

**Emphasis device swap:** the retired system's hard 3px offset shadow (Neubrutalism's signature
depth cue, explicitly "no gradients, no blur") is replaced everywhere by a soft `indigoGlow`
decorative shadow (exempt from contrast rules, same technique `WebWinnerBanner` uses on Voting) —
on `WebCompeteButton`'s primary variant, `WebChallengeCard`'s `active`-challenge state, and
`WebResultBanner`. This is a direct, necessary consequence of adopting Vaporwave's glass/glow
language in place of Neubrutalism's flat-hard-edge language, not an inconsistency.

**Reuse, not duplication:** `WebSideMemberPicker` now renders each row's avatar via the already-
generic `WebAvatar` (Feed/Friends/Voting's own member-avatar primitive) instead of a hand-rolled
initials-fallback circle, per this pass's explicit reuse instruction — the retired system had
duplicated that fallback logic locally.

### UX carried forward unchanged (real findings from the retired pass, still true under the new visual system)
1. **Duration quick-select presets** (`WebDurationPresets`) on all three create/propose screens —
   still fixes the same identical native gap (typing raw minutes with no unit hint). Additive
   only, manual field still present.
2. **Centralized status badge** (`WebChallengeStatusBadge`) — still replaces three duplicated
   native `STATUS_STYLES` maps with one source of truth; no informational change.

---

## Known seams (accepted, out of scope for this pass)

- `DesktopShell`/`DesktopSidebarNav` render in the older pre-Vaporwave chrome (`#1e0f13`/
  `#372529`) — the same accepted shell-boundary seam every prior Vaporwave pilot has documented.
- **`CompeteScreen.web.tsx`'s Leaderboards segment** reuses the native `LeaderboardsPanel`
  unrestyled — out of this six-screen scope (Leaderboards is its own `features/leaderboards/`
  tree, migrating in a later pass per the ordered sequence). The container wrapping it uses a
  fixed dark surface sourced verbatim from MASTER.md's own native `bg` token (`#1e0f13`), not this
  page's light/dark toggle — identical precedent to the retired system's own identical seam,
  carried forward unchanged (the native rows assume MASTER's dark-only palette regardless of
  which system wraps them).
- The `/new-post` (creator) route, reached via the "Create a meme for this challenge" CTA on both
  detail screens, is native-resolved and renders unstyled on web — unchanged, same accepted seam
  every prior web pass has documented for this same route.

---

## Next steps

Challenges/Compete is screen 2 of 5 in the ordered Vaporwave migration sequence (Voting →
**Challenges** → Leaderboard → Profile → Inbox). Per the standing-default status this system
already has (see MASTER.md), no further approval gate is required before Leaderboard's own
migration pass — but per the PILOT-SCREEN precedent this system established on Feed/Friends and
re-confirmed on Voting, `pages/community-web.md`/`pages/profile-web.md`'s independent systems
remain untouched until each of those screens gets its own dedicated migration pass.
