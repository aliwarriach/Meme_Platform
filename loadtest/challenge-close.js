// Roadmap_Scaling.md D1 — "a burst of challenge submissions near a window close (a
// genuine thundering-herd moment in this product - see .claude/memory/challenges.md)."
// Every VU tries to submit right as CHALLENGE_END approaches, then the scenario ends -
// this deliberately concentrates load into a short window rather than spreading it out,
// matching the real product moment it's modeling.
//
// Prerequisite: create a fresh challenge right before running this
// (backend/scripts/create_test_challenge.py), then pass its id and end time in:
//
//   CHALLENGE_ID=<id> CHALLENGE_END_UNIX=<epoch seconds> k6 run challenge-close.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomUser, authHeaders } from './lib/users.js';
import { uploadRealImage } from './lib/upload.js';

const CHALLENGE_ID = __ENV.CHALLENGE_ID;
const CHALLENGE_END_UNIX = __ENV.CHALLENGE_END_UNIX
  ? Number(__ENV.CHALLENGE_END_UNIX)
  : Math.floor(Date.now() / 1000) + 300;
const BASE_URL = __ENV.BASE_URL || 'http://localhost';

export const options = {
  scenarios: {
    challenge_close_burst: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 300,
      stages: [
        // Quiet, then a sharp ramp timed to land right at the window close - this
        // shape (not a flat load) is the point of the scenario.
        { duration: '1m', target: 1 },
        { duration: '30s', target: 40 },
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<2000'],
  },
};

export default function () {
  if (!CHALLENGE_ID) {
    throw new Error('CHALLENGE_ID env var required - run create_test_challenge.py first');
  }
  const user = randomUser();
  const secondsToClose = CHALLENGE_END_UNIX - Math.floor(Date.now() / 1000);
  // Pace arrivals to actually converge on the close moment rather than firing
  // uniformly across the whole scenario duration.
  if (secondsToClose > 5) {
    sleep(Math.min(secondsToClose - 5, 2));
  }

  const publicId = uploadRealImage(BASE_URL, user.token, 'challenges');
  if (!publicId) return;

  const res = http.post(
    `${BASE_URL}/challenges/${CHALLENGE_ID}/submissions`,
    {
      image_public_id: publicId,
      caption: 'load test submission',
    },
    { headers: { Authorization: `Bearer ${user.token}` } }
  );
  check(res, {
    'submission accepted or window already closed': (r) => [201, 400, 403, 409].includes(r.status),
  });
}
