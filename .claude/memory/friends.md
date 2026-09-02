# friends

## Status
Done (Phase 2 backend + frontend built). Backend fully tested against real Postgres (22/22 pytest, including auth). Frontend type-checks and bundles clean (`tsc`, `expo export --platform web`). Live device/simulator tap-through not yet run by a human — same outstanding item as Phase 1 (see `auth-profile.md`), now compounded across both phases.

## Models
- `Friendship` (`backend/app/models/friendship.py`), table `friendships`, UUID PK + timestamps (standard mixins).
  - `requester_id`, `addressee_id` (both FK `users.id`, `ondelete=CASCADE`, indexed).
  - `status`: Postgres native enum `friendship_status` (`pending` | `accepted`) — no `declined` state; declining/unfriending deletes the row instead (see Business rules).
  - `user_low`/`user_high`: DB-computed columns (`GENERATED ALWAYS AS ... STORED`, `LEAST`/`GREATEST` of the two user ids) — exist purely to back a direction-independent unique constraint, never read/written directly from app code.
  - Constraints: `UniqueConstraint(user_low, user_high)` blocks a duplicate friendship *in either direction* while one is pending or accepted; `CheckConstraint(requester_id <> addressee_id)` blocks self-friending. Both enforced at the DB level, not just service checks.
  - `requester`/`addressee` relationships use `lazy="selectin"` (required under async SQLAlchemy — plain lazy-load raises `MissingGreenlet` outside an await context).

## Endpoints
All under `/friends`, registered in `backend/app/routers/friends.py`. All require Bearer auth.
- `POST /friends/requests` — body `{username}` → `201` `FriendshipOut` (`{id, status, requester: PublicUserOut, addressee: PublicUserOut, created_at}`, no email — see `[[auth-profile]]`'s H-1 note). `400` self-request, `403` either side has blocked the other (`[[blocks]]`, generic message), `404` unknown username, `409` a friendship (any status, either direction) already exists between the two users. Rate-limited `20/minute` (SecurityIssues.md L-8).
- `GET /friends/requests` — → `200` list of `FriendshipOut`, **incoming pending only** (current user is `addressee`) — no outgoing-requests view built (not required by Phase 2 exit test; add if a "sent requests" UI is ever needed).
- `POST /friends/requests/{friendship_id}/accept` — → `200` `FriendshipOut` with `status: accepted`. `403` if current user isn't the `addressee`, `404` not found, `409` not pending.
- `DELETE /friends/{friendship_id}` — → `204`. Deletes the row outright — this single endpoint covers declining a pending request, cancelling your own sent request, and unfriending an accepted one. `403` if current user isn't a participant, `404` not found.
- `GET /friends` — → `200` list of `FriendOut` (`{friendship_id, user: PublicUserOut}`) — deliberately **not** a bare user list; the frontend needs `friendship_id` to call the remove endpoint from the friends list UI.

## Business rules
- One friendship row per unordered pair, enforced by the `user_low`/`user_high` DB constraint — sending A→B while B→A is already pending (or already accepted) is rejected with `409` regardless of which direction is checked first.
- No "declined" status — rejecting a request and unfriending are both just `DELETE`, which frees the pair to request again later.
- `services/friends.py` builds `FriendOut` directly (service returns response-schema instances, matching the existing `services/auth.py` pattern) rather than routers reshaping ORM objects.
- **`are_friends()` now also returns `False` if either side has blocked the other** (2026-08-19, see `[[blocks]]`) — even for an already-accepted friendship. This function backs messaging's send/open-conversation checks and the duel-proposal check in `challenges.py`, so a block silently gates all three without those modules needing their own block-awareness. `send_friend_request` also rejects (403, generic message) if either direction is blocked, before the existing friendship/self-request checks run.
- **2026-08-31: `send_friend_request`/`accept_friend_request` now notify** (see [[notifications]] wave 2) — `friend_request_received` to the addressee, `friend_request_accepted` to the requester. This was the first of several features found with zero notification coverage despite the generic infra existing since Phase 21.

## Frontend integration notes
- `TextField` (was `AuthTextField`, feature-local to `auth/`) was **promoted to `src/components/TextField.tsx`** as part of this phase — friends' add-friend form was the 2nd real consumer, per the project's own "promote on 2nd consumer" rule. `LoginScreen`/`RegisterScreen` imports were updated; nothing still points at the old `features/auth/components/` path (deleted).
- `services/friends.ts` (API calls) + `services/useFriends.ts` (TanStack Query: `useFriendsList`, `useIncomingFriendRequests`, `useSendFriendRequestMutation`, `useAcceptFriendRequestMutation`, `useRemoveFriendshipMutation`) — mutations invalidate the `['friends']`/`['friends','requests']` query keys on success.
- `features/friends/FriendsScreen.tsx`: single `FlatList` keyed on `friendship_id` rendering the friends list (unbounded → `FlatList` per mobile-UX rule); the add-friend form + incoming-requests section (bounded, rendered via `.map()`) live in `ListHeaderComponent` — avoids nested-FlatList-in-ScrollView.
- Reachable via a "Friends" button on `SessionScreen` (profile) pushing `/friends` — there's no tab bar yet (not built until a later phase), so this is a plain stack push with a back arrow, not a tab.
- No RN test coverage yet — per `frontend/CLAUDE.md`, `services/`/store logic should get tests; `useFriends.ts` mutations are the candidate if this area grows.
- **2026-08-30 UX pass (FULL MODE, no design-system changes)**: added a client-side "Search your friends" filter, separate from the pre-existing "Add a friend" (send-request-by-username) input. Both `FriendsScreen.tsx` (native) and `FriendsScreen.web.tsx` got the same feature, implemented independently in each file's own styling system (NativeWind classes on native, that file's local `VaporwaveTheme`/`StyleSheet` on web) — no shared component was extracted, matching how the two files already duplicate the add-friend form.
  - Local `useState<string>` (`friendSearch`) + a `useMemo`'d case-insensitive substring filter over `friendsQuery.data ?? []` (memoized itself to avoid an exhaustive-deps warning from the `?? []` fallback). No new backend endpoint, no new query hook — pure client-side filtering of already-fetched data, per this feature's existing `useFriendsList()` contract.
  - `FlatList`'s `data` prop switched from the raw friends array to the filtered array; `ListEmptyComponent` now branches three ways: loading / error / `friends.length === 0` ("No friends yet", true empty) / else ("No friends match "{query}".", filtered-empty) — the two empty states are worded differently on purpose so a user searching a list they know isn't empty doesn't read it as "you have no friends."
  - The search box only renders when `friends.length > 0` — no point showing a filter control over an empty list.
  - Interaction pattern (rounded pill, `MaterialIcons name="search"`, `TextInput` directly — not the boxed/labeled `TextField` component) was **not invented**: it matches the pre-existing "Search friends" pattern already shipped in `SendMemeModal.tsx` and `NewChatModal.tsx` (same icon, same `bg-surface-high/60` pill chrome, same `"No friends match "{query}"."` copy) — found via a cross-screen consistency check before building, so this screen doesn't introduce a second visual language for "filter a list I already have" vs. the boxed `TextField` used for "submit a new value" (add-friend). One deliberate deviation from that precedent: an explicit `accessibilityLabel="Search your friends"` was added to the `TextInput` (the two precedent modals don't set one) — a `--domain web` skill query flagged unlabeled form inputs as Critical severity, so the new input got the label even though its precedent didn't.
  - Placement: directly under the "Your friends" section header, spatially separated from "Add a friend" by the entire "Friend requests" section in between — chosen over alternatives that would have merged or relocated the add-friend affordance (see Phase 2.5 in the task's audit trail / commit message for the rejected alternatives).
  - Unrelated to this pass: `FriendRequestRow.tsx` had an uncommitted working-tree change (passing `avatar_url`/`avatar_preset` into its `Avatar`) already present before this pass started — not touched or authored as part of this UX work.

## Gotchas
- Postgres `GENERATED ALWAYS AS (LEAST(...))` columns work fine for UUID columns (btree-comparable type) — don't need a workaround, but don't try to set `user_low`/`user_high` manually, the DB always overwrites them.
- Alembic autogenerate renders `sa.Computed(...)` correctly for these — no manual migration edits were needed.

## Key files
- backend: `app/models/friendship.py`, `app/schemas/friends.py`, `app/services/friends.py`, `app/routers/friends.py`, `app/core/exceptions.py` (6 new domain errors), `alembic/versions/c8c3a3480b54_create_friendships_table.py`.
- frontend: `src/components/TextField.tsx`, `src/services/friends.ts`, `src/services/useFriends.ts`, `src/features/friends/*`, `src/app/friends.tsx`.

## Tests
- `backend/tests/test_friends.py` (16 tests, all passing against real Postgres): send/accept/remove lifecycle, mutual visibility, third-party isolation, duplicate/reverse-direction rejection, self-request rejection, unknown-username rejection, non-addressee accept rejection, double-accept rejection, non-participant remove rejection, incoming-only request listing, auth-required on all three read/write surfaces.
- `backend/tests/conftest.py` gained a shared `register()` helper (2nd real usage — extracted out of `test_auth.py`, which now imports it).
