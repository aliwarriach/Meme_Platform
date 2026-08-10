# Roadmap — UI/UX Design & Accessibility Pass

**Created:** 2026-08-07 · **Driver:** ux-ui subagent (`.claude/agents/ux-ui.md`), one screen-group per phase, human-reviewed before the next phase starts.

## Relationship to `Roadmap_UX_Overhaul.md`

That roadmap (Phases 17–21, all shipped) fixed **functional/interaction** UX — navigation depth, discoverability, optimistic updates, chat, notifications. This roadmap is the layer on top: **visual design-system grounding, accessibility, and cross-screen consistency** on the screens that roadmap already made functionally correct. Different axis, not a duplicate — don't re-litigate navigation/data-flow decisions here; assume Phases 17–21's shipped behavior is correct and audit how it *looks and is perceived*.

## Ground truth this pass works from

The frontend already has a shipped design system — this is **not** a from-scratch redesign:
- "Vivid Meme Culture" (Stitch-generated, 2026-07-26): dark-mode-only, neon pink `primary #ff3385`, electric purple `secondary #8a2be2`, `tertiary #5ee060`, pure white `heading #ffffff`, `ink #f9dbe1` / `ink-muted #e3bdc5`, full surface scale (`surface-lowest` → `surface-bright`), Be Vietnam Pro font family, full pill roundness. Tokens live in `frontend/tailwind.config.js`.
- Shared components: `GlassCard`, `PillButton`, `Chip`, `Avatar`, `VotePill`, `TopBar`, `FloatingBottomNav`, `TextField`.
- **Known gotcha — do not reintroduce:** `BlurView` (`expo-blur`) is not NativeWind-registered and has an Android sizing bug when nested with real content; it was removed entirely from `FloatingBottomNav` after three failed fix attempts (see `.claude/memory` frontend-redesign entry). Any new glassmorphism must use the `StyleSheet.absoluteFill` sibling-layer pattern, or skip blur entirely — never put layout classNames directly on `<BlurView>`.
- **Scope boundary carried over from the redesign:** UI layer only (`components/`, `features/*/*Screen.tsx`, feature-local components, `tailwind.config.js`, `global.css`). `services/`, `store/`, TanStack Query hooks, the WebSocket manager, and Redux slices are out of scope for this agent — untouched, tested integration code.

So each phase below runs the ux-ui agent's Phase 1 **grounded in these existing tokens** (query the skill to validate/supplement, but the shipped direction wins on conflict — per the agent's own rule), not a fresh generic recommendation.

## Process

1. Agent runs FULL MODE against the phase's screens, persists/extends `design-system/meme-platform/MASTER.md` + one `pages/<screen>.md` per screen.
2. Agent applies BUILD fixes directly (real diffs, not just a report).
3. **Human review of the diff before the next phase starts** — no phase auto-chains into the next.
4. Nothing gets committed by the agent — review happens against the working tree.

## Phases

### Phase A — Communities (PILOT, in progress)
`CommunitiesScreen.tsx` (list/hub), `CommunityDetailScreen.tsx` (feed/members/leaderboard/challenges tabs), `CreateCommunityScreen.tsx`. Chosen as the pilot because it's the most recently touched area (Phase 18/20 of the functional roadmap) and establishes `MASTER.md` for every later phase.

### Phase B — Core loop
Feed (`FeedScreen`), Creator (upload/overlay/template picker + audience selector), Compete (`/compete` — Challenges list/detail/create/vs, Leaderboards). Highest-traffic screens; casual users live here per root `CLAUDE.md`.

### Phase C — Retention loop
Messaging (conversation list + thread + composer), Friends, Notifications. Second-order engagement surfaces.

### Phase D — Auth & onboarding
Login, Register, `SessionScreen` (Profile). First-impression and re-entry screens; smallest phase, cheap to do early once B/C validate the pattern.

### Phase E — Secondary & native-specific
Voting (Meme of Day/Week/Month), Sharing (native share sheet), Instagram Companion (`MemeContainer`/WebView), Templates, hashtag feed (`/tag/[slug]`), AI-caption modals.

### Phase F — Desktop web parity
`DesktopShell`, `DesktopSidebarNav`, `WebModalFrame`, `DesktopInboxPanel` and any other `Platform.OS==='web'` route. Separate phase because Phase 2's accessibility branch differs here (keyboard focus, not screen-reader) and it's the one place visual verification via a real screenshot (`expo start --web` + the `run` skill) is actually possible in this environment — native phases can't be screenshotted this way.

## Not in scope for this roadmap

Anything that changes behavior, data flow, navigation structure, or API shape — that's `Roadmap_UX_Overhaul.md` territory (or a new entry there). This roadmap only touches how already-correct flows look, read, and are perceived.
