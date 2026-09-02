# messaging

Replaces `meme-sending.md` (deleted). Phase 19, 2026-08-06.

## Status
Done (backend + frontend). Backend 18/18 pytest (13 new `test_messaging.py` + 5 rewritten `test_meme_sending.py`), run against real Postgres. Migration `e1d2c3b4a596` applied to the dev DB and verified in both directions on real data. Frontend `tsc` clean, `expo lint` 0 errors, jest 67/67 (16 new), `expo export --platform web` clean (20 routes). **Not yet human tap-through tested.**

**2026-08-21 (Roadmap_Scaling.md A1):** `connection_manager` is now Redis-pub/sub-backed, not a bare in-process dict — see [[redis-arq-infra]] for the shared-infra note. Two behavior changes every caller of the connection manager must know:
- **`is_online` is now `async`** — presence for a user not held locally is a Redis round trip. `services/messaging.py::send_meme_message`'s return now `await`s it.
- **`send_json`'s return value means "recipient was online" (locally or on another pod), not "delivered to a live socket."** A publishing pod cannot synchronously confirm a remote pod's local send succeeded. No caller's *logic* changed because of this — `send_message`'s `delivered_live` check and `notifications.py`'s fire-and-forget broadcast both already treated a falsy/uncertain result the same as "take the persisted-inbox/push fallback," never as a delivery guarantee — but don't add a caller that assumes a truthy return means the frame actually rendered on the recipient's device.

Deferred: typing indicators (need new WS traffic for marginal value). Read receipts *are* built.

## Models
- `Conversation` (`app/models/conversation.py`), table `conversations`.
  - `user_a_id`/`user_b_id` (FK `users.id` CASCADE, indexed) + `UniqueConstraint("user_a_id","user_b_id", name="uq_conversation_pair")`.
  - **Two columns, not a participants join table** — every thread is pairwise because the friendship gate is pairwise. Makes "the thread between A and B" one indexed lookup and lets the DB, not app code, guarantee uniqueness.
  - **`user_a_id` always holds the lexicographically smaller UUID** (`services/messaging.py::_canonical_pair`). Without that the unique constraint would accept both (A,B) and (B,A). Any new query that looks a pair up must canonicalise first.
  - `last_message_at` (nullable, indexed) — denormalised for list ordering; null until the first message, and those threads sort last via `nullslast()` rather than being hidden.
  - Helpers on the model: `other_participant(viewer_id)`, `includes(user_id)`.
- `Message` (`app/models/message.py`), table `messages`.
  - `conversation_id` (CASCADE), `sender_id` (CASCADE), `kind` (PG enum `message_kind`: `text` | `meme`), `body` (String(2000), null for meme), `meme_id` (**`ondelete="SET NULL"`**), `read_at` (nullable).
  - Composite index `ix_messages_conversation_created (conversation_id, created_at, id)` backs the keyset page.
  - One table with a `kind` discriminator, **not** a `Message` table beside the old `meme_sends`: a thread over two tables means a UNION, and keyset pagination over a UNION is painful and slow.
  - `meme_id` is SET NULL so deleting a meme doesn't punch holes in history — `MessageOut.meme` is nullable for exactly that case and the client renders an unavailable-attachment placeholder.

## Endpoints
All under `/messaging`, Bearer-auth-gated. JSON is snake_case on the wire as usual.
- `GET /messaging/conversations` → `200` `list[ConversationOut]` — `{id, other_user, last_message: MessageOut|null, unread_count, last_message_at}`, ordered `last_message_at desc nullslast`.
- `POST /messaging/conversations` body `{user_id}` → `201` `ConversationOut`. **Get-or-create** — returns the existing thread rather than 409ing, since the client can't know which case it's in. `403` if not accepted friends.
- `GET /messaging/conversations/{id}/messages?cursor=&limit=` (limit 1–100, default 30) → `200` `{items: [MessageOut], next_cursor}` — **newest-first keyset** page, same base64 `created_at|id` cursor as the feed (`core/pagination.py`). `403` non-participant.
- `POST /messaging/conversations/{id}/messages` body `{kind, body?, meme_id?}` → `201` `MessageOut`. Rate-limited 60/min. Pushes `message_received` to the other participant.
- `POST /messaging/conversations/{id}/read` → `200` `{conversation_id, read_count, read_at}`. Idempotent (`read_count: 0` when nothing was unread). Pushes `message_read` to the other participant **only when something actually changed**.
- `WS /meme-sending/ws?ticket=<ticket>` — unchanged path, see Gotchas. As of the 2026-08-19 audit fix (`[[hardening]]`, finding M-1) this takes a single-use ticket from `POST /meme-sending/ws-ticket`, not the session JWT directly — the JWT no longer travels in a URL/query string. Frames:
  - `{type: "message_received", conversation_id, message: MessageOut}`
  - `{type: "message_read", conversation_id, reader_id, read_at}`

Shim that survives from the old API: `POST /meme-sending/send` `{recipient_id, meme_id}` → `201` `MemeSendOut` (`{id, sender, recipient, meme, status: delivered|pending, reaction: null, created_at}`). Opens/reuses the thread and posts a meme message; `id` is the message's id. **`/meme-sending/inbox`, `/sent`, `/{id}/seen`, `/{id}/react` are gone**, as is the `meme_sends` table and the `MemeSend` model.

## Business rules
- **Accepted friendship is required to open a thread AND re-checked on every send** (`friends_service.are_friends`) — an existing thread must not stay writable after an unfriend. Covered by `test_cannot_message_after_the_friendship_is_removed`.
- **Meme attachments resolve through `services/memes.py::get_visible_meme`** — carries the Phase 16 IDOR fix forward. A meme the sender can't see must not become forwardable just because its ID is known. Regression tests on *both* paths: `test_cannot_send_a_meme_you_cannot_see` (messaging) and `..._through_the_shim` (meme-sending).
- Non-participants get `403`, not `404` — conversation IDs aren't enumerable anywhere in the API, so there's nothing to hide.
- `MessageCreate` validation is a Pydantic `model_validator`, so violations are `422` not a domain error: `text` needs a non-empty body (whitespace-stripped) and no `meme_id`; `meme` needs a `meme_id` and no body.
- The `message_received` frame's embedded `MessageOut` is built **for the recipient**, not the sender — `MemeOut` carries viewer-specific fields (`viewer_vote`, view-count visibility) that would otherwise leak the sender's state.
- `unread_count` = messages in the thread where `sender_id != viewer` and `read_at is null`. Marking read only touches inbound messages.

## Frontend integration notes
- `services/messaging.ts` (REST + wire types) · `services/useMessaging.ts` (TanStack Query) · `services/messagingCache.ts` (**pure, unit-tested cache transforms**).
- Query keys: `['messaging','conversations']` (list) and `['messaging','conversations',<id>,'messages']` (thread, `useInfiniteQuery`).
- **Socket frames patch the caches, they never invalidate them** — same Phase 17 rule as `optimistic-cache.md`. Invalidating a thread would refetch every loaded page and jump the scroll position mid-conversation. The one fallback: a `message_received` for a conversation not in the cached list (a brand-new thread) can't be patched, so that case alone invalidates the list.
- `useMessagingSocketSync()` is mounted **once at the app root** (`app/_layout.tsx`), not per screen, so unread badges stay current while the user is elsewhere.
- Optimistic sends insert a `pending-<random>` placeholder, replaced by the server row on success. On error the placeholder is **removed by id**, not restored from a snapshot — a message that arrived over the socket mid-flight must survive the rollback.
- `insertMessage` inserts **by timestamp, not by unshift**: an optimistic message and an incoming frame can arrive in either order, and a client clock can sit slightly behind the server's.
- Redux `AuthUser` is camelCase (`avatarUrl`) but cached wire types are snake_case (`avatar_url`) — the optimistic sender is converted at the boundary in `useMessaging.ts`.
- Thread `FlatList` is `inverted` over newest-first data, so `onEndReached` = "load older", which lines up with the backend's newest-first keyset page with no client-side reversing.
- Routes: `/inbox` (conversation list, `features/messaging/InboxScreen.tsx`) and `/inbox/[conversationId]` (`ThreadScreen.tsx`). Navigate with the object form — `router.push({pathname:'/inbox/[conversationId]', params:{conversationId}})`. A friend's own profile now uses this exact pattern for its Message button (`ProfileScreen.tsx::onMessage`, via `useOpenConversationMutation()`), rather than dropping the user on the bare `/inbox` list — see [[user-profiles]].
- **2026-08-28: `ConversationList.tsx`'s `ConversationRow` never actually passed `avatarUrl`/`avatarPreset` to `<Avatar>`** — every conversation showed initials-only regardless of what the other user had set (the user-reported bug: "inbox still shows the old AL"). Fixed; see [[user-profiles]] for five more native call sites with the identical gap.
- **2026-08-28: `ThreadScreen.tsx`'s `TopBar` showed only the other user's username, no avatar.** `TopBar` gained a new optional `titleAdornment?: ReactNode` prop (rendered immediately before the title text, in the centered title slot) specifically for this — `ThreadScreen` now passes a small `<Avatar size="sm" .../>` there. Reusable for any other screen that wants an icon/avatar next to its title.

## Gotchas
- **The WebSocket stayed at `/meme-sending/ws`.** It is the app's *single per-user socket*, not a meme-sending feature endpoint — moving it would have forced a client change for no behavioural gain. The connection is shared; the feature is not. Same for the frontend module name `services/memeSendingSocket.ts`.
- **Typed-routes `tsc` errors after adding a route are stale codegen, not real.** `.expo/types/router.d.ts` is regenerated by the **dev server**, not by `expo export` — `npx expo start` for ~30s, then re-run `tsc`.
- **Removing a model leaves its table behind in the test DB.** `Base.metadata.drop_all` only drops tables it still knows about, so the orphaned `meme_sends` kept a FK on `memes` and made every test error with `cannot drop table memes because other objects depend on it`. Fix is a one-time manual `DROP TABLE ... CASCADE` against the test DB; it isn't a code bug and will recur for any future model deletion.
- **A downgrade that recreates an enum column must use `postgresql.ENUM(..., create_type=False)`.** A plain `sa.Enum` column makes `op.create_table` emit its own `CREATE TYPE`, which collides with the explicit one — caught only by actually running the downgrade. Migration `e1d2c3b4a596` does this correctly; copy that pattern.
- The Phase 12 note still holds: **full-suite pytest runs must not overlap** against the shared Postgres test DB, or `_reset_schema`'s drop/create races and produces dozens of unrelated failures across every test file.

## Migration `e1d2c3b4a596` (down_revision `95e49a19db9a`)
Creates both tables **and moves the data** — `meme_sends` is dropped at the end, so anything left behind is lost:
- one conversation per distinct pair, canonicalised via `LEAST/GREATEST` on the UUIDs' text form (matches `_canonical_pair`);
- each send → a `meme` message from the sender, `created_at` preserved so thread order matches what users already saw;
- `status='seen'` → `read_at` (the send's `updated_at`);
- **a `reaction` becomes a text message from the recipient**, timestamped +1s after the meme it replied to. Reactions were the only reply the old model allowed; dropping them would have deleted the only conversation content that existed.
The downgrade is deliberately lossy (text messages and read receipts have no representation in the old shape) and documented as such in the file.

## Key files
- backend: `app/models/conversation.py`, `app/models/message.py`, `app/schemas/messaging.py`, `app/services/messaging.py`, `app/routers/messaging.py`, `app/services/meme_sending.py` (shim), `app/routers/meme_sending.py` (shim + WS), `app/websockets/connection_manager.py`, `app/websockets/pubsub.py` (Redis pub/sub bus, A1), `alembic/versions/e1d2c3b4a596_create_conversations_and_messages.py`.
- frontend: `src/services/messaging.ts`, `src/services/messagingCache.ts`, `src/services/useMessaging.ts`, `src/services/memeSendingSocket.ts`, `src/services/useMemeSending.ts` (shim hook), `src/features/messaging/*`, `src/app/inbox.tsx`, `src/app/inbox/[conversationId].tsx`, `src/components/web/DesktopInboxPanel.tsx`.
- **2026-08-20 Vaporwave web migration** (UI-only, no data/cache-layer change): `src/features/messaging/InboxScreen.web.tsx` + `ThreadScreen.web.tsx` (platform-extension siblings of the native screens above, picked up automatically by Metro for the web bundle — native files untouched) + `src/components/web/WebInboxTopBar.tsx`/`WebThreadTopBar.tsx`/`WebConversationRow.tsx`/`WebNewChatModal.tsx`/`WebMessageBubble.tsx`/`WebMessageComposer.tsx`. Full record, including the `DesktopInboxPanel`-is-now-dead-code finding: `design-system/meme-platform/pages/inbox-web.md`.

## Tests
- `backend/tests/test_connection_manager.py` (4, added 2026-08-21 for A1): two independent `ConnectionManager`/`RedisPubSubBus` pairs standing in for two pods sharing one real Redis — cross-pod delivery, cross-pod `is_online`, presence-key TTL expiry once the heartbeat stops, `send_json` fallback when nobody holds the socket.
- `backend/tests/test_messaging.py` (13): non-friend rejection, get-or-create idempotent from both directions, text round-trip with unread count, meme message payload, **IDOR regression**, non-participant read/write 403, send-after-unfriend 403, mark-read + idempotency, read receipt visible to sender, kind/payload validation (3 cases), keyset pagination across 3 pages, list ordering by activity, and a real WS test covering both `message_received` and `message_read`.
- `backend/tests/test_meme_sending.py` (5): shim opens/reuses a thread, lands as a meme message in the conversation, friendship gate, IDOR through the shim, live WS delivery.
- `frontend/src/services/messagingCache.test.ts` (16): insert into empty/ordered/duplicate cases, page identity preservation, pending replace/remove, read stamping, conversation reorder + unread rules, unknown-conversation signal, badge clearing/summing.
