from app.integrations.gmail_client import send_email

RESET_EMAIL_SUBJECT = "Your Mosh password reset code"


async def send_password_reset_otp_job(ctx: dict, user_id: str, to_email: str, otp: str) -> None:
    body = (
        f"Your Mosh password reset code is {otp}.\n\n"
        "It expires in 10 minutes. If you didn't request this, you can safely ignore "
        "this email — your password hasn't been changed."
    )
    await send_email(to_email, RESET_EMAIL_SUBJECT, body)
