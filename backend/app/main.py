import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.core.config import settings
from app.core.exceptions import register_exception_handlers
from app.core.rate_limit import limiter
from app.routers import (
    ai_caption,
    auth,
    challenges,
    communities,
    competitions,
    friends,
    instagram,
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

# Origins come from CORS_ALLOWED_ORIGINS (settings.cors_origins), not a wildcard — set it
# to the real client origin(s) in .env for any non-local deployment.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

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
app.include_router(ai_caption.router)
app.include_router(instagram.router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
