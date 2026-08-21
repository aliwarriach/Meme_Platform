"""Roadmap_Scaling.md A5 — JSON logs to stdout.

The `JsonFormatter` itself predates this phase (SecurityFeatures.md F-6) — A5 only adds
the `log_format` setting gate (`configure_logging` picks JSON vs. a plain text formatter)
and this dedicated test coverage. Tests attach their own capturing handler directly to a
logger rather than depending on `configure_logging()`'s one-time, settings-driven choice
at import time, so they're unaffected by whatever `LOG_FORMAT` happens to be set locally.
"""

import io
import json
import logging

from httpx import AsyncClient

import app.core.logging as logging_module
from app.core.logging import JsonFormatter, log_security_event, request_id_var


def _capture_json_logs(logger: logging.Logger) -> tuple[io.StringIO, logging.Handler]:
    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    handler.setFormatter(JsonFormatter())
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    return stream, handler


def test_json_formatter_output_is_valid_json_with_required_fields():
    logger = logging.getLogger("tests.a5.formatter")
    stream, handler = _capture_json_logs(logger)
    try:
        token = request_id_var.set("test-request-id")
        try:
            logger.info("hello world")
        finally:
            request_id_var.reset(token)
    finally:
        logger.removeHandler(handler)

    payload = json.loads(stream.getvalue().strip())
    assert payload["message"] == "hello world"
    assert payload["level"] == "INFO"
    assert payload["logger"] == "tests.a5.formatter"
    assert payload["request_id"] == "test-request-id"
    assert "timestamp" in payload


def test_log_security_event_kwargs_survive_as_top_level_json_fields():
    logger = logging.getLogger("security")
    stream, handler = _capture_json_logs(logger)
    try:
        log_security_event("tests.a5_event", client_ip="127.0.0.1", path="/x")
    finally:
        logger.removeHandler(handler)

    payload = json.loads(stream.getvalue().strip())
    assert payload["event"] == "tests.a5_event"
    assert payload["client_ip"] == "127.0.0.1"
    assert payload["path"] == "/x"
    # Never flattened into the message string — each stays its own JSON field.
    assert payload["message"] == "tests.a5_event"


def test_configure_logging_selects_the_formatter_from_settings(monkeypatch):
    root = logging.getLogger()
    original_handlers = root.handlers[:]
    try:
        monkeypatch.setattr(logging_module.settings, "log_format", "json")
        logging_module.configure_logging()
        assert isinstance(root.handlers[0].formatter, JsonFormatter)

        monkeypatch.setattr(logging_module.settings, "log_format", "text")
        logging_module.configure_logging()
        assert not isinstance(root.handlers[0].formatter, JsonFormatter)
    finally:
        root.handlers = original_handlers


async def test_request_id_in_a_real_log_line_matches_the_response_header(client: AsyncClient):
    root_logger = logging.getLogger()
    stream, handler = _capture_json_logs(root_logger)
    try:
        response = await client.post(
            "/auth/register",
            json={
                "email": "a5logtest@test.com",
                "username": "a5logtest",
                "password": "password123",
                "date_of_birth": "2000-01-01",
            },
        )
    finally:
        root_logger.removeHandler(handler)

    assert response.status_code == 201
    header_request_id = response.headers["X-Request-ID"]

    lines = [json.loads(line) for line in stream.getvalue().splitlines() if line.strip()]
    register_events = [line for line in lines if line.get("event") == "auth.register_success"]
    assert register_events, "expected an auth.register_success log line for this request"
    assert register_events[0]["request_id"] == header_request_id
