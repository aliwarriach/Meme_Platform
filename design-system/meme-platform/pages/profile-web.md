# Profile/Session Web Page Overrides

> **PROJECT:** Meme Platform
> **Generated:** 2026-08-20 — replaces the 2026-08-11 record (retired "reuses voting-web's old
> independent palette verbatim" lineage; that lineage no longer applies since voting-web itself was
> migrated to Vaporwave/Luminous, see below).
> **Page Type:** Desktop/web-only screen — `SessionScreen.web.tsx` (profile/account/settings).
> Screen 4 of 5 in the ordered Vaporwave migration sequence (Voting → Challenges → Leaderboard →
> **Profile** → Inbox).
> **Mode:** FULL MODE pass. Per this task's explicit instruction, Phase 1 was **promoted, not
> generated** — Vaporwave/Luminous is the project's already-persisted standing default (see
> `MASTER.md`'s "Web Design System" section), so no skill re-query was run for tokens. Phase 0
> (primary action), Phase 2 (UX/accessibility audit), Phase 2.5 (layout alternatives), and Phase 3
> (score) all ran normally against those fixed tokens.

> ⚠️ **IMPORTANT:** Rules in this file **override** `design-system/meme-platform/MASTER.md` for
> anything page-specific but **inherit** MASTER's "Web Design System" section for all shared
> tokens/mechanism — same relationship `voting-web.md`/`leaderboard-web.md` already have. Applies
> to the web-only profile tree (`features/auth/SessionScreen.web.tsx`,
> `components/web/WebProfileTopBar.tsx`/`WebScoreCard.tsx`/`WebBadgeChip.tsx`/
> `WebSettingsRow.tsx`/`WebEmailVerificationBanner.tsx`, plus the reused `WebAvatar.tsx`). MASTER's
> "Vivid Meme Culture" system (above the Web Design System section) is untouched and still governs
> the native screen, `features/auth/SessionScreen.tsx` — **not touched by this pass, byte-for-byte
> identical**.

---

## Migration record — retired vs. net-new (2026-08-20)

**Retired (deleted, confirmed dead via grep before deletion):**
- `constants/webProfileTheme.ts`, `constants/ProfileWebTheme.tsx` — the independent Profile theme
  (rose-crimson `#E11D48` + gold `#F59E0B`, copied verbatim from an already-superseded `voting-web`
  lineage — that source system itself no longer exists as an independent theme).
- `components/web/WebProfileAvatar.tsx` — retired outright, not just rewritten: the profile avatar
  now reuses `components/web/WebAvatar.tsx` directly (the same generic, theme-aware primitive
  Feed/Friends/Voting/Leaderboard already share), per this task's explicit "reuse `WebAvatar`
  rather than duplicating it" instruction. `WebAvatar` already accepts an arbitrary `size` prop, so
  the profile's larger 88px identity-block avatar needed no new component.

Grep confirmed all three files had exactly one consumer (`SessionScreen.web.tsx` and each other)
before deletion — no other tree imports them.

**Rewritten in place** (same filename, same responsibility, full content replaced — old
`ProfileWebTheme`/`webProfileTheme` imports swapped for `useVaporwaveTheme()`/
`webFeedThemeVapor.ts`, same "retire + recreate under the same name" precedent
`WebVotingTopBar.tsx`/`WebLeaderboardsTopBar.tsx` already established for their own trees):
`components/web/WebProfileTopBar.tsx`, `WebScoreCard.tsx`, `WebBadgeChip.tsx`, `WebSettingsRow.tsx`.

**Net-new:** `components/web/WebEmailVerificationBanner.tsx` — see Phase 2 finding below; not a
theme artifact, a real functional-parity fix.

**Not touched:** `components/web/WebPillButton.tsx` shares a name-adjacent role but is actually
part of the **Communities** web tree (imports `CommunityWebTheme`/`webCommunityTheme`, used by
`CommunityDetailScreen.web.tsx`/`CommunitiesScreen.web.tsx`/`CreateCommunityScreen.web.tsx`) — it
was an unused, dead import in the old `SessionScreen.web.tsx` (confirmed: imported but never
referenced in that file's JSX), dropped in the rewrite. Never repointed or modified — out of this
pass's scope.

---

## Phase 0 — primary action

Confirm standing (score + badges) and reach the app's other core destinations (Friends,
Communities, Compete, Competitions, Inbox) or sign out, with zero friction — Profile is a **hub**,
not a task screen. Unlike Voting/Challenges (which drive a specific vote/submission action), or
even Leaderboard (a single lookup task), Profile has no one dominant task; every decision below
(card ordering, settings-row grouping, danger-zone separation) is judged against how fast a viewer
gets their bearings and moves on to what they actually came to the app to do.

---

## Tokens actually used (sourced from `constants/webFeedThemeVapor.ts`, not re-typed from memory)

### Typography
Quicksand (`QUICKSAND_STACK`, `VAPOR_TYPE_DARK`/`LUMINOUS_TYPE_LIGHT`), loaded via
`injectFeedWebFont()` — same as every other Vaporwave screen. No page-specific `stat` size was
added (unlike the retired system's Fredoka-based `PROFILE_WEB_TYPE.stat`) — the Meme Score/Badges
hero numbers use a locally-styled 30px/700 weight built directly on the shared `fontStack`, since
Vaporwave's own type scale has no dedicated "hero stat" role and this page's need doesn't justify
extending the shared scale for one screen (see FULL MODE TOKEN AMENDMENT discipline — no shared
token was touched, only a local style in `WebScoreCard`).

### Color roles used on this screen
| Role | Dark value | Light value | Used for |
|---|---|---|---|
| `gradientTop/Mid/Bottom` | `#12121f`/`#1a1a28`/`#0d0d1a` | `#f8f9ff`/`#f2f3f9`/`#ffffff` | Page background gradient |
| `surfaceGlass` | `rgba(255,255,255,0.1)` | `rgba(255,255,255,0.75)` | Stat cards, settings rows, verify-email banner card |
| `surfaceElevated` | `#292937` | `rgba(255,255,255,0.9)` | Verify-email code input fill |
| `hoverTint` | `rgba(255,255,255,0.06)` | `rgba(0,219,233,0.08)` | Top-bar toggle hover, settings-row hover |
| `border` | `rgba(255,255,255,0.15)` | `#bac9cb` | Card/row/top-bar borders |
| `indigoSecondary` | `#8c016b` | `#a72683` | Badge-chip fill, stat-card icon chip fill, verify-email border/primary button/resend-outline accent — always paired with `onAccent` (fills) or used as a mode-conditional focus-ring/border color, never as unpaired foreground text |
| `indigoPrimary` | `#00f0ff` | — (dark-mode-only) | Top-bar/row focus ring, dark mode only |
| `foreground` / `foregroundMuted` | `#e3e0f3` / `#b9cacb` | `#191c20` / `#3b494b` | Username, bio, stat digits, settings-row labels; `foregroundMuted` for email, section labels, meta |
| `onAccent` | `#FFFFFF` | `#FFFFFF` | Text/icons on `indigoSecondary` fills |
| `error` | `#ffb4ab` | `#ba1a1a` | Log Out row icon/text, verify-email mutation error text |

### Radius / spacing
`radius.card` (24 dark / 16 light) on stat cards, settings rows, and the verify-email banner.
`radius.chip` (16 both) on the stat-card icon chip and the code-input field. `radius.pill` (999) on
badge chips and every button. `FEED_WEB_SPACING` (4/8/12/16/20/24) — same shared scale as every
other Vaporwave screen.

---

## Accessibility — decisions made this pass (grounded, not eyeballed)

```
python "$HOME/.claude/skills/ui-ux-pro-max/scripts/search.py" "contrast focus keyboard touch target spacing grouping icon" --domain ux -n 5
python "$HOME/.claude/skills/ui-ux-pro-max/scripts/search.py" "settings list row danger action press feedback profile avatar stat card" --stack react-native -n 5
```
Returned: 44×44px minimum touch targets (High), 8px minimum gap between adjacent targets (Medium),
visible focus rings for keyboard users (High), body-text contrast 4.5:1 minimum (High), touch
feedback on press (Medium), `FlatList` only for 50+ items (High — this screen's lists are 5 entry
links and ≤~6 badges, so `.map()` inside `ScrollView` was kept, same reasoning every other bounded
Vaporwave list uses).

1. **No new contrast pairing was invented.** Badge chips, the stat-card icon chip, and the
   verify-email banner's primary button all reuse the exact solid-`indigoSecondary`-fill +
   `onAccent`-text pairing `voting-web.md` measured at 9.0:1 dark / 6.46:1 light — not re-measured
   here since the token values are unchanged.
2. **Stat digits stay `foreground`, never `indigoPrimary`/`indigoSecondary` as text color** — this
   carries forward the rule `voting-web.md`/`leaderboard-web.md` already established ("no
   color-coded text sits directly on a background... differentiation is carried by badge/border
   fills, never by tinting body text"). The retired independent-theme `WebScoreCard` colored its
   Meme Score digit directly with `primaryText`/`goldText` — that pattern is **not** carried
   forward; differentiation between the two stat cards is now carried by each card's icon chip
   (a solid fill), not by recoloring the number.
3. **Mode-conditional focus ring everywhere interactive** (top-bar toggle, every settings row, the
   verify-email banner's buttons): `indigoPrimary` dark / `indigoSecondary` light, the same
   ~11.7:1 dark / ~6.5:1 light pairing every other Vaporwave screen's focus ring uses. Built into
   `WebProfileTopBar`/`WebSettingsRow` from the start (this screen is a fresh Vaporwave build, not
   inheriting the older `WebFriendsTopBar`/`WebFeedTopBar` gap `voting-web.md` had to flag).
4. **Log Out row: color is not the only signal.** `error` tint on icon+text is paired with a second,
   non-color cue — no chevron, and a separate "Account" section heading/grouping distinct from the
   "Explore" links above it — same rule the retired version already applied, carried forward
   unchanged (not re-derived, since it was already correct).

### Phase 2 finding (real, fixed in this build): missing email-verification affordance on web
Neither the retired independent-theme `SessionScreen.web.tsx` nor its own `profile-web.md` ever
rendered native's `EmailVerificationBanner` — the web build has silently lacked it since this
screen's very first web pass. An unverified account can't vote, generate AI captions, start new
DMs, or create a community (`.claude/memory/hardening.md` F-1; native's own `EmailVerificationBanner`
doc comment: "the only place in the app that explains why and lets the user actually fix it"). A
web user hitting those gates previously had **zero on-screen explanation or fix path** — a real
functional-parity gap, not a visual one. Fixed with `components/web/WebEmailVerificationBanner.tsx`:
same mutations/Redux action native's banner already uses (`useRequestEmailOtpMutation`,
`useConfirmEmailOtpMutation`, `setEmailVerified`), Vaporwave-styled markup instead of native's
NativeWind classNames (reusing that component verbatim on web would have pulled the native "Vivid
Meme Culture" tokens into this Vaporwave-migrated screen — a token contradiction, not a fix).
Zero new backend calls. Conditionally rendered (`!user.emailVerifiedAt`) directly under the
identity block, above the stat cards — the first thing an unverified user sees, matching where
native places it.

---

## Page-Specific Rules

### Layout — Phase 2.5 (structural alternatives considered)

**Baseline / recommended and implemented: identity block → verify-email banner (conditional) →
two-up stat cards → badge row → "Explore" settings group → "Account" settings group.** Same order
the retired version used (a real prior audit already got this ordering right — verify-email sits
above the stats because an unverified account's gates apply to almost everything below it), plus
the banner insertion point.

Two structurally different alternatives were considered and rejected:

- **Two-column layout (identity + stats in a left rail, settings groups in a right column, both
  visible without scrolling on a wide viewport).** Optimizes: uses the desktop surface, no scroll
  needed to reach "Log Out" on a tall monitor. **Costs:** this route sits in `DesktopShell`'s
  capped-width content column (`DESKTOP_CONTENT_MAX_WIDTH`, not the wider `DESKTOP_FEED_CONTENT_MAX_WIDTH`
  reserved for `/feed`); a two-column split at that width would compress the settings-row labels
  and badge chips uncomfortably, and widening the column is a shared-file (`DesktopShell.tsx`)
  change out of scope for a single-screen pass — the identical rejection reasoning
  `leaderboard-web.md`/`voting-web.md` already recorded for their own two-pane alternatives.
  Rejected on the same precedent rather than re-deriving it.
- **Tabbed profile (Overview / Settings as two segmented tabs, splitting stats+badges from the
  settings lists).** Optimizes: shorter single-tab scroll depth. **Costs:** this screen's total
  content is short (5 links + ≤6 badges + 2 stat cards) — nowhere near the length that motivated
  tabs on Voting (Active/Open/Results, each independently paginated) or Leaderboards
  (Individual/Communities, each its own infinite list). Adding a tab control here would add an
  extra click to reach "Log Out" for zero scroll-depth benefit, working against the Phase 0 primary
  action (get oriented and move on) rather than for it. Rejected: the cost of an extra interaction
  is not justified by content that already fits comfortably in one scroll.

**Recommended and implemented:** single scrolling column, same order as the retired version (that
prior audit's ordering decision holds up under Vaporwave's own tokens, so it was kept, not
re-litigated) plus the verify-email banner insertion.

### Navigation
`FloatingBottomNav active="profile"` is rendered (unlike Voting/Leaderboard, which are drill-in,
nav-less screens) — Profile is one of `FloatingBottomNav`'s four `NavDestination` values and has
its own `DesktopSidebarNav` sidebar item, matching the native screen's own navigation model (a
primary tab, not a drill-in). No back button in `WebProfileTopBar`, same reasoning.

### Component Notes
`WebAvatar` (not a new `WebProfileAvatar`) renders the 88px identity-block avatar — same reuse
precedent `WebLeaderboardRow` already established for community-initials rows. `WebScoreCard`'s
icon chip (`military-tech` for Meme Score, `emoji-events` for Badges) is the only genuinely new
visual pattern this page introduces to the Vaporwave family — a solid-fill icon badge used to
differentiate two otherwise-identical stat cards without tinting the number itself (see
Accessibility #2 above).

---

## Known seams (accepted, out of scope for this pass)

- `DesktopShell`/`DesktopSidebarNav` still render in the older pre-Vaporwave chrome
  (`#1e0f13`/`#372529`) — the same accepted shell-boundary seam every prior Vaporwave screen has
  documented.
- `FloatingBottomNav` is intentionally plain inline `StyleSheet`, not Vaporwave-themed (confirmed
  Android `BlurView`/NativeWind sizing bug, per `MASTER.md`'s Component Conventions) — inherited
  unchanged from Feed/Compete's identical precedent, not something a single-screen pass should fix.
- The verify-email OTP request can 404/fail in a local dev environment without Google OAuth env
  vars configured (`.claude/memory/auth-profile.md`: "needs Google OAuth env vars configured to
  actually send") — the banner's error state renders correctly regardless (verified via screenshot,
  see report), this is a backend/environment configuration gap, not a frontend bug.

---

## Next steps

Profile is screen 4 of 5 in the ordered Vaporwave migration sequence (Voting → Challenges →
Leaderboard → **Profile** → Inbox). Per the standing-default status this system already has, no
further approval gate is required before Inbox's own migration pass — but per the PILOT-SCREEN
precedent this system established, Inbox's independent system (it currently has none of its own —
never migrated) remains untouched until its own dedicated migration pass.
