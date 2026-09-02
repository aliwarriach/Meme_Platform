# Product Edge-Case Catalogue

Edge cases that are **already true** in this codebase, per surface. Every entry is derived from a
memory file, a backend contract, or read code — not invented.

**Read only the `##` section for the surface under audit, plus Cross-cutting.**
Locate sections: `grep -n "^## " references/product-edge-cases.md`

This is a starting hand, not a ceiling. The best findings are usually the ones not listed here.
Verify before citing — memory can go stale; if an entry contradicts the code, the code wins and the
staleness is itself worth reporting.

---

## Cross-cutting — true on every screen

Standing capability gaps, all verified against `package.json` and a repo-wide grep. Raise one only
when the audited screen actually exhibits it, and name the local consequence.

- **No toast/snackbar/undo system exists.** Zero matches for Toast, Snackbar, or `Alert.alert` in
  `src/`, and no such dependency. Every confirmation, every non-blocking error, and every undoable
  action currently has nowhere to appear. This is why destructive actions here tend to be either
  unguarded or guarded by a full modal — there is no middle affordance.
- **No offline detection.** `netinfo` is not installed. Offline is indistinguishable from a slow
  server, and both present as a 15s timeout string.
- **No error boundary anywhere.** A render throw takes down the screen (or the app) with no recovery
  UI. Expo Router supports an `ErrorBoundary` export per route; none exists.
- **No skeletons.** Loading is a bare `ActivityIndicator`, so every screen flashes empty then pops
  into content, with layout shift on arrival.
- **Raw `error.message` is rendered to users** via `<Text className="text-error">{...}</Text>`. On a
  transport failure those strings contain a LAN IP and the text "Is the backend running and is
  EXPO_PUBLIC_API_URL set correctly?" (`services/api.ts::describeTransportProblem`).
- **No retry affordance in any error state.** Pull-to-refresh exists on 5 lists and is undiscoverable.
- **No block UI and no report path**, despite `Block` being fully implemented backend-side.
- **No haptics** (`expo-haptics` not installed) — votes, publishes and wins land silently on a
  product whose whole point is delight.
- **`FlashList` is not installed** despite `frontend/CLAUDE.md` preferring it; every long list is a
  `FlatList`.
- **Two design systems**: Neon Plum (native, light+dark since 2026-08-21) and Vaporwave Glass /
  Luminous Vapor Glass (web). Never cross-apply tokens.

---

## Feed (`features/feed/`, `MemeFeedList`, `MergedFeedList`, `MemeCard`)

- **Hot-rank + offset pagination.** Any refetch re-runs the ranking; with offset paging over a shifted
  ranking, memes can duplicate or disappear mid-scroll. Only pull-to-refresh may legitimately reorder.
  A new mutation that invalidates the `['memes']` prefix reintroduces this — automatic P0.
- The public feed is **merged**: native memes and Instagram `MemeContainer`s interleaved in one
  scroll. Community feeds are memes-only. A container with a stubbed/failed oEmbed fetch, a deleted
  original Reel, or a WebView that will not load renders inside the same list as a normal card.
- **Blocks hide an author's memes bidirectionally and override an accepted friendship.** A user's
  feed can legitimately go empty or sparse for a reason the UI must not explain away as "no posts yet."
- `view_count` is private: populated only for the author, or for a community post, that community's
  owner. It is `null` for everyone else and always `null` in standings. A view count rendered
  unconditionally will show blank for most viewers.
- View tracking runs on two mechanisms by platform and is guarded against double-fire (web:
  `IntersectionObserver` per card; native: FlatList viewability, 50% for 1000ms). A new card type that
  forgets one of the two silently stops counting views on that platform.
- Author-only three-dot menu (Edit/Delete) exists on `MemeCard`. Non-author menu state, and what the
  menu shows when the meme is already deleted in another session, are both real states.
- `paddingBottom: 100` on the list compensates for the overlaying `FloatingBottomNav`. New scroll
  surfaces that omit it hide their last row.
- Deleted memes leave gaps in competitions and challenge submissions — already handled there
  (2026-08-30); check any *new* surface that embeds a meme.

## Meme Creator / Editor (`features/creator/`, `creatorDraftSlice`)

- **Skia on web freezes `Skia` as undefined if evaluated before `LoadSkiaWeb()`** — solved by a
  `.web.tsx` route that lazy-imports the creator behind a readiness gate. Any new editor entry point
  on web must pass through that gate or it breaks on load.
- Photo-library permission denied, and permission denied *permanently* (needs a Settings deep link,
  not a retry). Currently surfaces as `pickerError` text.
- Flatten/capture failure sets `captureError` — "Could not generate a preview. Try again." What
  happens to the composed document if they cannot?
- **Publish is a long, destructible operation**: image upload over a 15s timeout, with caption,
  overlays, layer layout and audience selection all held in state. Failure mid-publish, app
  backgrounded mid-publish, and navigation away mid-publish are three distinct states.
- **Audience selection is required and explicit for personal posts** (at least one of Friends/Public)
  — and is skipped entirely for community posts, where visibility derives from the community. A
  Community option must never reappear in the personal picker.
- **Challenge-aware entry**: entering with a `challengeId` joins a challenge on publish; join failure
  sets `joinError` ("Couldn't enter X — try again"). An already-joined 400 is treated as success —
  verify any new path preserves that, or the user sees a false failure.
- Undo/redo (`creatorDraftSlice`) — depth limit, and what survives an app kill. A draft that silently
  vanishes is data loss on the most effortful screen in the app.
- Layer edge cases: zero layers, a text layer with 500 characters, a layer dragged fully off-canvas,
  overlapping stickers, an aspect-ratio change after layout (1:1 / 4:5 / 9:16 / 16:9 / 3:4, Fit/Fill).
- Compress before upload is mandatory (`frontend/CLAUDE.md`); `image/gif` is accepted by direct upload
  despite animated content being out of scope.

## Communities (`features/communities/`)

- Public vs private, and the **join-request** path: pending, approved, rejected (rejection deletes the
  row — there is no "rejected" state to display, so a rejected user sees the same UI as a never-applied
  one). Requesting again after rejection is a real flow with no designed messaging.
- **Owner is the only privileged role** — `MembershipRole` has no admin tier. Every owner-only action
  (edit icon/banner, create challenge, manage requests) has exactly one person who can do it.
- Last-owner leaving, and a community with zero members, have no documented product answer. Worth
  raising when the audit touches leave/membership.
- **Community-scoped data must be fetched by `communityId`, never fetched broadly and filtered
  client-side** — filtering client-side briefly holds data the viewer should not have.
- Five tabs (feed / members / leaderboard / challenges / templates). Each needs its own empty state;
  a shared one is wrong for at least three of them.
- Header is cover photo + overlapping circular icon — missing images, extreme aspect ratios, and
  avatar-preset vs uploaded icon are all live states.
- A private community's content appearing in search or standings is a visibility question, not a
  cosmetic one.

## Challenges / Compete (`features/challenges/`)

Richest lifecycle in the app; most of the interesting findings live here.

- **Four shapes**: `intra_community`, `community_vs_community`, `open`, `duel`. Three statuses:
  `setup` → `active` → `evaluated`. `intra_community` and `open` skip straight to `active`.
- **A `setup` proposal never expires.** No mechanism exists. A duel or vs-challenge can sit
  "Awaiting response" indefinitely; the proposer has no cancel path and no timeline.
- **Window close runs on an arq cron every 5 seconds**, deliberately not evaluated on read. Between
  `end_time` and the next tick, the UI can show an active challenge whose submission the server will
  reject. "You were 3 seconds late" needs a designed state.
- `useChallenge` polls every 5s while `active` or `setup`. Status can flip while the user is reading —
  a submit button disappearing mid-tap is a real event, not a hypothetical.
- **Side choice is final for the whole duration** (switching would let people follow the winner). That
  irreversibility deserves a guard proportional to it, and it currently has none worth the name.
- **`ChallengeSideOut.member_ids` is always `[]` for `community_vs_community`** (membership is checked
  live) — any UI computing "am I on this side" or a member count from it is wrong for that shape.
- For `community_vs_community`, a meme must **already** carry a community `PostAudience` row for the
  submitter's side. A meme made from the main feed creator is permanently ineligible **with no
  explanation shown**. This is a documented, still-live UX failure — a strong P0/P1 whenever the
  submission flow is in scope.
- **Challenge submissions report 0 upvotes/downvotes/comments on the embedded meme**
  (`.claude/memory/Shortcomings.md`) — the UI displays zeros as if they were true.
- Scoring is not a plain sum: only a contributor's 3 best memes count, and the total is multiplied by
  `1 + log10(distinct contributors)`. A user posting a 4th meme and seeing no score movement is
  confused for a reason the UI never explains.
- Hashtag reservation is **exclusive** to one non-evaluated open challenge. Attempting a reserved tag
  fails; released on evaluation.
- Accept/decline is gated to the opponent community's **owner** (or the duel's invitee). Client-side
  checks are convenience only — the server is the gate — so the UI must handle a 403 it did not expect.
- Empty/degenerate: a challenge whose window closed with zero submissions on one or both sides; a tie.

## Voting & Competitions (`features/voting/`, `VotePill`)

- **Toggle/flip semantics**: same value again *removes* the vote; the opposite flips it (±2 to score).
  A UI that reads "upvote" as purely additive is wrong.
- **Self-voting is allowed.** Deliberate.
- **Vote buttons are disabled while pending, so rapid taps are silently dropped** — a documented gap.
  The user taps three times; two vanish with no feedback.
- Score is `upvotes - downvotes` and **can be negative** on a meme. The competition *atom* score is
  different and always `>= 0`. Two different numbers, easily conflated in UI.
- **A deleted winner of a closed period renders as a non-clickable "Deleted Post" placeholder**
  (`meme: null`, `is_deleted: true`) with rank and score preserved — because promoting the runner-up
  would rewrite a decided result. Live standings never contain this state (deleted memes are excluded
  outright). Reuse this precedent rather than inventing a different one.
- A closed period still drifts if late votes land — no snapshot at close.
- Non-public memes **can** surface in global standings (standings are viewer-agnostic). Flagged as an
  open product question, not a bug to fix inside an audit — but worth naming if the audit touches it.
- Day/week/month period rollover at midnight, in an unspecified timezone. What does the user see the
  moment the tab they are looking at becomes a past period?

## Leaderboards (`features/leaderboards/`)

- Three distinct boards, easy to conflate: global individual, global community (top communities), and
  the internal per-community board (members-only, rendered inside `communities/`).
- Ties, rank 0/1 members, and a viewer who is unranked or off the visible page — "where am I?" is the
  question every leaderboard user actually has.
- Time-window filters that produce an empty window.
- Rank gold/silver/bronze is color-carried meaning; needs a non-color signal too.
- Scores are cached/arq-warmed — a stale board after a vote is expected behavior
  (`markScoreSurfacesStale` uses `refetchType: 'none'`, so it refreshes on next mount, not now).
  Does the UI imply live-ness it does not have?

## Messaging / Inbox (`features/messaging/`)

- **WS frames patch the TanStack cache; they never invalidate.** Invalidating a thread refetches the
  whole loaded history and jumps scroll position mid-conversation. Any new realtime surface must patch.
- Socket connection state lives in `socketSlice`. Disconnected, reconnecting, and never-connected are
  three states — is any of them visible to the user, or do messages just silently stop arriving?
- Sending while offline / while disconnected: queued, failed, or silently lost?
- **Blocking stops new messages but leaves history visible.** A conversation with someone who has
  blocked you looks entirely normal until a send fails.
- `POST /messaging/conversations` is get-or-create idempotent — starting a chat with an existing
  conversation must land in the existing thread, not a duplicate.
- Message kinds are `text` and `meme`; a meme message whose meme was deleted, or which the recipient
  cannot see (audience/blocks), is a live case.
- Thread edge cases: very long messages, a thread with 1 message, a thread with 5000, scroll-to-bottom
  on new message vs. the user having scrolled up to read history.

## Friends (`features/friends/`)

- States: none, pending outgoing, pending incoming, accepted, blocked, self. Each needs distinct UI.
- Friend requests are rate-limited at 20/minute; the 429 has no designed UI.
- **`UserBlockedError`'s message is deliberately generic** so a harasser cannot confirm a block.
  New UI must not leak what that message hides.
- Blocks are **not** wired into friend-list or request-list filtering — an existing friendship or a
  pending incoming request from someone you later blocked still appears. Deliberate, documented, and
  jarring for the blocker.
- Removing a friend: reciprocal, irreversible-ish, and currently unguarded.

## Profile (`features/profile/`, `ProfileScreen(.web)`)

- One shared screen serves **own profile and another user's**. Every element needs a viewer-relative
  answer: is this me, a friend, a stranger, someone I blocked, someone who blocked me?
- **The posts grid is friends-only — stricter than normal feed visibility.** A stranger's profile
  legitimately shows an empty grid while their memes are visible in the public feed. That looks like a
  bug unless the empty state explains it.
- Read-only aggregation, no new tables — counts can lag their sources.
- Avatar-preset vs uploaded vs missing; long usernames; empty bio.
- Entry is via the feed header hamburger `NavDrawer` — a discoverability question in itself.

## Auth & Onboarding (`features/auth/`)

- **No token revocation or logout invalidation exists.** A 401 mid-session is real and undesigned:
  what happens to unsaved input at that moment?
- Email verification: `WebEmailVerificationBanner` exists on web — what gates on verification, and is
  the native path equivalent?
- Google auth alongside password auth: same email through both providers; cancelled OAuth; OAuth on a
  device with no browser.
- Registration conflicts return 409 for both email and username — two different fixes, one status.
- First-run after registration: the app is empty everywhere at once. That is the single highest-stakes
  empty-state moment in the product.

## Search & Hashtags (`features/search/`, `features/hashtags/`)

- 5-scope aggregator with token matching and a `challenge_visibility_clause`. A scope returning zero
  while others return results, and *all* scopes returning zero, are different empties.
- Query edge cases: 1 character, 200 characters, emoji, only punctuation, leading/trailing `#`,
  a query matching thousands.
- Debounce, in-flight cancellation, and results arriving out of order after fast typing.
- Trending has a cold-start fallback and an arq-warmed cache — a cold or empty trending list is an
  expected state, not an error.
- A tag feed (`/tag/[slug]`) for a tag currently **reserved by an open challenge** carries extra
  meaning the plain tag feed does not show.
- Search results must respect blocks and visibility — a result that 404s on tap is a leak plus a
  dead end.

## Instagram Companion (`features/instagram-companion/`)

- **oEmbed fetch is stubbed.** Metadata may be missing or wrong for every container.
- WebView failure modes: no network, Instagram blocking the embed, a deleted or now-private original
  Reel, a slow-loading embed inside a scrolling feed, autoplay and sound.
- "Open Original" leaves the app — what comes back, and to where?
- Containers carry their own parallel `ContainerVote`/`ContainerComment` tables and appear in the
  merged feed and standings alongside native memes. Anything treating a feed item as always-a-meme
  breaks on containers.
- Share-intake modal: a malformed URL, a non-Reel Instagram URL, a non-Instagram URL, a duplicate.

## Templates (`features/templates/`)

- Global library vs per-community private library — membership-scoped, must be fetched by
  `communityId`, never filtered client-side.
- Empty community library (common on a new community) vs empty global library (never).
- A template deleted while a draft references it; a template image that fails to load in a grid.
- Upload permissions: who can add to a community library.

## Notifications (`features/notifications/`)

- Push permission denied, and denied permanently. Expo push token registration failing silently.
- The in-app centre with 0, 1, and 500 notifications; read vs unread; bulk-clear.
- A notification whose target is gone (deleted meme, evaluated challenge, declined duel) — tapping it
  must not dead-end.
- Challenge lifecycle fires many notifications (invite / starting / ending-soon / side-overtaken /
  results). A user in 6 challenges can be flooded in a day; grouping is a real design question.
- `create_open_challenge` and `join_open_challenge` deliberately fire nothing — silence is intended
  there, not a gap.
