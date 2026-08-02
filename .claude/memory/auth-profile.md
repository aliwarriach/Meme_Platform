# auth-profile

## Status
Done (Phase 1). Backend fully tested against real Postgres (9/9 pytest). Frontend wired and type-checks/bundles clean; final on-device tap-through (register → logout → login → see profile on a simulator/device) not yet run by a human — do that before marking Phase 1 "Done" in `Project_Timeline.md`.

## Models
- `User` (`backend/app/models/user.py`), table `users`, UUID PK (`UUIDPKMixin`) + `created_at`/`updated_at` (`TimestampMixin`, both in `app/db/base.py`).
  - `email` (unique, indexed), `username` (unique, indexed, `^[a-zA-Z0-9_]+$`, 3–32 chars), `hashed_password`, `bio` (nullable), `avatar_url` (nullable).
  - No profile fields beyond this yet — `bio`/`avatar_url` exist on the model/schema but there's no endpoint to set them yet (comes with a later profile-editing pass, not scheduled as its own phase).

## Endpoints
All under `/auth`, registered in `backend/app/routers/auth.py`.
- `POST /auth/register` — auth: no — body `{email, username, password}` → `201` `TokenResponse`. `409` if email or username taken (distinct checks, both return 409).
- `POST /auth/login` — auth: no — body `{email, password}` → `200` `TokenResponse`. `401` on wrong password or unknown email (same error either way, don't leak which).
- `GET /auth/me` — auth: yes (Bearer) — → `200` `UserOut`. `401` if no/invalid/expired token.
- `POST /auth/logout` — auth: yes (Bearer) — → `204`. Bumps `User.token_version`, which invalidates **every** outstanding JWT for that user immediately (there's no per-device session tracking, so logout is always "logout everywhere").

`TokenResponse` = `{access_token, token_type: "bearer", user: UserOut}`. `UserOut` = `{id, email, username, bio, avatar_url}` (snake_case on the wire).

## Business rules
- Password hashing: `bcrypt` directly (not passlib — passlib's bcrypt backend breaks on bcrypt>=4.1's version probing; see Gotchas).
- JWT: HS256, payload `{sub: user UUID string, tv: token_version int, exp}`, expires in `settings.jwt_expire_minutes` (default **24 hours** — was 7 days until the 2026-08-03 audit fix, see `Shortcomings.md`). Secret/algorithm/expiry in `app/core/config.py` (`Settings.jwt_*`), sourced from `.env`. `create_access_token(user_id, token_version)` / `decode_access_token(token) -> DecodedToken(user_id, token_version)` in `app/core/security.py`.
- **Token revocation**: `User.token_version` (int, default 0) is embedded in every issued JWT as `tv` and compared against the DB value in every real auth gate — `get_current_user` (`app/core/deps.py`), the meme-sending WebSocket handshake (`app/routers/meme_sending.py`), but deliberately **not** `app/core/rate_limit.py`'s key function (that's a rate-limit bucket key, not an auth gate — a stale bucket under a revoked token has no security impact). A mismatch is treated identically to an invalid/expired token (`401` / WS policy-violation close). `logout_everywhere` (`app/services/auth.py`) increments the version; there's no denylist or refresh-token store (Fix Option 2 in `Shortcomings.md`, chosen over a Redis denylist since it needed zero new infra).
- Auth errors are typed domain exceptions (`app/core/exceptions.py`: `EmailAlreadyExistsError`, `UsernameAlreadyExistsError`, `InvalidCredentialsError`) → translated to HTTP by the handler registered in `register_exception_handlers(app)`. Add new domain errors as `DomainError` subclasses with a `status_code`; no per-router try/except needed. That same function also registers a system-wide `IntegrityError` → `409` handler (safety net for any check-then-insert race that slips past a service-level `try/except`) — see `Shortcomings.md`'s Critical issue.
- `register_user` wraps its insert in `try/except IntegrityError`: a concurrent duplicate registration that passes the pre-check race gets re-checked (email vs. username) and raises the correct specific `DomainError` instead of a raw `500`.
- `get_current_user` (`app/core/deps.py`) re-fetches the user from the DB on every request (not just JWT decode) — a deleted/deactivated user is rejected even with a still-valid token.
- **2026-08-03 deploy note**: bumping `jwt_expire_minutes` down and adding the `tv` claim means every JWT issued before this change (no `tv` field) fails `decode_access_token`'s `token_version is None` check and is rejected as invalid — every existing session was force-logged-out by this deploy. Expected/accepted for a pre-launch app; would need a migration/grace-period plan for a live user base.

## Frontend integration notes
- Base URL: `EXPO_PUBLIC_API_URL` env var, default `http://127.0.0.1:6001` (`frontend/src/constants/config.ts`, `frontend/.env`). See `backend/CLAUDE.md` for why it's 6001 and not 6000 or 8000 (6000 is Chrome's blocked "unsafe port" — X11 — never use it for anything a browser calls directly).
- Auth header: `Authorization: Bearer <token>`, set globally on the shared `apisauce` instance via `setAuthToken()` (`frontend/src/services/api.ts`) — don't set it per-request.
- Session persistence goes through `frontend/src/services/tokenStorage.ts` (NOT `expo-secure-store` directly — see Gotchas), key `meme_platform_auth_token`. On app boot, `bootstrapAuth()` thunk (`authSlice.ts`) reads it, calls `/auth/me` to validate + refresh user, clears it on failure. `_layout.tsx` blocks rendering the `Stack` until `isBootstrapped` is true (prevents a login-screen flash).
- Login/register are TanStack Query mutations (`frontend/src/services/useAuth.ts`) — server-call only. The resulting session (token + user) is Redux client state via the `persistCredentials` thunk, not mirrored into TanStack cache. This is the project's standard split: server data → TanStack Query, client/session state → Redux.
- Route gating is plain `expo-router` `<Redirect>` based on `state.auth.token`, done per-route (`app/index.tsx`, `app/login.tsx`, `app/register.tsx`) — no custom auth-guard hook (matches the "no custom hooks" rule in `frontend/CLAUDE.md`).

## Gotchas
- `passlib[bcrypt]` is NOT used — swapped for the `bcrypt` package directly in `requirements/base.txt` because passlib's bcrypt backend errors against bcrypt ≥4.1. If you see `AttributeError` mentioning `__about__` from passlib anywhere, that's why it was avoided.
- Test DB engine must use `NullPool` (`tests/conftest.py`) — pytest-asyncio's per-test event loops otherwise collide with a pooled asyncpg connection (`InterfaceError: another operation is in progress`).
- CORS is wide open (`allow_origins=["*"]`) in `app/main.py`, dev-only — tighten before any real deployment.
- Two local Postgres databases exist on the shared local server (`127.0.0.1:5432`, user `postgres`): `meme_platform` (dev) and `meme_platform_test` (tests, schema is dropped/recreated per test by `tests/conftest.py`). Credentials are in `backend/.env` (gitignored).
- **`expo-secure-store` does not work on web** — its `.web.ts` module is a literal empty object, so `setItemAsync`/`getItemAsync`/`deleteItemAsync` all throw there (`TypeError: ... is not a function`). Symptom looked like nothing happening after a successful login (200 from the API, no navigation, no visible error) because the failure was in session persistence, not auth. Fixed by routing all token storage through `frontend/src/services/tokenStorage.ts`, which uses `localStorage` on `Platform.OS === 'web'` and real `SecureStore` on native — **never call `expo-secure-store` directly**, always go through that module. `authSlice.ts`'s `persistCredentials`/`bootstrapAuth`/`signOut` also `.unwrap()` their storage dispatch so a future storage failure throws visibly instead of silently stranding the user.

## Key files
- backend: `app/models/user.py`, `app/schemas/auth.py`, `app/services/auth.py`, `app/services/users.py`, `app/routers/auth.py`, `app/core/security.py`, `app/core/deps.py`, `app/core/exceptions.py`, `app/core/rate_limit.py`, `app/routers/meme_sending.py` (WS handshake), `alembic/versions/f8a6c1da5443_create_users_table.py`, `alembic/versions/95e49a19db9a_add_token_version_to_users.py`.
- frontend: `src/store/authSlice.ts`, `src/services/tokenStorage.ts`, `src/services/api.ts`, `src/services/auth.ts`, `src/services/useAuth.ts`, `src/features/auth/*`, `src/app/{_layout,index,login,register}.tsx`. **Not yet updated**: no frontend call to `POST /auth/logout` exists yet — whatever screen has a "log out" action currently only clears the local token (`tokenStorage`/`authSlice`), it doesn't invalidate the token server-side. Wire that up before relying on server-side logout in the UI.

## Tests
- `backend/tests/test_auth.py` (13 tests, all passing against real Postgres): register success, duplicate email, duplicate username, login success, wrong password, unknown email, `/me` without token, `/me` with valid token, `/me` with garbage token, concurrent duplicate registration never 500s, logout invalidates the token, login-after-logout issues a working new token.
- Concurrent-duplicate-write race tests (the Critical fix in `Shortcomings.md`) also live per-feature: `test_friends.py::test_concurrent_friend_requests_never_return_500`, `test_communities.py::test_concurrent_join_never_returns_500`, `test_challenges.py::test_concurrent_submission_of_same_meme_never_returns_500`, `test_memes.py::test_concurrent_first_votes_never_return_500`, `test_instagram.py::test_concurrent_first_container_votes_never_return_500`. All fire two truly concurrent (`asyncio.gather`) requests at the real test-Postgres-backed ASGI app and assert no request ever surfaces a raw `500`.
- Frontend: no automated tests yet (not required for pure screens per `frontend/CLAUDE.md`; `services/useAuth.ts` mutations would be the thing to test if this grows more logic).
