import logging
import signal
import threading
from contextlib import asynccontextmanager
from types import FrameType

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from app.core.config import settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import configure_logging, log_security_event, new_request_id, request_id_var
from app.core.rate_limit import limiter
from app.core.redis import close_arq_pool, get_arq_pool
from app.routers import (
    ai_caption,
    auth,
    blocks,
    challenges,
    communities,
    competitions,
    friends,
    hashtags,
    health,
    instagram,
    leaderboards,
    media,
    meme_sending,
    memes,
    messaging,
    notifications,
    profiles,
    templates,
)
from app.websockets.connection_manager import connection_manager
from app.websockets.pubsub import pubsub_bus


configure_logging()

logger = logging.getLogger(__name__)

# The handler `signal.signal()` had installed for SIGTERM before ours (uvicorn's own
# `Server.handle_exit`, in real deployment) — captured at registration time so our handler
# can chain to it below. Without this, replacing the handler outright would mean SIGTERM
# never actually triggers uvicorn's own drain-then-exit sequence; it would just flip our
# flag and the process would keep running forever.
_previous_sigterm_handler = None


def _handle_sigterm(signum: int, frame: FrameType | None) -> None:
    # Flips first, unconditionally, before anything else — this is the one thing that must
    # happen the instant the signal arrives (Roadmap_Scaling.md A3): `/health/ready` starts
    # returning 503 so a polling load balancer stops routing new traffic here, *before* the
    # rest of the drain sequence (below) even begins.
    health.mark_shutting_down()
    logger.info("Received SIGTERM — marking not-ready and draining")
    if callable(_previous_sigterm_handler):
        _previous_sigterm_handler(signum, frame)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Warms the shared arq connection pool used to *enqueue* jobs (AI captions,
    # Instagram metadata fetch) — actual job execution happens in a separate
    # `arq app.workers.arq_worker.WorkerSettings` process, started independently.
    # Challenge window-close and score recompute are arq cron jobs on that same
    # worker process, not started here at all.
    await get_arq_pool()
    # This pod's long-lived Redis pub/sub connection (Roadmap_Scaling.md A1) — separate
    # from the arq pool above, since a connection in subscribe mode can't serve other
    # Redis commands. `deliver_local` is called when another pod publishes for a user this
    # pod holds a local socket for.
    await pubsub_bus.start(connection_manager.deliver_local)

    # Signals can only be registered from the main thread (mirrors uvicorn's own guard in
    # `Server.capture_signals`) — under `TestClient(app)`, this lifespan runs on anyio's
    # portal thread instead, where `signal.signal()` would raise; skip registration there,
    # same as uvicorn itself does when it isn't on the main thread.
    global _previous_sigterm_handler
    if threading.current_thread() is threading.main_thread():
        _previous_sigterm_handler = signal.signal(signal.SIGTERM, _handle_sigterm)

    yield

    # Realtime pods (A6/C2) hold long-lived sockets — send a real close frame so clients
    # reconnect deliberately instead of hanging on a half-open connection.
    await connection_manager.close_all()
    await pubsub_bus.stop()
    await close_arq_pool()


# Interactive docs (/docs, /redoc) and the raw schema (/openapi.json) map every endpoint,
# parameter and shape to any anonymous caller — fine for local dev, not for a public
# deployment (SecurityIssues.md L-3). Set ENVIRONMENT=production in .env to disable them.
app = FastAPI(
    title="Meme Platform API",
    lifespan=lifespan,
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
    openapi_url=None if settings.is_production else "/openapi.json",
)

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


@app.exception_handler(RateLimitExceeded)
async def _handle_rate_limit_exceeded(request: Request, exc: RateLimitExceeded) -> Response:
    # A rejection here means a limiter key hit its ceiling — worth its own event name
    # rather than folding into "security.forbidden", since it's a distinct signal
    # (automation/abuse pattern vs. a single unauthorized action) (SecurityFeatures.md F-6).
    log_security_event(
        "security.rate_limited",
        path=request.url.path,
        method=request.method,
        client_ip=get_remote_address(request),
    )
    return _rate_limit_exceeded_handler(request, exc)


app.add_middleware(SlowAPIMiddleware)


# Baseline defense-in-depth headers (SecurityIssues.md I-1). Browsers only honor
# Strict-Transport-Security over an already-secure connection, so sending it
# unconditionally is safe even in local HTTP dev — it's simply ignored there.
@app.middleware("http")
async def _security_headers(request: Request, call_next) -> Response:
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


# Outermost middleware: stamps a request ID (returned as X-Request-ID, and available to
# every log call made while handling this request via the request_id_var contextvar) and
# logs any exception that reaches here unhandled, before re-raising so Starlette's own
# error handling still produces the response — this only adds observability, it doesn't
# change what gets returned to the caller (SecurityFeatures.md F-6).
@app.middleware("http")
async def _request_id_and_unhandled_exceptions(request: Request, call_next) -> Response:
    req_id = new_request_id()
    token = request_id_var.set(req_id)
    try:
        try:
            response = await call_next(request)
        except Exception as exc:
            log_security_event(
                "security.unhandled_exception",
                level=logging.ERROR,
                path=request.url.path,
                method=request.method,
                client_ip=request.client.host if request.client else None,
                error_type=type(exc).__name__,
            )
            raise
    finally:
        request_id_var.reset(token)
    response.headers["X-Request-ID"] = req_id
    return response

register_exception_handlers(app)
app.include_router(auth.router)
app.include_router(friends.router)
app.include_router(blocks.router)
app.include_router(memes.router)
app.include_router(media.router)
app.include_router(templates.router)
app.include_router(communities.router)
app.include_router(leaderboards.router)
app.include_router(competitions.router)
app.include_router(challenges.router)
app.include_router(challenges.flat_router)
app.include_router(hashtags.router)
app.include_router(meme_sending.router)
app.include_router(messaging.router)
app.include_router(notifications.router)
app.include_router(ai_caption.router)
app.include_router(instagram.router)
app.include_router(profiles.router)
app.include_router(health.router)
