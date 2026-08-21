"""Structured security event logging (SecurityFeatures.md F-6). Plain stdlib `logging` —
JSON to stdout, no new dependency — so it works today and can be piped into any log
aggregator once one exists. Never log the JWT, a password, or a DM body (F-6's explicit
warning, given SecurityIssues.md M-1 already put tokens where they shouldn't be).
"""

import datetime
import json
import logging
import uuid
from contextvars import ContextVar
from typing import Any

from app.core.config import settings

request_id_var: ContextVar[str | None] = ContextVar("request_id", default=None)

# Every attribute a bare `logging.LogRecord` carries — anything else on a record is a
# caller-supplied structured field and gets promoted to a top-level JSON key.
_STANDARD_RECORD_KEYS = frozenset(vars(logging.LogRecord("", 0, "", 0, "", (), None)).keys())


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.datetime.fromtimestamp(
                record.created, tz=datetime.timezone.utc
            ).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        request_id = request_id_var.get()
        if request_id is not None:
            payload["request_id"] = request_id
        for key, value in record.__dict__.items():
            if key not in _STANDARD_RECORD_KEYS:
                payload[key] = value
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


def configure_logging() -> None:
    # stdout only (Roadmap_Scaling.md A5) — no file handlers, no rotation; the container
    # runtime (or, locally, the terminal) owns that.
    handler = logging.StreamHandler()
    if settings.log_format == "json":
        handler.setFormatter(JsonFormatter())
    else:
        handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(logging.INFO)


security_logger = logging.getLogger("security")


def new_request_id() -> str:
    return uuid.uuid4().hex


def log_security_event(event: str, level: int = logging.INFO, **fields: Any) -> None:
    """`event` is a short dotted name (`auth.login_failed`, `auth.register_success`,
    `security.forbidden`, `security.rate_limited`, `security.unhandled_exception`) —
    keep it as a stable, gradually-growing enum of event names rather than free text, so
    a later reader/alert rule can match on it."""
    security_logger.log(level, event, extra={"event": event, **fields})
