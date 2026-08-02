import datetime
import uuid
from typing import NamedTuple

import bcrypt
from jose import JWTError, jwt

from app.core.config import settings


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: uuid.UUID, token_version: int) -> str:
    expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(
        minutes=settings.jwt_expire_minutes
    )
    payload = {"sub": str(user_id), "tv": token_version, "exp": expires_at}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


class InvalidTokenError(Exception):
    pass


class DecodedToken(NamedTuple):
    user_id: uuid.UUID
    token_version: int


def decode_access_token(token: str) -> DecodedToken:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise InvalidTokenError from exc

    subject = payload.get("sub")
    token_version = payload.get("tv")
    if subject is None or token_version is None:
        raise InvalidTokenError

    try:
        return DecodedToken(uuid.UUID(subject), int(token_version))
    except (ValueError, TypeError) as exc:
        raise InvalidTokenError from exc
