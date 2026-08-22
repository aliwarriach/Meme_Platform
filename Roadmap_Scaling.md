# Roadmap — Scaling to 10k Concurrent (architecture for 100k)

Source of truth for taking this platform from single-process dev to an autoscaling Kubernetes
deployment. Written as an implementation document: a future Claude Code session should be able to
pick up any phase and implement it without re-exploring the codebase or re-litigating decisions.

**Read order for an implementer:** §0 (status board) → §1 (locked decisions) → §2 (baseline) →
the one phase you're implementing in §3. Then `backend/CLAUDE.md`, then
`/.claude/memory/<feature>.md` for whichever domain the phase touches.

**Global status: Stage A — IN PROGRESS.** A1 (Redis pub/sub connection manager), A2 (DB
pool + read/write seam), A3 (liveness/readiness + graceful shutdown), and A5 (JSON logs)
are implemented. A4 (direct signed Cloudinary uploads) is partially done — backend
signing/verification mechanism plus one flagship migrated endpoint (`POST /memes`); see
its own implementation note for the narrowed scope. A6 is BLOCKED (no Docker on this
machine, no admin rights to install it) — see its note. A7 depends on A6 and hasn't
been attempted.

**Statuses are greppable.** `grep "^\*\*STATUS:" Roadmap_Scaling.md` prints the whole board.
Allowed values, exactly: `PENDING` · `IN PROGRESS` · `IMPLEMENTED` · `BLOCKED`.
**Update the phase's STATUS line in the same changeset that implements it** — a stale status here
is worse than no roadmap, because the next session will trust it.

---

## 0. Status board

| # | Phase | Status | Est. | Blocks |
|---|---|---|---|---|
| **Stage A — multi-pod safe, local only, $0** | | | **3–4 wks** | |
| A1 | Redis Pub/Sub connection manager | IMPLEMENTED | 3d | Everything. Hard blocker. |
| A2 | DB pool config + read/write seam | IMPLEMENTED | 2d | C4 (autoscaling) |
| A3 | Liveness/readiness + graceful shutdown | IMPLEMENTED | 2d | C2 (Helm) |
| A4 | Direct signed Cloudinary uploads | IN PROGRESS | 4–5d | — |
| A5 | JSON logs to stdout | IMPLEMENTED | 1d | C5 (observability) |
| A6 | Dockerfiles (api / realtime / worker) | BLOCKED | 3d | A7, all of Stage C |
| A7 | Local multi-instance proof | PENDING | 4d | **Gate to Stage B** |
| **Stage B — AWS foundation, $0–24/mo** | | | **1.5–2 wks** | |
| B1 | Account guardrails (budget, credit expiry) | PENDING | 0.5d | Do this first, before any resource |
| B2 | Terraform: persistent stack | PENDING | 1wk | C1 |
| B3 | Migrate schema + push images | PENDING | 2d | **Gate to Stage C** |
| **Stage C — cluster + autoscaling, ~$0.15/hr** | | | **3–4 wks** | |
| C1 | EKS + Karpenter on spot | PENDING | 1wk | C2 |
| C2 | Helm chart, three deployments | PENDING | 1wk | C3 |
| C3 | Ingress + PgBouncer + Cloudflare | PENDING | 4d | C4 |
| C4 | Autoscaling (HPA / KEDA / Karpenter) | PENDING | 4d | **The actual deliverable** |
| C5 | Grafana Cloud observability | PENDING | 1d | D2 |
| **Stage D — prove it, ~$15–25 total** | | | **1.5–2 wks** | |
| D1 | k6 scenarios | PENDING | 4d | D2 |
| D2 | 10k run | PENDING | 3d | D3 |
| D3 | 50k burst | PENDING | 4d | D4 |
| D4 | Record measured numbers | PENDING | 2d | Closes the roadmap |

**Total: 9–12 weeks solo, new to Terraform/K8s. ~6–7 weeks if already fluent in both.**
**Credit spend across the whole plan: ~$40–70 of the $100.**

---

## 1. Locked decisions — do not re-litigate

Approved by the project owner on 2026-08-21. If a phase seems to argue against one of these,
implement the decision as written and flag the conflict; don't silently choose differently.

| Decision | Chosen | Rejected, and why |
|---|---|---|
| Cluster lifecycle | **Ephemeral EKS via Terraform.** `terraform apply` to work, `terraform destroy` when done. | Always-on EKS ($73/mo control plane alone burns the credit in ~28 days). k3s (doesn't teach EKS-specific IRSA/ALB/Karpenter). |
| Real-time | **Separate realtime Deployment + Redis Pub/Sub.** | WS inside API pods (idle sockets break CPU autoscaling). Push-only (changes product feel). |
| Media uploads | **Direct signed uploads to Cloudinary.** | Proxying through API (media competes with feed traffic for pod capacity). |
| Load testing | **Prove 10k and 50k for real.** | Architecture-only (bottlenecks stay hidden until production). |

### 1.1 Cost model (the constraint behind every choice)

Running cluster ≈ **$0.15/hr** = EKS control plane $0.10 + 2× t3.small spot ~$0.012 + ALB ~$0.023.
RDS + ElastiCache sit outside this and stay on (free tier for 12 months on a new account).

| Usage pattern | $100 lasts |
|---|---|
| 24/7 | ~28 days |
| ~40 hrs/wk | ~3.5 months |
| ~20 hrs/wk | ~7 months |
| ~8 hrs/wk (builds + tests only) | ~18 months |

**The habit that decides this:** `terraform destroy` on the ephemeral stack when you stop working.
**Stopping nodes is not enough** — EKS bills the control-plane fee regardless of node count. Only
deleting the cluster stops that meter. Rebuild is ~15 min; data is untouched because it lives in
the persistent stack (§B2).

### 1.2 Deliberately not building

Each is a real technology for a real problem this project does not have. Adding any now costs
credits and comprehension.

| Not doing | Instead | Revisit when |
|---|---|---|
| NAT Gateway | Public subnets + tight security groups | Payment data or a compliance boundary. Saves ~$33/mo — a third of the credit. |
| RDS Proxy | PgBouncer pod | Running it yourself becomes a chore worth ~$15/mo. |
| Self-hosted Prometheus | Grafana Cloud free tier | >10k metric series. Self-hosting costs a 4th node to watch 3. |
| CloudFront | Cloudflare free tier | Signed URLs or tight AWS-native integration. |
| Fargate | EC2 spot via Karpenter | Never at this scale — costlier per pod, slower to burst. |
| Kafka / MSK | arq on Redis | Event replay or multiple independent consumer groups. |
| OpenSearch | Postgres full-text search | Search becomes a core product surface. |
| Service mesh | Plain K8s networking | Many teams, many services. Not a solo 3-deployment app. |
| Multi-AZ RDS | Single AZ + automated backups | Downtime costs revenue. Doubles DB cost today. |
| Sharding | One primary + read replicas | Past 100k concurrent. Explicitly out of scope. |
| Microservices split | One codebase, three deployments | The router/service layering already provides the seams. |

---

## 2. Architecture baseline (verified 2026-08-21 — do not re-derive)

### 2.1 Already multi-instance safe — do not "fix" these

| Property | Where | Why it already works |
|---|---|---|
| Redis-backed rate limits | `app/core/rate_limit.py:24` — `Limiter(..., storage_uri=settings.redis_url)` | Counters are shared across pods. Scaling out doesn't multiply a user's allowance. |
| Keyset feed pagination | `app/core/pagination.py` | Constant-time at any depth. `OFFSET` would degrade linearly. Single most important feed decision, already correct. |
| Precomputed + cached leaderboards | `app/services/leaderboards.py`, `app/core/leaderboard_cache.py` | Ranking never runs as a live aggregation on the request path. |
| Jobs on a Redis queue, separate process | `app/workers/arq_worker.py` | Workers already scale independently. Precondition for KEDA scale-to-zero. |
| Stateless JWT auth | `app/core/security.py`, `app/core/deps.py` | No sticky sessions; any pod serves any request. |
| Env-var config | `app/core/config.py` (pydantic-settings) | Maps 1:1 onto K8s ConfigMap/Secret. No app change needed for deployment. |

### 2.2 Blocks multi-pod deployment

| Blocker | Where | What breaks | Fixed in |
|---|---|---|---|
| In-memory socket registry | `app/websockets/connection_manager.py:13` | Message sent from pod A can't reach a user socketed on pod B. The file's own docstring flags this. | A1 |
| Unconfigured DB pool | `app/db/session.py:5` — bare `create_async_engine` | Defaults ~15 conns/process. 60 pods × 15 = 900 → Postgres refuses. Autoscaling becomes the outage. | A2 |
| Media proxied through API | `app/integrations/cloudinary_client.py:24` | 10MB upload holds pod memory + a thread-pool slot for seconds; stalls a pod that would serve 300 req/s. | A4 |
| One combined health check | `app/main.py:150` | K8s needs liveness vs readiness separately, or traffic routes to pods whose DB isn't up and every deploy drops requests. | A3 |

### 2.3 Target architecture

```
Cloudflare (TLS, CDN, DDoS, edge cache — free)
        │
    AWS ALB (Ingress)
        │
   ┌────┴─────────────────┬──────────────────────┐
API Deployment       Realtime Deployment     Worker Deployment
stateless FastAPI    WebSockets only         arq
HPA on CPU           scaled on conn count    KEDA on queue depth, min 0
7 pods @10k          1–2 pods @10k           0–N
67 pods @100k        8–10 pods @100k
   └────┬─────────────────┴──────────────────────┘
        │
   PgBouncer pod ──► RDS Postgres (+ read replica at ~50k)
   ElastiCache Redis — cache · rate limits · arq queue · WS pub/sub
   Cloudinary — clients upload DIRECT; bytes never touch pods
```

**Why three Deployments and not one:** they scale on different signals and one Deployment can only
obey one. A pod holding 10k idle WebSockets shows ~0% CPU — CPU autoscaling would never scale it
up under connection pressure, and would scale it *down*, severing live sockets. Workers should hit
zero when idle. API scales on CPU.

### 2.4 Capacity dial — same architecture, different numbers

Assumes ~0.2 req/s per actively-browsing user, ~300 req/s per API pod, ~12k idle sockets per
realtime pod. **Every row is a values-file change, not a design change.** Replace with measured
numbers in D4.

| Concurrent | Req/s | API pods | Realtime pods | Nodes | Database |
|---|---|---|---|---|---|
| 10,000 | ~2,000 | 7 | 1–2 | 3–4 | single `db.t4g.medium` |
| 50,000 | ~10,000 | 33 | 4–5 | 15–18 | + 1 read replica |
| 100,000 | ~20,000 | 67 | 8–10 | 30–35 | `db.r7g.large` + 2 replicas |

100k concurrent is ~35 servers, not 500. That is why this ceiling needs no sharding.

### 2.5 What breaks first, in order

Scaling failures are sequential. Each row is what gives way once the row above is fixed.

| Breaks at | Symptom | Fix |
|---|---|---|
| 2+ pods | Real-time messages silently vanish for some users | A1 |
| ~15 pods | `FATAL: too many connections`, cascading 500s | A2 + C3 |
| ~5k users | p95 climbs while CPU stays low | Unindexed query — Grafana points at it, `EXPLAIN ANALYZE` confirms |
| ~10k users | Uploads time out, feed slows alongside | A4 |
| ~25k users | Realtime pods hit memory ceiling and restart | Raise fd limits; scale on conn count not CPU |
| ~50k users | DB CPU pegged, writes queue behind reads | Read replica — A2's seam makes it an env-var change |
| ~100k users | Single primary saturates on writes | The real ceiling. Beyond: sharding, event-driven writes, multi-region. Different project. |

---

## 3. Phases

Each phase below carries: **STATUS**, **WHY** (why it's necessary — read this before deciding to
skip it), **FILES**, **IMPLEMENT** (steps), **TEST** (how to prove it works), **DONE WHEN**.

---

### A1 — Redis Pub/Sub connection manager

**STATUS:** IMPLEMENTED (2026-08-21)
**Est:** 3 days · **Stage:** A (local, $0) · **Blocks:** literally everything else

**Implementation note.** `app/websockets/pubsub.py` (new) holds a `RedisPubSubBus` class,
not a flat module-singleton like `leaderboard_cache.py` — needed so the unit test could
instantiate two independent buses (simulating two pods) against one real Redis.
`ConnectionManager.__init__` takes an optional bus (defaults to the shared `pubsub_bus`).
One real gotcha found only by running the suite: **do not use `redis.asyncio`'s
`pubsub.listen()`** as the background listener loop — its own condition is
`while self.subscribed`, so a listener started at pod boot (zero subscriptions yet, the
normal case before any user connects) returns immediately and never listens again.
Fixed by polling `get_message(timeout=1.0)` in a `while True` instead, gated only on
`self._pubsub.connection is not None` (set on the first-ever subscribe, survives later
unsubscribes). Full suite (272) green; new `tests/test_connection_manager.py` (4) is the
two-pod proof required by this phase's TEST section.

**WHY.** This is the one hard blocker. Today `ConnectionManager` is a module-level dict of
`user_id -> WebSocket` (`app/websockets/connection_manager.py:13`). The moment a second pod exists,
a message published by pod A for a user connected to pod B is dropped silently — no error, no log,
the message just never arrives. Nothing else in this roadmap is worth starting until pods can reach
each other's sockets.

**FILES.**
- `app/websockets/connection_manager.py` — rewrite internals, keep the public interface
- `app/websockets/pubsub.py` — **new**, the Redis bus
- `app/services/messaging.py:231,276,307` — call sites
- `app/services/notifications.py:31` — call site
- `app/routers/meme_sending.py:55,66` — connect/disconnect
- `backend/tests/conftest.py:64–77` — the `_reset_connection_manager` fixture reaches into
  `connection_manager._connections` directly; it must also flush the Redis presence keys

**IMPLEMENT.**

1. **Keep the public interface identical** — `connect`, `disconnect`, `is_online`, `send_json`.
   The local dict stays: actual `WebSocket` objects are inherently per-process. What changes is
   what happens when the socket *isn't* local.

2. **Per-user channels, not one global channel.** On connect, the pod subscribes to
   `ws:user:{user_id}`; on disconnect it unsubscribes. A pod then only receives messages for users
   it actually holds. A single global channel every pod filters locally would mean every pod
   receives every message — fine at 3 pods, wasteful at 100k users.

3. **Presence via a TTL key, not a set.** On connect `SET ws:online:{user_id} {pod_id} EX 60`;
   refresh every 30s from a heartbeat task while the socket lives; `DEL` on clean disconnect. A TTL
   key is self-healing — a pod that dies uncleanly leaves a key that expires on its own, whereas a
   set member would mark a user online forever.

4. **`send_json` logic:** if a local socket exists, send directly and return. Otherwise publish to
   `ws:user:{user_id}` and return the *presence* result.

5. **Two breaking changes to flag while implementing:**
   - `is_online` becomes **async** (it's a Redis call now). `app/services/messaging.py:307`
     currently calls it synchronously — add `await`.
   - `send_json`'s return value changes meaning from "delivered to a live socket" to "user was
     online". The publishing pod cannot synchronously know whether the receiving pod's send
     succeeded. This is acceptable because the fallback path is a persisted inbox row either way —
     but say so in the docstring so the next reader doesn't assume delivery confirmation.

6. **Subscriber lifecycle.** One long-lived pub/sub connection per pod, separate from the arq pool
   in `app/core/redis.py` (a connection in subscribe mode can't serve other commands). Start it in
   the `lifespan` handler in `app/main.py`, cancel it cleanly on shutdown.

**TEST.**
- Unit, two-manager simulation: instantiate two `ConnectionManager` objects against the same Redis
  (they stand in for two pods). Connect a fake socket on A, call `send_json` on B, assert the
  payload arrives at A. **This is the test that proves the phase.**
- `is_online` returns True from a manager that holds no local socket for that user.
- Presence key expires: connect, kill the heartbeat, advance past TTL, assert `is_online` is False.
- Update `_reset_connection_manager` in `conftest.py` to clear both the dict and `ws:*` Redis keys.
- Full suite must stay green: `pytest backend/tests/ -v` — pay attention to `test_messaging.py`,
  `test_meme_sending.py`, `test_notifications.py`.

**DONE WHEN.** Two manager instances sharing one Redis deliver to each other, the full suite is
green, and no caller outside `app/websockets/` needed a signature change beyond adding `await` to
`is_online`.

---

### A2 — DB pool configuration + read/write seam

**STATUS:** IMPLEMENTED (2026-08-21)
**Est:** 2 days · **Stage:** A · **Blocks:** C4

**Implementation note.** Settings added exactly as specified (`db_pool_size`,
`db_max_overflow`, `db_pool_timeout`, `db_pool_recycle`, `database_read_url`), plus a
`db_use_pgbouncer` bool gating the asyncpg `statement_cache_size=0` connect arg (not named
in the spec, needed to satisfy IMPLEMENT step 3). `ReadDbSession` (`app/core/deps.py`)
moved onto `get_read_db_session` for the six actually-safe read-only endpoints:
`/leaderboards/individual`, `/leaderboards/communities`, `/leaderboards/profile/{id}`,
`/communities/{id}/leaderboard`, `/communities/{id}/feed`, `/memes/feed` — each verified
read-only line by line (no `db.add`/`db.commit`/`update` anywhere in their call graphs)
before moving. **Gotcha for the next reader:** `tests/conftest.py` must override
`get_read_db_session` the same way it overrides `get_db_session`, or those six endpoints
silently hit the real dev database instead of the per-test schema during the whole rest of
the suite — easy to miss since the failure mode is wrong/missing data, not a crash.
`tests/test_db_pool.py` proves the pool ceiling, the read/write aliasing when no replica
is configured, and (via a subprocess with `DATABASE_READ_URL` set) that a real second
engine gets built when a replica *is* configured — `engine`/`read_engine` are built once
at module import time, so that branch can't be exercised by in-process monkeypatching.

**WHY.** `app/db/session.py:5` is a bare `create_async_engine(settings.database_url)` — SQLAlchemy
defaults to `pool_size=5, max_overflow=10`, so ~15 connections per process. Postgres tops out
around 100–500. At 60 pods that's 900 attempted connections and the database starts refusing them:
**turning on autoscaling would itself cause the outage.** The read/write seam is added now, while
it costs nothing, because retrofitting it later means touching every read path under live load
pressure.

**FILES.** `app/db/session.py`, `app/core/config.py`, `app/core/deps.py`

**IMPLEMENT.**

1. New settings with conservative defaults: `db_pool_size: int = 5`,
   `db_max_overflow: int = 5`, `db_pool_timeout: int = 30`, `db_pool_recycle: int = 1800`,
   `database_read_url: str | None = None`.

2. Pass them explicitly, plus `pool_pre_ping=True` (drops connections killed by a PgBouncer or RDS
   restart instead of failing the next request with a stale-connection error).

3. **The asyncpg + PgBouncer footgun — do not skip.** PgBouncer in transaction-pooling mode breaks
   asyncpg's prepared-statement cache, producing intermittent
   `prepared statement "__asyncpg_stmt_x__" does not exist` errors under concurrency. Pass
   `connect_args={"statement_cache_size": 0}` when the engine is pointed at PgBouncer. Gate it on a
   setting so local direct-to-Postgres dev keeps the cache.

4. **Read engine:** if `database_read_url` is set, build a second engine and session factory from
   it; otherwise **alias the write engine**. The seam exists from day one and costs nothing until
   there's a replica. Add `get_read_db_session()` alongside `get_db_session()` in `app/core/deps.py`.

5. Do **not** switch every read to the read session yet — only the safe, obviously-read-only ones
   (leaderboards, feed). A read session on a path that writes will fail against a real replica.
   Anything ambiguous stays on the write session.

6. **Sizing math to keep true** — write it as a comment where the settings are defined:
   `pods × (db_pool_size + db_max_overflow)` ≤ PgBouncer `max_client_conn`, and PgBouncer
   `default_pool_size` ≤ Postgres `max_connections` minus headroom for migrations and admin.

**TEST.**
- Assert the engine's pool is configured from settings (`engine.pool.size()`), not defaults.
- Concurrency test: fire N concurrent requests, poll
  `SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()` and assert it stays
  bounded by the configured ceiling.
- Read-session test: a leaderboard read through `get_read_db_session` returns identical data to the
  write session.
- Full suite green.

**DONE WHEN.** Pool config is settings-driven, connection count under load is provably bounded, and
`database_read_url` can be pointed at a replica with no code change.

---

### A3 — Liveness / readiness probes + graceful shutdown

**STATUS:** IMPLEMENTED (2026-08-21)
**Est:** 2 days · **Stage:** A · **Blocks:** C2

**Implementation note.** Built as `app/routers/health.py` (new) rather than inline in
`app/main.py`, so the module-level `_shutting_down` flag and its `mark_shutting_down()`/
`is_shutting_down()` accessors have one clear owner. The Redis check reuses the existing
arq enqueue pool (`app/core/redis.py::get_arq_pool`, an `ArqRedis` — a real
`redis.asyncio.Redis` subclass — `.ping()`) rather than opening a dedicated connection.
**Two environment realities this dev machine forced adaptations around, both documented
in the TEST file docstrings:**
- **Windows cannot deliver a real cross-process SIGTERM to a registered Python handler** —
  verified directly: `os.kill(pid, signal.SIGTERM)` raises `WinError 87`, and even Git
  Bash's `kill -TERM <pid>` just force-terminates the process without invoking the
  handler. The handler itself (`app/main.py::_handle_sigterm`) is written correctly for
  real deployment (chains to whatever handler `signal.signal()` returns as "previous" —
  uvicorn's own `Server.handle_exit` in production — so SIGTERM still actually drains and
  exits, not just flips the flag forever); the automated test calls it directly to prove
  the application-level contract, and the real OS-signal path gets its first genuine
  exercise once A6/A7 run this inside a Linux container.
- **No docker-compose stack exists yet** (that's A7) and Postgres/Redis run as native
  Windows services shared with the rest of this suite (and possibly other concurrently
  running test processes) — so the DB/Redis-down tests monkeypatch
  `health._check_database`/`_check_redis` to fail rather than literally stopping shared
  infrastructure mid-suite.
- Also added: `ConnectionManager.close_all()` (graceful WS close, item 5 of IMPLEMENT) and
  its own test in `test_connection_manager.py`, since it's the connection-manager half of
  this phase's shutdown sequence.

**WHY.** `app/main.py:150` has one `/health` returning a static `{"status": "ok"}`. Kubernetes needs
two distinct signals: *liveness* ("restart this pod") and *readiness* ("send this pod traffic").
With only one, K8s routes traffic to pods whose DB pool hasn't connected yet, and **every deploy and
every scale-down event drops live user requests.** This phase is what makes autoscaling invisible
to users rather than a source of intermittent 502s.

**FILES.** `app/main.py`, `app/routers/health.py` (**new**)

**IMPLEMENT.**

1. `/health/live` — returns 200 if the process is running. Checks **nothing** else. A liveness probe
   that touches the database turns a slow query into a pod restart loop, which turns a brownout
   into an outage.

2. `/health/ready` — actually verifies dependencies: `SELECT 1` against the DB and `PING` against
   Redis, both with a short timeout (~2s). Return 503 with which dependency failed if either is down.

3. Keep `/health` as an alias for `/health/live` — the ngrok/preview setup and any existing client
   may still call it (see `.claude/memory/project_run_setup.md` context).

4. **Graceful shutdown.** A module-level `_shutting_down` flag; a `SIGTERM` handler sets it;
   `/health/ready` returns 503 immediately once set. Sequence: SIGTERM → ready flips 503 → the load
   balancer stops sending new requests → in-flight requests finish → process exits.

5. Realtime pods additionally send a WebSocket close frame on shutdown so clients reconnect
   deliberately rather than hanging on a half-open socket.

6. Note for C2 (don't implement here, but the Helm chart must match): `preStop` hook of
   `sleep 15` and `terminationGracePeriodSeconds: 30`. The LB needs time to deregister the pod
   *before* the process stops accepting.

**TEST.**
- `/health/ready` returns 503 when Postgres is stopped (`docker compose stop postgres`), and 200
  again once it's back. Same for Redis.
- `/health/live` keeps returning 200 throughout the above — this is the distinction that matters.
- Shutdown test: send SIGTERM mid-request; assert readiness flips to 503 immediately and the
  in-flight request still returns a complete response.

**DONE WHEN.** Both endpoints behave correctly with each dependency independently stopped, and
SIGTERM drains rather than drops.

---

### A4 — Direct signed Cloudinary uploads

**STATUS:** IN PROGRESS (2026-08-21) — backend done for one flagship endpoint, scope
narrowed below
**Est:** 4–5 days (backend + frontend) · **Stage:** A

**Scope decision (confirmed with project owner 2026-08-21).** This phase's own estimate
(4-5 days, 5+ call sites, frontend included) doesn't fit inside one autonomous pass
through the rest of Stage A. Implemented in full: the signing/verification mechanism
(`POST /media/upload-signature`, `services/media.py::create_upload_signature` +
`confirm_pending_upload`, all 5 required negative tests + oversized/wrong-format checks)
and **one flagship migrated endpoint, `POST /memes`** (personal meme creation), which now
accepts either the legacy `image` file *or* a confirmed `image_public_id` — mutually
exclusive, exactly one required. **Not migrated, still on the proxied
`validate_and_upload_image` path:** `POST /templates`, community icon/banner
(`POST /communities`), challenge images (`services/challenges.py`), avatar upload
(`POST /auth/register`/profile update). No frontend work — the mobile/web client still
posts multipart to every endpoint including `/memes`, so the new flow is backend-only and
inert until a client actually calls `POST /media/upload-signature`. **DONE WHEN's "no
image bytes pass through a FastAPI route" is therefore not yet met platform-wide** — only
for a `/memes` request that opts into the new flow. Revisit to finish the migration
(mechanical repetition of the `/memes` pattern for the remaining call sites, then delete
`validate_and_upload_image`) plus the frontend upload-flow rewrite.

**Implementation notes:**
- Redis-backed pending-upload tracking reuses `app/core/redis.py::get_arq_pool()` for
  plain SET/GETDEL commands — same established pattern as
  `services/meme_sending.py`'s WS ticket store, not a new Redis client.
- **Size can't actually be "baked into the signed params"** the way IMPLEMENT step 3
  literally describes — Cloudinary's signed upload API has no raw max-bytes parameter;
  that only exists via a dashboard-configured upload preset, which isn't something this
  agent can create/verify against the real account. `allowed_formats` *is* a real signed
  param and is used (genuinely enforced by Cloudinary at upload time). Size is enforced
  by `confirm_pending_upload`'s Admin API check instead (step 5) — reading Cloudinary's
  own record of `bytes`/`format` after upload and deleting+rejecting anything over
  10MB or the wrong format. This still means bytes never pass through this process; it
  just means the size check happens a moment after upload rather than blocking it.
- `tests/fake_arq.py::FakeArqPool` needed real TTL enforcement added (lazy
  expiry-on-read, like real Redis) to make the "expired pending upload" test meaningful —
  it previously ignored `ex` entirely, since nothing before A4 needed a fake key to
  actually expire.

**WHY.** Today image bytes flow through the API: `app/services/media.py` reads the whole file into
memory, then `app/integrations/cloudinary_client.py:24` ships it to Cloudinary inside
`asyncio.to_thread`. A 10MB upload therefore holds pod memory *and* a thread-pool slot for seconds.
A hundred concurrent uploads can stall a pod that would otherwise serve 300 req/s of feed traffic.
Moving to direct upload removes media from the pod entirely and drives AWS data-transfer cost toward
zero.

**FILES.** `app/services/media.py`, `app/integrations/cloudinary_client.py`,
`app/routers/memes.py`, `app/routers/templates.py`, `app/routers/communities.py`,
`app/routers/challenges.py`, `app/routers/auth.py` (avatar), plus the frontend upload paths.

**IMPLEMENT.**

1. New endpoint `POST /media/upload-signature` returning the signed params the client needs
   (`signature`, `timestamp`, `api_key`, `cloud_name`, `folder`, `public_id`). JWT-required and
   rate-limited like any other write endpoint.

2. **The server chooses `public_id` and `folder`** — never the client. Record the issued id in Redis
   as `media:pending:{public_id} -> {user_id}` with a ~15 minute TTL.

3. **Constrain the signature.** Bake `allowed_formats` and `max_file_size` into the signed
   parameters so Cloudinary enforces the existing rules from `app/services/media.py:11-12`
   (`ALLOWED_IMAGE_TYPES`, `MAX_IMAGE_BYTES = 10MB`) at *their* edge. The validation moves — it is
   not dropped.

4. **Verify on confirm.** When the client posts a `public_id` back to `POST /memes` (etc.), do a
   Redis `GETDEL` on `media:pending:{public_id}` and confirm the stored user id equals the current
   user's. Reject otherwise. `GETDEL` makes each signature single-use.

5. Optionally call Cloudinary's Admin API (`cloudinary.api.resource`) on confirm to read the real
   stored format and byte size — a genuine server-side final check rather than trusting anything
   client-supplied.

6. **Migration:** keep `validate_and_upload_image` working while the frontend ships, then delete it.
   Don't break the existing app mid-flight.

**SECURITY — the trap this phase exists around.** A naive direct-upload flow lets a client claim
**any arbitrary URL** as their meme image, bypassing `validate_and_upload_image` entirely. Steps 2,
3 and 4 above are the mitigation and all three are required. Never store a client-supplied URL
directly. This is a `backend/CLAUDE.md` "never drop validation for brevity" case.

**TEST.**
- Signature generation is deterministic for fixed params.
- **User B cannot claim a `public_id` issued to user A** → 403.
- A `public_id` never issued by the server → 400.
- An expired pending key (TTL elapsed) → 400.
- A second confirm with the same `public_id` → 400 (GETDEL made it single-use).
- Oversized/wrong-format upload is rejected by Cloudinary given the signed constraints — verify
  manually once against the real API; it can't be unit-tested meaningfully.

**DONE WHEN.** All five negative tests pass, an end-to-end upload works from the real client, and no
image bytes pass through a FastAPI route.

---

### A5 — JSON logs to stdout

**STATUS:** IMPLEMENTED (2026-08-22)
**Est:** 1 day · **Stage:** A · **Blocks:** C5

**Implementation note.** The structured `JsonFormatter` (timestamp/level/logger/message/
request_id/extra-fields-as-top-level-keys) already existed pre-A5 (SecurityFeatures.md
F-6) and was already unconditionally active — this phase's actual gap was just the
`log_format` setting (`"text"` default for local dev, `"json"` for deployment) and its
own test coverage. `tests/test_logging.py` (4 tests): formatter output is valid JSON with
required fields, `log_security_event` kwargs survive as top-level fields (never flattened
into the message), `configure_logging` picks the right formatter per setting, and a real
request's log line's `request_id` matches its `X-Request-ID` response header.

**WHY.** Kubernetes collects logs from stdout and log aggregators parse JSON, not prose. The
structured logging and request-ID plumbing already exist (`app/core/logging.py`,
`request_id_var`, the `X-Request-ID` middleware at `app/main.py:109`) — this is a formatter change
so `request_id` becomes a queryable field instead of text buried in a line.

**FILES.** `app/core/logging.py`, `app/core/config.py`

**IMPLEMENT.**
1. Add a JSON formatter emitting at minimum: `timestamp`, `level`, `logger`, `message`,
   `request_id` (from the contextvar), and any `extra` fields — `log_security_event` already passes
   structured kwargs and those must survive as real JSON fields, not be flattened into the message.
2. Gate on a new `log_format: str = "text"` setting; `json` in deployment, `text` locally (JSON logs
   are miserable to read in a terminal).
3. stdout only. No file handlers, no rotation — the container runtime owns that.

**TEST.** Capture output, `json.loads` every line, assert `request_id` is present and matches the
`X-Request-ID` response header for the same request. Assert `log_security_event` kwargs appear as
top-level fields.

**DONE WHEN.** Every log line in `json` mode parses as JSON and carries a correlatable `request_id`.

---

### A6 — Dockerfiles

**STATUS:** BLOCKED (2026-08-22)
**Est:** 3 days · **Stage:** A · **Blocks:** A7 and all of Stage C

**Blocker.** No Docker installation exists on this dev machine, and this phase's own TEST
section is inherently Docker-dependent (`docker build`, `docker run`, `docker exec`,
`docker history`) — there's no meaningful way to write or verify a Dockerfile without a
working daemon to build and run it against. Investigated getting one:
- `docker` — not on PATH, not installed.
- `winget` is available, but the Windows account this session runs as (`desktop-dop2vu8\newuser`)
  is **not an administrator** (`IsInRole(Administrator)` → `False`) — confirmed directly.
  Docker Desktop's installer requires elevation (it installs a system service and, on
  Windows, sets up the WSL2 or Hyper-V backend).
- WSL2 as an alternative path (running `dockerd` directly inside a WSL distro, bypassing
  Docker Desktop) is also unavailable: `wsl --status` reports WSL itself isn't installed,
  and `wsl --install` / enabling the WSL Windows feature both need admin rights this
  session doesn't have either.

**Seam for whoever unblocks this:** once Docker (or WSL2 + dockerd) is available — either
by installing Docker Desktop with an admin account, or handing this session admin rights —
A6 can proceed exactly as written below; nothing about the plan itself needs to change.
A7 is blocked transitively (it builds on A6's image). The autonomous loop through
Roadmap_Scaling.md stopped here per its own instructions ("if you genuinely can't, set
STATUS to BLOCKED... and stop").

**WHY.** Kubernetes runs containers, not Python processes. Prerequisite for everything after it.

**FILES.** `backend/Dockerfile` (**new**), `backend/.dockerignore` (**new**),
`backend/requirements/prod.txt`

**IMPLEMENT.**
1. Multi-stage build: a builder stage installs into a venv, the final stage copies just the venv.
   Keeps compilers out of the shipped image.
2. `python:3.13-slim` base (match the local interpreter — `__pycache__` shows cpython-313).
3. **Non-root user.** Create and switch to it; never run as root.
4. **One image, three commands.** Build once; the Deployment overrides the command:
   - api → `gunicorn app.main:app -k uvicorn.workers.UvicornWorker`
   - realtime → same app, tuned worker count and raised file-descriptor limit
   - worker → `arq app.workers.arq_worker.WorkerSettings`

   One image is simpler to build, tag, and version than three, and guarantees all three run
   identical code.
5. `.dockerignore` must exclude `.env`, `__pycache__`, `.git`, `tests/`, `frontend/`. **Verify `.env`
   is excluded** — a secret baked into an image pushed to ECR is a real leak.

**TEST.**
- Image builds clean; `docker run` + `curl /health/live` returns 200.
- `docker exec <c> whoami` is not root.
- `docker history` shows no build toolchain in the final layer.
- `docker run --rm <image> printenv | grep -i secret` returns nothing, and `.env` is absent from
  the image filesystem.

**DONE WHEN.** All three commands run from the one image and the image contains no secrets.

---

### A7 — Local multi-instance proof

**STATUS:** PENDING
**Est:** 4 days · **Stage:** A · **This is the gate to Stage B**

**WHY.** The checkpoint that makes the rest of the roadmap cheap. Multi-instance bugs are identical
whether you debug them locally or on a live cluster — but locally they cost $0 and the feedback loop
is seconds instead of minutes. **Do not pay $0.15/hr to find bugs Docker Compose surfaces just as
well.** If this passes, EKS becomes a deployment detail rather than a debugging surface.

**FILES.** `docker-compose.scale.yml` (**new**), `deploy/nginx.conf` (**new**),
`deploy/pgbouncer.ini` (**new**)

**IMPLEMENT.**
1. Compose stack: postgres, redis, pgbouncer, api ×3, realtime ×2, worker ×1, nginx.
2. nginx: `least_conn` for the API upstream; route `/ws` to the realtime upstream with `ip_hash` so
   a reconnecting client lands consistently.
3. PgBouncer in **transaction** mode — the mode that requires A2's `statement_cache_size=0`.
4. Point the API at PgBouncer, not directly at Postgres, so the real production path is what's
   being exercised.

**TEST — three specific proofs, all required.**
1. **Suite green against the load-balanced stack.** Run `pytest backend/tests/` with the API base
   URL pointed at nginx rather than a single uvicorn.
2. **Cross-pod WebSocket delivery.** Connect a WS client (it lands on realtime-1), then trigger a
   message via an HTTP call that nginx routes to api-3. The message must arrive. *This is the proof
   that A1 actually worked* — the unit test simulated two pods; this is two real processes.
3. **No dropped requests on pod death.** Run sustained traffic through nginx, `docker kill` one API
   container mid-flight, assert zero 5xx responses in the client.

Also confirm: `pg_stat_activity` connection count stays bounded with all 6 app containers running
(proves A2 + PgBouncer together).

**DONE WHEN.** All three proofs pass. **Only then start spending AWS credits.**

---

### B1 — Account guardrails

**STATUS:** PENDING
**Est:** 0.5 day · **Stage:** B · **Do this before creating any billable resource**

**WHY.** The difference between a warning and a surprise charge. Also: two facts discovered here can
reshape the whole timeline, and it's better to know before Stage A finishes than after.

**IMPLEMENT.**
1. **AWS Budget alert at $80**, second at $95. Five minutes. Non-negotiable.
2. **Check the credit expiry date.** AWS credits expire on a fixed date regardless of remaining
   balance. If they expire in 6 months, the "~18 months at 8 hrs/week" plan was never available and
   the schedule compresses — **record the actual date in this file when found.**
3. **Confirm free-tier eligibility** for RDS and ElastiCache (accounts under 12 months old only). If
   not eligible, add ~$24/mo always-on to every projection in §1.1 and record that here.
4. IAM user with programmatic access for Terraform. Never the root account. Never commit the keys —
   see root `CLAUDE.md` on secrets.

**DONE WHEN.** Budget alerts active, and the expiry date + free-tier answer are written into this
section.

> **Findings (fill in during B1):**
> - Credit expiry date: _not yet checked_
> - RDS/ElastiCache free tier eligible: _not yet checked_

---

### B2 — Terraform: persistent stack

**STATUS:** PENDING
**Est:** 1 week · **Stage:** B · **Blocks:** C1

**WHY.** Terraform is not bureaucracy here — **it is the credit strategy.** Being able to destroy
and rebuild the cluster identically in ~15 minutes is what makes "only pay while working" a
practical habit instead of a scary one.

**FILES.** `infra/persistent/` (**new**), `infra/ephemeral/` (**new**)

**IMPLEMENT.**
1. **Two separate states — this is the important structural decision.**
   - `infra/persistent/` — VPC, subnets, security groups, RDS, ElastiCache, ECR. Applied once, left
     alone. Holds all data.
   - `infra/ephemeral/` — EKS, node pools, ALB. Destroyed nightly.

   If they share one state file, teardown feels risky → you avoid it → the cluster stays up → the
   credit is gone in 28 days. The split is what makes the habit sustainable.
2. Remote state in S3 with DynamoDB locking (both effectively free at this size).
3. **No NAT Gateway** (§1.2). Nodes in public subnets with tightly-scoped security groups; RDS and
   ElastiCache in private subnets reachable only from the node security group.
4. RDS `db.t4g.micro`, ElastiCache `cache.t4g.micro` to start — both free-tier sized.

**TEST.** `terraform plan` is clean and idempotent (a second `apply` changes nothing). Destroying
the ephemeral stack leaves the persistent stack untouched — **verify this explicitly before relying
on it**, since the whole cost model depends on it.

**DONE WHEN.** Both stacks apply cleanly, and ephemeral destroy provably leaves data intact.

---

### B3 — Migrate schema, push images

**STATUS:** PENDING
**Est:** 2 days · **Stage:** B · **Gate to Stage C**

**WHY.** Proves the data layer works before a cluster exists to blame for problems.

**IMPLEMENT.**
1. Run Alembic against RDS. Never edit an applied migration (root `CLAUDE.md`) — new revision if
   something's wrong.
2. Push the A6 image to ECR.
3. Move secrets from `.env` into K8s Secrets sourced from Terraform. `app/core/config.py` reads
   plain env vars, so **no application code changes** — this is purely a delivery-mechanism change.
4. Confirm a container running locally can reach RDS and ElastiCache through the VPC.

**TEST.** Local container against RDS + ElastiCache: `/health/ready` returns 200. Run a smoke subset
of the suite against RDS.

**DONE WHEN.** `/health/ready` is green against real AWS-managed data services.

---

### C1 — EKS + Karpenter on spot

**STATUS:** PENDING
**Est:** 1 week · **Stage:** C (metered, ~$0.15/hr) · **Blocks:** C2

**WHY Karpenter over Cluster Autoscaler.** Provisions nodes in ~40s vs. several minutes; picks
instance types to fit pending pods instead of scaling fixed groups; handles spot interruption
natively; and **consolidates underused nodes on its own** — that last property means it actively
reduces the bill rather than merely enabling growth.

**WHY spot.** 60–90% off on-demand, the biggest cost lever after switching things off. AWS can
reclaim with 2 minutes' notice, which is fine for dev and load testing — Karpenter drains pods
gracefully, and combined with A3's graceful shutdown the reclaim is invisible to users.

**IMPLEMENT.** EKS cluster in the ephemeral stack. Karpenter with a spot-first NodePool and
on-demand fallback, consolidation enabled. IRSA for pod-level AWS permissions.

**TEST.** Schedule a pod that doesn't fit existing capacity; assert Karpenter provisions a node in
under ~60s. Delete it; assert the node is consolidated away. **Then `terraform destroy` and confirm
billing stops** — verify this on day one, not after a surprise invoice.

**DONE WHEN.** Nodes appear on demand, disappear when idle, and destroy is verified to stop the meter.

---

### C2 — Helm chart, three deployments

**STATUS:** PENDING
**Est:** 1 week · **Stage:** C · **Blocks:** C3

**WHY Helm.** One chart, different values files. `values-dev.yaml` runs 2 pods; `values-loadtest.yaml`
runs 70. Swapping scale profiles with a flag is what makes repeated load testing cheap enough to
actually do.

**FILES.** `deploy/helm/` (**new**)

**IMPLEMENT.** Deployments for api / realtime / worker from the single A6 image with different
commands. Wire A3's probes: liveness → `/health/live`, readiness → `/health/ready`, plus
`preStop: sleep 15` and `terminationGracePeriodSeconds: 30`. Realtime pods need raised fd limits and
a longer termination grace period (open sockets take longer to drain). Resource requests/limits on
every container — Karpenter can't size nodes without requests.

**TEST.** `helm install` then `kubectl get pods` shows all three healthy. `helm upgrade` with a
changed image performs a rolling update with **zero dropped requests** under light load — this is
where A3 pays off.

**DONE WHEN.** All three deployments run and a rolling upgrade drops nothing.

---

### C3 — Ingress + PgBouncer + Cloudflare

**STATUS:** PENDING
**Est:** 4 days · **Stage:** C · **Blocks:** C4

**WHY.** The front door plus the database's shock absorber. PgBouncer as a pod does what RDS Proxy
does for ~$11–15/mo less.

**IMPLEMENT.** AWS Load Balancer Controller → ALB. Route `/ws` to the realtime service with sticky
sessions; everything else to the API service. PgBouncer Deployment in transaction mode (config
already proven locally in A7). Cloudflare in front for free TLS, DDoS protection, and edge caching
of public GET responses — confirm it proxies WebSockets correctly, it does by default but verify.

**TEST.** HTTP and WebSocket both work through the ALB. Connection count on RDS stays bounded while
pods scale — the same `pg_stat_activity` check from A2, now against real infrastructure.

**DONE WHEN.** Both protocols work end-to-end through Cloudflare, and DB connections stay flat as
pod count rises.

---

### C4 — Autoscaling (the actual deliverable)

**STATUS:** PENDING
**Est:** 4 days · **Stage:** C

**WHY.** Everything before this was preparation. This phase is the thing the roadmap exists for, and
**this is the 10k → 100k dial** referenced throughout §2.4.

**IMPLEMENT.**
1. **API — HPA on CPU**, target ~65%, `minReplicas: 2`, `maxReplicas: 70`. The 10k → 100k change is
   literally this one value.
2. **Realtime — scaled on active connection count**, exported as a custom metric (KEDA, or a
   Prometheus adapter). **Never CPU** — see §2.3. Use generous scale-down stabilization
   (~300s) so a brief connection dip doesn't sever thousands of live sockets.
3. **Workers — KEDA on arq queue depth, `minReplicaCount: 0`.** Scale-to-zero is a direct credit
   saving: idle workers cost nothing.
4. **Nodes — Karpenter** (done in C1), spot-first, consolidation on.
5. **PodDisruptionBudgets** on all three so consolidation and spot reclaim can never take down every
   replica simultaneously.

**TEST.**
- Ramp load; watch `kubectl get hpa -w` add API pods, then Karpenter add nodes.
- Stop load; watch pods scale down and nodes consolidate away.
- Enqueue arq jobs against zero workers; assert KEDA scales from 0 and the jobs drain.
- Hold 100 WebSocket connections, drop load elsewhere; assert realtime pods do **not** scale down
  and sever them.

**DONE WHEN.** All four behaviours are observed live. That's the roadmap's core claim demonstrated.

---

### C5 — Grafana Cloud observability

**STATUS:** PENDING
**Est:** 1 day · **Stage:** C · **Blocks:** D2

**WHY not self-hosted Prometheus.** It needs 3–4 pods and a real slice of a node — on a 3-node
cluster that means paying for a 4th node to watch the other 3. Grafana Cloud's free tier does the
job at zero cost and zero cluster footprint.

**IMPLEMENT.** Grafana Alloy/agent scraping into Grafana Cloud. Track **four things and ignore the
rest**: p95 latency, error rate, pod count, DB connections in use. The last is the early warning for
A2's failure mode.

**TEST.** All four metrics visible; kill a pod and see it reflected.

**DONE WHEN.** A single dashboard shows all four during a load test.

---

### D1 — k6 scenarios

**STATUS:** PENDING
**Est:** 4 days · **Stage:** D · **Blocks:** D2

**WHY.** A load test that hammers one endpoint proves nothing. Model actual behaviour: mostly feed
scrolling, periodic votes and reactions, occasional uploads, a long-lived WebSocket per user, and a
burst of challenge submissions near a window close (a genuine thundering-herd moment in this
product — see `.claude/memory/challenges.md`).

**FILES.** `loadtest/feed-scroll.js`, `loadtest/vote-burst.js`, `loadtest/websocket-hold.js`,
`loadtest/challenge-close.js` (all **new**)

**IMPLEMENT.** k6 — JS-scripted, native WebSocket support, runs from a laptop for 10k. Seed a
realistic dataset first: a 10-user database makes every query look fast and proves nothing. Mixed
scenario weighting ~70% feed reads, 20% votes/reactions, 5% uploads, 5% challenge/community writes.

**TEST.** Scenarios run against the local A7 Compose stack first, for free, before ever pointing
them at AWS.

**DONE WHEN.** All four scenarios run clean locally.

---

### D2 — 10k run

**STATUS:** PENDING
**Est:** 3 days · ~$2 · **Stage:** D · **Blocks:** D3

**WHY.** More important than the number it produces: you need to **watch** pods multiply and
Karpenter add nodes under real load. Until you've seen it, autoscaling is a config file you hope
works.

**IMPLEMENT.** Ramp to 10k over ~10 min, hold ~20 min, ramp down. Watch the C5 dashboard throughout.

**TEST / acceptance.** p95 under target, error rate <0.1%, autoscaling visibly engaged, DB
connections bounded. Record the **actual** req/s per pod and sockets per pod — these replace the
estimates in §2.4.

**DONE WHEN.** 10k sustained within acceptance thresholds, real numbers recorded.

---

### D3 — 50k burst

**STATUS:** PENDING
**Est:** 4 days · ~$5/run · **Stage:** D · **Blocks:** D4

**WHY.** Something will break, and it will be specific — expect the DB connection ceiling or a
single unindexed query, **not "everything."** Budget for 2–3 runs: the first finds a bottleneck, you
fix it, the second finds the next.

**IMPLEMENT.** Distributed k6 (a laptop won't generate 50k). Scale via `values-loadtest.yaml`.
**Destroy the cluster immediately after each run** — this is the most expensive activity in the
roadmap.

**TEST / acceptance.** Same thresholds as D2. Document each bottleneck found and its fix in §2.5,
which is where that table gets its real entries.

**DONE WHEN.** 50k sustained, or the blocking bottleneck is documented with a concrete fix plan.

---

### D4 — Record measured numbers

**STATUS:** PENDING
**Est:** 2 days · **Stage:** D · **Closes the roadmap**

**WHY.** Six months from now, under real traffic pressure, you want a document that says "to serve
50k, set these four values" — not a memory of having once tested something.

**IMPLEMENT.**
1. Create `/.claude/memory/scaling.md` per the memory-system rules in root `CLAUDE.md`: measured
   req/s per pod, sockets per pod, DB connections at peak, the exact values to change for each tier,
   and every bottleneck found with its fix.
2. **Replace the estimates in §2.4 of this file with the measured numbers** and note the date.
3. Update `/.claude/memory/redis-arq-infra.md` — Redis now also carries WS pub/sub and presence.
4. Update `/.claude/memory/messaging.md` and `meme-sending.md` for the A1 delivery-semantics change.
5. Set **Global status** at the top of this file to reflect completion.

**DONE WHEN.** `scaling.md` exists, §2.4 holds measured rather than estimated numbers, and the
affected memory files are current.

---

## 4. Conventions for future sessions

- **Update the phase's `**STATUS:**` line in the same changeset that implements it.** A stale status
  is worse than no roadmap — the next session will trust it.
- Set `IN PROGRESS` when starting, and leave a dated note under the phase if you stop partway, so
  the next session knows exactly where the seam is.
- **Phases within a stage are ordered by dependency, not preference.** A1 genuinely blocks
  everything; A7 genuinely gates AWS spend. Don't reorder without noting why.
- **Never skip a phase's TEST section.** Every one of them exists because that phase has a specific,
  known failure mode that only shows up under concurrency or scale.
- New/changed backend logic ships with tests, per `backend/CLAUDE.md`. That rule is not suspended
  for infrastructure work.
- Secrets never enter this repo — not in Terraform files, not in Helm values, not in Dockerfiles.
  Root `CLAUDE.md` applies.
- When a phase changes a documented feature's behaviour, update that feature's
  `/.claude/memory/<feature>.md` in the same changeset.

---

*Drafted 2026-08-21. Capacity figures in §2.4 are estimates until D4 replaces them with
measurements. Companion visual summary: the published Scaling Roadmap artifact.*
