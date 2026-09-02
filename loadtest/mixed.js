// Roadmap_Scaling.md D1 — "Mixed scenario weighting ~70% feed reads, 20%
// votes/reactions, 5% uploads, 5% challenge/community writes." The four scenario
// files (feed-scroll.js, vote-burst.js, websocket-hold.js, challenge-close.js) each
// prove one behavior in isolation; this is what D2/D3 actually run - all four request
// *types* proportioned by real VU counts, so the mix of traffic hitting the cluster at
// once looks like the real product, not one endpoint hammered alone. websocket-hold's
// connections layer on top as its own scenario at a size matched to the run's target
// concurrency (see README) rather than being folded into this file's percentages,
// since a held-open socket isn't a request in the same sense the other three are.
import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomUser, authHeaders } from './lib/users.js';
import { uploadRealImage } from './lib/upload.js';

const BASE_URL = __ENV.BASE_URL || 'http://localhost';
const TOTAL_VUS = __ENV.TARGET_VUS ? Number(__ENV.TARGET_VUS) : 200;
const CHALLENGE_ID = __ENV.CHALLENGE_ID; // optional - writes scenario skips gracefully without it

function vus(pct) {
  return Math.max(1, Math.round((TOTAL_VUS * pct) / 100));
}

export const options = {
  scenarios: {
    feed_reads: {
      executor: 'ramping-vus',
      exec: 'feedScroll',
      startVUs: 0,
      stages: [
        { duration: '2m', target: vus(70) },
        { duration: '6m', target: vus(70) },
        { duration: '1m', target: 0 },
      ],
    },
    votes_reactions: {
      executor: 'ramping-vus',
      exec: 'voteBurst',
      startVUs: 0,
      stages: [
        { duration: '2m', target: vus(20) },
        { duration: '6m', target: vus(20) },
        { duration: '1m', target: 0 },
      ],
    },
    uploads: {
      executor: 'ramping-vus',
      exec: 'uploadFlow',
      startVUs: 0,
      stages: [
        { duration: '2m', target: vus(5) },
        { duration: '6m', target: vus(5) },
        { duration: '1m', target: 0 },
      ],
    },
    challenge_writes: {
      executor: 'ramping-vus',
      exec: 'challengeWrite',
      startVUs: 0,
      stages: [
        { duration: '2m', target: vus(5) },
        { duration: '6m', target: vus(5) },
        { duration: '1m', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    http_req_failed: ['rate<0.02'],
  },
};

export function feedScroll() {
  const user = randomUser();
  const headers = authHeaders(user.token);
  const res = http.get(`${BASE_URL}/memes/feed?offset=0&limit=20`, { headers });
  check(res, { 'feed 200': (r) => r.status === 200 });
  sleep(0.5 + Math.random() * 2);
}

export function voteBurst() {
  const user = randomUser();
  const headers = authHeaders(user.token);
  const feedRes = http.get(`${BASE_URL}/memes/feed?offset=0&limit=20`, { headers });
  if (feedRes.status !== 200) return;
  let items;
  try {
    items = JSON.parse(feedRes.body).items.filter((i) => i.kind === 'meme');
  } catch {
    return;
  }
  if (items.length === 0) return;
  const memeId = items[Math.floor(Math.random() * items.length)].meme.id;
  http.post(`${BASE_URL}/memes/${memeId}/views`, null, { headers });
  if (Math.random() < 0.5) {
    http.post(
      `${BASE_URL}/memes/${memeId}/votes`,
      JSON.stringify({ value: 1 }),
      { headers }
    );
  }
  sleep(0.5 + Math.random() * 1.5);
}

export function uploadFlow() {
  const user = randomUser();
  const publicId = uploadRealImage(BASE_URL, user.token, 'memes');
  if (!publicId) return;
  const res = http.post(
    `${BASE_URL}/memes`,
    { image_public_id: publicId, audiences: 'public', caption: 'load test upload' },
    { headers: { Authorization: `Bearer ${user.token}` } }
  );
  check(res, { 'meme created': (r) => r.status === 201 });
  sleep(1 + Math.random() * 2);
}

export function challengeWrite() {
  if (!CHALLENGE_ID) {
    sleep(1);
    return;
  }
  const user = randomUser();
  const publicId = uploadRealImage(BASE_URL, user.token, 'challenges');
  if (!publicId) return;
  const res = http.post(
    `${BASE_URL}/challenges/${CHALLENGE_ID}/submissions`,
    { image_public_id: publicId, caption: 'load test submission' },
    { headers: { Authorization: `Bearer ${user.token}` } }
  );
  check(res, { 'submission handled': (r) => [201, 400, 403, 409].includes(r.status) });
  sleep(1 + Math.random() * 2);
}
