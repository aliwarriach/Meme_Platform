// Roadmap_Scaling.md D1 — votes, views, and comments: bursty, write-heavy, and the
// thing that actually stresses the DB (feed reads are cache-then-refresh; these are
// not). Pulls real meme ids from a live feed page rather than guessing ids, so every
// request is a realistic write against real rows.
import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomUser, authHeaders } from './lib/users.js';

export const options = {
  scenarios: {
    vote_burst: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: __ENV.TARGET_VUS ? Number(__ENV.TARGET_VUS) : 80 },
        { duration: '4m', target: __ENV.TARGET_VUS ? Number(__ENV.TARGET_VUS) : 80 },
        { duration: '1m', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    http_req_failed: ['rate<0.02'], // slightly looser: 429s from per-user rate limits are expected under a deliberate burst
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost';

export default function () {
  const user = randomUser();
  const headers = authHeaders(user.token);

  const feedRes = http.get(`${BASE_URL}/memes/feed?offset=0&limit=20`, { headers });
  if (feedRes.status !== 200) {
    sleep(1);
    return;
  }
  let items;
  try {
    items = JSON.parse(feedRes.body).items.filter((i) => i.kind === 'meme');
  } catch {
    return;
  }
  if (items.length === 0) {
    sleep(1);
    return;
  }

  // One "session" reacts to a handful of memes off the same page, matching how a real
  // burst actually happens (everyone piling onto what's currently on screen).
  const reactCount = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < reactCount && i < items.length; i++) {
    const memeId = items[i].meme.id;

    const viewRes = http.post(`${BASE_URL}/memes/${memeId}/views`, null, { headers });
    check(viewRes, { 'view ok or rate-limited': (r) => r.status === 200 || r.status === 429 });

    if (Math.random() < 0.4) {
      const voteRes = http.post(
        `${BASE_URL}/memes/${memeId}/votes`,
        JSON.stringify({ value: Math.random() < 0.85 ? 1 : -1 }),
        { headers }
      );
      check(voteRes, {
        'vote ok, rate-limited, or already voted': (r) =>
          [200, 201, 429, 409].includes(r.status),
      });
    }
    sleep(0.3 + Math.random() * 0.7);
  }
  sleep(1 + Math.random() * 2);
}
