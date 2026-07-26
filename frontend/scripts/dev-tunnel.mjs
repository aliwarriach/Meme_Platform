#!/usr/bin/env node
/**
 * One-command, network-independent dev launcher.
 *
 * Opens a public Cloudflare tunnel to the local backend (port 6001), then starts Expo/Metro in
 * tunnel mode with the app pointed at that public URL. Result: the phone reaches BOTH Metro (the
 * JS bundle) and the backend from ANY network — same WiFi, a different WiFi, or cellular — with
 * no IP juggling and nothing to edit. Ideal for live demos.
 *
 * The backend's public URL is passed to Expo as EXPO_PUBLIC_API_URL in the environment (not
 * written to .env), so it wins over the LAN auto-derive in src/constants/config.ts for this run
 * only. Plain `npm start` still uses fast LAN auto-derive, unaffected.
 *
 * Prerequisites (run these first, in the backend/ folder):
 *   uvicorn app.main:app --host 0.0.0.0 --port 6001
 *   arq app.workers.arq_worker.WorkerSettings
 *
 * Usage:  npm run dev:tunnel      (Ctrl+C stops both the tunnel and Metro)
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import http from 'node:http';

const BACKEND_PORT = 6001;
const URL_CAPTURE_TIMEOUT_MS = 60_000;
const TRYCLOUDFLARE_RE = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;

function resolveCloudflared() {
  // Prefer PATH; fall back to the default winget install location on Windows.
  const winDefault = 'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe';
  if (process.platform === 'win32' && existsSync(winDefault)) return winDefault;
  return 'cloudflared';
}

function checkBackend() {
  return new Promise((resolve) => {
    const req = http.get(
      { host: '127.0.0.1', port: BACKEND_PORT, path: '/openapi.json', timeout: 4000 },
      (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      }
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

let tunnel = null;
let metro = null;
let shuttingDown = false;

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (metro && !metro.killed) metro.kill();
  if (tunnel && !tunnel.killed) tunnel.kill();
  process.exit(code ?? 0);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

function startMetro(apiUrl) {
  console.log(`\n[dev-tunnel] ✅ backend public URL: ${apiUrl}`);
  console.log('[dev-tunnel] launching Expo in tunnel mode — first bundle over the tunnel can take ~30–60s...\n');
  // shell: true is required on Windows (Node 20+ throws EINVAL spawning npx.cmd without it);
  // harmless on POSIX. Args are static/simple so there's no shell-injection surface here.
  metro = spawn('npx', ['expo', 'start', '--tunnel', '--clear'], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, EXPO_PUBLIC_API_URL: apiUrl },
  });
  metro.on('exit', (code) => shutdown(code ?? 0));
}

async function main() {
  const backendUp = await checkBackend();
  if (!backendUp) {
    console.warn(
      `[dev-tunnel] ⚠  backend not reachable at http://127.0.0.1:${BACKEND_PORT}.\n` +
        '   Start it first (in backend/):\n' +
        '     uvicorn app.main:app --host 0.0.0.0 --port 6001\n' +
        '     arq app.workers.arq_worker.WorkerSettings\n' +
        '   Continuing anyway — the tunnel will serve 502s until the backend is up.\n'
    );
  }

  const cloudflared = resolveCloudflared();
  console.log(`[dev-tunnel] opening Cloudflare tunnel to http://localhost:${BACKEND_PORT} ...`);
  tunnel = spawn(cloudflared, ['tunnel', '--url', `http://localhost:${BACKEND_PORT}`, '--no-autoupdate'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let captured = false;
  const timer = setTimeout(() => {
    if (!captured) {
      console.error('[dev-tunnel] ❌ timed out waiting for the tunnel URL. Is cloudflared installed and outbound 7844 allowed?');
      shutdown(1);
    }
  }, URL_CAPTURE_TIMEOUT_MS);

  const onData = (buf) => {
    if (captured) return;
    const match = buf.toString().match(TRYCLOUDFLARE_RE);
    if (match) {
      captured = true;
      clearTimeout(timer);
      startMetro(match[0]);
    }
  };
  tunnel.stdout.on('data', onData);
  tunnel.stderr.on('data', onData); // cloudflared prints the URL on stderr

  tunnel.on('error', (err) => {
    console.error(`[dev-tunnel] ❌ failed to start cloudflared: ${err.message}`);
    shutdown(1);
  });
  tunnel.on('exit', (code) => {
    if (!captured) {
      console.error(`[dev-tunnel] ❌ cloudflared exited (code ${code}) before a URL was captured.`);
      shutdown(1);
    }
  });
}

main();
