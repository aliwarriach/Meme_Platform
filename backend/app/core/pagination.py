import base64
import datetime
import uuid

from app.core.exceptions import InvalidCursorError


def encode_cursor(created_at: datetime.datetime, id_: uuid.UUID) -> str:
    raw = f"{created_at.isoformat()}|{id_}"
    return base64.urlsafe_b64encode(raw.encode()).decode()


def decode_cursor(cursor: str) -> tuple[datetime.datetime, uuid.UUID]:
    try:
        raw = base64.urlsafe_b64decode(cursor.encode()).decode()
        created_at_str, id_str = raw.split("|")
        return datetime.datetime.fromisoformat(created_at_str), uuid.UUID(id_str)
    except Exception as exc:
        raise InvalidCursorError("Invalid pagination cursor") from exc
