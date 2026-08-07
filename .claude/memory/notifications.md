# notifications

## Status
Done (Phase 21, 2026-08-06). Backend 223/223 full pytest suite against real Postgres (`test_notifications.py` + notification assertions folded into `test_duels.py` + `test_challenge_notification_crons.py`). Frontend `tsc`/`expo lint` clean (2 pre-existing unrelated warnings), jest 76/76 (9 new), `expo export --platform web` clean (21 routes). Human tap-through on a real device (push permission prompt, actual delivery) not yet done — needs a physical-device dev-client/standalone build, not the Expo Go/web dev flow (`Device.isDevice`/web checks in `pushNotifications.ts` skip registration on both).

Ships alongside 1v1 duels (see [[challenges]] Phase 21 section) — duels are the concrete "challenge-invite" event this system delivers, pulled forward from Phase 20's deferred §3.4.

## Two delivery channels, one call
`services/notifications.py::notify_one`/`notify_many` insert `Notification` row(s), push a `{"type":"notification", notification}` WS frame over the **existing single per-user socket** (`connection_manager`, same one messaging uses — no new connection), and enqueue an arq push-send job. Every challenge-lifecycle event goes through this. **New chat messages deliberately do NOT** — see Business rules.

## Models
- `Notification` (`app/models/notification.py`), table `notifications`: `user_id` (FK CASCADE, indexed), `type` (enum `NotificationType`: `challenge_invite`, `challenge_invite_accepted`, `challenge_invite_declined`, `challenge_starting`, `challenge_ending_soon`, `challenge_side_overtaken`, `challenge_results`), `title` (String 150), `body` (String 280), `data` (JSON — deep-link payload, e.g. `{"challenge_id": "..."}`), `read_at` (nullable). Composite index `(user_id, created_at, id)` backs keyset pagination, same shape as `messages`.
- `PushToken` (same file), table `push_tokens`: `user_id` (FK CASCADE, indexed), `token` (**globally unique**, not unique-per-user — a device's token must move to whoever re-registers it, e.g. a different account logging into the same phone), `platform` (String 16, e.g. `"ios"`/`"android"`).

## Endpoints
All under `/notifications`, Bearer-auth-gated.
- `GET /notifications?cursor=&limit=` → `200` `{items: [NotificationOut], next_cursor}` — newest-first keyset, same cursor helper as messaging.
- `GET /notifications/unread-count` → `200` `{count}`.
- `POST /notifications/{id}/read` → `200` `NotificationOut`. `404` (not 403) if the notification doesn't belong to the caller — ids aren't enumerable, and confirming existence to a non-owner has no legitimate use either.
- `POST /notifications/read-all` → `200` `{read_count}`. Idempotent (`0` when nothing was unread).
- `POST /notifications/push-token` body `{token, platform}` → `204`. **Upsert by token**, not by (user, token) — see Models.
- `DELETE /notifications/push-token?token=` → `204`. `token` is a **query param**, not a JSON body field (same `meme_id`-on-submissions precedent — DELETE-with-body is avoided).

## Business rules
- **New messages are push-only, never a `Notification` row.** `services/messaging.py::send_message` checks `connection_manager.send_json(...)`'s return value (renamed `delivered_live`) — if the recipient isn't connected, it enqueues the same `send_push_job` arq job directly, bypassing `notify_*` entirely. Reason: a conversation already has its own unread-count/inbox surface (see [[messaging]]); a duplicate `Notification` row would be a second, redundant unread concept.
- **Challenge-lifecycle hook points** (in `services/challenges.py`) are listed in [[challenges]]'s Business rules — this file only owns the notification *infrastructure*, not which events fire it.
- **Three new arq crons, registered in `arq_worker.py`**: `notify_challenges_ending_soon` (every 5 min — active challenges with `end_time` inside the next 60 min and `Challenge.ending_soon_notified_at IS NULL`, one-shot via that flag), `notify_side_overtaken` (every 60s — recomputes `_side_scores`, compares the argmax side against `Challenge.leading_side_id`, only notifies when **both** old and new leader are non-null and different — see [[challenges]] Business rules for the missing-side-defaults-to-0.0 bug this surfaced during testing), `create_weekly_open_challenge` (Monday 00:00 UTC — cold-start platform challenge, see [[challenges]]).
- **Push delivery is fire-and-forget and never raises** — `app/integrations/expo_push.py::send_push_notifications` catches `httpx.HTTPError` and only logs; a flaky Expo API must not fail the request or job that triggered it (backend/CLAUDE.md's background-task directive). No `exponent_server_sdk` dependency — a raw `httpx` POST to `https://exp.host/--/api/v2/push/send`, batched at 100 messages/request (Expo's cap), same precedent as `integrations/llm_client.py`'s raw call to Groq over a heavier SDK.
- **The push-send job (`app/workers/tasks/notifications.py::send_push_job`) is a real arq job**, registered in `WorkerSettings.functions` — `notify_one`/`notify_many` and the offline-message path both enqueue it by name via `get_arq_pool()`, never call it directly, so it runs on the worker process like every other background task in this repo.

## Frontend integration notes
- `services/notifications.ts` (REST + wire types) · `services/notificationsCache.ts` (**pure, unit-tested cache-patch helpers** — insert/mark-read/mark-all-read, never invalidate) · `services/useNotifications.ts` (TanStack Query hooks + `useNotificationsSocketSync()`, mounted once at the app root exactly like `useMessagingSocketSync()`).
- Query keys: `['notifications','list']` (infinite) and `['notifications','unreadCount']`. A live `notification` socket frame patches the list cache **and** bumps the unread-count cache directly (no refetch) — same "patch don't invalidate" rule as [[optimistic-cache]] and [[messaging]].
- `services/pushNotifications.ts::getExpoPushTokenAsync()` — resolves `null` (not an error) on web, simulator/emulator, or denied permission; callers must treat `null` as "skip registration." Uses the EAS `projectId` already in `app.json`'s `extra.eas`.
- Push registration lives directly in `app/_layout.tsx`'s `AuthBoundary`, as a second effect keyed on the auth `token` right next to the existing socket-connect effect (not a hand-rolled hook — matches the existing `connectMemeSendingSocket`/`disconnectMemeSendingSocket` pattern of plain functions called from `_layout.tsx`). Registers on login, unregisters (via a `useRef`-held last-known Expo token) on logout.
- `components/NotificationBell.tsx` — icon + unread badge, dropped into `TopBar`'s existing `rightActions` slot on the feed screen (the highest-traffic one); `TopBar` needed no changes, the slot already existed for the inbox icon.
- Route: `/notifications` (`features/notifications/NotificationsScreen.tsx`) — infinite `FlatList`, tap marks read and deep-links via `data.challenge_id` (→ `/challenges/[challengeId]`) or `data.conversation_id` (→ `/inbox/[conversationId]`).
- `expo-notifications` added as a dependency + config plugin in `app.json`. `Notifications.setNotificationHandler` (in `pushNotifications.ts`) shows a foreground banner — without it, a push arriving while the app is open is silently swallowed on some platforms.

## Gotchas
- **`tests/fake_arq.py`'s `_JOB_FUNCTIONS` dict must list every job name a test path can enqueue** — `send_push_job` had to be added there, or any test triggering a notification would `KeyError` inside `FakeArqPool.enqueue_job` (jobs run inline in tests, no real worker — see [[redis-arq-infra]]).
- **`get_arq_pool` is patched per-module in `tests/conftest.py`'s `use_fake_arq_pool` fixture, not globally** — `services/notifications.py` and `services/messaging.py` (the offline-push path) both needed their own `monkeypatch.setattr(..., "get_arq_pool", get_fake_arq_pool)` line added, or they'd try a real Redis connection during tests.
- **The real Expo HTTP call also needed mocking separately from the arq pool** — `FakeArqPool` runs `send_push_job`'s body for real (by design, to exercise real logic), which would otherwise fire an actual request to `exp.host` on every test that triggers a notification. New autouse fixture `mock_expo_push` in `conftest.py` patches `app.workers.tasks.notifications.send_push_notifications` (patched where it's *called*, not where it's defined — same rule as `mock_media_upload`).
- **`app/workers/tasks/notifications.py::send_push_job` and the three new cron jobs all need `async_session_factory` patched to `TestSessionFactory`** in `conftest.py`'s `use_test_session_factory_for_background_tasks` fixture — they open their own DB session outside any request/dependency context, same pattern as the Instagram metadata job.

## Key files
- backend: `app/models/notification.py`, `app/schemas/notifications.py`, `app/services/notifications.py`, `app/routers/notifications.py`, `app/integrations/expo_push.py`, `app/workers/tasks/notifications.py`, `app/workers/arq_worker.py`, `app/services/challenges.py` (hook points), `app/services/messaging.py` (offline-push hook), `app/core/exceptions.py` (`NotificationNotFoundError`), `alembic/versions/acb0458543db_create_notifications_and_push_tokens.py`.
- tests: `backend/tests/test_notifications.py`, `backend/tests/test_challenge_notification_crons.py`, `backend/tests/conftest.py` (`mock_expo_push` + the `get_arq_pool`/`async_session_factory` patches above), `backend/tests/fake_arq.py`.
- frontend: `src/services/{notifications,notificationsCache,useNotifications,pushNotifications}.ts`, `src/components/NotificationBell.tsx`, `src/features/notifications/NotificationsScreen.tsx`, `src/app/notifications.tsx`, `src/app/_layout.tsx` (push registration effect + socket sync mount), `src/services/memeSendingSocket.ts` (`notification` frame added to `IncomingMessage`).

## Tests
- `backend/tests/test_notifications.py` (11): push-token register is an idempotent upsert, a re-registered token moves to the new owner, unregister, keyset pagination, unread-count + mark-read (+ scoped-to-owner 404), mark-all-read + idempotency, real WS delivery of a `notification` frame (triggered via a duel invite).
- `backend/tests/test_challenge_notification_crons.py` — see [[challenges]] Tests section.
- `frontend/src/services/notificationsCache.test.ts` (9): insert into empty/ordered/duplicate cases, page-reference preservation, mark-read (single + already-read no-op + unknown-id no-op), mark-all-read across multiple pages + no-op when nothing's unread.
