import os
import httpx
import logging
from app.config import settings

logger = logging.getLogger("email_service")

async def send_email(to_email: str, subject: str, html_content: str):
    """
    Sends an email using Resend API.
    If the Resend API key is not configured, it writes to a local log file
    so development links can be easily retrieved.
    """
    # Write to local file for debug
    log_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    log_file_path = os.path.join(log_dir, "local_emails.log")
    
    log_entry = f"========================================\n" \
                f"TO: {to_email}\n" \
                f"SUBJECT: {subject}\n" \
                f"BODY:\n{html_content}\n" \
                f"========================================\n\n"
                
    try:
        with open(log_file_path, "a", encoding="utf-8") as f:
            f.write(log_entry)
        logger.info(f"Local email copy logged to {log_file_path}")
    except Exception as e:
        logger.error(f"Failed to log email locally: {e}")

    # Real Resend API delivery
    if not settings.RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not configured. Skipping real email delivery.")
        print(f"\n[EMAIL SIMULATOR] Sent email to {to_email}. Inspect 'local_emails.log' for links.\n")
        return True

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "from": settings.RESEND_FROM_EMAIL,
                    "to": to_email,
                    "subject": subject,
                    "html": html_content
                },
                timeout=10.0
            )
            if response.status_code >= 400:
                logger.error(f"Resend returned error: {response.status_code} - {response.text}")
                return False
            
            logger.info(f"Email sent successfully to {to_email} via Resend. ID: {response.json().get('id')}")
            return True
    except Exception as e:
        logger.error(f"Exception during email delivery to {to_email}: {e}")
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
