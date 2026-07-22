# meme-sending

## Status
Done (Phase 12 backend + frontend built). Backend fully tested against real Postgres (125/125 pytest total, 7 new including a real WebSocket delivery test). Frontend type-checks and bundles clean (`tsc`, `expo export --platform web` — 17 routes). No human tap-through yet.

## Models
- `MemeSend` (`app/models/meme_send.py`), table `meme_sends`, UUID PK + timestamps.
  - `sender_id`/`recipient_id` (FK `users.id`, `ondelete=CASCADE`, indexed), `meme_id` (FK `memes.id`, `ondelete=CASCADE`).
  - `status`: Postgres enum `meme_send_status` — `pending` (recipient offline, sits in inbox), `delivered` (pushed live over an open socket), `seen` (recipient's client acknowledged after fetching/opening the inbox — auto-fired by `InboxScreen` on mount per row).
  - `reaction`: nullable string, the *only* reply a recipient can give (no free-text chat) — reaction-only replies per `Project_Requirements.md`/timeline scope.

## Endpoints
All under `/meme-sending`, Bearer-auth-gated except the WS handshake (see Gotchas).
- `POST /meme-sending/send` — body `{recipient_id, meme_id}` → `201` `MemeSendOut`. `403` if sender/recipient aren't accepted friends, `404` unknown meme. Attempts live delivery via the connection manager first; `status` reflects whether it actually reached an open socket (`delivered`) or was only persisted (`pending`).
- `GET /meme-sending/inbox` — → `200` list of `MemeSendOut`, current user as recipient, newest first.
- `GET /meme-sending/sent` — → `200` list of `MemeSendOut`, current user as sender (so a sender can see reactions come back).
- `POST /meme-sending/inbox/{send_id}/seen` — recipient-only → `200` `MemeSendOut` with `status: seen`. Idempotent no-op if already seen.
- `POST /meme-sending/inbox/{send_id}/react` — body `{reaction}` (any short string/emoji, recipient-only) → `200` `MemeSendOut`. Pushes a `meme_send_reaction` event to the sender if they're connected.
- `WS /meme-sending/ws?token=<jwt>` — one connection per logged-in user; server pushes `{type: "meme_received", send: MemeSendOut}` and `{type: "meme_send_reaction", send: MemeSendOut}` frames. No client→server payloads are read (`receive_text()` only keeps the connection alive/detects disconnects).

## Business rules
- Sending requires an **accepted** friendship both directions — reused `services/friends.py::are_friends` (new helper, wraps the existing `_get_friendship_between`), not a new relationship check.
- Delivery is real-time-first with inbox fallback: `send_meme` always persists the `MemeSend` row, then tries `connection_manager.send_json` — if the recipient has an open socket, the row is updated to `delivered` in the same request; otherwise it stays `pending` and is picked up whenever the recipient's `GET /meme-sending/inbox` is called (typically on reconnect/app open).
- No polling/scheduled worker — delivery attempt is synchronous within the `send` request, matching the "never assume the recipient is connected" directive in backend/CLAUDE.md.
- `MemeSendOut.meme` is a full `MemeOut` with live reaction/comment counts — built via a new shared `services/memes.py::get_meme_out_for_viewer(db, meme_id, viewer_id)`, extracted so meme-sending doesn't reimplement the feed's count-subquery logic (2nd consumer of that pattern).

## Frontend integration notes
- `services/memeSending.ts` (REST calls) + `services/useMemeSending.ts` (TanStack Query: `useInbox`, `useSentMemes`, `useSendMemeMutation`, `useAcknowledgeSendMutation`, `useReactToSendMutation`, plus `useMemeSendingSocketSync` which subscribes to the socket and invalidates `['meme-sending','inbox']`/`['meme-sending','sent']` on incoming frames).
- `services/memeSendingSocket.ts` — the single WebSocket connection manager (module-level singleton, per frontend/CLAUDE.md's "never open ad hoc sockets per screen" rule). `connectMemeSendingSocket(token, dispatch)` / `disconnectMemeSendingSocket()` are called from `app/_layout.tsx`'s `AuthBoundary`, keyed off `state.auth.token` — connects on login, disconnects on logout, auto-reconnects after a 3s backoff on any close (not just intentional ones, since backgrounding/brief network loss look the same as a real drop from the client's perspective).
- `store/socketSlice.ts` — `status: 'disconnected' | 'connecting' | 'connected'`, read by `InboxScreen` to show a live status dot (this is the "socket-status Redux slice" from the Phase 12 deliverables list).
- `features/meme-sending/SendMemeModal.tsx` — friend picker (reuses `useFriendsList`), opened from a new "↗ Send" button on `MemeCard` (feed). `features/meme-sending/InboxScreen.tsx` — route `/inbox`, reachable via a button on `SessionScreen`; each row auto-fires `useAcknowledgeSendMutation` on mount (marks `seen`) and offers 4 fixed emoji quick-reactions (no text input — reaction-only per scope).
- WS URL is derived from `API_BASE_URL` by swapping `http`→`ws` (`memeSendingSocket.ts::wsUrl`) — works for both `http://127.0.0.1:6001` (dev) and any future `https://` deploy (→ `wss://`).

## Gotchas
- **WS auth can't use the Bearer-header convention** — browsers don't let JS set headers on the WebSocket upgrade request, so the JWT travels as a `?token=` query param instead (`routers/meme_sending.py::meme_sending_socket`). This is the one deliberate exception to the header-auth pattern used by every other endpoint; documented inline in the router.
- **The WS handler must use `Depends(get_db_session)`, not a raw `async_session_factory()` call** — the test suite overrides `get_db_session` via `app.dependency_overrides` to point at the test DB; bypassing that (as an early draft of this router did) silently hits the real dev Postgres inside tests, causing confusing "user not found" 1008 closes in a WS test that has nothing to do with test-pollution. Fixed by injecting `db: AsyncSession = Depends(get_db_session)` as a WebSocket route parameter, which FastAPI resolves through the same override.
- **Full-suite pytest runs must not overlap** — running two `pytest` invocations concurrently (e.g. a backgrounded run plus a new foreground run) against the same real Postgres test DB causes `_reset_schema`'s `drop_all`/`create_all` to race, producing dozens of unrelated `IntegrityError`/`relation does not exist` failures across every test file, not just the new ones. Not a real regression — confirmed by re-running the full suite alone (125/125 passed). Always let one pytest process finish before starting another against this DB.
- `TestClient(app)` (sync, from `fastapi.testclient`) is used only for the WS test (`test_websocket_delivers_meme_in_real_time`) since `httpx.AsyncClient` has no websocket support; it shares the same `app.dependency_overrides`, so it's safe to mix with the async `client` fixture used elsewhere in the same test module.

## Key files
- backend: `app/models/meme_send.py`, `app/schemas/meme_sending.py`, `app/services/meme_sending.py`, `app/routers/meme_sending.py`, `app/websockets/connection_manager.py`, `app/services/friends.py` (`are_friends` added), `app/services/memes.py` (`get_meme_out_for_viewer` added), `app/core/exceptions.py` (3 new domain errors), `alembic/versions/a31087eb8f96_create_meme_sends_table.py`.
- frontend: `src/store/socketSlice.ts`, `src/services/memeSending.ts`, `src/services/memeSendingSocket.ts`, `src/services/useMemeSending.ts`, `src/features/meme-sending/SendMemeModal.tsx`, `src/features/meme-sending/InboxScreen.tsx`, `src/app/inbox.tsx`, `src/app/_layout.tsx` (socket lifecycle wiring), `src/features/feed/components/MemeCard.tsx` (Send button).

## Tests
- `backend/tests/test_meme_sending.py` (7 tests, all passing against real Postgres): friendship-required rejection, send+inbox+sent round-trip (pending status when recipient offline), nonexistent-meme rejection, recipient-only seen/react authorization (sender forbidden), reaction visible to sender via `/sent`, and a real end-to-end WebSocket test (`TestClient.websocket_connect`) proving live delivery flips `status` to `delivered` and pushes a `meme_received` frame with no polling.
