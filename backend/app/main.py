from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.exceptions import register_exception_handlers
from app.routers import auth, communities, friends, memes, templates

app = FastAPI(title="Meme Platform API")

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


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
