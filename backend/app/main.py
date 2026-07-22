import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.exceptions import register_exception_handlers
from app.routers import (
    auth,
    challenges,
    communities,
    competitions,
    friends,
    leaderboards,
    meme_sending,
    memes,
    templates,
)
from app.workers.challenges import run_challenge_close_loop


@asynccontextmanager
async def lifespan(app: FastAPI):
    close_loop_task = asyncio.create_task(run_challenge_close_loop())
    yield
    close_loop_task.cancel()


app = FastAPI(title="Meme Platform API", lifespan=lifespan)

# Dev-only permissive CORS so the Expo web/simulator client can call the API directly.
# Tighten this to explicit origins before any real deployment.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)
app.include_router(auth.router)
app.include_router(friends.router)
app.include_router(memes.router)
app.include_router(templates.router)
app.include_router(communities.router)
app.include_router(leaderboards.router)
app.include_router(competitions.router)
app.include_router(challenges.router)
app.include_router(meme_sending.router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
