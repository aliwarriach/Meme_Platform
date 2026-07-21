# Frontend — Senior React Native Engineer

Scope: `frontend/` only. Ignore backend rules here. Root rules still apply.

## What this project is
Mobile-first, **community-focused** meme creation & sharing app (Android APK now, iOS later): meme feed, **communities** (join/create, community-private templates, community feed), meme creator (upload + text overlays + templates) with **per-post audience selection** (Friends / Public / one-or-more Communities), a rule-based meme scoring system driving **individual + community leaderboards**, **community challenges** (intra-community team vs. team, and community vs. community — setup, active submission window, evaluation, results/rewards), global voting/competitions (Meme of the Day/Week/Month), AI caption generator, real-time meme sending with a lightweight inbox, native share-sheet distribution, and Instagram Companion Mode (view/react to shared Reels inside the app via WebView). Casual users mostly live in the public feed; the core, retained user is community-focused. See root `CLAUDE.md`, `Idea.md`, and `Project_Requirements.md` in the repo root for the full picture.

## Directives
- Ultra-concise, code-first. ≤2 lines explanation unless real trade-off.
- 1 precise question if ambiguity changes implementation (state scope, unlisted variant).
- Flow: Plan → Verify → Implement. Skip ceremony for trivial changes.
- Use available MCP/design tools for specs before asking user to describe visuals.
- **No custom hooks for client-state/logic** — that's what Redux Toolkit slices, selectors, and thunks are for. Don't wrap `useState`/`useEffect`/`useReducer` combinations in a bespoke hook when a slice + `useSelector`/`useDispatch` expresses the same thing. The only hooks in this codebase are library-provided (TanStack Query's `useQuery`/`useMutation`, Redux's `useSelector`/`useDispatch`, RN/Expo hooks) — never a hand-rolled `useSomething.ts`.
- **Minimize code without cutting functionality/accuracy/performance**: fewer files, fewer reducers — lean on TanStack Query + Redux Toolkit's built-ins (`createSlice`, `createAsyncThunk` only if truly needed, RTK's Immer-based reducers) instead of hand-written equivalents. Less code to read is a feature, not a shortcut — never achieve it by skipping error/loading states or validation.

## Stack
React Native + Expo (managed workflow) · TypeScript · NativeWind (Tailwind for RN) · Redux Toolkit (client state) · TanStack Query (server state) · Apisauce or axios (HTTP client) · Expo Router (navigation)

**State split — don't blur this:**
- **Server data** (feed memes, templates, votes/leaderboards, AI-generated captions, inbox) → TanStack Query. It gives you loading/error/caching/refetch for free; never hand-roll these with `useState`/Redux.
- **Client state** (auth session, active creator draft, UI toggles, WebSocket connection status) → Redux Toolkit (`createSlice`), replacing scattered `useState` and any custom-hook state management across screens.
- Apisauce/axios is only the HTTP client TanStack Query's `queryFn`/mutation calls into — it holds no state itself.
- A component needing both reads server data via a query hook and client state via `useSelector` — don't proxy one through the other.

## Architecture
```
src/
  app/                    Expo Router file-based routes (screens)
  components/  pure UI, no logic, no API calls
  features/
    auth/                login, register, JWT session
    friends/             friend list, requests, add/accept/remove
    feed/                infinite-scroll public feed, reactions/likes
    communities/         create/join/leave, community profile, community feed, member list, community leaderboard
    creator/             upload (camera/gallery), text overlays, template picker, preview/publish; audience selector (Friends/Public multi-select) shown only for personal posts — when entered from inside a community (communityId param) the audience is auto-derived from that community's privacy and no picker is shown
    templates/           global template library + per-community private template library (upload/browse scoped to membership)
    scoring/             meme score display/breakdown components shared across feed, profile, and challenge results
    leaderboards/        read-only ranked lists — global individual leaderboard, global community leaderboard (top communities), and the internal per-community leaderboard (rendered inside communities/, members-only, distinct from the global community one), time-window filters
    challenges/           challenge setup (sides/rules/window/rewards), active challenge view + submission, evaluation/results screen
    voting/              Meme of the Day/Week/Month, one-vote-per-period UI state
    sharing/             native share sheet integration, export as image/video
    ai-caption/          "make it funnier" caption/joke generator UI, iteration flow
    meme-sending/        real-time send-to-friend, lightweight inbox, reaction-only replies
    instagram-companion/ share-to-app intake, MemeContainer display (WebView), react/comment UI, "Open Original" link-out
  store/       Redux Toolkit: store.ts + one slice file per client-state domain (authSlice, creatorDraftSlice, socketSlice)
  services/    Apisauce/axios API layer + TanStack Query hooks (useFeed, useCommunities, useTemplates, useScoring, useLeaderboards, useChallenges, useVoting, useAiCaption, useInbox, useMemeContainer)
  utils/       pure helpers
  constants/   static values/config
```
No mixed concerns, no `hooks/` folder — non-data-fetching logic lives in Redux slices (reducers/selectors/thunks), not custom hooks. Prefer a query hook in `services/` over any other data-fetching pattern. Each `features/<name>/` may nest feature-local `components/` not shared elsewhere — promote to top-level `components/` only on 2nd real consumer. Default to fewer files: don't split a slice into multiple modules until it's actually too large to scan in one screen.

## Mobile UX — required on every screen
This is a native app, not a responsive web layout — design for phone first, tablet as a stretch:
- **Phone** portrait is the primary target; verify landscape doesn't break the creator/feed.
- Respect safe-area insets (notches, home indicator) via `react-native-safe-area-context` — never hardcode top/bottom padding.
- Touch targets ≥44pt; text-overlay drag handles in the creator must be usable one-thumb.
- Test iOS and Android both when a feature touches native modules (share sheet, camera/gallery picker, WebView, notifications) — behavior and permissions prompts differ.
- Data-heavy views (public feed, community feed, individual/community leaderboards, challenge submission lists, inbox) use `FlatList`/`FlashList` with proper `keyExtractor`/windowing — never `.map()` inside a `ScrollView` for long/unbounded lists.

## Components
- Fully reusable — no hardcoded copy/structure.
- Props-driven only. No static inline data — use `constants/` or props.
- Small, composable. Prefer composition/children over unbounded variant props.
- DRY, but extract only on 2nd real occurrence, not the 1st.
- **Use `.map()` for rendering short/bounded lists of repeated elements — use `FlatList`/`FlashList` for long or unbounded lists (feed, inbox, leaderboard).**

## Libraries — prefer over manual implementation
Don't hand-roll what a best-in-class library already solves:
- **Forms/validation:** React Hook Form + Zod — never manual per-field `useState` forms.
- **Camera/gallery picker:** `expo-image-picker`.
- **Text overlay drag/resize:** `react-native-gesture-handler` + `react-native-reanimated` — never manual `PanResponder` math.
- **Native share sheet:** `react-native-share` (or Expo's `Sharing` API) — never a custom share modal.
- **Instagram Reel display:** `react-native-webview` — never attempt to re-host/download the source video.
- **Real-time meme sending:** `socket.io-client` (or native WebSocket) via a single connection manager in `services/` — never open ad hoc sockets per screen.
- **Dates:** date-fns (or dayjs) — never manual date math.
- **Icons:** `lucide-react-native` (or `@expo/vector-icons`).
- **Server-state caching/re-fetching:** TanStack Query — required for all API reads, not optional.
- **Long lists:** `FlashList` (preferred) or `FlatList`.
Hand-roll only if trivial (few static items) or no well-maintained library fits. Name the library in 1 line if it's not already a repo dependency.

## Code Quality
- Minimal, no dead code, no leftover `console.log`.
- No pass-through wrapper components with zero added behavior.
- Comments only for non-obvious why, never restating the code.
- Explicit loading/error/empty states for all data-driven UI — no happy-path-only components (especially upload/publish and AI caption generation, which can fail or time out).

## Data & State
- All API calls via `services/` (Apisauce/axios inside a TanStack Query hook) — never fetch/axios, and never a raw HTTP call, directly in components.
- Server data → TanStack Query. Client state → Redux Toolkit slice (cross-screen) or `useState` (local, single component). Promote local → Redux only on 2nd real cross-component consumer — most component state should stay `useState`, not preemptively globalized, and never wrapped in a custom hook instead.
- Never mirror a TanStack Query result into Redux/useState — read it directly where needed; duplicating it is the exact bloat this stack exists to avoid.
- WebSocket connection state (meme-sending) lives in a Redux slice; incoming messages invalidate/update the relevant TanStack Query cache (inbox), not a separate parallel state tree.
- Community-scoped data (private templates, community feed, challenge submissions) is always fetched through a query hook parameterized by `communityId` — never fetched once and filtered client-side, since that would briefly expose data the user shouldn't see. The backend is the actual gate; the frontend just shouldn't rely on hiding what it already fetched.
- The creator's audience selector (Friends/Public) is required, explicit state (not an implicit default) for personal posts — validate at least one audience is chosen before enabling publish. Community posts skip this picker entirely (see `features/creator/`); don't add a Community option back into it.
- API / state / UI stay in separate layers.

## Testing
- Required for `services/` (data-fetching/logic), `store/` slices, and any API/WebSocket integration — mock the network layer, test success/error/loading paths.
- Not required for pure presentational `components/` — visual correctness is verified by the user, not a test suite.
- Feature logic in `features/` → test if it contains branching/business logic (e.g. one-vote-per-period enforcement, audience-selector validation, challenge window/state transitions, caption iteration state); skip if it's pure composition/layout.

## Styling
- NativeWind (Tailwind) only, no inline `StyleSheet` unless NativeWind can't express it (e.g. complex gesture-driven transforms). Global theme (colors/spacing/type) via `tailwind.config` — no ad hoc values.

## Performance
- Memoize only with real/predictable re-render cost, not by default.
- Keep state local where possible; split store subscriptions narrowly.
- Lazy-load heavy screens/routes (creator's editor, WebView) where it meaningfully helps startup time.
- Compress/resize images before upload; never send full-resolution camera captures straight to the server.

## Output
1. Plan (1-3 lines, non-trivial only)
2. Verify (1 question, if needed)
3. Implement (clean, complete, production code)

## Rules
- No hardcoding — props/constants/config only.
- Split components once >1 concern mixes (fetch + layout + logic = split).
- No cross-feature imports of internals — go through shared components/store.
- Don't break folder structure to save lines.
- Production-level always: real error boundaries, loading states, accessibility (accessible labels, adequate touch target sizes, screen-reader support via RN accessibility props).
