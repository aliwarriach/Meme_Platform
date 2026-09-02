// Roadmap_Scaling.md D1 — a long-lived WebSocket per user, held open for the
// scenario's duration. This is what proves realtime's connection-count-based KEDA
// scaling (never CPU — idle sockets sit near 0% CPU regardless of count, see
// Roadmap_Scaling.md §2.3) against genuine sustained load rather than a short burst.
// Each VU = one held-open connection for the whole run, matching a real user with the
// app open in the background.
import http from 'k6/http';
import ws from 'k6/ws';
import { check } from 'k6';
import { randomUser, authHeaders } from './lib/users.js';

export const options = {
  scenarios: {
    websocket_hold: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        // Ramp gently — this is deliberately paced, not a thundering-herd connect
        // storm, since that's not what "idle users with the app open" looks like.
        { duration: '3m', target: __ENV.TARGET_CONNECTIONS ? Number(__ENV.TARGET_CONNECTIONS) : 500 },
        { duration: '10m', target: __ENV.TARGET_CONNECTIONS ? Number(__ENV.TARGET_CONNECTIONS) : 500 },
        { duration: '2m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    ws_connecting: ['p(95)<2000'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost';
const WS_URL = __ENV.WS_URL || BASE_URL.replace(/^http/, 'ws');
const HOLD_SECONDS = __ENV.HOLD_SECONDS ? Number(__ENV.HOLD_SECONDS) : 600;

export default function () {
  const user = randomUser();
  const ticketRes = http.post(`${BASE_URL}/meme-sending/ws-ticket`, null, {
    headers: authHeaders(user.token),
  });
  if (ticketRes.status !== 200) return;
  let ticket;
  try {
    ticket = JSON.parse(ticketRes.body).ticket;
  } catch {
    return;
  }

  const url = `${WS_URL}/meme-sending/ws?ticket=${ticket}`;
  const res = ws.connect(url, {}, function (socket) {
    socket.on('open', function () {
      // No client->server messages are expected on this channel (see
      // backend/app/routers/meme_sending.py) - the socket just needs to stay open,
      // matching a real idle client.
      socket.setTimeout(function () {
        socket.close();
      }, HOLD_SECONDS * 1000);
    });
    socket.on('error', function () {});
  });
  check(res, { 'ws handshake succeeded': (r) => r && r.status === 101 });
}
