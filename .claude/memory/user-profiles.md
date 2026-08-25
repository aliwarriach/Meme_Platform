# user-profiles

## Status
Done. Backend tested against real Postgres (5/5 pytest, `test_profiles.py`; full suite re-run clean, 69/69). Frontend (native + web) type-checks clean. Not yet tap-through-tested on a device/browser by a human.

## Models
No new tables — this feature is a read-only aggregation over existing ones: `Meme` (author's posts), `Badge` (count), `Friendship` (count + the access gate). See [[auth-profile]], [[meme-feed]], [[friends]], [[challenges]] (badges).

## Endpoints
Both under `/users`, registered in `backend/app/routers/profiles.py` (service: `app/services/profiles.py`).
- `GET /users/{user_id}/profile` — auth: yes — → `200` `UserProfileOut`: `{user: PublicUserOut, score: int, badge_count: int, friend_count: int, is_self: bool, is_friend: bool, posts_locked: bool}`. `404` unknown user. Score/badge/friend counts are visible to **any** authenticated viewer regardless of friendship (matches the pre-existing `GET /leaderboards/profile/{id}` stance) — only `posts_locked` (`true` when the viewer is neither the owner nor an accepted friend) gates the grid.
- `GET /users/{user_id}/posts` — auth: yes — query `cursor`/`limit` (keyset, mirrors `FeedPage`/`core/pagination.py`, default `limit=24`) → `200` `FeedPage` (`{items: MemeOut[], next_cursor}`). **`403` (`NotFriendsError`) if the caller isn't the owner or an accepted friend** — enforced server-side regardless of what the client saw in `posts_locked`; never trust the client to skip the call. Returns every non-deleted meme the user authored (personal + community posts alike), newest first — `services/memes.py::get_author_posts`, a thin wrapper around the existing `_paginated_feed` helper.

## Business rules
- **Posts-grid privacy is stricter than a post's own audience**: a stranger's `public`-audience meme still surfaces in the main feed (unchanged), but it does **not** appear on their profile grid to a non-friend — the profile page is a friends-only surface by product decision, not a re-derivation of `meme_visibility_clause`. Don't reuse that clause here; `get_author_posts`'s own `Meme.author_id == author_id` filter is intentionally the only visibility rule at the query level, because the friend-gate already happened one layer up in `services/profiles.py` before this ever runs.
- `services/profiles.py` exists as its own module specifically to avoid a circular import: `services/friends.py` already imports `services/users.py`, so profile aggregation (which needs `are_friends` from `friends.py`) can't live in `users.py` without a cycle.
- Reuses `are_friends()` ([[friends]]) for the gate and `get_profile_score()` ([[leaderboards]]) for the score number — no score math duplicated here.

## Frontend integration notes
- `frontend/src/services/profiles.ts` (types + apisauce calls) + `useProfiles.ts` (`useUserProfile(userId)` plain query, `useUserPosts(userId, enabled)` cursor `useInfiniteQuery` — mirrors `useCommunityFeed`'s shape exactly). Callers must pass `enabled` as `!profile.posts_locked` (or `false` until the profile query resolves) — the posts query is never fired for a locked profile, avoiding a guaranteed 403 round trip.
- **One shared screen for both "my profile" and "a friend's profile"**: `features/profile/ProfileScreen.tsx` (native) / `ProfileScreen.web.tsx` (web), parameterized by `{ userId, isOwnProfile }`. Mounted at `app/profile.tsx` (own, `userId` from Redux session) and `app/users/[id].tsx` (route param; `isOwnProfile` derived by comparing to session id). Every own-profile-only affordance (settings/logout, `FloatingBottomNav`, email-verification banner) is gated on the `isOwnProfile` prop rather than forked into a second component.
- **Instagram-style layout, replacing the old flat entry-link list**: avatar/bio → a 3-stat row (Meme Score / Badges / Friends, all from `UserProfileOut`) → for a non-owner, an Add Friend (`useSendFriendRequestMutation`) or Message button depending on `is_friend` → a 3-column post grid (`numColumns={3}` FlatList) or, when `posts_locked`, a lock-icon placeholder ("Add X as a friend to see their posts") instead of calling the posts endpoint at all.
- **The old entry links (Friends/Communities/Compete/Competitions/Inbox) moved off the profile screen entirely**, into a new hamburger-triggered drawer opened from the main feed's top-left (`features/navigation/NavDrawer.tsx`) — trimmed to just Friends/Communities/Competitions, since Inbox already has its own feed-header icon and Compete already lives on the bottom nav. Wired via `TopBar`'s new `leftActions` prop (native `FeedScreen.tsx`) and `WebFeedTopBar`'s new `onOpenMenu` prop (web `FeedScreen.web.tsx`, passed **only** when the viewport is below `DESKTOP_FRAME_MIN_WIDTH` — at desktop width `DesktopSidebarNav` already shows those links permanently, so no drawer is added there by design).
- Own-profile settings (Appearance toggle + Log Out) moved to: native — a gear icon in `ProfileScreen`'s `TopBar` opening `features/profile/components/SettingsSheet.tsx`; web — a log-out icon added directly to `WebProfileTopBar` (new `onLogout` prop) alongside its pre-existing theme toggle, no separate sheet.
- Entry point: `FriendRow.tsx` (native Friends screen) — avatar+username is now a `Pressable` that pushes `/users/[id]`. No equivalent wired on the web Friends screen or from feed post authors yet (not asked for; flag if wanted).
- Deliberately **not built**: tapping a grid tile to open a full post-detail view — the grid is display-only for now (no single-meme detail screen exists anywhere in the app yet to link to).

## Gotchas
- Don't try to reuse `services/memes.py::meme_visibility_clause` for the profile grid — it's the *general* feed-visibility rule (public/friends-audience/community-membership) and is deliberately more permissive than this feature's friends-only gate. See Business rules above.
- `GET /users/{id}/posts` 403s for a non-friend even if every one of that user's posts is `public` audience — this is intentional, not a bug to "fix" by loosening the query.

## Key files
- backend: `app/schemas/profiles.py`, `app/services/profiles.py`, `app/routers/profiles.py`, `app/services/memes.py::get_author_posts` (added), `app/main.py` (router registration).
- frontend: `src/services/profiles.ts`, `src/services/useProfiles.ts`, `src/features/profile/ProfileScreen.tsx`, `src/features/profile/ProfileScreen.web.tsx`, `src/features/profile/components/SettingsSheet.tsx`, `src/features/navigation/NavDrawer.tsx`, `src/components/TopBar.tsx` (`leftActions` prop), `src/components/web/WebFeedTopBar.tsx` (`onOpenMenu` prop), `src/components/web/WebProfileTopBar.tsx` (`showBack`/`onLogout` props), `src/app/profile.tsx`, `src/app/users/[id].tsx`, `src/app/_layout.tsx` (route registration), `src/features/friends/components/FriendRow.tsx` (tap-to-navigate).
- Removed: `src/features/auth/SessionScreen.tsx` and `.web.tsx` — superseded by `features/profile/ProfileScreen{,.web}.tsx`.

## Tests
- `backend/tests/test_profiles.py` (5 tests): own profile unlocked + shows own posts; friend profile unlocked + friend_count correct; non-friend profile shows stats but locks posts (`posts_locked: true`, `GET .../posts` → 403); requires auth (401); unknown user (404).
