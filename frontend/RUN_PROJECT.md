# How to run the project (permanent setup)

The mobile app is a **standalone APK** with a **permanent backend URL baked in**
(`https://salaried-negation-scheming.ngrok-free.dev`). It opens straight to login and works on
**any network** (WiFi or cellular). No Metro, no dev client, no launcher, no URL pasting, and
**no rebuild needed** when the network/IP changes — the URL never changes.

## To run it, start three things on the laptop:

```bash
# 1. Backend API (in backend/)
uvicorn app.main:app --host 0.0.0.0 --port 6001

# 2. Background worker (in backend/) — needed for AI captions, scoring, Instagram metadata, challenge close
arq app.workers.arq_worker.WorkerSettings

# 3. Public tunnel on the PERMANENT domain (points the baked-in URL at the local backend)
C:\Users\Newuser\ngrok\ngrok.exe http --domain=salaried-negation-scheming.ngrok-free.dev 6001
```

Then just open the app on the phone and log in. That's it.

## Key facts
- **Permanent backend URL** (baked into the APK): `https://salaried-negation-scheming.ngrok-free.dev`
  — a free ngrok reserved domain. It never changes, so the APK never needs rebuilding for
  network reasons.
- **ngrok binary**: `C:\Users\Newuser\ngrok\ngrok.exe` (v3.39.10+). Authtoken already configured
  (`ngrok config add-authtoken ...`, stored in `%LOCALAPPDATA%\ngrok\ngrok.yml`).
- **Windows Defender exclusion** was added for `C:\Users\Newuser\ngrok` (Defender false-flags
  tunnel tools as PUA). If ngrok ever "disappears", re-check that exclusion.
- The app sends a `ngrok-skip-browser-warning` header on every API call so ngrok's free-tier
  interstitial never interferes (see `src/services/api.ts`).
- The backend URL is set via `eas.json` → `preview` profile → `env.EXPO_PUBLIC_API_URL`. Only
  change it + rebuild if you switch tunnels/hosting.

## When to rebuild the APK
ONLY when the app's **code** changes (new screens/features/fixes). Networks/IP changes never
require a rebuild. Rebuild with:
```bash
npx eas-cli build --platform android --profile preview --non-interactive
```

## Local dev alternative (fast, same-WiFi, live reload)
For active coding with hot reload, use `npm start` (LAN) — the app auto-detects the backend from
the Metro host (`src/constants/config.ts`), no `.env` edits needed. See `DEV_TUNNEL.md` for the
tunnel-based dev flow. The standalone APK above is for demos / stable use, not live code editing.
