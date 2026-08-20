# Inbox Web Page Overrides

> **PROJECT:** Meme Platform
> **Generated:** 2026-08-20 — net-new build, no prior page doc to supersede.
> **Page Type:** Desktop/web-only screens — `InboxScreen.web.tsx` (conversation list) +
> `ThreadScreen.web.tsx` (single conversation thread). Screen 5 of 5, the LAST screen in the
> ordered Vaporwave migration sequence (Voting → Challenges → Leaderboard → Profile → **Inbox**).
> **Mode:** FULL MODE pass. Per this task's explicit instruction, Phase 1 was **promoted, not
> generated** — Vaporwave/Luminous is the project's already-persisted standing default (see
> `MASTER.md`'s "Web Design System" section), so no skill re-query was run for tokens. Phase 0
> (primary action), Phase 2 (UX/accessibility audit), Phase 2.5 (layout alternatives), and Phase 3
> (score) all ran normally against those fixed tokens.

> ⚠️ **IMPORTANT:** Rules in this file **override** `design-system/meme-platform/MASTER.md` for
> anything page-specific but **inherit** MASTER's "Web Design System" section for all shared
> tokens/mechanism — same relationship `voting-web.md`/`leaderboard-web.md`/`profile-web.md`
> already have. Applies to the web-only messaging tree
> (`features/messaging/InboxScreen.web.tsx`, `features/messaging/ThreadScreen.web.tsx`,
> `components/web/WebInboxTopBar.tsx`/`WebThreadTopBar.tsx`/`WebConversationRow.tsx`/
> `WebNewChatModal.tsx`/`WebMessageBubble.tsx`/`WebMessageComposer.tsx`). MASTER's "Vivid Meme
> Culture" system (above the Web Design System section) is untouched and still governs the native
> screens: `features/messaging/InboxScreen.tsx`, `ThreadScreen.tsx`, `ConversationList.tsx`,
> `MessageBubble.tsx`, `NewChatModal.tsx` — **not touched by this pass, byte-for-byte identical.**

---

## Build record — net-new, nothing retired (2026-08-20)

Unlike Voting/Challenges/Profile, Inbox had **no prior independent web theme and no prior
`.web.tsx` sibling for either screen** — there was nothing to consolidate or delete. Neither
`app/inbox.tsx` nor `app/inbox/[conversationId].tsx` needed any change: both import their screen
component by bare specifier (`InboxScreen`, `ThreadScreen`), and Metro/Expo Router's
platform-extension resolution now prefers the new `.web.tsx` siblings for the web bundle
automatically.

Eight new files, all reading tokens from `constants/webFeedThemeVapor.ts` via
`useVaporwaveTheme()`, same source of truth already governing every prior Vaporwave screen:
- `features/messaging/InboxScreen.web.tsx` — conversation-list screen shell (provider mount,
  gradient background, top bar, list, New Chat modal).
- `features/messaging/ThreadScreen.web.tsx` — single-thread screen shell (provider mount, top
  bar, inverted message list, composer). Same optimistic-send/socket-patch cache model as native
  — `useConversationMessages`, `useSendMessageMutation`, `useMarkConversationReadMutation` are
  reused unmodified; this pass only changes presentation, never `services/messagingCache.ts`'s
  transforms (per `frontend/CLAUDE.md`: socket frames patch the cache, never invalidate it).
- `components/web/WebInboxTopBar.tsx` — back button + title + live socket-status dot + a
  **labeled** "New Chat" pill + the light/dark toggle (see Phase 2 finding below for why this
  isn't the bare icon-only button native uses).
- `components/web/WebThreadTopBar.tsx` — back button + the other participant's avatar/username +
  the light/dark toggle. No "New Chat" action — that's the list screen's job.
- `components/web/WebConversationRow.tsx` — themed conversation row (new; native's
  `ConversationList`/`ConversationRow` stay untouched, same "new `Web*` component, not a reskinned
  native one" precedent every prior Vaporwave row follows).
- `components/web/WebNewChatModal.tsx` — themed friend-picker modal (`Modal` + `WebModalFrame`,
  same shape as `WebCompetitionEntryModal`, but fully themed rather than reusing a native body —
  the content here is simple enough not to need that seam).
- `components/web/WebMessageBubble.tsx` — themed message bubble (text/meme kinds, pending/read
  state).
- `components/web/WebMessageComposer.tsx` — themed composer (optimistic send, no
  `KeyboardAvoidingView` — that was an iOS-only native concern, meaningless on a web `<textarea>`).

**Reused, not duplicated:** `WebAvatar` renders every avatar on both screens (conversation rows,
thread top bar, New Chat modal rows) — same reuse precedent every prior Vaporwave screen
established, no second avatar implementation written.

**No skill re-query was run for this pass.** Per the task's explicit instruction, Vaporwave/
Luminous is being *extended*, not *regenerated* — every token cited below is read directly from
`webFeedThemeVapor.ts`, or is a direct carry-forward of a contrast decision `voting-web.md`/
`leaderboard-web.md`/`profile-web.md` already made and grounded.

---

## Phase 0 — primary action

Reach an existing conversation and exchange a message with minimal friction — Inbox is a
**task screen** (like Voting/Challenges), not a hub (like Profile) or a pure lookup (like
Leaderboard): the point of opening it is almost always to read something new and reply, not to
browse. Every decision below (New Chat as a modal vs. inline, single-column vs. two-pane, the
unread-badge treatment) is judged against how fast a user gets from "Inbox" to "message sent."

---

## Tokens actually used (sourced from `constants/webFeedThemeVapor.ts`, not re-typed from memory)

### Typography
Quicksand (`QUICKSAND_STACK`, `VAPOR_TYPE_DARK`/`LUMINOUS_TYPE_LIGHT`), loaded via
`injectFeedWebFont()` — same as every other Vaporwave screen.

### Color roles used on this screen
| Role | Dark value | Light value | Used for |
|---|---|---|---|
| `gradientTop/Mid/Bottom` | `#12121f`/`#1a1a28`/`#0d0d1a` | `#f8f9ff`/`#f2f3f9`/`#ffffff` | Page background gradient (both screens) |
| `surfaceGlass` | `rgba(255,255,255,0.1)` | `rgba(255,255,255,0.75)` | Composer input fill, "other" message bubble fill |
| `surfaceElevated` | `#292937` | `rgba(255,255,255,0.9)` | "Own" message bubble fill, New Chat modal close-button fill |
| `surfaceHover` | `rgba(41,41,55,0.85)` | `rgba(242,243,249,0.9)` | Conversation row hover, New Chat friend-row hover |
| `border` | `rgba(255,255,255,0.15)` | `#bac9cb` | Top-bar/row/composer/bubble borders |
| `hoverTint` | `rgba(255,255,255,0.06)` | `rgba(0,219,233,0.08)` | Icon-button hover (both top bars) |
| `indigoSecondary` | `#8c016b` | `#a72683` | "New Chat" pill fill, unread badge fill, Send-button fill, own-bubble border — always paired with `onAccent` (fills) or used as the light-mode focus-ring/border color |
| `indigoPrimary` | `#00f0ff` | — (dark-mode-only) | Top-bar focus ring, dark mode only |
| `accentUpvote` / `accentDownvote` | `#22C55E` / `#EF4444` | same | Socket-status dot: connected / disconnected (see Accessibility #1) |
| `foreground` / `foregroundMuted` | `#e3e0f3` / `#b9cacb` | `#191c20` / `#3b494b` | Usernames, message text, timestamps, read receipts, empty/error states |
| `onAccent` | `#FFFFFF` | `#FFFFFF` | Text/icons on `indigoSecondary` fills |
| `error` | `#ffb4ab` | `#ba1a1a` | Load-error text, send-error text |

### Radius / spacing
`radius.card` (24 dark / 16 light) on message bubbles, `radius.pill` (999) on the New Chat pill,
unread badge, top-bar icon buttons, and Send button — all from `VAPOR_RADIUS_DARK`/
`LUMINOUS_RADIUS_LIGHT`. `FEED_WEB_SPACING` (4/8/12/16/20/24) — same shared scale as every other
Vaporwave screen.

---

## Accessibility — decisions made this pass (measured/grounded, not eyeballed)

```
python "$HOME/.claude/skills/ui-ux-pro-max/scripts/search.py" "contrast focus keyboard touch target" --domain ux -n 5
python "$HOME/.claude/skills/ui-ux-pro-max/scripts/search.py" "conversation list message bubble unread badge chat" --stack react-native -n 5
```
Returned: 44×44px minimum touch targets (High), visible keyboard focus rings (High), body-text
contrast 4.5:1 minimum (High), color-is-never-the-only-signal (High), `FlatList` for long/unbounded
lists (High — both the conversation list and the message list use `FlatList`, matching native).

1. **No new fill/text contrast pairing was invented.** The "New Chat" pill, unread badge, and Send
   button all reuse the exact solid-`indigoSecondary`-fill + `onAccent`-text pairing
   `voting-web.md` measured at 9.0:1 dark / 6.46:1 light — not re-measured here since the token
   values are unchanged.
2. **`indigoPrimary` is never used as a text-bearing fill on this screen** — only as the
   dark-mode-only focus ring (~11.7:1 against the dark canvas), matching `voting-web.md`'s
   established rule. This is deliberate, not incidental: `FriendsScreen.web.tsx`'s "Send" button
   and `WebFriendRequestRow`'s "Accept" button (both out of scope, already-migrated files) use
   `indigoPrimary` as a solid white-text fill — the exact pairing `voting-web.md`'s own audit
   measured at 1.41:1 dark / 1.70:1 light and rejected. **Flagged here as a real, pre-existing
   contrast bug carried into two Friends-screen components** (not fixed — Friends is out of this
   pass's named scope, same "flag, don't fix" precedent `voting-web.md` set for
   `WebFeedTopBar`/`WebFriendsTopBar`'s missing focus ring). This Inbox build does not repeat it
   anywhere.
3. **No color-coded text sits directly on a background in this build** — usernames, message text,
   and timestamps all use `foreground`/`foregroundMuted` exclusively. Own-vs-other message bubbles
   are differentiated by **fill + border shape**, not text tint: own bubbles get `surfaceElevated`
   + a full `indigoSecondary` border, other bubbles get plain `surfaceGlass` with a neutral
   `border`. Same "no color-coded text" rule every prior Vaporwave screen's accessibility section
   established, applied here to a new content type (chat bubbles) rather than rows/badges.
4. **Unread state is never color-only.** `WebConversationRow` pairs the unread visual weight
   (bolder `foreground` preview text vs. muted `foregroundMuted` for read) with a solid numeric
   **badge** (shape + text, the unread count itself) and an `accessibilityLabel` that states the
   unread count explicitly (`"Open conversation with X, N unread"`) — same pattern
   `leaderboard-web.md`'s "You" badge finding established for its own color-only gap.
5. **Socket-status dot uses theme tokens, not hardcoded hex** — unlike
   `ConversationList.tsx`/`DesktopInboxPanel.tsx`'s own `STATUS_DOT_COLOR` (raw `#5ee060`/
   `#ffb1c4`/`#aa888f` literals, native "Vivid Meme Culture" hex, out of scope to change).
   `WebInboxTopBar` sources connected/disconnected from `accentUpvote`/`accentDownvote` (the
   existing cross-app vote-semantics tokens) and "connecting" from `indigoSecondary` as a neutral
   in-progress signal — there's no dedicated warning/pending role in this palette, so the brand
   accent was chosen deliberately rather than inventing an ungrounded amber literal.
6. **Mode-conditional focus ring everywhere interactive** on both top bars, every conversation
   row, every New Chat friend row, and the composer's Send button: `indigoPrimary` dark /
   `indigoSecondary` light, the same ~11.7:1 dark / ~6.5:1 light pairing every other Vaporwave
   screen's focus ring uses.

### Phase 2 finding (real, fixed in this build): icon-only "New Chat" affordance
Native's `InboxScreen` renders a bare `edit` icon button (`accessibilityLabel="New chat"`, no
visible text) as the only way to start a new conversation. On a phone that's an established
mobile-chat-app convention (Messages, WhatsApp); on a wide desktop canvas with room to spare, an
icon-only compose action reads ambiguously on first glance for a sighted user even though the
`accessibilityLabel` already covers screen readers correctly. `WebInboxTopBar`'s "New Chat" is a
labeled pill (`+` icon + text), matching `DesktopSidebarNav`'s own "Create" button shape — a
first-time-hesitation fix grounded in the extra horizontal room desktop web has that native's
44×44pt icon button doesn't.

---

## Page-Specific Rules

### Layout — Phase 2.5 (structural alternatives considered)

**Baseline / recommended and implemented: single-column stack navigation** — the conversation
list at `/inbox`, drilling into a full-page thread at `/inbox/[conversationId]`, exactly
mirroring native's two-route structure. Zero routing change needed (see Build record above).

Two structurally different two-pane alternatives were considered and rejected — this is
genuinely the strongest candidate among all five migrated screens for a real two-pane split
(messaging apps are canonically two-pane on desktop), so both were weighed seriously rather than
pattern-matched against the prior rejections:

- **Two-pane split inside the current 680px `DesktopShell` content column** (list ~280px left,
  thread ~380px right, both visible without a page change). **Optimizes:** Slack/Messenger-style,
  switching threads needs no full navigation. **Costs:** at a capped 680px column, each pane
  compresses immediately — conversation previews would truncate to a few characters and the
  220px-wide meme-bubble images used elsewhere in this build wouldn't comfortably fit a ~380px
  thread pane alongside its own padding and composer. Same specific width-constraint rejection
  `voting-web.md`/`leaderboard-web.md`/`profile-web.md` already recorded for their own two-pane
  ideas — applying the identical reasoning here, not re-deriving it.
- **Two-pane using the wider `DESKTOP_FEED_CONTENT_MAX_WIDTH` (1040px), reserved for `/feed`.**
  **Optimizes:** would fully solve the width problem — a real Gmail-style split. **Costs:**
  `/inbox` doesn't currently opt into that wider column; enabling it means either a shared
  `DesktopShell` change (explicitly out of scope for this task) or a new per-route width
  mechanism that doesn't exist yet — disproportionate for a single-screen pass, same reasoning
  every prior rejected two-pane alternative used.

**The differentiator that makes rejecting a two-pane `/inbox` a genuine decision, not just
precedent-following:** this app **already ships a live two-pane-equivalent** — `WebFeedRail` on
the Feed screen is an always-open inbox preview sitting beside the feed content column, and
clicking a row there already deep-links into this same migrated `ThreadScreen.web.tsx` (see
"DesktopInboxPanel / WebFeedRail relationship" below). The desktop "see the list and read a
thread without a full page change" need is already served elsewhere in the app. Building a second,
competing two-pane implementation at `/inbox` itself would duplicate that job rather than serve
one `/inbox` doesn't already have: being a complete, direct, sidebar-linkable destination for
managing/scanning the **full** conversation list (not just a preview) and for thread links that
arrive from outside Feed's context (e.g. a future notification deep link). Single-column stack
wins on the actual primary action (fast read-and-reply) without either alternative's cost.

**One micro-decision, not a full Phase 2.5 item:** New Chat as a modal (matching native) vs. an
always-visible inline friend-search row pinned above the list (matching `FriendsScreen.web.tsx`'s
own inline "Add a friend" pattern). Kept as a modal: starting a new conversation is a secondary
action relative to the primary "read and reply" task, and a pinned inline row would add permanent
vertical chrome to every visit for something most opens don't need — the same modal-for-secondary-
actions precedent `DuelProposeModal` already established elsewhere in this app. The modal's
trigger itself got the Phase 2 labeling fix above.

### DesktopInboxPanel / WebFeedRail relationship (read and resolved, not left ambiguous)

`components/web/DesktopInboxPanel.tsx` (the rail-only inbox preview built during the Feed pilot)
is a **different surface** from what this pass built — a persistent, always-visible preview rail
next to Feed's content, not a full inbox page. It was read in full before starting this pass.

**Finding: `DesktopInboxPanel` is now dead code, not merely off-brand.** It is only ever imported
by `features/feed/FeedScreen.tsx` (the **native**-resolved Feed file), inside a
`Platform.OS === 'web'` branch (`showDesktopInbox`) — but Metro's platform-extension resolution
has preferred `features/feed/FeedScreen.web.tsx` for the web bundle since the Feed migration pass,
so that branch inside `FeedScreen.tsx` never executes on web (a different file entirely renders
there) and never executes on native (`Platform.OS` is never `'web'` there either). The web Feed
rail's actual, live implementation is `components/web/WebFeedRail.tsx` — already Vaporwave-themed,
already reusing native's `ConversationList` for its row data. `DesktopInboxPanel.tsx` was **not**
deleted this pass: doing so would require editing `FeedScreen.tsx`'s import, and that file is
native-resolved and explicitly out of this task's scope ("every native-resolved `.tsx` file stays
untouched"). Flagged here rather than silently left, per this task's explicit instruction.

**Separate, already-known seam, not touched:** `WebFeedRail.tsx` renders its row data via the
shared native `ConversationList`/`ConversationRow` directly — those rows still carry native's
"Vivid Meme Culture" NativeWind classNames (`bg-primary`, `text-heading`, etc.) inside `WebFeedRail`'s
otherwise-Vaporwave-themed shell, a real token mismatch. This predates this pass (introduced during
the Feed migration, documented in `WebFeedRail`'s own doc comment) and touching it means editing
`WebFeedRail.tsx`/Feed's own tree — out of this pass's scope (Feed is already migrated). This
pass's own `WebConversationRow` does **not** repeat that mismatch — it's a fully Vaporwave-native
component, available as the natural fix for `WebFeedRail` if a future pass chooses to make it
(swap its body from `<ConversationList />` to a `.map()` over the same `useConversations()` data
using `WebConversationRow`, since the rail's list is always short/bounded).

**How the two surfaces connect, concretely:** `WebFeedRail`'s rows navigate via
`router.push('/inbox/[conversationId]')` (the same call `ConversationList`'s native row already
uses) — that route now renders `ThreadScreen.web.tsx` instead of native's `ThreadScreen.tsx`, so a
thread opened from the Feed rail **already deep-links into this pass's fully migrated thread view**
with zero additional wiring. No "Back to Feed" affordance was added to either new screen:
`WebThreadTopBar`'s and `WebInboxTopBar`'s back buttons both use plain `router.back()` (the same
mechanism every other Vaporwave drill-in screen's back button uses), which already returns to
whichever screen the user actually came from — Feed if opened from the rail, `/inbox`'s own list
if opened from there or from `DesktopSidebarNav`'s "Inbox" link.

### Navigation
Neither `InboxScreen.web.tsx` nor `ThreadScreen.web.tsx` render `FloatingBottomNav` — Inbox isn't
in that component's `NavDestination` union (`'feed' | 'communities' | 'compete' | 'profile'`),
matching Friends'/Voting's/Leaderboard's identical precedent for a drill-in web screen.
`DesktopSidebarNav` already carries its own "Inbox" link (`NAV_ITEMS`, unchanged — it already
pointed at `/inbox` before this pass, since the route itself always existed). Both top bars'
back buttons are the only way back, same as every other nav-less Vaporwave screen.

### Component Notes
`WebConversationRow` and `WebMessageBubble` are net-new content types this pass introduces to the
Vaporwave family (no prior Vaporwave screen needed a chat-bubble or unread-badge-carrying row) —
both follow the same "differentiate by fill/border shape, never by tinting text" rule established
by `leaderboard-web.md`'s "You" row and `voting-web.md`'s rank badges, applied to a new context
rather than a new rule.

---

## Known seams (accepted, out of scope for this pass)

- `DesktopShell`/`DesktopSidebarNav` still render in the older pre-Vaporwave chrome
  (`#1e0f13`/`#372529`) — the same accepted shell-boundary seam every prior Vaporwave screen has
  documented.
- `components/web/DesktopInboxPanel.tsx` is dead code (see relationship section above) — not
  deleted this pass since doing so requires editing the native-resolved `FeedScreen.tsx`'s import,
  out of scope.
- `WebFeedRail.tsx` renders conversation rows via the shared native `ConversationList` component,
  unstyled inside its own otherwise-Vaporwave shell — pre-existing, out of scope (Feed's own tree).
- `FriendsScreen.web.tsx`'s "Send" button and `WebFriendRequestRow`'s "Accept" button use
  `indigoPrimary` as a solid white-text fill — a measured contrast failure (1.41:1 dark / 1.70:1
  light) `voting-web.md`'s own audit already found and designed around everywhere else. Flagged,
  not fixed (Friends is out of this pass's scope).

---

## Final consolidation check (this is the last of the five migration passes)

Grepped the full frontend tree for the five files/components this task named as expected-deleted
by the prior four passes: `webVotingTheme.ts`, `VotingWebTheme.tsx`, `webCompeteTheme.ts`,
`CompeteWebTheme.tsx`, `webProfileTheme.ts`, `ProfileWebTheme.tsx`, `WebProfileAvatar.tsx`. **All
seven are confirmed absent from `frontend/src/`** (no file at any of those paths); the only
remaining hits anywhere in the tree are doc-comment prose in already-migrated files (`WebCompeteTopBar.tsx`,
`SessionScreen.web.tsx`, `CompeteScreen.web.tsx`, `VotingScreen.web.tsx`) narrating what was
retired, not live imports. Nothing this pass wrote imports any of them. The one still-open item
from this final check is `DesktopInboxPanel.tsx` above — not one of the seven named files, dead
code rather than an old-theme file, and left in place for the scope reason given.

---

## Next steps

Inbox is the last of five screens in the ordered Vaporwave migration sequence. All five —
Feed, Friends, Voting, Challenges/Compete, Leaderboard, Profile, Inbox — now share the same
Vaporwave/Luminous token source (`webFeedThemeVapor.ts`) and toggle mechanism
(`VaporwaveWebTheme.tsx`). Any future new web screen should extend this system via the same
promote-don't-regenerate discipline these five passes established, not re-roll the skill.
Communities (`pages/community-web.md`) remains the one deliberately unmigrated screen, per every
prior pass's PILOT-SCREEN precedent — untouched until it gets its own dedicated pass.
