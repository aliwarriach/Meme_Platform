# Discovery Framework — hunting edge cases in *this* repo

Expansion of the 12 lenses in SKILL.md. Each lens gets: what to actually look for, where to look in
this codebase, and the failure shape it usually takes here.

Read the lenses that plausibly apply to the surface under audit. Skip the rest — a screen with no
list has no Flood findings, and saying so is not thoroughness.

---

## The three questions that generate most real findings

Before the lenses, ask these. They out-perform any checklist:

1. **"What is the server allowed to say that this screen has no UI for?"**
   Open the feature's memory file, list every error and every status the endpoint can return, then
   check which ones the component actually renders. The gap is the finding. This repo's backend is
   unusually explicit (`app/core/exceptions.py` maps ~40 named `DomainError` subclasses to status
   codes), so the gap is always findable, never guesswork.

2. **"What state can change underneath a user who is standing still?"**
   Challenge windows close on a 5s cron. Competition periods roll over at midnight. WS frames arrive.
   Another device votes. A friend blocks you. The screen was correct when it mounted and is wrong now.

3. **"Who is on the other end of this?"**
   Every social feature has a second user. The submitter *and* the person whose meme was beaten. The
   blocker *and* the blocked. The inviter *and* the invitee who never responds. Audit both.

---

## Lens 1 — Void (empty states)

There are four different empties and this repo renders them all as one grey sentence.

| Empty | User's actual situation | What the screen must do |
|---|---|---|
| **First-run** | New account, nothing exists yet anywhere | Teach + one primary CTA. This is onboarding, not an error. |
| **Genuinely empty** | Feature works, this collection is just empty | Explain what will appear here and what causes it to appear. |
| **Filtered to empty** | A tab/filter/search produced nothing | Say which filter, offer to clear it. Never look like the first two. |
| **Hidden empty** | Content exists but blocks/visibility/membership hide it | Hardest. Must not leak that content exists, must not look broken. |

Where to look: `ListEmptyComponent` in the FlatLists, and the `emptyMessage` prop threaded through
`MemeFeedList`/`MergedFeedList`. Current pattern is a single `<Text>` string with no illustration, no
CTA, and no distinction between the four cases — including while `isLoading` is false but the query
has never run.

Ask: does the empty state contain the *action* that fills it? An empty community feed that does not
offer "post the first meme" is a dead end at exactly the moment the user is most willing to act.

## Lens 2 — Break (errors)

The finding to check for first, on every single data-driven screen in this app:

> `services/api.ts::throwApiError` falls back to `describeTransportProblem`, which produces strings
> like `Could not reach the server at http://192.168.1.7:8000/memes/feed (GET). Is the backend
> running and is EXPO_PUBLIC_API_URL set correctly?` — and screens render `{error.message}` raw into
> a `<Text className="text-error">`. That is a developer diagnostic, containing a LAN IP and an env
> var name, shown to an end user.

So for each error surface ask:
- Is the message written for a **user** or for a developer?
- 4xx-with-a-body (the backend's own `detail` — usually good, user-facing) vs transport failure
  (developer text) vs 5xx (never usable) — are they distinguished, or all one branch?
- **Is there a retry?** Grep the repo: essentially no error state offers one. Where a `RefreshControl`
  exists the user can pull, but nothing tells them that, and an error rendered inside
  `ListEmptyComponent` gives them nothing to pull *on* when the list is short.
- Does the error replace the content, or sit next to it? Replacing loaded content with an error
  because a *refetch* failed is a data-loss-shaped bug.
- After a failed mutation, is the user's input still there? (Caption text, comment draft, overlay
  layout, selected image.)

## Lens 3 — Wire (network)

- **This app cannot detect offline.** `@react-native-community/netinfo` is not a dependency; there is
  no connectivity state anywhere. Every offline failure therefore presents as a generic 15s timeout
  string. On a mobile meme app — subway, elevator, festival, bad hotel wifi — this is a primary path,
  not an edge case.
- The api client timeout is **15s** (`services/api.ts`). An image upload on a weak connection is a
  realistic 15s+ operation. What does the user see at second 8? At second 16, after their photo,
  caption, overlays and audience selection are gone?
- Backgrounding: a publish or upload in flight when the OS suspends the app.
- TanStack Query refetch-on-focus returning to a screen after hours away — is the transition from
  stale to fresh visible and non-jarring, or does content shift under the thumb?

## Lens 4 — Race (concurrency)

Repo-specific, all verified:
- **Vote buttons are `disabled` while pending, so rapid taps are silently dropped** (documented in
  `.claude/memory/optimistic-cache.md`). The user taps upvote three times fast; two do nothing and
  nothing tells them.
- **Never invalidate a feed key from an interaction mutation.** The main feed is Hot-ranked and
  offset-paginated, so a refetch re-runs the ranking and cards can reorder, duplicate, or vanish
  mid-scroll. `optimisticCache.ts` exists solely to prevent this. Any new mutation that invalidates
  `['memes']` reintroduces it — that is an automatic P0.
- Optimistic patch vs server truth: `onSuccess` reconciles against authoritative counts, so a
  correct optimistic UI still visibly *jumps* when someone else voted in between. Is that jump
  designed, or does the number just twitch?
- WS frames patch the messaging cache rather than invalidating, specifically so the thread does not
  jump scroll position mid-conversation. Anything that invalidates a thread key breaks this.
- Mutation resolving after the user navigated away — where does the success/failure surface?

## Lens 5 — Gate (permissions, auth, membership)

Enumerate every gate the endpoint enforces and check the UI has a state for each. The recurring
failure shape in this repo is **the button that should not exist is rendered, the 403 is caught, and
the raw message is printed**. Correct behavior is usually: don't render the action, or render it
disabled with the reason attached.

Gates that actually exist here: authenticated / email-verified / friend / community member /
community owner (there is no admin tier — owner is the only privileged role) / challenge participant /
correct challenge side / challenge invitee / within the active window / not blocked in either
direction. Blocks are **bidirectional and override friendship**.

Also: there is **no token revocation or logout invalidation** (`.claude/memory/Shortcomings.md`), so a
401 mid-session is a real state with no designed recovery. What happens to a half-written comment when
the session dies?

## Lens 6 — Moderate (safety)

This is a public, content-heavy social product. The audit must be adversarial.

- **`Block` is backend-only. There is no `services/blocks.ts`, no block button, no blocked-list
  screen.** Any surface that exposes a user (profile, comment, thread, member list, feed card, side
  picker) is a surface where a harassed user currently has no exit. Raise it where relevant.
- **There is no report/flag path anywhere** for a meme, comment, container, community, or user.
- Deleted content: does this surface handle it? Competitions already have a designed answer — a
  closed period's winner deleted afterwards renders as a non-clickable "Deleted Post" placeholder,
  because promoting the runner-up would rewrite history. Reuse that thinking; don't invent a new one.
- Who sees a moderation action? Blocking is deliberately silent to the blocked party, and
  `UserBlockedError`'s message is deliberately generic so a harasser cannot confirm the block.
  Any new UI must not leak what that message carefully hides.
- User-generated text (captions, comments, community names, side names, usernames) rendered into a
  layout that assumed short strings.

## Lens 7 — Flood (extreme data)

- 0, 1, exactly-at-limit, and far-past-limit for every list. Challenge setup schemas have unbounded
  array sizes (`.claude/memory/Shortcomings.md`) — a 30-side challenge is constructible.
- Long single-word usernames and community names (no spaces, cannot wrap).
- Emoji-only and RTL captions. Text overlays in the Skia editor with a 500-character string.
- Numbers: a score of 0, a negative net vote score, 1.2M views, a rank of 4-digit length.
- Images: 8 MB camera captures. `frontend/CLAUDE.md` requires compress-before-upload — verify the
  surface honors it. `image/gif` is accepted by direct upload despite animated content being out of
  documented scope.
- Hashtags: 40 on one meme; the autocomplete list when a prefix matches thousands.

## Lens 8 — Clock (time and lifecycle)

- **Challenge window close is an arq cron running every 5 seconds.** Between `end_time` and the
  worker's next tick the UI can legitimately show an active challenge that the server will reject
  submissions for. The screen must handle "you were 3 seconds late" as a designed state, not a 400.
- `useChallenge` polls every 5s while `status` is `active` or `setup`. What does a status flip look
  like *while the user is reading the screen*? A submit button vanishing mid-tap is a real event.
- **A `setup` challenge proposal never expires.** No mechanism exists. A duel or vs-challenge can sit
  "Awaiting response" forever. What does the proposer see on day 14?
- Competition periods roll over at midnight — in **whose** timezone? Backend stores UTC;
  `challenge start_time`/`end_time` accept naive datetimes and silently reinterpret them as UTC
  (`Shortcomings.md`). A user in UTC+5 setting a 9pm challenge is a live bug source.
- Relative timestamps (`utils/timeAgo.ts`) do not tick. "2 minutes ago" on a thread left open for an
  hour is wrong and looks stale.
- A closed competition period still drifts if late votes land (no snapshot at close).

## Lens 9 — Thumb (mobile physicality)

- 44pt minimum touch targets — required by both `frontend/CLAUDE.md` and `MASTER.md`. Check row
  actions, icon buttons, vote pills, three-dot menus, and chips especially.
- Keyboard: does it cover the input, the send button, or the error message? `KeyboardAvoidingView`
  behavior differs on iOS (`padding`) vs Android (`height`) — the feed lists already do this split.
- Safe-area insets via `react-native-safe-area-context`, never hardcoded padding. The
  `FloatingBottomNav` overlays content; lists compensate with `paddingBottom: 100` — a new scroll
  surface that forgets this hides its last row behind the nav.
- One-handed reach: is the primary action in the bottom half of the screen?
- Gesture conflicts: the Skia editor's drag/pinch/rotate layers inside a scroll container; a
  horizontal strip inside a vertical FlatList; a `BottomSheet` over a WebView.
- Landscape must not break the creator or feed (`frontend/CLAUDE.md`).

## Lens 10 — Ear (accessibility)

- Every interactive element needs `accessibilityRole` + `accessibilityLabel`, plus
  `accessibilityState` for toggle/selected/disabled (`MASTER.md`). Vote pills, tabs, and segmented
  controls are the usual misses — a vote pill without state announces nothing about whether you voted.
- **Contrast in both modes.** Native ships Neon Plum light *and* dark since 2026-08-21. `MASTER.md`
  records measured failures worth not repeating: unmodified `bg-primary` is not a safe white-text
  fill in either mode (use `bg-primary-container`); on web, `indigoPrimary` fails 4.5:1 as a
  white-text fill in both modes.
- Meaning by color alone: upvote green vs downvote red, rank gold/silver/bronze, challenge side
  colors, online dots. Each needs a shape, icon, or label too.
- Dynamic type: does the layout survive a 1.3x system font scale, or does the card clip?
- Screen-reader traversal order on a card that mixes image, caption, meta, and actions.

## Lens 11 — Twin (native vs web parity)

There are 24 native screens and 17 `.web.tsx` siblings — the deltas are where bugs hide.

- Which platform got the fix and which did not? Feature drift between a `Screen.tsx` and its
  `Screen.web.tsx` is the single most common regression shape in this repo.
- Behaviors that genuinely differ and must be designed separately, not copied:
  view tracking (web = per-card `IntersectionObserver`, native = FlatList viewability, because
  VirtualizedList scroll metrics are unreliable on react-native-web); Skia readiness (web must gate
  on `LoadSkiaWeb()` or the `Skia` object freezes undefined); `RefreshControl` (meaningless on
  desktop — web needs an explicit refresh affordance); keyboard focus and Escape-to-close on
  `WebModalFrame`, which have no native equivalent.
- Two design systems: Neon Plum (native) and Vaporwave Glass / Luminous Vapor Glass (web). Do not
  cross-apply tokens. `DesktopShell`/`DesktopSidebarNav` still render in older pre-Vaporwave chrome —
  a known accepted seam, not a finding to re-raise.
- Desktop-only states: window narrower than 900px falls back to full-bleed; hover has no native twin;
  a 2560px-wide window against a 680px content column.

## Lens 12 — Return (lifecycle of the user, not the data)

- **First session**: the screen has to teach. Does it? Once — not forever.
- **Day 30**: 200 conversations, 40 communities, 12 badges, a full notification centre. Does the
  screen that looked great with 3 items still work with 300? Is there search, filter, or grouping
  where volume demands it?
- **Returning after 2 weeks**: what changed while they were gone, and does the app say so? A
  challenge they were in ended, a duel proposal expired socially if not technically, a competition
  period closed.
- **The power user**: are the actions they repeat 50 times a day fast, or do they cost the same taps
  as the first time?
- **Re-entry mid-flow**: they left the creator with a draft. `creatorDraftSlice` holds it. Is it
  still there, is that communicated, and can they discard it deliberately?
