# Meme Creation & Sharing Platform

A mobile-first, community-focused meme creation and sharing platform: meme
creation with text overlays and templates, AI-assisted captioning,
communities with private template libraries and challenges, a rule-based
meme scoring engine driving leaderboards, global Meme of the Day/Week/Month
competitions, real-time meme sending, native sharing, and an Instagram
Companion Mode.

See [`Idea.md`](Idea.md) and [`Project_Requirements.md`](Project_Requirements.md)
for the full product spec.

## Stack

- **Backend**: FastAPI (async Python), SQLAlchemy (async) + Alembic, PostgreSQL, Redis, `arq` background worker
- **Frontend**: React Native + Expo, TypeScript, Redux Toolkit, TanStack Query

## Prerequisites

- Python 3.11+
- Node.js 18+ and npm
- PostgreSQL (running locally or reachable via a connection string)
- Redis (running locally or reachable via a connection string)

## 1. Backend setup

```bash
cd backend
python -m venv venv
source venv/Scripts/activate   # Windows Git Bash: source venv/Scripts/activate
# venv\Scripts\activate.bat    # Windows cmd.exe
# source venv/bin/activate     # macOS/Linux

pip install -r requirements/dev.lock --require-hashes   # pinned + hash-verified; dev.lock pulls in base + test/lint tools
```

`requirements/*.txt` are the pinned, human-edited inputs; `requirements/*.lock` are the fully-resolved, hash-verified files actually installed from (regenerate after editing a `.txt` — see the comment in `dev.txt`).

Copy the env template and fill in real values:

```bash
cp .env.example .env
```

`backend/.env`:

```env
ENVIRONMENT=development
DATABASE_URL=postgresql+asyncpg://USER:PASSWORD@localhost:5432/meme_platform
REDIS_URL=redis://localhost:6379/0
JWT_SECRET=changeme
CORS_ALLOWED_ORIGINS=http://localhost:8081,http://localhost:19006
```

Set `ENVIRONMENT=production` for any non-local deployment — it disables the interactive
`/docs`/`/redoc`/`/openapi.json` endpoints and requires `CORS_ALLOWED_ORIGINS` to be set to
real origins (the app refuses to start with the localhost default in production).

Create the database (name must match `DATABASE_URL`), then run migrations:

```bash
createdb meme_platform   # or create it via your Postgres client of choice
alembic upgrade head
```

Start the API (always on port **6001**, not the FastAPI default):

```bash
uvicorn app.main:app --host 0.0.0.0 --port 6001
```

In a second terminal, start the background worker (required for AI captions,
scoring recomputation, Instagram metadata fetch, and challenge window close):

```bash
arq app.workers.arq_worker.WorkerSettings
```

Visit `http://localhost:6001/docs` for the interactive API docs once the
server is up.

### Running backend tests

Tests run against a real PostgreSQL database — never SQLite.

```bash
pytest
```

## 2. Frontend setup

```bash
cd frontend
npm install
cp .env.example .env
```

`frontend/.env`:

```env
EXPO_PUBLIC_API_URL=http://127.0.0.1:6001
```

- If you're running the phone/emulator on the **same machine** as the
  backend (e.g. an Android emulator), `127.0.0.1` may need to be your
  machine's LAN IP instead, so the physical/virtual device can reach it.
- If you're testing on a **physical phone over the same WiFi**, the app
  auto-detects the backend host from the Expo dev server's own address —
  you usually don't need to set `EXPO_PUBLIC_API_URL` by hand for local dev.

Start the Expo dev server:

```bash
npm start
```

Then:
- Press `a` for Android emulator, `i` for iOS simulator, or scan the QR
  code with **Expo Go** on a physical device (same WiFi as your computer).
- `npm run android` / `npm run ios` launch directly into a connected
  emulator/simulator.

### Running frontend tests

```bash
npm test
```

## 3. Running everything together

You need **3 processes** running at once for full functionality:

1. `uvicorn app.main:app --host 0.0.0.0 --port 6001` (backend, in `backend/`)
2. `arq app.workers.arq_worker.WorkerSettings` (worker, in `backend/`)
3. `npm start` (Expo dev server, in `frontend/`)

Then open the app via Expo Go, an emulator, or a simulator and log in
(register a new account first if the database is empty).

## Project layout

```
/backend   FastAPI (async Python) — see backend/CLAUDE.md
/frontend  React Native + Expo — see frontend/CLAUDE.md
/shared    cross-cutting types/contracts (API response shapes, enums)
```

## Notes for contributors

- Never commit `.env` files or real secrets (JWT secret, S3/Cloudinary keys,
  Groq/OpenAI API keys) — use `.env.example` as the template.
- Backend conventions, architecture, and business rules: `backend/CLAUDE.md`.
- Frontend conventions, architecture, and stack rules: `frontend/CLAUDE.md`.
