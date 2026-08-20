# Security Features — Meme Platform

_What is not implemented, and should be._ Companion file: `.claude/memory/SecurityIssues.md` (what is implemented, and wrong). No item appears in both; cross-references are by ID.

- **Audit date:** 2026-08-18
- **Scope:** whole repository at commit `89c717f` (master, clean tree) — `backend/`, `frontend/`, root config.
- **Lens:** ASVS 5.0 chapter map, read as a catalogue of controls this system's class should hold, per the `owasp-security` skill.

**Every recommendation below derives from the classification. If the classification is wrong, the recommendations are wrong.** Correct it first, then re-read.

## System classification (verbatim from `SecurityIssues.md` Step 2)

| Axis | Finding | Evidence |
|---|---|---|
| **2.1 Access model** | **Public self-serve.** Open, unauthenticated, unverified registration; no invite flow, no admin provisioning, no allowlist | `backend/app/routers/auth.py:15` `POST /auth/register`; `frontend/src/app/register.tsx` |
| **2.2 Actors** | (a) Anonymous internet — reaches `/auth/register`, `/auth/login`, `/health`, `/docs`, `/openapi.json` only; (b) **Authenticated user** — free, unverified, creatable in unlimited quantity; **this is the realistic attacker**; (c) Community owner — elevated inside their own community only; (d) arq worker — full DB. **There is no platform admin/staff role at all** (`MembershipRole` is `owner`/`member`; `User` has no `is_admin`) | `backend/app/core/deps.py:17`; `backend/app/models/community_membership.py`; `backend/app/models/user.py` |
| **2.3 Data classes** | Credentials (bcrypt hashes, `users.hashed_password`) · **contact details (email, `users.email`)** · **private user-to-user communications (`conversations`, `messages` — DMs between friends)** · user-generated public content (`memes`, `comments`, `meme_containers`, `container_comments`, `templates`, community icons/banners — all images on Cloudinary) · device identifiers (`push_tokens`) · behavioural data (`meme_views`, `container_views`, `meme_votes`). **Not present:** payment, financial, health, biometric, government ID, precise location | `backend/app/models/*.py` (23 models reviewed) |
| **2.4 Tenancy** | **Single-tenant application with in-app community scoping.** Not multi-tenant SaaS. Isolation key is `community_id`, enforced server-side by `require_active_membership` and `meme_visibility_clause` | `backend/app/services/communities.py:49`; `backend/app/services/memes.py:27` |
| **2.5 Implied regulation** (requires legal confirmation — this is not a compliance verdict) | GDPR / UK GDPR and CCPA/CPRA are **implied** by email + DM + UGC processing of any EU/UK/CA user, with three third-party processors (Cloudinary, Groq, Expo). COPPA / UK AADC are **plausibly** implied — a meme platform with open signup and no age gate will attract minors. **Not implied:** PCI-DSS, HIPAA | `backend/app/models/user.py`, `message.py`; absence of any DOB/age field |
| **2.6 Implied ASVS level** | **L2.** Personal data (emails), private communications, and public UGC at consumer scale. Not L3 — no financial, health, or safety-critical function | ASVS 5.0 level definitions |

**Confidence: high on 2.1–2.4, medium on 2.5–2.6.** Assumptions: (a) the platform is intended to launch publicly with real users rather than remain a closed portfolio demo — **if it stays a personal demo, every EXPECTED-band gap below drops to RECOMMENDED or disappears**; (b) no under-13 audience is deliberately targeted; (c) TLS termination will be handled by a managed edge.

---

## Executive summary

The build is feature-complete on the product axis and close to empty on the account-lifecycle and safety axes. Three absences change this system's posture more than anything else:

1. **There is no trust & safety layer of any kind (F-5).** A public platform that accepts image uploads, hosts public comments, and carries DMs has no report button, no block, no moderation queue, no takedown path — and no admin role that could action one even manually. For this system's class that is the single largest gap, and it is a legal exposure as much as a security one.
2. **There is no account recovery and no email verification (F-1, F-2).** A forgotten password is permanent account loss, and accounts are free and unlimited — which is the root cause of `SecurityIssues.md` M-2 and M-3 as well.
3. **There is no way for a user to delete their account or their content, and no way to export their data (F-3, F-4).** Under the GDPR/CCPA surface implied by 2.5, those are not optional once real users exist.

Beneath those, **there is no security logging anywhere in the API request path (F-6)** — so none of the attacks described in `SecurityIssues.md` would leave a trace.

| Band | Count |
|---|---|
| EXPECTED | 6 |
| RECOMMENDED | 7 |
| MATURITY | 4 |

---

## Applicability note

Domains from the Step 4 sweep assessed and ruled **not applicable** to this system. Listed so a later reader knows they were considered, not overlooked.

- **Payment / PCI-DSS controls** — no payment data class (2.3); no payment model, no Stripe/billing integration anywhere in the schema or dependencies.
- **Health (HIPAA), biometrics, government ID, precise location, financial data** — none of these classes are stored or processed (2.3, full 23-model schema review).
- **Multi-tenant isolation architecture** — not applicable: the system is single-tenant (2.4). Community scoping is an in-app permission and is already correctly enforced (`require_active_membership`, `meme_visibility_clause`); there is no tenant-per-customer boundary to build.
- **OAuth / OIDC hardening (ASVS V10)** — no federated login is implemented, so there is nothing to harden. Adding it is noted as an *alternative* under F-7, not required on its own.
- **WebRTC (ASVS V17)** — no real-time audio/video anywhere.
- **Agentic AI controls (ASI01–ASI10)** — not applicable: no agent, no tool-calling, no planner, no persistent memory, no inter-agent communication, no MCP server. `Roadmap_Agentic_AI.md` is a plan. Re-run this domain when any of it ships.
- **RAG / vector-store controls (LLM02, LLM04, LLM08)** — not applicable: no vector store, no retrieval, no embeddings, no fine-tuning, no training data. The only LLM use is a single-turn stateless completion.
- **Model supply chain (LLM03)** — minimally applicable and already adequate: the model is pinned by name (`groq_model = "llama-3.1-8b-instant"`) against a hosted API; there are no downloaded weights or adapters to verify.
- **Under-13-specific controls beyond age assurance** — no evidence the product deliberately targets children; the proportionate control is an age gate (F-13), not a full COPPA parental-consent apparatus.

---

## EXPECTED

### F-1 — Email/identity verification at registration
**Band:** EXPECTED · **ASVS 5.0:** V6 (Authentication — registration integrity), supports 6.3.1

**Why this system needs it.** 2.1 is public self-serve and 2.2 names the authenticated user as the realistic attacker. Nothing distinguishes a real person from the 300th scripted account. Verification is also the prerequisite for F-2 (recovery needs a proven address) and for any future ban to mean anything.

**Confirmed absent.** No `is_verified`/`email_verified_at` column on `User` (`backend/app/models/user.py` — 6 columns total). No verification-token model in `app/models/`. No email provider anywhere: repo-wide search for `smtp`, `sendgrid`, `ses`, `mailgun`, `postmark`, `resend` returns nothing in code, `requirements/*.txt`, or config. `register_user` (`app/services/auth.py:15`) issues a fully privileged JWT immediately on insert.

**Risk of the gap.** An attacker registers unlimited accounts at 5/minute per IP and uses them to (a) multiply every per-user rate limit — including the billed Groq endpoint (`SecurityIssues.md` M-2); (b) farm votes and views to control leaderboards, Meme-of-the-Day, and challenge outcomes, which `services/scoring.py` itself notes it does not defend against; (c) harass a user through friend requests and DMs from an endless supply of identities that cannot be blocked (F-5) or banned. Separately, an unverified address means the platform cannot reach its own users for a breach notification or a password reset.

**What to build.** A `verified_at` column plus a signed, single-use, expiring verification token emailed on registration. Gate the abuse-relevant capabilities — AI captions, voting, DMs, community creation — on verification rather than gating login itself, so the first-run experience survives. Use a managed transactional email provider (Resend, Postmark, SES); do not hand-roll SMTP.

**Dependencies.** An email provider and a verified sending domain. Nothing else — the `User` model change is one column and one migration.

**Confidence:** Confirmed absent.

---

### F-2 — Password reset / account recovery
**Band:** EXPECTED · **ASVS 5.0:** V6 (Authentication — credential recovery) · **OWASP:** A07:2025

**Why this system needs it.** 2.1 is public self-serve with password-based local credentials (`users.hashed_password`) and 2.2 confirms there is **no admin or support role** that could reset a password out of band. There is no second factor and no federated identity to fall back on.

**Confirmed absent.** `backend/app/routers/auth.py` contains exactly five routes — `register`, `login`, `logout`, `me`, `me/badges`. There is no reset, no forgot-password, no change-password, and no password-reset-token model in `app/models/`. Confirmed by enumerating every route in every router.

**Risk of the gap.** Any user who forgets their password permanently loses their account, their meme history, their community memberships, their badges, and their DM history — with no path for anyone to help them, because no privileged actor exists. A user whose credentials are stuffed successfully (`SecurityIssues.md` M-3) also has no way to regain control: they cannot change the password the attacker now knows, and `POST /auth/logout` requires the token they no longer control. For a consumer product this is a launch blocker on product grounds before it is one on security grounds.

**What to build.** Standard flow: `POST /auth/password-reset-request` (always returns 200 regardless of whether the email exists, to avoid re-introducing the enumeration oracle of `SecurityIssues.md` L-1), a single-use token with a short TTL stored hashed, `POST /auth/password-reset-confirm` that sets the new password **and bumps `token_version`** so every existing session dies. Add an authenticated `POST /auth/change-password` requiring the current password, also bumping `token_version`. Rate-limit both request endpoints hard.

**Dependencies.** F-1's email provider. `token_version` already exists and does exactly the right thing.

**Confidence:** Confirmed absent.

---

### F-3 — Account deletion, deactivation, and user data export
**Band:** EXPECTED · **ASVS 5.0:** V14 (Data Protection), 7.4.2 · **Implied regulation:** GDPR Arts. 15 & 17, CCPA/CPRA

**Why this system needs it.** 2.3 holds email addresses, private DMs and user-generated content; 2.5 implies GDPR/CCPA for any EU/UK/CA user. 2.2 confirms no admin exists to service such a request manually.

**Confirmed absent.** Enumerated every mutation route: the only `DELETE` endpoints are `challenges/duels/{id}/decline`, `challenges/{id}/decline`, `communities/{id}/membership`, `communities/{id}/join-requests/{id}`, `friends/{id}`, and `notifications/push-token`. **None touches `users`.** No `deleted_at`/`is_active` column on `User`. No export endpoint of any kind. No soft-delete mixin in `app/db/base.py` despite `backend/CLAUDE.md` describing one.

**Risk of the gap.** A user who wants to leave cannot; their email, DMs, and content remain indefinitely. A DSAR or erasure request cannot be serviced within the statutory window by any mechanism short of a manual SQL session. Note the knock-on: ASVS 7.4.2 ("all active sessions terminate when an account is disabled or deleted") is *unsatisfiable* here, not merely unimplemented, because accounts cannot be disabled at all. There is also no way to suspend an abusive account — which is what makes F-5's moderation gap unfixable without this one.

**What to build.** (a) `is_active`/`deactivated_at` on `User`, checked in `get_current_user` alongside the existing `token_version` comparison — this alone gives the ban capability F-5 needs, cheaply; (b) `DELETE /auth/me` with a grace period, cascading through `memes` → Cloudinary asset deletion → `messages`, and documenting what is retained and why (e.g. the other participant's copy of a DM); (c) `GET /auth/me/export` producing a JSON bundle of the user's rows. Decide and document the deletion policy for DMs before writing the code — it is a product decision, not a technical one.

**Dependencies.** None technically. Deletion propagation to Cloudinary needs the `image_public_id` already stored on `Meme` and `Template` (it is).

**Confidence:** Confirmed absent.

---

### F-4 — Author-initiated content deletion and editing
**Band:** EXPECTED · **ASVS 5.0:** V8 (Authorization — data-level control by the owning principal)

**Why this system needs it.** 2.3 includes user-generated public content and image uploads on a public self-serve platform (2.1). Users post things they immediately regret, misfire an audience selection, or upload the wrong image.

**Confirmed absent.** No `DELETE` or `PATCH`/`PUT` route exists for `Meme`, `Comment`, `MemeContainer`, `ContainerComment`, `Template`, or `Community` (full route enumeration across all 14 routers). There is also no profile-edit endpoint — `bio` and `avatar_url` exist on the model and in `UserOut` but nothing can set them.

**Risk of the gap.** Content on this platform is permanent and immutable by construction. A user who accidentally posts a private photo to `public` audience cannot remove it. A comment containing another person's phone number or address cannot be taken down by its author, by the affected party, or by anyone else — because F-5 provides no path either. Combined, F-4 and F-5 mean **nothing posted to this platform can ever be removed by any mechanism the application provides**.

**What to build.** `DELETE /memes/{id}` and `DELETE /memes/{id}/comments/{id}` (and container equivalents) with an ownership check reusing the existing pattern, soft-delete so feeds and DM references degrade gracefully rather than 500 (`MessageOut.meme` already tolerates a null meme — the comment there anticipates exactly this), plus Cloudinary asset cleanup via the stored `image_public_id`. Add `PATCH /auth/me` for `bio`/`avatar_url`. Community owners should be able to remove content from their own community's feed.

**Dependencies.** None. The ownership-check helpers already exist and are used correctly elsewhere.

**Confidence:** Confirmed absent.

---

### F-5 — Trust & safety: reporting, blocking, moderation, takedown
**Band:** EXPECTED · **ASVS 5.0:** V2 (Business Logic), V8 · **Implied regulation:** platform-liability regimes (EU DSA, UK OSA), NCII/CSAM takedown obligations

**Why this system needs it.** Every trigger for this domain is present: user-generated public content, arbitrary image upload to a public feed, public comments on other users' posts, **private user-to-user messaging (2.3)**, and public self-serve signup (2.1) so anyone can reach any of it. And 2.2 confirms **there is no platform admin or moderator role that could act even manually**.

**Confirmed absent.** Searched the full schema, all routers and all services for `report`, `block`, `mute`, `moderat`, `ban`, `suspend`, `flag`, `takedown`, `appeal` — zero matches outside unrelated words (`banner_url`). No `Report` model, no `Block` model, no moderation queue, no content-safety scan on upload (`services/media.py` validates content-type and size only), no admin surface anywhere in the frontend.

**Risk of the gap.** A user who is being harassed through DMs by a friend, or targeted in comments, has no block, no report, and no one to escalate to — their only recourse is to remove the friendship, which the harasser can immediately re-request (`SecurityIssues.md` L-8 notes that endpoint is also unthrottled). Worse: if illegal imagery is uploaded to the public feed, the platform has **no mechanism to remove it** (F-4) and **no account to suspend** (F-3) — the operator would be reduced to direct database and Cloudinary intervention while the content stays live. Sybil accounts (F-1) make any informal countermeasure futile.

**What to build, in order of value per unit of effort:**
1. **Block** — a `blocks` table and one clause added to `meme_visibility_clause`, `are_friends`, and the messaging participant check. Purely user-controlled, needs no staff, and is the single highest-value item in this file.
2. **Report** — a `reports` table plus `POST /memes/{id}/report`, `.../comments/{id}/report`, `/users/{id}/report`. Even with no one reading them on day one, capturing reports from launch is what makes moderation possible later; retrofitting reports after an incident is far worse.
3. **Suspend/ban** — depends on F-3's `is_active` column and one check in `get_current_user`.
4. **A minimal internal moderation surface** — the first thing the system's missing admin role should exist for. An authenticated staff-only router listing open reports with hide/suspend actions is sufficient; it does not need a UI.
5. **Automated CSAM/NCII scanning on upload** — Cloudinary offers add-on moderation; enabling it is configuration, not code, and it is the proportionate answer for a platform this size.

**Dependencies.** Items 3 and 4 depend on F-3 (`is_active`) and on introducing a staff role, which does not exist today. Items 1, 2 and 5 have no dependencies and can ship immediately.

**Confidence:** Confirmed absent.

---

### F-6 — Security logging, alerting, and detection
**Band:** EXPECTED · **ASVS 5.0:** V16 — 16.2.1, 16.2.2, 16.3.1, 16.3.2, 16.3.4, 16.4.1, 16.4.2, 16.4.3, 16.5.1 (**the entire chapter is L2+, and this system is L2**)

**Why this system needs it.** 2.6 places the system at L2, where all of V16 begins. 2.2's realistic attacker is an ordinary authenticated user, and 2.3 includes private communications — meaning an account takeover has real consequences that someone needs to be able to detect and reconstruct.

**Confirmed absent.** No logging configuration anywhere in `app/main.py` or `app/core/`. Repo-wide search for `logging.getLogger` returns **five hits, all in `app/workers/` and `app/integrations/expo_push.py`** — none in any router, service, or auth path. No `sentry-sdk`, `structlog`, or `opentelemetry` in any requirements file. No request-ID or correlation-ID middleware. No log shipping. Failed logins, failed authorization (`CommunityAccessDeniedError`, `NotConversationParticipantError`, etc.), rate-limit rejections, and password changes all pass silently.

**Risk of the gap.** Every attack in `SecurityIssues.md` is invisible: the distributed credential stuffing of M-3 generates no record; the 300-account registration burst of M-2 generates no record; a successful takeover leaves no trail to distinguish the attacker's session from the victim's. If a breach were suspected there would be no data with which to scope it — no answer to "when did this start", "which accounts", "what did they reach". Note that this is also what makes F-5's reports actionable or not: a report with no surrounding audit trail is very hard to adjudicate.

**What to build.** A structured JSON logger configured once in `main.py`, plus a request-ID middleware. Emit a security event — with when/where/who/what and a synchronized clock (16.2.1–16.2.2) — for: login success and failure, registration, logout, password change/reset, every `DomainError` subclass carrying 401/403, rate-limit rejection, and unhandled exceptions. Return a generic message with a correlation ID to the user and keep the detail in the log (16.5.1). **Never log the JWT, the password, or DM bodies** (16.2.5) — worth stating explicitly given `SecurityIssues.md` M-1 already puts tokens into URLs. Ship logs off-box (16.4.3); a managed sink such as Sentry or Better Stack is the sane default rather than a self-hosted stack at this size.

**Dependencies.** None. This is additive and can land today.

**Confidence:** Confirmed absent.

---

## RECOMMENDED

### F-7 — Multi-factor authentication (or federated login as an alternative)
**Band:** RECOMMENDED · **ASVS 5.0:** 6.3.3 (**L2 — formally required at this system's level**)

**Why this system needs it.** 2.3 includes private user-to-user communications, and 2.2 establishes there is no admin who can help after a takeover; F-2 means there is currently no recovery path either. ASVS formally requires MFA at L2, which is the level 2.6 assigns. Banded RECOMMENDED rather than EXPECTED only because optional 2FA is standard-for-class rather than universal among consumer meme apps — the ASVS tension is deliberate and stated here so it is a conscious decision, not an oversight.

**Confirmed absent.** No TOTP secret, recovery-code, or WebAuthn credential column on `User`; no `pyotp`/`webauthn` dependency; no step-up challenge on any route.

**Risk of the gap.** A single stolen or stuffed password (M-3) is complete, unrecoverable account compromise: the attacker reads the victim's entire DM history, posts as them, and — since `logout` requires the token the victim no longer controls and there is no password reset — the victim cannot evict them.

**What to build.** Optional TOTP enrolment with hashed single-use recovery codes; require re-authentication to disable it. **Alternative worth considering first:** adding "Sign in with Google/Apple" would remove local password handling from the attack surface entirely for most users and delegate MFA to the provider — likely a better return than building TOTP, given the frontend is already Expo (which has first-class support) and F-1's email-verification burden would largely disappear too.

**Dependencies.** F-2 should land first — MFA without a recovery path makes permanent lockout *more* likely, not less.

**Confidence:** Confirmed absent.

---

### F-8 — Secrets and key management
**Band:** RECOMMENDED · **ASVS 5.0:** V11 (Cryptography — key management), V13 (Configuration)

**Why this system needs it.** One environment file holds the JWT signing secret, the database URL with credentials, and full-privilege Cloudinary and Groq keys (`backend/app/core/config.py:8-20`). 2.5's third-party processors mean two of those keys reach outside the trust boundary.

**Confirmed absent.** No managed secret store, no rotation procedure, no key-versioning scheme, no separation of build-time and runtime credentials. `.env.example` ships `JWT_SECRET=changeme` — and the README instructs the reader to copy it verbatim (`README.md`, backend setup section), which is exactly how a placeholder reaches production. There is also no documented dev/prod key separation; `.claude/memory/ai-caption.md` records the real Groq key living in the developer's local `.env`.

**Risk of the gap.** If `JWT_SECRET` is ever weak, guessed, or left as `changeme`, an attacker forges a JWT for any `sub` and `tv` and becomes any user — that would be a CRITICAL, and the only thing standing between the system and it is operator discipline. If any key leaks there is no rotation runbook: rotating `JWT_SECRET` force-logs-out every user (workable as break-glass, but nobody has decided that), and rotating the Cloudinary secret is untested.

**What to build.** Move runtime secrets into the deployment platform's secret store or a managed KMS. Validate at startup that `JWT_SECRET` is not `changeme` and has ≥256 bits of entropy — **fail closed**, do not warn. Change `.env.example` to `JWT_SECRET=<generate with: python -c "import secrets;print(secrets.token_urlsafe(64))">` so the copy-paste path produces a real secret. Scope the Cloudinary key to upload-only and set a provider-side spend cap on the Groq key. Write down the rotation procedure for each of the four.

**Dependencies.** None.

**Confidence:** Confirmed absent (rotation policy and startup validation); the deployment secret store is **needs verification** — no deployment configuration exists in the repository to inspect.

---

### F-9 — Per-principal LLM consumption budget and cost alerting
**Band:** RECOMMENDED · **LLM Top 10:** LLM10 (Unbounded Consumption) · **ASVS 5.0:** V2 (Business Logic limits) · **Related:** `SecurityIssues.md` M-2, M-4

**Why this system needs it.** 2.1's free unlimited accounts sit directly in front of a metered third-party API billed to the operator.

**Confirmed absent.** The only ceiling anywhere is `@limiter.limit("15/minute")` per account (`routers/ai_caption.py:14`) and `max_tokens=60` per call. No daily cap, no monthly cap, no global platform ceiling, no token accounting, no spend alert, no circuit breaker. Confirmed by reading `services/ai_caption.py` and `integrations/llm_client.py` in full.

**Risk of the gap.** Denial of wallet: 300 scripted accounts sustain ~4,500 billed calls/minute (M-2's arithmetic). The operator's first signal is the invoice or a hard provider cutoff that takes the feature down for every real user.

**What to build.** A Redis counter per account per UTC day and one platform-wide daily counter, both checked in `services/ai_caption.py` before `enqueue_job`; return a clean 429 on either. Emit a metric on the global counter and alert at 50% of the expected daily volume — **treat a cost anomaly as a security signal, not a billing one.** A hard provider-side spend cap on the Groq key (F-8) is the backstop if the application logic is ever bypassed.

**Dependencies.** None — Redis is already wired for rate limiting and leaderboard caching.

**Confidence:** Confirmed absent.

---

### F-10 — Session visibility and granular revocation
**Band:** RECOMMENDED · **ASVS 5.0:** V7 — 7.2.4, 7.4.1, 7.4.2 · **Related:** `SecurityIssues.md` M-7

**Why this system needs it.** 2.3 includes private communications, and the token lifetime is 24 hours (`config.py:12`) with no server-side session record at all. `token_version` gives exactly one revocation granularity: all sessions, all devices, at once.

**Confirmed absent.** No `sessions` or `refresh_tokens` table; no device or user-agent recorded anywhere; no per-session revoke endpoint; no "active sessions" surface in the frontend. `token_version` (`models/user.py`) is the entire mechanism.

**Risk of the gap.** A user who suspects one device is compromised can only nuke every session on every device — and today cannot even do that, because the client never calls the endpoint (M-7). There is no way to see *that* an unfamiliar session exists, which is how most users discover a takeover in the first place. A 24-hour non-revocable window also amplifies M-1 (token in URL) and H-2 (token over cleartext): both leak a token that stays live for a full day.

**What to build.** Short-lived access tokens (15–30 min) plus rotating refresh tokens held server-side, one row per device with `created_at`, last-seen, and a coarse user-agent. Add `GET /auth/sessions` and `DELETE /auth/sessions/{id}`, and keep `token_version` as the "log out everywhere" break-glass. This is a real refactor — worth doing before a large user base exists, not urgent before that.

**Dependencies.** Fix M-7 first; it is a five-line change that delivers most of the immediate value.

**Confidence:** Confirmed absent.

---

### F-11 — Automated security gate in the build pipeline
**Band:** RECOMMENDED · **ASVS 5.0:** V15 (Secure Coding and Architecture) · **OWASP:** A03:2025, A08:2025 · **Related:** `SecurityIssues.md` M-5, L-6

**Why this system needs it.** The backend has 16 unpinned direct dependencies (M-5) and the frontend tree carries 31 known-vulnerable transitive packages (L-6). There is no root `.gitignore` (`SecurityIssues.md` I-2), so a stray secret is one `git add` away from history.

**Confirmed absent.** **No CI exists at all** — no `.github/workflows`, no `.gitlab-ci.yml`, no Jenkinsfile, no CircleCI config, nothing. Therefore no dependency scanning, no secret scanning, no SAST, no SBOM, and no automatic enforcement that the 145-test backend suite passes before a change lands.

**Risk of the gap.** A malicious dependency release, a newly disclosed CVE, or an accidentally committed API key all reach `master` — and a deployment — with nothing in the path to stop them. Recovery from a committed secret requires history rewriting plus rotation of every key in `config.py`.

**What to build.** One GitHub Actions workflow on push and PR: `pip-audit` (after M-5's lockfile lands), `npm audit --audit-level=high`, a secret scanner (gitleaks or GitHub's own), `ruff` and `pytest` for the backend, `tsc --noEmit` and `expo lint` for the frontend. Enable Dependabot. Generate an SBOM (`cyclonedx-py`, `cyclonedx-npm`) as a build artefact — that is what makes the next "are we affected by X?" answerable in minutes.

**Dependencies.** M-5's lockfile makes `pip-audit` meaningful; everything else works today.

**Confidence:** Confirmed absent.

---

### F-12 — Encryption at rest and a documented data-protection posture
**Band:** RECOMMENDED · **ASVS 5.0:** V14 (Data Protection) · **Implied regulation:** GDPR Art. 32

**Why this system needs it.** 2.3 holds private user-to-user communications, and `messages.body` is a plain text column read straight from Postgres.

**Confirmed absent.** No encryption at rest is configured or documented for Postgres, Redis (which caches leaderboard pages and rate-limit state), or Cloudinary assets. `.env.example` shows `REDIS_URL=redis://localhost:6379/0` with no password and no TLS. No deployment configuration exists in the repository to verify any of this against.

**Risk of the gap.** A stolen backup, a snapshot left world-readable, or a compromised host exposes every DM in the system in plaintext, alongside every email address. Under GDPR Art. 32 this is the "appropriate technical measures" question, and the answer today is documented nowhere.

**What to build.** The proportionate answer is **not** application-level field encryption — it is a managed Postgres with encryption at rest enabled, encrypted and access-controlled backups, TLS on the Postgres and Redis connections, a Redis password, and private-network-only access for both. Write it down as a one-page data-protection note so it is verifiable rather than assumed. Application-level encryption of `messages.body` is deliberately **not** recommended (see *Deliberate omissions*).

**Dependencies.** None; this is a deployment decision.

**Confidence:** Needs verification — the controls may already be provided by the hosting platform, but no deployment configuration exists in the repository to confirm either way.

---

### F-13 — Age assurance and privacy transparency
**Band:** RECOMMENDED · **ASVS 5.0:** V14 · **Implied regulation (2.5):** COPPA, UK AADC, GDPR Arts. 13–14

**Why this system needs it.** 2.1 is public self-serve with no age gate, and 2.5 notes a meme platform plausibly attracts minors. Independently, the app already transmits user data to three third-party processors (Cloudinary for all media, Groq for caption context, Expo for push) with no disclosure to the user.

**Confirmed absent.** No date-of-birth or age field on `User`; no age gate in the registration screen (`frontend/src/features/auth/RegisterScreen.tsx`); no privacy policy, terms of service, consent record, or processor disclosure anywhere in the repository or the app.

**Risk of the gap.** Under-13 users sign up freely and their email addresses, DMs and images are processed with no parental consent — a COPPA exposure, and a reputational one given F-5 provides no protective controls for them either. Separately, GDPR Art. 13 transparency obligations are unmet from the first EU user onward: nobody is told their caption text is sent to Groq or their images to Cloudinary.

**What to build.** A date-of-birth or 13+ attestation at registration, stored, with a neutral screen for users below the threshold. A privacy policy and terms accessible from the app, naming each processor and what data it receives, with acceptance recorded at registration. Both are small; the writing is the work, not the code.

**Dependencies.** None.

**Confidence:** Confirmed absent.

---

## MATURITY

### F-14 — Log retention, off-box shipping, and an incident runbook
**Band:** MATURITY · **ASVS 5.0:** 16.4.2, 16.4.3 · **Depends on:** F-6

Once F-6 emits security events, they need somewhere tamper-resistant to live, a retention period aligned to the DSAR/breach-notification window, and alerting thresholds (repeated auth failures per account, registration-rate spikes, LLM cost anomalies from F-9). Pair with a short written runbook: who is called, how a user is suspended (F-3), how `JWT_SECRET` is rotated (F-8), how affected users are notified. Not a gap today because there are no logs to ship and no users to notify — becomes one the day either changes.

### F-15 — Backup, restore verification, and deletion propagation
**Band:** MATURITY · **ASVS 5.0:** V14 · **Depends on:** F-3

An untested backup is not a backup. Once F-3 exists, deletion has to propagate to backups, to Cloudinary assets (via the stored `image_public_id`), and to any log/cache copy — otherwise "deleted" is a UI state rather than a fact. Schedule a restore drill.

### F-16 — Abuse and anomaly detection on the scoring engine
**Band:** MATURITY · **OWASP:** A06:2025 · **Depends on:** F-1, F-6

`services/scoring.py`'s own docstring is explicit: *"Abuse-resistance is deliberately light for now — no unique-view dedup, no voter-trust weighting. Revisit if farming appears."* That is a sound call for a pre-launch product and is recorded here rather than re-flagged as a bug. Once F-1 makes accounts costly and F-6 makes behaviour visible, add voter-trust weighting, coordinated-voting-ring detection, and alerting on implausible score velocity. Views are already deduplicated per `(meme, user)`, which is a good foundation.

### F-17 — Third-party integration hardening
**Band:** MATURITY · **OWASP:** A03:2025, A08:2025

The Instagram oEmbed fetcher is currently a stub (`integrations/instagram_oembed.py`) that makes no outbound request. When it becomes a real HTTP call it introduces an SSRF and indirect-injection surface that does not exist today: restrict it to Instagram's Graph API host with an allowlist, disable redirect-following, set a timeout and a response-size cap, and treat the returned title/thumbnail as untrusted input before storing or rendering it. Flagged now so the control lands with the feature rather than after it.

---

## Suggested build order

Sequenced by risk reduction per unit of effort, respecting dependencies. Items 1–3 are small and unblock disproportionately.

1. **F-3 (partial) — add `is_active` to `User` and check it in `get_current_user`.** One column, one migration, one line. It is the prerequisite for banning anyone at all, and it makes ASVS 7.4.2 satisfiable.
2. **F-5 (item 1) — user blocking.** One table plus a clause in the three existing visibility/participant checks. Highest user-protection value in this file per line of code, and needs no staff.
3. **F-6 — security logging.** Purely additive, no dependencies, and it is what makes everything after it observable. Do this before the fixes in `SecurityIssues.md`, not after, so their effect is measurable.
4. **F-1 — email verification.** Unblocks F-2 and substantially resolves `SecurityIssues.md` M-2 and M-3.
5. **F-2 — password reset and change.** Depends on 4. Product-blocking as much as security-blocking.
6. **F-5 (items 2, 5) — report capture and Cloudinary upload moderation.** Start capturing reports from launch even if nobody reads them yet; enable provider-side scanning (configuration only).
7. **F-9 — LLM daily budget and cost alert.** Small, and it caps a real bill.
8. **F-11 — CI security gate.** One workflow file; land it alongside `SecurityIssues.md` M-5's lockfile.
9. **F-4 — content deletion and profile editing.** Moderate size; pairs naturally with F-3's full deletion flow.
10. **F-3 (remainder) — full account deletion and data export.** Larger; needs the retention policy decided first.
11. **F-13 — age gate and privacy policy.** Before public launch, not before internal testing.
12. **F-8, F-12 — secrets management and encryption at rest.** Deployment-time; do them as part of whatever "go to production" checklist exists.
13. **F-7 — MFA (or federated login).** After F-2 exists, or the lockout risk increases.
14. **F-5 (items 3, 4) — suspension and moderation surface**, then **F-10** — session management, then **F-14 → F-17** as scale demands.

## Deliberate omissions

Controls a reader might expect here, judged disproportionate for this system. Recorded so they are not re-raised every audit.

- **Application-level encryption of `messages.body`.** Disproportionate: it would break search and pagination, add a key-management burden this team has no story for yet (F-8), and defend against a threat — a database read by someone who already has application-server access — that mostly already implies total compromise. Managed encryption at rest (F-12) covers the realistic threat of a stolen backup or snapshot.
- **Hardware / phishing-resistant MFA (ASVS 6.3.3's L3 clause, e.g. FIDO2).** The system is L2 (2.6). Mandating security keys for a meme app would be a product-killing control with no matching risk.
- **Formal build provenance / SLSA attestation and signed artefacts.** Disproportionate pre-launch. A committed lockfile with hashes (M-5) plus dependency and secret scanning (F-11) captures most of the value at a fraction of the cost.
- **Logging every authorization decision (ASVS 16.3.2's L3 clause).** L3 only. F-6's scope — failed authorization plus all authentication events — is the correct L2 bar and generates far less noise.
- **A full RBAC/ABAC permission framework.** The actor model (2.2) has three roles and community ownership is already enforced correctly and consistently. Introducing a policy engine would add a trust-boundary surface without removing one; a single `is_staff` boolean is the right increment when F-5 item 4 arrives.
- **Rewriting the in-memory WebSocket registry for multi-instance deployment.** Real and documented in `app/websockets/connection_manager.py`, but it is an availability/correctness concern, not a security control — it belongs on the engineering backlog, not in this file.
- **Anti-automation beyond email verification (CAPTCHA, device attestation, proof-of-work).** Deliberately folded into F-1 rather than listed separately. Verification is the control that actually raises the cost of a sybil account; adding a CAPTCHA on top before verification exists would be friction without the corresponding benefit. Revisit if verified accounts are still being farmed at scale.
