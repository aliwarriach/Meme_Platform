# Community Web Page Overrides

> **PROJECT:** Meme Platform
> **Generated:** 2026-08-11 (hand-authored — see "Why hand-authored" below)
> **Page Type:** Desktop/web-only GREENFIELD pilot — `CommunitiesScreen.web.tsx`,
> `CommunityDetailScreen.web.tsx`, `CreateCommunityScreen.web.tsx`
> **Mode:** GREENFIELD MODE, explicit new-visual-identity request, **light + dark** (the
> feed-web pilot below shipped dark-only; this pass ships two independently-grounded palettes
> plus a toggle). Native is completely untouched.

> ⚠️ **IMPORTANT:** Rules in this file **override** `design-system/meme-platform/MASTER.md`
> and apply **only** to the web-only communities tree (`Communities*.web.tsx`,
> `components/web/WebCommunity*.tsx`, `constants/webCommunityTheme.ts`,
> `constants/CommunityWebTheme.tsx`). MASTER.md's "Vivid Meme Culture" system is untouched and
> still governs every native screen. `pages/feed-web.md`'s "Dark Cinema" system is untouched and
> still governs only the web feed screen. This page is a third, independent system — expected
> divergence per this task's explicit ask, not a contradiction requiring reconciliation.

---

## Why hand-authored, not `--persist --page`

Same tooling gate as `feed-web.md`: `design_system.py::persist_design_system` returns
`status: "skipped_exists"` whenever `MASTER.md` already exists and `--force` isn't passed —
verified again by actually running the flow first:

```
python "$HOME/.claude/skills/ui-ux-pro-max/scripts/search.py" "vibrant community membership directory discover join groups app violet purple green playful" --design-system --persist -p "Meme Platform" --output-dir "C:\Users\Newuser\Desktop\Meme_Platform" --page "community-web"
```
→ printed the full recommendation (captured verbatim in Reconciliation below) but did not write
a page file (`--force` forbidden by this task's scope). Everything below is transcribed by hand
from raw query output — nothing invented from memory.

---

## Reconciliation — multi-query convergence (RESKIN's "Generating the new system" discipline)

Per this agent's own rule (never trust a single `--design-system` roll), split-domain queries
were run 3-4× per domain with different phrasings, covering both light and dark explicitly, and
only what **converged across independent runs** was kept.

### Style (`--domain style -n 5`, 6 phrasings total)
Phrasings run: "community social hub discover join dark mode vibrant gen-z" / "social community
directory groups app playful energetic dark theme" / "community collaboration workspace
directory warm belonging membership app" / "community light mode clean minimal social groups app
friendly" / "vibrant playful community groups app light and dark theme full support bento cards"
/ "social club directory member cards badges friendly approachable app".

- **"Vibrant & Block-based"** (Bold, energetic, playful, block layout, geometric shapes, high
  color contrast; **Light ✓ Full / Dark ✓ Full**; "Best For: ...social media, youth-focused,
  entertainment, consumer") appeared in **3 of 6** independent style queries (top-5) — the only
  style family that (a) recurred across multiple distinct phrasings **and** (b) natively
  supports both modes, which every other recurring candidate ("Modern Dark Cinema Mobile" —
  4/6 but dark-primary-only; "Dark Mode OLED" — 4/6 but dark-only) did not. Deliberately not
  reused here anyway: "Cinema Mobile" is `feed-web.md`'s own family (indigo, glassmorphism) —
  reusing it would blur two pages that are supposed to be independently-generated systems, not
  variations of the same one.
- **Kept:** "Vibrant & Block-based" — bold block-card layout, high contrast, full light+dark
  support. Directly fits the Communities section's own primary action (browsing/scanning a
  directory of discrete community "blocks" to join) better than a single-column feed metaphor.

### Color (`--domain color -n 5`, 4 phrasings)
"vibrant playful community social youth entertainment block color palette dark mode" / same
phrase with "light mode" / "membership community purple violet dark mode app card surface" /
"social club groups dark theme violet purple accent vibrant".

- **Product Type: "Membership/Community"** — `Primary #7C3AED / Secondary #A78BFA / Accent
  #16A34A / Background #FAF5FF / Foreground #4C1D95 / Muted #ECEEF9 / Border #DDD6FE /
  Destructive #DC2626` — returned as an **exact identical row** in **3 of 4** color queries.
  The product-type label itself ("Membership/Community") is a direct semantic match for this
  section, not a generic swatch repurposed from an unrelated vertical.
- **Dark-mode counterpart**: no row is explicitly labeled dark + "Membership/Community", so the
  dark surface values are derived from the *same exact Primary `#7C3AED`* recurring in three
  separate dark-background rows across the two dark-phrased queries (Sleep Tracker,
  Photo Editor & Filters — the latter using #7C3AED as Primary directly, an exact match to the
  light-mode Primary): `Background #0F172A / Card #192134 / Muted #171939 / Muted Foreground
  #94A3B8 / Border rgba(255,255,255,0.08) / Foreground #FFFFFF` — `#94A3B8` and the
  `rgba(255,255,255,0.08)` border appear in **every** dark row returned across both dark-phrased
  queries, highest-confidence dark tokens in the set. Secondary in dark mode uses `#6366F1`
  (recurred 3× across the same dark rows) rather than light mode's `#A78BFA`, since `#A78BFA` on
  `#0F172A` reads too close in value to the primary for a useful secondary distinction, while
  `#6366F1` is itself grounded (not invented) from the same rows.
- **Accent kept identical across modes**: `#16A34A` (light-grounded "join green") is reused
  as-is in dark mode rather than substituting a separately-invented dark accent, because (a) it
  already carries a WCAG-driven adjustment per its own row note ("[Accent adjusted from #22C55E
  for WCAG 3:1]") and (b) a manual contrast check against the dark background confirms it still
  passes body text: `#16A34A` on `#0F172A` = **5.42:1** (exceeds 4.5:1 AA). Cross-mode-identical
  accent also keeps "active/joined" status legible as the same hue regardless of theme, which
  matters for a status color, not just a decorative one.
- **Independent 4th confirmation**: the cross-check `--design-system` roll (query: "vibrant
  community membership directory discover join groups app violet purple green playful") landed
  on **exactly** the same STYLE ("Vibrant & Block-based") **and** the same COLORS row
  (`#7C3AED`/`#A78BFA`/`#16A34A`/`#FAF5FF`/`#4C1D95`/`#ECEEF9`/`#DDD6FE`/`#DC2626`) as the split
  queries above — a genuine second-source convergence on both axes simultaneously, not a
  coincidence of asking the same non-deterministic tool twice.

### Typography (`--domain typography -n 5`, 3 phrasings)
"playful bold community social app rounded friendly sans typography" / "membership directory
clean modern geometric sans app typography light dark" / "community discover join directory bold
energetic yet clean readable app typography".

- **Fredoka (heading) / Nunito (body)** ("Playful Creative" pairing — "playful, friendly, fun,
  creative, warm, approachable"; Best For: "...creative tools, entertainment") appeared in the
  first phrasing's top-5 **and** was independently returned by the cross-check `--design-system`
  roll above — **2/2 convergence**. No other pairing recurred across more than one query. Chosen
  over Geometric Modern (Outfit/Work Sans, 1 hit) and Modern Dark Cinema (Inter, 1 hit — also
  `feed-web.md`'s own family, avoided for the same reason as the style choice above).
- Google Fonts URL (verbatim, non-truncated, from raw output):
  `https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Nunito:wght@300;400;500;600;700&display=swap`

### UX/accessibility grounding (`--domain ux -n 5`, "contrast focus keyboard touch target
spacing grouping icon")
Returned: 44×44px minimum touch targets (High severity), 8px minimum gap between adjacent touch
targets (Medium), visible focus rings required for keyboard users (High — this page is
`Platform.OS==='web'`, so this row applies directly, unlike the native-only rows in
`MASTER.md`), body text contrast (dark text on light bg / High). All four directly inform the
Accessibility section below.

### React Native stack grounding (`--stack react-native -n 5`, "community card grid discover
directory member list join button")
Returned: memoized `renderItem`, stable `keyExtractor`, `FlatList` over `ScrollView.map()` for
50+ items — already the existing pattern in every native list in this codebase; no change
needed, just confirms the discover/members grids below should stay `FlatList`-backed (not
`ScrollView` + `.map()`) once community/member counts grow past a handful.

---

## Page-Specific Rules

### Layout Overrides
- **Structure:** `DesktopShell` (untouched, shared) supplies the sidebar at ≥900px and the
  680px-max content column (this page does not use the wider feed-route column). All three
  screens render inside that column.
- **Discover / My Communities (`CommunitiesScreen.web.tsx`):** 2-column card grid (`WebCommunityCard`),
  not a single-column list — see CONCEPT GENERATION in the agent's final report for why a grid
  beat the native single-column carryover.
- **Community Detail (`CommunityDetailScreen.web.tsx`):** single-column stacked page — banner
  header (icon/name/privacy/member count/description/action button) → segmented tab control
  (`WebSegmentedControl`) → tab content. Feed tab is a single card column; Members tab is a
  2-column member-card grid with a pending-join-requests block above it for owners. Leaderboard
  and Challenges tabs are explicitly **out of this pass's scope** (see Known seams) and reuse the
  native `IndividualLeaderboardRow`/`ChallengeRow` rows unrestyled inside a plain themed
  container, exactly like `feed-web.md`'s precedent of reusing nested modals as-is.
- **Create (`CreateCommunityScreen.web.tsx`):** centered single-column form, capped at 480px
  inside the 680px shell column (matches `DESKTOP_MODAL_MAX_WIDTH`, reused as a form-width cap
  rather than inventing a new constant).
- **Breakpoint:** reuses `DESKTOP_FRAME_MIN_WIDTH` (900px), same as `feed-web.md` and
  `DesktopShell` itself — one breakpoint, no mismatch.

### Light/Dark mechanism
- `constants/webCommunityTheme.ts` exports both palettes as plain objects (`COMMUNITY_LIGHT`,
  `COMMUNITY_DARK`) plus shared spacing/radius/type-scale/font constants.
- `constants/CommunityWebTheme.tsx` exports a `CommunityThemeProvider` + `useCommunityWebTheme()`
  hook, mounted locally by each of the three `.web.tsx` screens (not global — scoped exactly to
  this tree, per this task's explicit instruction). Default resolution order: `localStorage`
  override (`community-web-theme` key) → `Appearance.getColorScheme()` (OS preference, works
  under react-native-web) → `'light'` fallback. A toggle button in each screen's top bar flips
  and persists the override.

### Spacing / Radius
- 4/8/12/16/24/32/40px scale (`COMMUNITY_WEB_SPACING`) — the 40px "section" step is deliberately
  larger than `feed-web.md`'s 24px max, per "Vibrant & Block-based"'s own documented "large
  sections (48px+ gaps)" note (scaled to 40 for in-app density vs. that note's landing-page
  context, same reasoning `feed-web.md` used to scale down its own reference numbers).
- Card radius 18px (distinct from `feed-web.md`'s 20px and MASTER's 24px — small deliberate
  difference, not a copy), pill 999px for buttons/chips/badges/avatars (accessible tap-target
  convention, not a fabricated brand signature).

### Component Notes
New standalone `components/web/` components (none reuse MASTER's or `feed-web.md`'s
components — both are scoped to their own trees): `WebCommunityAvatar`, `WebCommunityCard`,
`WebMemberCard`, `WebJoinRequestCard`, `WebCommunityFeedCard`, `WebCommunityTopBar`,
`WebPillButton`, `WebTextField`, `WebSegmentedControl`.

---

## Known seams (accepted, out of scope for this pilot)

- `DesktopShell`/`DesktopSidebarNav` render in `feed-web.md`'s already-diverged old-token chrome
  (`#1e0f13`/`#372529`) — a third visible clash at the shell/content-column boundary. Same
  accepted scope boundary as `feed-web.md`: reskinning shared app chrome would propagate a new
  system app-wide before manual review, which the PILOT-SCREEN RULE forbids.
- Community Detail's Leaderboard and Challenges tabs render native `IndividualLeaderboardRow` /
  `ChallengeRow` unrestyled (old NativeWind tokens) — explicit user scope exclusion for this
  pass, not an oversight. Because those rows assume MASTER.md's dark-only palette (white text,
  no light variant), the container wrapping them uses a **fixed dark surface sourced verbatim
  from MASTER.md's own `bg`/`surface`/`outline-variant`/`ink-muted`/`error`/`primary` tokens**
  (not this page's light/dark toggle) — verified by contrast check during the visual pass this
  page's own violet primary measured ~2.9:1 and red destructive ~3.4:1 against that fixed dark
  card (both fail 4.5:1); MASTER's own pink primary (4.7:1) and error token (9.6:1) were used
  instead specifically inside this seam. This keeps the reused rows exactly as legible as they
  are natively, regardless of which mode the rest of this page is in.
- The `/new-post` (creator) and `/communities/[id]/challenges/*` routes, reached via buttons on
  this page, are native-resolved and render unstyled on web — out of scope.

---

## Next steps (do not do this automatically)

Core Communities is the pilot for this system only. Do not propagate "Vibrant & Block-based"
(community palette) to Challenges, Leaderboards, or any other screen until a human has reviewed
the rendered result and explicitly approved the direction.
