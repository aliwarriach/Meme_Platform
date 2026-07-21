import datetime
import uuid

import bcrypt
from jose import JWTError, jwt

from app.core.config import settings


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: uuid.UUID) -> str:
    expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(
        minutes=settings.jwt_expire_minutes
    )
    payload = {"sub": str(user_id), "exp": expires_at}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


class InvalidTokenError(Exception):
    pass


def decode_access_token(token: str) -> uuid.UUID:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise InvalidTokenError from exc

    subject = payload.get("sub")
    if subject is None:
        raise InvalidTokenError

    try:
        return uuid.UUID(subject)
    except ValueError as exc:
        raise InvalidTokenError from exc
