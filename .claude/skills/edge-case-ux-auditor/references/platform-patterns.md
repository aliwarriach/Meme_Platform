# Platform Patterns — the mechanics behind the findings

How this stack actually behaves, and what this repo actually does. Read when a finding needs to be
technically precise, or when checking whether something is a real gap versus an existing convention
you have not noticed yet.

Everything here is verified against the working tree. Where it disagrees with the code, the code wins.

---

## Where things live

```
components/            shared native UI     (GlassCard, PillButton, Chip, Avatar, VotePill, TopBar,
                                             TextField, DateField, BottomSheet, SegmentedControl,
                                             FloatingBottomNav, NotificationBell, RankBadge,
                                             PhotoEditSheet)
components/web/        shared web UI        (~65 Web* components + DesktopShell, DesktopSidebarNav,
                                             WebModalFrame, DesktopInboxPanel)
features/<name>/       screens + local components; may nest components/
services/              apisauce client + TanStack Query hooks (use*.ts) + cache patchers
store/                 authSlice, creatorDraftSlice, socketSlice
constants/             theme.ts (Neon Plum native), webFeedThemeVapor.ts (Vaporwave web),
                       ThemeMode.tsx, webLayout.ts, cssThemeVars.ts, avatarPresets.ts
```

Before recommending anything new, check these two folders for the existing answer. Extending a shared
component is almost always the better recommendation.

## State ownership — do not blur it

- **Server data** → TanStack Query. Loading/error/refetch come free; never hand-roll them.
- **Client state** → Redux Toolkit slice (cross-screen) or `useState` (local).
- **Never mirror a query result into Redux or `useState`.** Read it where needed.
- **No custom hooks.** The only hooks are library-provided. A finding that recommends a
  `useSomething.ts` contradicts `frontend/CLAUDE.md` and will be rejected — recommend a slice,
  a selector, or a query hook in `services/` instead.

## The cache-patching contract (`services/optimisticCache.ts`)

This module exists because a single upvote used to refetch the entire feed. The rules are load-bearing:

- **Never invalidate a feed key from an interaction mutation.** Patch the cached entity in place.
- Off-screen score surfaces are marked stale with `refetchType: 'none'` — they refresh on next mount,
  not now. So a leaderboard being briefly stale after a vote is correct behavior, not a bug.
- **Never `cancelQueries` on the paginated feed prefix.** Cancelling `['memes']` aborts an in-flight
  `fetchNextPage`, and `FlatList` will not re-fire `onEndReached` until the user scrolls again —
  infinite scroll silently dies.
- **Identity preservation is load-bearing**: unchanged nodes are returned by reference so only the one
  card re-renders. Breaking it silently restores a full-list re-render on every vote.
- Vote toggle/flip math is mirrored client-side and must stay in sync with
  `backend/app/services/votes.py`.
- Messaging follows the same doctrine: WS frames **patch** the conversation list and open thread
  (`services/messagingCache.ts`); invalidating would refetch history and jump scroll position.

If an audited screen adds a mutation, check which side of this line it falls on. Getting it wrong is
a P0 because the symptom (cards reordering, scroll jumping) reads to users as data loss.

## Error path, end to end

1. `services/api.ts` — apisauce, **15s timeout**, dev-only request monitor.
2. `throwApiError(response, context)` prefers the backend's `detail` (string, or a joined Pydantic
   validation list), and otherwise falls back to `describeTransportProblem` — which produces
   developer-facing text containing the full URL and env-var advice.
3. TanStack surfaces it as `error.message`.
4. Screens render `{error.message}` raw into `<Text className="text-error">`.

Consequence for audits: **the backend's `detail` messages are usually fine to show; the transport
fallbacks never are.** Any finding about error copy should say which of the two it is.

Backend statuses come from ~40 named `DomainError` subclasses in `backend/app/core/exceptions.py`
(409 conflicts, 403 gates, 404 not-found-or-not-visible, 400 rule violations). Reading that file
against the screen's UI is the fastest way to find unhandled states.

## Lists

- `FlatList` everywhere; `FlashList` is not installed despite `frontend/CLAUDE.md` preferring it.
- `.map()` is correct for short bounded lists; a long or unbounded list inside a `ScrollView` is a
  real finding.
- `keyExtractor` correctness matters on the merged feed, where meme ids and container ids coexist.
- `ListEmptyComponent` currently carries loading, error, and empty in one ternary — which is why all
  three look alike.
- `contentContainerStyle={{ paddingBottom: 100 }}` clears the overlaying `FloatingBottomNav`.
- `onEndReachedThreshold={0.5}`, guarded by `hasNextPage && !isFetchingNextPage`.
- `onScrollToIndexFailed` is handled on the feed lists — a real pattern to reuse, not reinvent.

## Native vs web

24 native screens, 17 `.web.tsx` siblings. Behaviors that genuinely differ:

| Concern | Native | Web |
|---|---|---|
| View tracking | FlatList viewability (50% / 1000ms) | Per-card `IntersectionObserver` — VirtualizedList scroll metrics are unreliable on react-native-web |
| Skia | Direct import | Must gate on `LoadSkiaWeb()`; the `Skia` object freezes undefined otherwise |
| Refresh | `RefreshControl` pull-to-refresh | Meaningless — needs an explicit control |
| Theme | Neon Plum, CSS vars + `vars()`, SecureStore | Vaporwave Glass / Luminous Vapor Glass, `localStorage` key `vaporwave-web-theme` |
| Modals | `BottomSheet` | `WebModalFrame` — needs focus trap, Escape, backdrop click |
| Keyboard | `KeyboardAvoidingView` (`padding` iOS / `height` Android) | Real keyboard nav and focus order |
| Layout | Full-bleed phone-first | Sidebar 264px + content column 680px (feed 1040px, inbox rail 380px); below 900px falls back to full-bleed |

Parity drift is a finding category in itself: state plainly which platform has the gap.

## Theming

- Native light/dark uses **NativeWind CSS variables plus `vars()`**, never `dark:` variants. A second
  parallel theming mechanism is an explicit anti-pattern.
- `colorScheme.set()` does not work on-device — the app uses a unified provider with a 3-way
  light/dark/system picker.
- Color props that cannot take a className (`ActivityIndicator`, `placeholderTextColor`, icon colors,
  `shadowColor`) read from `constants/theme.ts`'s `NEON_PLUM_DARK`/`NEON_PLUM_LIGHT`, selected via
  `useThemeMode()` — **not** NativeWind's `useColorScheme()`, which tracks the OS rather than the
  app's own setting.
- Known contrast facts: unmodified `bg-primary` is unsafe behind white text in both modes (use
  `bg-primary-container`); on web `indigoPrimary` fails 4.5:1 as a white-text fill in both modes and
  fails 3:1 as light-mode foreground.
- `BlurView` was removed after three failed attempts at an Android sizing bug. Never put layout
  classNames on it; use the `StyleSheet.absoluteFill` sibling-layer pattern or skip blur.

## Gestures, media, realtime

- Drag/pinch/rotate uses `react-native-gesture-handler` + `react-native-reanimated` — never
  `PanResponder`. Watch for conflicts with an enclosing scroll container.
- Images: `expo-image-picker`; compress and resize before upload, never send a raw camera capture.
- One socket connection manager in `services/` (`memeSendingSocket.ts`), connection state in
  `socketSlice`; never open ad hoc sockets per screen.
- Push via Expo, registered through `services/pushNotifications.ts`.

## What "not implemented" means here

Absent from `package.json` and from `src/`, so any recommendation depending on them is a *new
capability*, and should be labelled as one with its cost stated:

`netinfo` (offline detection) · any toast/snackbar library · any skeleton/shimmer library ·
`expo-haptics` · `FlashList` · any `ErrorBoundary` · `services/blocks.ts` and block/report UI

A recommendation like "show an offline banner" is therefore not a one-line change — say so. That
honesty is what makes the audit actionable rather than aspirational.

## Testing expectations (for recommendations that imply logic)

Required for `services/`, `store/` slices, and API/WebSocket integration — success, error, and loading
paths, with the network mocked. Not required for presentational components. Feature code is tested
when it contains branching business logic (window transitions, audience validation, vote semantics).
If a recommendation adds branching logic, note that it needs a test; if it is pure presentation, note
that it does not.
