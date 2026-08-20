"""Sends transactional email (currently: the email-verification OTP, SecurityFeatures.md
F-1) via the Gmail API, authenticated as `settings.gmail_sender_email` using a
pre-authorized OAuth2 refresh token — not a password, and not "less secure app access".

Setup (one-time, done outside this app):
1. Create a Google Cloud Console project, enable the Gmail API.
2. Create an OAuth 2.0 Client ID (type: Desktop app).
3. Run a one-time consent flow as the sending Gmail account, requesting the
   `https://www.googleapis.com/auth/gmail.send` scope, to obtain a refresh token.
4. Set GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REFRESH_TOKEN,
   GMAIL_SENDER_EMAIL in `.env`.

Raw `httpx` calls for both the OAuth2 token refresh and the Gmail send itself, rather
than the `google-auth`/`google-api-python-client` SDKs — same precedent as this
codebase's other external integrations (`integrations/llm_client.py` for Groq,
`integrations/expo_push.py` for Expo). `google-auth`'s synchronous transport also
requires the `requests` package, a poor fit alongside this app's async stack.
"""

import base64
from email.mime.text import MIMEText

import httpx

from app.core.config import settings

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"
REQUEST_TIMEOUT_SECONDS = 8.0


class EmailSendError(Exception):
    pass


def _is_configured() -> bool:
    return bool(
        settings.google_oauth_client_id
        and settings.google_oauth_client_secret
        and settings.google_oauth_refresh_token
        and settings.gmail_sender_email
    )


async def _refresh_access_token(client: httpx.AsyncClient) -> str:
    response = await client.post(
        GOOGLE_TOKEN_URL,
        data={
            "client_id": settings.google_oauth_client_id,
            "client_secret": settings.google_oauth_client_secret,
            "refresh_token": settings.google_oauth_refresh_token,
            "grant_type": "refresh_token",
        },
    )
    if response.status_code >= 400:
        raise EmailSendError(
            f"Google OAuth token refresh failed ({response.status_code}): {response.text}"
        )
    access_token = response.json().get("access_token")
    if not access_token:
        raise EmailSendError("Google OAuth token refresh returned no access_token")
    return access_token


async def send_email(to: str, subject: str, body: str) -> None:
    """Raises `EmailSendError` on any failure (misconfiguration, token refresh failure,
    Gmail API rejection) — callers (arq job bodies) must treat this as best-effort and
    never let it block or crash a request/response cycle, same convention as
    `integrations/expo_push.py`."""
    if not _is_configured():
        raise EmailSendError(
            "Gmail sending is not configured — set GOOGLE_OAUTH_CLIENT_ID, "
            "GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REFRESH_TOKEN and GMAIL_SENDER_EMAIL."
        )

    message = MIMEText(body)
    message["to"] = to
    message["from"] = settings.gmail_sender_email
    message["subject"] = subject
    raw = base64.urlsafe_b64encode(message.as_bytes()).decode("ascii")

    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS) as client:
        access_token = await _refresh_access_token(client)
        response = await client.post(
            GMAIL_SEND_URL,
            json={"raw": raw},
            headers={"Authorization": f"Bearer {access_token}"},
        )
    if response.status_code >= 400:
        raise EmailSendError(
            f"Gmail API rejected the send ({response.status_code}): {response.text}"
        )
