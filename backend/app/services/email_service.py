import os
import asyncio
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.config import settings

logger = logging.getLogger("email_service")


def _send_smtp_sync(to_email: str, subject: str, html_content: str) -> bool:
    """Synchronous SMTP email delivery using smtplib and STARTTLS with detailed logs."""
    host = settings.SMTP_HOST or "smtp.gmail.com"
    port = settings.SMTP_PORT or 587
    user = settings.SMTP_USERNAME
    password = (settings.SMTP_PASSWORD or "").replace(" ", "")
    from_email = settings.SMTP_FROM or user or "noreply@zeplay.dev"

    logger.info(f"Initiating SMTP mail transfer to {to_email} via {host}:{port}")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"ZePlay <{from_email}>"
    msg["To"] = to_email
    msg.attach(MIMEText(html_content, "html"))

    try:
        logger.info(f"Connecting to SMTP server at {host}:{port}...")
        with smtplib.SMTP(host, port, timeout=15.0) as server:
            logger.info("SMTP socket connected. Starting TLS handshake...")
            server.starttls()
            logger.info(f"TLS established. Authenticating as user: {user}...")
            server.login(user, password)
            logger.info(f"Authentication succeeded. Sending message to: {to_email}...")
            server.sendmail(from_email, [to_email], msg.as_string())
            logger.info(f"Message successfully transferred to MTA for recipient: {to_email}")
        return True
    except Exception as e:
        logger.error(f"Detailed SMTP error during transmission: {e}", exc_info=True)
        raise e


async def send_email(to_email: str, subject: str, html_content: str) -> bool:
    """
    Sends an email using Gmail SMTP.
    If SMTP credentials are not configured, it writes to a local log file
    so development links can be easily retrieved.
    """
    log_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    log_file_path = os.path.join(log_dir, "local_emails.log")
    
    log_entry = f"========================================\n" \
                f"TO: {to_email}\n" \
                f"SUBJECT: {subject}\n" \
                f"BODY:\n{html_content}\n" \
                f"========================================\n\n"

    # Check if SMTP service is configured
    smtp_configured = bool(settings.SMTP_USERNAME and settings.SMTP_PASSWORD)
    if not smtp_configured:
        logger.warning("SMTP_USERNAME / SMTP_PASSWORD not configured. Skipping real email delivery.")
        try:
            with open(log_file_path, "a", encoding="utf-8") as f:
                f.write(log_entry)
            logger.info(f"Local email copy logged to {log_file_path}")
        except Exception as e:
            logger.error(f"Failed to log email locally: {e}")
        print(f"\n[EMAIL SIMULATOR] Sent email to {to_email}. Inspect 'local_emails.log' for links.\n")
        return True

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
            f"  From   : {settings.SMTP_FROM or settings.SMTP_USERNAME}\n"
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
