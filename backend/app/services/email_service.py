import os
import asyncio
import smtplib
import logging
import resend
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.config import settings

logger = logging.getLogger("email_service")


def _send_resend_sync(to_email: str, subject: str, html_content: str) -> bool:
    """
    Synchronous Resend email delivery using resend-python SDK.
    """
    resend.api_key = settings.RESEND_API_KEY
    from_email = settings.EMAIL_FROM
    
    logger.info(f"[Resend] Attempting API delivery to {to_email} from {from_email}")
    try:
        response = resend.Emails.send({
            "from": f"ZePlay <{from_email}>",
            "to": to_email,
            "subject": subject,
            "html": html_content
        })
        # Try to retrieve ID; API response for resend-python is typically a dict or model with id
        email_id = getattr(response, "id", None) or response.get("id", "unknown-id")
        logger.info(f"[Resend] ✓ Delivered successfully via Resend API. ID: {email_id}")
        return True
    except Exception as err:
        logger.error(f"[Resend] Delivery failed: {err}", exc_info=True)
        raise err


def _send_smtp_sync(to_email: str, subject: str, html_content: str) -> bool:
    """
    Synchronous SMTP email delivery.

    Strategy:
      1. Try port 465 with SMTP_SSL (implicit TLS) — works on Render and most cloud hosts.
      2. Fall back to port 587 with STARTTLS — works on most local / office networks.

    Gmail App Password must be used (spaces are stripped automatically).
    """
    host = settings.SMTP_HOST or "smtp.gmail.com"
    user = settings.SMTP_USERNAME
    password = (settings.SMTP_PASSWORD or "").replace(" ", "")
    from_email = settings.SMTP_FROM or user or settings.EMAIL_FROM or "noreply@zeplay.dev"

    # Build the message once
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"ZePlay <{from_email}>"
    msg["To"] = to_email
    msg.attach(MIMEText(html_content, "html"))
    raw_msg = msg.as_string()

    # ── Attempt 1: Port 465 implicit SSL ──────────────────────────────────────
    try:
        logger.info(f"[SMTP] Attempting SSL on {host}:465 for {to_email}")
        with smtplib.SMTP_SSL(host, 465, timeout=10.0) as server:
            server.ehlo()
            server.login(user, password)
            server.sendmail(from_email, [to_email], raw_msg)
        logger.info(f"[SMTP] ✓ Delivered via SSL:465 to {to_email}")
        return True
    except Exception as ssl_err:
        logger.warning(f"[SMTP] SSL:465 failed ({type(ssl_err).__name__}: {ssl_err}). Trying STARTTLS:587 ...")

    # ── Attempt 2: Port 587 STARTTLS ─────────────────────────────────────────
    try:
        logger.info(f"[SMTP] Attempting STARTTLS on {host}:587 for {to_email}")
        with smtplib.SMTP(host, 587, timeout=10.0) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(user, password)
            server.sendmail(from_email, [to_email], raw_msg)
        logger.info(f"[SMTP] ✓ Delivered via STARTTLS:587 to {to_email}")
        return True
    except Exception as tls_err:
        logger.error(f"[SMTP] STARTTLS:587 also failed ({type(tls_err).__name__}: {tls_err})", exc_info=True)
        raise tls_err


async def send_email(to_email: str, subject: str, html_content: str) -> bool:
    """
    Sends an email using configured provider (Resend or Gmail SMTP).
    If credentials are not configured or provider is local, it writes to a local log file.
    """
    log_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    log_file_path = os.path.join(log_dir, "local_emails.log")
    
    log_entry = f"========================================\n" \
                f"TO: {to_email}\n" \
                f"SUBJECT: {subject}\n" \
                f"BODY:\n{html_content}\n" \
                f"========================================\n\n"

    import sys
    provider = (settings.EMAIL_PROVIDER or "resend").lower()
    if "pytest" in sys.modules:
        provider = "local"

    # Pre-flight check / configuration fallback
    if provider == "resend" and not settings.RESEND_API_KEY:
        logger.warning("EMAIL_PROVIDER is set to 'resend' but RESEND_API_KEY is not configured. Falling back to local logging.")
        provider = "local"
    elif provider == "smtp" and not (settings.SMTP_USERNAME and settings.SMTP_PASSWORD):
        logger.warning("EMAIL_PROVIDER is set to 'smtp' but SMTP credentials are not configured. Falling back to local logging.")
        provider = "local"

    if provider == "local":
        try:
            with open(log_file_path, "a", encoding="utf-8") as f:
                f.write(log_entry)
            logger.info(f"Local email copy logged to {log_file_path}")
        except Exception as e:
            logger.error(f"Failed to log email locally: {e}")
        print(f"\n[EMAIL SIMULATOR] Sent email to {to_email}. Inspect 'local_emails.log' for links.\n")
        return True

    if provider == "resend":
        try:
            await asyncio.to_thread(_send_resend_sync, to_email, subject, html_content)
            logger.info(f"Email sent successfully to {to_email} via Resend API.")
            print(f"\n[OK EMAIL SENT] Email delivered to {to_email} via Resend API.\n")
            return True
        except Exception as e:
            logger.error(f"Exception during Resend email delivery to {to_email}: {e}")
            banner = (
                f"\n{'='*60}\n"
                f"  [!] RESEND EMAIL DELIVERY FAILED\n"
                f"  To     : {to_email}\n"
                f"  From   : {settings.EMAIL_FROM}\n"
                f"  Error  : {e}\n"
                f"{'='*60}\n"
            )
            print(banner)

            # Append the email content and error to the local log so it's traceable offline
            try:
                with open(log_file_path, "a", encoding="utf-8") as f:
                    f.write(log_entry)
                    f.write(f"[RESEND ERROR] For {to_email}: {e}\n\n")
            except Exception:
                pass
            return False

    # Otherwise SMTP
    try:
        await asyncio.to_thread(_send_smtp_sync, to_email, subject, html_content)
        logger.info(f"Email sent successfully to {to_email} via Gmail SMTP.")
        print(f"\n[OK EMAIL SENT] Email delivered to {to_email} via Gmail SMTP.\n")
        return True
    except Exception as e:
        logger.error(f"Exception during SMTP email delivery to {to_email}: {e}")
        banner = (
            f"\n{'='*60}\n"
            f"  [!] GMAIL SMTP EMAIL DELIVERY FAILED\n"
            f"  To     : {to_email}\n"
            f"  From   : {settings.SMTP_FROM or settings.SMTP_USERNAME or settings.EMAIL_FROM}\n"
            f"  Error  : {e}\n"
            f"{'='*60}\n"
        )
        print(banner)

        # Append the email content and error to the local log so it's traceable offline
        try:
            with open(log_file_path, "a", encoding="utf-8") as f:
                f.write(log_entry)
                f.write(f"[SMTP ERROR] For {to_email}: {e}\n\n")
        except Exception:
            pass
        return False


async def send_verification_email(to_email: str, name: str, token: str):
    """Sends a verification email with professional ZePlay branding."""
    verify_url = f"{settings.FRONTEND_URL}/verify-email?token={token}"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Verify your Email - ZePlay</title>
        <style>
            body {{
                background-color: #060B18;
                color: #FFFFFF;
                font-family: 'Inter', sans-serif;
                margin: 0;
                padding: 40px 20px;
            }}
            .container {{
                max-width: 500px;
                margin: 0 auto;
                background-color: #0B1535;
                border: 1px solid rgba(255, 255, 255, 0.05);
                border-radius: 16px;
                padding: 32px;
                text-align: center;
            }}
            .logo {{
                font-family: 'Outfit', sans-serif;
                font-size: 28px;
                font-weight: 900;
                color: #3B82F6;
                margin-bottom: 24px;
            }}
            h1 {{
                font-family: 'Outfit', sans-serif;
                font-size: 24px;
                margin-bottom: 16px;
                color: #FFFFFF;
            }}
            p {{
                font-size: 14px;
                color: #A8B3CF;
                line-height: 1.6;
                margin-bottom: 24px;
            }}
            .btn {{
                display: inline-block;
                background-color: #3B82F6;
                color: #FFFFFF !important;
                text-decoration: none;
                font-weight: bold;
                font-size: 14px;
                padding: 12px 28px;
                border-radius: 8px;
                box-shadow: 0 0 20px rgba(59, 130, 246, 0.35);
                margin-bottom: 24px;
            }}
            .footer {{
                font-size: 11px;
                color: #52525B;
                margin-top: 32px;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="logo">ZePlay</div>
            <h1>Verify your email address</h1>
            <p>Hi {name},</p>
            <p>Welcome to ZePlay space! Click the button below to verify your email address and activate your account.</p>
            <a href="{verify_url}" class="btn">Verify Email Address</a>
            <p>If the button doesn't work, copy and paste this link in your browser:</p>
            <p style="word-break: break-all; font-size: 12px; color: #3B82F6;">{verify_url}</p>
            <div class="footer">&copy; {datetime_now_year()} ZePlay. All rights reserved.</div>
        </div>
    </body>
    </html>
    """
    return await send_email(to_email, "Verify your email - ZePlay", html_content)


async def send_password_reset_email(to_email: str, name: str, token: str):
    """Sends a password reset email with professional ZePlay branding."""
    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Reset your Password - ZePlay</title>
        <style>
            body {{
                background-color: #060B18;
                color: #FFFFFF;
                font-family: 'Inter', sans-serif;
                margin: 0;
                padding: 40px 20px;
            }}
            .container {{
                max-width: 500px;
                margin: 0 auto;
                background-color: #0B1535;
                border: 1px solid rgba(255, 255, 255, 0.05);
                border-radius: 16px;
                padding: 32px;
                text-align: center;
            }}
            .logo {{
                font-family: 'Outfit', sans-serif;
                font-size: 28px;
                font-weight: 900;
                color: #3B82F6;
                margin-bottom: 24px;
            }}
            h1 {{
                font-family: 'Outfit', sans-serif;
                font-size: 24px;
                margin-bottom: 16px;
                color: #FFFFFF;
            }}
            p {{
                font-size: 14px;
                color: #A8B3CF;
                line-height: 1.6;
                margin-bottom: 24px;
            }}
            .btn {{
                display: inline-block;
                background-color: #3B82F6;
                color: #FFFFFF !important;
                text-decoration: none;
                font-weight: bold;
                font-size: 14px;
                padding: 12px 28px;
                border-radius: 8px;
                box-shadow: 0 0 20px rgba(59, 130, 246, 0.35);
                margin-bottom: 24px;
            }}
            .footer {{
                font-size: 11px;
                color: #52525B;
                margin-top: 32px;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="logo">ZePlay</div>
            <h1>Reset your password</h1>
            <p>Hi {name},</p>
            <p>We received a request to reset your password. Click the button below to set a new password for your account.</p>
            <a href="{reset_url}" class="btn">Reset Password</a>
            <p>If you did not request this, you can ignore this email. The link will expire in 2 hours.</p>
            <p>If the button doesn't work, copy and paste this link in your browser:</p>
            <p style="word-break: break-all; font-size: 12px; color: #3B82F6;">{reset_url}</p>
            <div class="footer">&copy; {datetime_now_year()} ZePlay. All rights reserved.</div>
        </div>
    </body>
    </html>
    """
    return await send_email(to_email, "Reset your password - ZePlay", html_content)


def datetime_now_year() -> int:
    from datetime import datetime
    return datetime.now().year
