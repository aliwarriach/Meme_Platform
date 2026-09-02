// Roadmap_Scaling.md D1 — the dominant real-world action: opening the app and
// scrolling the feed. Offset-based pagination (GET /memes/feed?offset=&limit=), not
// keyset — the feed's hot-score ranking has no stable cursor value
// (backend/app/routers/memes.py, confirmed against `.claude/memory/meme-feed.md`).
import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomUser, authHeaders } from './lib/users.js';

export const options = {
  scenarios: {
    feed_scroll: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: __ENV.TARGET_VUS ? Number(__ENV.TARGET_VUS) : 200 },
        { duration: '5m', target: __ENV.TARGET_VUS ? Number(__ENV.TARGET_VUS) : 200 },
        { duration: '1m', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<800'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost';

export default function () {
  const user = randomUser();
  const headers = authHeaders(user.token);

  // A session is a few pages of scrolling, then the user moves on — not an infinite
  // loop against one endpoint, which would understate real per-user request spacing.
  let offset = 0;
  const pagesThisSession = 2 + Math.floor(Math.random() * 4); // 2-5 pages
  for (let page = 0; page < pagesThisSession; page++) {
    const res = http.get(`${BASE_URL}/memes/feed?offset=${offset}&limit=20`, { headers });
    check(res, {
      'feed 200': (r) => r.status === 200,
      'feed has items field': (r) => {
        try {
          return Array.isArray(JSON.parse(r.body).items);
        } catch {
          return false;
        }
      },
    });
    if (res.status !== 200) break;
    let body;
    try {
      body = JSON.parse(res.body);
    } catch {
      break;
    }
    if (!body.has_more) break;
    offset += 20;
    sleep(0.5 + Math.random() * 1.5); // real scroll pacing, not a hot loop
  }
  sleep(1 + Math.random() * 3); // time spent actually reading a post before the next session
}
