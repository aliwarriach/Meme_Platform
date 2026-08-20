# blocks

## Status
Done (2026-08-19, security-audit remediation — SecurityFeatures.md F-5 item 1). Backend only — no frontend UI yet (no `services/blocks.ts`, no block button/blocked-list screen). Add those before real users can actually use this.

## Models
- `Block` (`backend/app/models/block.py`), table `blocks`, UUID PK + timestamps.
  - `blocker_id`, `blocked_id` (both FK `users.id`, `ondelete=CASCADE`). **Directional** — unlike `Friendship`, there's no `user_low`/`user_high` pair-ordering: A blocking B and B blocking A are two independent rows, since blocking is never mutual by construction.
  - `UniqueConstraint(blocker_id, blocked_id)` (also serves as the forward-direction lookup index) + `CheckConstraint(blocker_id <> blocked_id)` + `Index(blocked_id, blocker_id)` for the reverse-direction check.

## Endpoints
All under `/blocks`, registered in `backend/app/routers/blocks.py`. All require Bearer auth.
- `POST /blocks` — body `{user_id}` → `201` `BlockOut` (`{id, blocked: PublicUserOut, created_at}`). **Idempotent** — blocking an already-blocked user returns the existing row rather than erroring (same get-or-create precedent as `POST /messaging/conversations`). `400` self-block, `404` unknown user. Rate-limited `20/minute` (same as friend requests).
- `DELETE /blocks/{user_id}` — → `204`. `404` if no block exists from the caller to that user.
- `GET /blocks` — → `200` list of `BlockOut`, only blocks the caller placed (not who blocked the caller — that's deliberately not exposed, see Business rules).

## Business rules
- **`services/blocks.py::is_blocked_clause(user_a, user_b)`** is the single source of truth — a composable SQLAlchemy boolean expression (`user_b` can be a bound value or a correlated column), checked bidirectionally. `is_blocked()` wraps it for a plain yes/no query. Reused directly by `meme_visibility_clause` rather than duplicating the OR-of-two-EXISTS shape.
- **Three integration points**, matching the audit's exact scope (no more, no less — containers/comments/challenges beyond duels were deliberately left out of this pass):
  1. `services/memes.py::meme_visibility_clause` — a block between viewer and author hides the author's memes from the viewer, **even overriding an existing accepted friendship** (blocking wins). Never affects the viewer's own memes (no self-block can exist).
  2. `services/friends.py::are_friends` — returns `False` if either side has blocked the other, even for an already-accepted friendship. This one function backs messaging's `_get_or_create_conversation`/`send_message` re-checks *and* `services/challenges.py`'s duel-proposal check, so blocking a friend also stops new messages and new duel proposals to them for free.
  3. `services/friends.py::send_friend_request` — rejects with `UserBlockedError` (403) if either direction is blocked.
- **Deliberately not covered by this pass**: `MemeContainer`/comment visibility, community feeds, challenge submissions beyond duels, existing DM history (old messages stay visible/sendable-context, only *new* sends are blocked), existing friendship rows (not auto-deleted — user chose "block gates future interaction only" over "auto-sever ties" when this was scoped).
- **`UserBlockedError`'s message is deliberately generic** ("Unable to send a friend request to this user") — it does not confirm a block exists, so a harasser probing why their request failed can't use the response to confirm they've been blocked (which could invite retaliation). Blocking is otherwise silent to the blocked party by design: `GET /blocks` only returns blocks the caller placed, never who has blocked the caller.
- Blocking is **not** wired into `GET /friends`/`GET /friends/requests` list filtering — an existing accepted friendship or a still-pending incoming request from someone you later block will still appear in those lists (only new sends/requests and content visibility are gated). Flagged here so it isn't mistaken for an oversight later; revisit if product wants blocked users scrubbed from those lists too.

## Key files
- backend: `app/models/block.py`, `app/schemas/blocks.py`, `app/services/blocks.py`, `app/routers/blocks.py`, `app/core/exceptions.py` (`CannotBlockSelfError`, `BlockNotFoundError`, `UserBlockedError`), `app/services/memes.py` (`meme_visibility_clause`), `app/services/friends.py` (`are_friends`, `send_friend_request`), `app/main.py` (router registration), `alembic/versions/3b8ea06b46a8_add_blocks_table.py`.

## Tests
- `backend/tests/test_blocks.py` (9 tests): block/list, idempotent re-block, self-block rejection, unblock + unblock-when-absent 404, symmetric feed hiding, blocking overriding an existing friends-only post's visibility, blocked-then-friend-request rejection, blocking a friend stopping a new message send.
