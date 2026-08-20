# Data Protection Posture

SecurityFeatures.md F-12. The proportionate control for this system's classification
(single-tenant, ASVS L2, personal data + private DMs, no deployment target committed to
this repo yet) is **not** application-level field encryption — it's the standard set of
managed-infrastructure controls below. This file is a checklist to configure and verify
against the real deployment once one exists, and to re-verify whenever the deployment
changes. It is **not** a compliance certification.

## Database (PostgreSQL)

- [ ] Encryption at rest enabled at the managed provider level (e.g. RDS/Cloud SQL/Neon/
      Supabase all offer this by default or as a one-setting toggle — verify it's on,
      don't assume).
- [ ] TLS required for client connections (`sslmode=require` or stricter in
      `DATABASE_URL`). Reject plaintext connections at the server if the provider
      supports it.
- [ ] Backups are encrypted and access-controlled (same provider setting as the primary
      volume in most managed offerings — verify separately, it is sometimes a distinct
      toggle).
- [ ] Not publicly reachable — private network / VPC-only, or an IP allowlist limited to
      the application's own hosts. No `0.0.0.0/0` inbound rule.
- [ ] The application's DB role has least-privilege grants (not a superuser), separate
      from any migration/admin role.

## Cache / rate-limit / OTP store (Redis)

- [ ] `REDIS_URL` includes a password (`.env.example` currently ships a passwordless
      example URL for local dev — that must not reach a real deployment as-is).
- [ ] TLS on the connection if the provider offers it (`rediss://`), especially since
      Redis now also holds short-lived OTP hashes (F-1/F-2) and WS tickets (M-1) —
      low-sensitivity individually, but still worth the same network protection as
      everything else in the trust boundary.
- [ ] Not publicly reachable, same private-network rule as Postgres.

## Media storage (Cloudinary)

- [ ] Confirm whether uploaded media (memes, avatars, templates, community icons/
      banners) is encrypted at rest — this is provider-side, not application-controlled;
      check the Cloudinary account's own settings/plan.
- [ ] Confirm the API key's scope (ideally upload-only, not full-account) — tracked
      separately under F-8.
- [ ] Confirm whether a friends-only or private-community meme's image URL is guessable/
      enumerable, or merely unguessable-but-public — this determines whether the
      audience model (Friends/Public/Community) is actually enforced at the storage
      layer or only at the API layer. Flagged in SecurityIssues.md as needing manual
      verification; still unresolved.

## Transport (the API itself)

- [ ] TLS 1.2+ with a publicly trusted certificate, HSTS (the app already sends the
      `Strict-Transport-Security` header unconditionally — see `main.py` — but that only
      matters once real TLS termination exists in front of it).
- [ ] `--forwarded-allow-ips` set correctly if deployed behind a load balancer/reverse
      proxy (SecurityIssues.md I-4) — otherwise rate limiting collapses to a single
      global bucket.

## Deliberately not done: application-level field encryption

Encrypting `messages.body` (or other fields) at the application layer was considered and
rejected as disproportionate for this system:

- It would break search/pagination over that data without significant extra work.
- It introduces a key-management burden this project has no story for yet (see F-8).
- It defends against a threat model — a database read by someone who already has
  application-server-level access — that in most realistic breach scenarios already
  implies broader compromise than field encryption meaningfully mitigates.
- The controls above (encryption at rest, access-controlled backups, network isolation)
  cover the realistic threat: a stolen backup, a leaked snapshot, or an exposed
  unauthenticated database — without the ongoing engineering cost of field-level crypto.

Revisit this decision only if the data classification changes (e.g. health or financial
data enters scope) — nothing in the current schema warrants it.

## Status

**Everything above is unverified** — no deployment configuration exists in this
repository to check any box against. This file exists so the checklist itself doesn't
have to be re-derived later; go through it item by item once a real hosting target is
chosen.
