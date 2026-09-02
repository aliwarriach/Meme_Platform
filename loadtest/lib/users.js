// Shared token pool for every k6 scenario. Loaded once per VU-thread via SharedArray
// (not per-VU) so a 5000-VU run doesn't parse the JSON file 5000 times over.
// Populated by `backend/scripts/seed_load_test_data.py` — see loadtest/README.md.
import { SharedArray } from 'k6/data';

export const users = new SharedArray('users', function () {
  const raw = JSON.parse(open(`${__ENV.TOKENS_FILE || '../tokens.json'}`));
  return raw.users;
});

export function randomUser() {
  return users[Math.floor(Math.random() * users.length)];
}

export function authHeaders(token) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}
