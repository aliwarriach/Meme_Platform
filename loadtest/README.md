# Load testing this cluster yourself

This is Roadmap_Scaling.md's Stage D toolkit — k6 scripts that generate realistic
traffic against the live EKS cluster, plus the scripts that seed fixture data for them
to run against. Everything here talks to the **real ALB endpoint**, not a mock — these
are the same numbers an evaluator would see if they hit the app directly.

## One-time setup

1. **Install k6** (if not already): `winget install k6` (Windows) or see
   https://k6.io/docs/get-started/installation/. Confirm with `k6 version`.
2. **Get the ALB hostname**: `kubectl get ingress` — the `ADDRESS` column. This is your
   `BASE_URL` for every command below (prefix with `http://`).
3. **Seed test data** (users + memes) by running the seed script inside a live `api`
   pod — it needs the app's DB access and JWT signing key, which only exist inside the
   cluster, so this always runs via `kubectl exec`, never from your laptop directly:

   ```bash
   API_POD=$(kubectl get pod -l app=api -o jsonpath='{.items[0].metadata.name}')
   kubectl exec -i "$API_POD" -- sh -c "cat > /tmp/seed_load_test_data.py" < backend/scripts/seed_load_test_data.py
   kubectl exec "$API_POD" -- sh -c "cd /app && PYTHONPATH=/app python /tmp/seed_load_test_data.py --users 500 --memes-per-user 6" > loadtest/tokens.json
   ```

   This creates real users (bypassing the registration rate limit on purpose — you're
   seeding fixtures, not testing `/auth/register`) and real memes, and mints each user
   a real JWT directly (same signing path a real login uses) so k6 never has to log in
   mid-test either. `loadtest/tokens.json` is what every k6 script reads its user pool
   from. **Bump `--users` up for a bigger run** — e.g. `--users 3000` for something
   closer to a real 10k-concurrent test (each user does several scrolls/actions per
   session, so you don't need 1 seeded user per concurrent VU 1:1, but more users means
   less token reuse and a more realistic vote/spread pattern).

## Running a scenario

Each script is self-contained and can be run alone to prove one specific behavior, or
you can run `mixed.js` for the real blended-traffic shape (70% feed reads / 20%
votes-reactions / 5% uploads / 5% challenge writes, per the roadmap):

```bash
# one behavior at a time
k6 run -e BASE_URL=http://<alb-hostname> loadtest/feed-scroll.js
k6 run -e BASE_URL=http://<alb-hostname> -e TARGET_VUS=500 loadtest/vote-burst.js
k6 run -e BASE_URL=http://<alb-hostname> -e TARGET_CONNECTIONS=2000 -e HOLD_SECONDS=900 loadtest/websocket-hold.js

# the real mixed-traffic shape - this is what D2/D3 actually run
k6 run -e BASE_URL=http://<alb-hostname> -e TARGET_VUS=2000 loadtest/mixed.js
```

`TARGET_VUS` is your dial for "how many concurrent users." Roughly: **1 VU in these
scripts ≈ 1 concurrent user**, since each VU does think-time-paced sessions rather than
hammering in a tight loop — so `TARGET_VUS=10000` across a `mixed.js` run is a genuine
attempt at proving the 10k-concurrent claim (see the note on running this *from more
than one machine* below — a laptop tops out well before 10k).

### Challenge-close burst (needs a fresh challenge each time)

```bash
# 1. Create a challenge that closes in 10 minutes, using one seeded user's token
TOKEN=$(python -c "import json; print(json.load(open('loadtest/tokens.json'))['users'][0]['token'])")
python backend/scripts/create_test_challenge.py --base-url http://<alb-hostname> --token "$TOKEN" --minutes-from-now 10
# prints a challenge id - copy it

# 2. Run the burst scenario timed to converge on that close
k6 run -e BASE_URL=http://<alb-hostname> -e CHALLENGE_ID=<id-from-step-1> -e CHALLENGE_END_UNIX=<unix-timestamp-of-close> loadtest/challenge-close.js
```

## Running a real 10k / 50k test (not just a laptop smoke test)

A single laptop can realistically drive a few thousand VUs before *k6 itself* becomes
the bottleneck (it's single-machine, CPU/network bound like anything else). For the
roadmap's actual D2 (10k) and D3 (50k) proof runs:

- **k6 Cloud** (Grafana's own hosted runner) is the easiest path — `k6 cloud login`,
  then `k6 cloud run loadtest/mixed.js` distributes the load generation across their
  infrastructure, not your laptop. Free tier has limits; check current ones before a
  50k run.
- Alternative: run k6 from **several EC2 instances in the same AWS region** in
  parallel (cheap, short-lived, same idea as D1's own guidance) — each runs a fraction
  of `TARGET_VUS` against the same `BASE_URL`, and you sum the results afterward.
- Either way: **before a 10k run, check the AWS EC2 on-demand vCPU quota** — C4's
  testing hit an 8-vCPU account ceiling that capped real schedulable capacity well
  below 10k concurrent. Request a quota increase (AWS Console → Service Quotas → EC2 →
  "Running On-Demand Standard instances") well before your evaluation date; approval
  isn't always instant.

## Where to see results

**Two places, both real-time during a run:**

1. **k6's own terminal output** — every run ends with a summary block (like the one
   your smoke test produced): request counts, `http_req_duration` (this is your p95
   latency number), `http_req_failed` (error rate), and — for `websocket-hold.js` —
   `ws_sessions`/`ws_connecting`. This is enough to answer "did it pass" on its own.
2. **The Grafana Cloud dashboard** (once C5 is wired up) — this is what actually lets
   you *watch* the cluster respond while the test runs: pods multiplying
   (`kubectl get hpa` mirrors this too, live, if you want a second window open), nodes
   being added by Karpenter, DB connections staying flat. This is the more convincing
   thing to show an evaluator live, since it's the infrastructure visibly reacting, not
   just a client-side number. **Ask me for the dashboard URL once C5 is done** — I'll
   set it up once you've shared your Grafana Cloud connection details.

For a live demo specifically: open the Grafana dashboard in one window, `kubectl get
hpa -w` and `kubectl get nodes -w` in a terminal, and kick off `mixed.js` in another —
watching the pod/node counts climb in real time during the test is a much stronger
demonstration than a final summary number.

## What's in this directory

| File | Roadmap phase | What it proves |
|---|---|---|
| `feed-scroll.js` | D1 | The dominant read path — feed pagination under sustained concurrent scrolling. |
| `vote-burst.js` | D1 | Write-heavy DB pressure (votes/views) — the thing that actually stresses Postgres, unlike cached feed reads. |
| `websocket-hold.js` | D1 | Sustained WebSocket connections — proves realtime's connection-count KEDA scaling (never CPU) under real load, not just the ~20-connection correctness check from C4. |
| `challenge-close.js` | D1 | The "thundering herd near a challenge deadline" product moment. |
| `mixed.js` | D1 | The real 70/20/5/5 blended traffic shape — what D2/D3 actually run. |
| `lib/users.js`, `lib/upload.js` | — | Shared helpers (token pool, real signed Cloudinary upload). |

`backend/scripts/seed_load_test_data.py` and `backend/scripts/create_test_challenge.py`
live in `backend/` (not `loadtest/`) since they need the app's own code/DB session, and
only run via `kubectl exec` inside a pod — never from your laptop directly.

## Cleaning up seeded data afterward

Load-test users/memes are tagged (`username LIKE 'loadtest_%'`, `image_public_id LIKE
'loadtest/%'`) specifically so they're easy to find and remove later without touching
real data — ask me to write a cleanup script when you're done evaluating, or just leave
them (they cost nothing extra once the cluster itself is torn down).
