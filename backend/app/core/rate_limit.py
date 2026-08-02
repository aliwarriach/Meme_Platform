from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings
from app.core.security import InvalidTokenError, decode_access_token


def _rate_limit_key(request: Request) -> str:
    """Key by authenticated user when a valid bearer token is present, so limits
    track the account rather than a shared/rotating IP; unauthenticated requests
    (register/login, where there's no user yet) fall back to the client IP."""
    auth_header = request.headers.get("authorization")
    if auth_header and auth_header.lower().startswith("bearer "):
        token = auth_header.split(" ", 1)[1]
        try:
            decoded = decode_access_token(token)
            return f"user:{decoded.user_id}"
        except InvalidTokenError:
            pass
    return get_remote_address(request)


limiter = Limiter(key_func=_rate_limit_key, storage_uri=settings.redis_url)
