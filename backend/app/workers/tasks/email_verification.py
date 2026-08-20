from app.integrations.gmail_client import send_email

OTP_EMAIL_SUBJECT = "Your MemeVerse verification code"


async def send_email_otp_job(ctx: dict, user_id: str, to_email: str, otp: str) -> None:
    body = (
        f"Your MemeVerse verification code is {otp}.\n\n"
        "It expires in 10 minutes. If you didn't request this, you can ignore this email."
    )
    # `services/email_verification.py::request_email_otp` enqueues this and never awaits
    # its result (fire-and-forget, matching the notification jobs) — the caller's HTTP
    # response has already been sent by the time this runs. Letting `send_email` raise
    # on failure is deliberate: arq logs the failure and retries with backoff on its own
    # (default up to 5 attempts) rather than needing bespoke retry logic here.
    await send_email(to_email, OTP_EMAIL_SUBJECT, body)
