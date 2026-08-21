from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# ASVS 5.0 key-management guidance for an HMAC signing key is >=256 bits of entropy.
# Length is a practical proxy for entropy on a string we didn't generate ourselves (real
# Shannon-entropy measurement needs the generation process, not just the output) — 32
# characters is the floor a `secrets.token_urlsafe(n)`-style secret clears comfortably,
# while still catching the actual failure mode this exists for: `changeme` or a short
# placeholder shipping to a real deployment (SecurityFeatures.md F-8).
MIN_JWT_SECRET_LENGTH = 32


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # "development" (default) or "production" — gates dev-only conveniences that must
    # never ship to a public deployment: the interactive API docs (main.py) and a
    # localhost-trusting CORS policy (cors_origins below). Set ENVIRONMENT=production
    # in .env for any non-local deployment.
    environment: str = "development"

    database_url: str
    test_database_url: str | None = None
    redis_url: str
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24

    @field_validator("jwt_secret")
    @classmethod
    def _reject_weak_jwt_secret(cls, value: str) -> str:
        # Fails closed, unconditionally — not gated on ENVIRONMENT=production. A weak
        # secret here means anyone can forge a JWT for any user (SecurityFeatures.md
        # F-8's stated worst case), so "only enforce it in prod" would just mean the
        # mistake ships the first time someone forgets to set ENVIRONMENT.
        if value == "changeme" or len(value) < MIN_JWT_SECRET_LENGTH:
            raise ValueError(
                f"JWT_SECRET is missing or too weak (must be >= {MIN_JWT_SECRET_LENGTH} "
                "characters and not the placeholder 'changeme'). Generate one with: "
                'python -c "import secrets; print(secrets.token_urlsafe(64))"'
            )
        return value

    cloudinary_cloud_name: str
    cloudinary_api_key: str
    cloudinary_api_secret: str

    groq_api_key: str
    # llama-3.1-8b-instant (and the rest of Groq's Llama lineup) was removed from Groq's
    # catalog (confirmed 2026-08-21: returns 404 model_not_found) — gpt-oss-20b is the
    # current cheapest/fastest production model. It's a reasoning model, which
    # `llm_client.py` accounts for via `reasoning_effort: "low"`.
    groq_model: str = "openai/gpt-oss-20b"

    # Gmail API OAuth2 credentials for sending email-verification OTPs
    # (SecurityFeatures.md F-1) — optional so the app still starts without them configured;
    # `integrations/gmail_client.py` raises a clear error only when actually asked to send.
    # `google_oauth_refresh_token` comes from a one-time OAuth consent flow run outside the
    # app (see .claude/memory/hardening.md for the exact steps) — never a password.
    google_oauth_client_id: str | None = None
    google_oauth_client_secret: str | None = None
    google_oauth_refresh_token: str | None = None
    gmail_sender_email: str | None = None

    # "Sign in with Google" (SecurityFeatures.md F-7) — a *separate* set of OAuth 2.0
    # Client IDs from google_oauth_client_id above (that one is a Desktop-app credential
    # for server-side Gmail sending; these are the iOS/Android/Web client IDs
    # expo-auth-session uses on the device). Comma-separated because Expo's Google
    # provider issues ID tokens with a different `aud` per platform — every accepted
    # audience must be listed, or `services/google_auth.py` rejects the token outright.
    google_signin_client_ids: str = ""

    @property
    def google_signin_audiences(self) -> list[str]:
        return [c.strip() for c in self.google_signin_client_ids.split(",") if c.strip()]

    # Comma-separated list of allowed origins. Defaults to Expo's local dev web ports;
    # override in .env with the real client origin(s) before any non-dev deployment.
    cors_allowed_origins: str = "http://localhost:8081,http://localhost:19006"

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def cors_origins(self) -> list[str]:
        origins = [origin.strip() for origin in self.cors_allowed_origins.split(",") if origin.strip()]
        # Fail startup rather than silently serving a deployment with a localhost-trusting
        # (or empty) CORS policy — a deployment that simply forgets to set
        # CORS_ALLOWED_ORIGINS would otherwise ship with the dev default (SecurityIssues.md L-7).
        if self.is_production and (
            not origins or any("localhost" in o or "127.0.0.1" in o for o in origins)
        ):
            raise RuntimeError(
                "CORS_ALLOWED_ORIGINS must be set to the real client origin(s) when "
                "ENVIRONMENT=production — refusing to start with a localhost-trusting "
                "or empty CORS policy."
            )
        return origins


settings = Settings()
