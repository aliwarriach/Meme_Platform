# Running the app on your phone from ANY network (incl. cellular)

Two ways to run, depending on where your phone is:

## A) Same WiFi as the laptop — fast (everyday dev)
```
# backend/ (two terminals or two background processes)
uvicorn app.main:app --host 0.0.0.0 --port 6001
arq app.workers.arq_worker.WorkerSettings

# frontend/
npm start
```
Open the dev client, connect to the LAN URL Metro prints. The backend address is **auto-detected** from the Metro host (see `src/constants/config.ts`) — nothing to edit when your IP changes, as long as phone + laptop share a network.

## B) Any network / cellular — network-independent (demos)
```
# backend/ (must be running first)
uvicorn app.main:app --host 0.0.0.0 --port 6001
arq app.workers.arq_worker.WorkerSettings

# frontend/  — ONE command does the rest
npm run dev:tunnel
```
`npm run dev:tunnel` (`scripts/dev-tunnel.mjs`):
1. Opens a public **Cloudflare tunnel** to the backend (`:6001`) — no account needed.
2. Passes that public HTTPS URL to the app as `EXPO_PUBLIC_API_URL` (this run only; `.env` is untouched).
3. Launches **Expo in tunnel mode** so Metro (the JS bundle) is also reachable from anywhere.

Then scan the QR it prints with your dev client. The phone can be on **any** network — the app reaches both Metro and the backend over the public tunnels. WebSockets (real-time meme sending) upgrade to `wss://` automatically.

### Demo tips
- The backend tunnel URL is **new each run** but it's injected automatically — you never type it.
- The **first** bundle load over the tunnel is slow (~15 MB through the tunnel). **Pre-load the app once before a live demo** so it's cached and instant when it matters.
- Requires: `cloudflared` (installed via winget: `Cloudflare.cloudflared`) and `@expo/ngrok` (dev dependency). Both already set up.
- Want a **fixed** backend URL that never changes (so nothing is dynamic at all)? Switch the tunnel to ngrok with a free reserved domain, or a Cloudflare *named* tunnel — ask and it can be wired in.

## Prerequisites recap
- `cloudflared` on PATH (or at `C:\Program Files (x86)\cloudflared\cloudflared.exe`).
- Backend running on `0.0.0.0:6001` **and** the arq worker (needed for AI captions, Instagram metadata, scoring, challenge close).
