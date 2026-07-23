from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.core.config import settings
from app.core.exceptions import register_exception_handlers
from app.core.rate_limit import limiter
from app.core.redis import close_arq_pool, get_arq_pool
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Warms the shared arq connection pool used to *enqueue* jobs (AI captions,
    # Instagram metadata fetch) — actual job execution happens in a separate
    # `arq app.workers.arq_worker.WorkerSettings` process, started independently.
    # Challenge window-close and score recompute are arq cron jobs on that same
    # worker process, not started here at all.
    await get_arq_pool()
    yield
    await close_arq_pool()


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
