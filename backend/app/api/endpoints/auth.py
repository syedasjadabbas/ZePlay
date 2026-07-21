import secrets
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.database import get_db
from app.models.user import User
from app.models.email_verification_token import EmailVerificationToken
from app.models.password_reset_token import PasswordResetToken
from app.schemas.user import (
    UserCreate, 
    UserResponse, 
    Token, 
    EmailVerifyRequest, 
    ForgotPasswordRequest, 
    ResetPasswordRequest
)
from app.core import security
from app.api import deps
from app.services.email_service import send_verification_email, send_password_reset_email
from app.config import settings

router = APIRouter()


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(user_in: UserCreate, db: AsyncSession = Depends(get_db)):
    """Register a new user account (unverified by default)."""
    # Check for existing email
    result = await db.execute(select(User).filter(User.email == user_in.email))
    existing_user = result.scalars().first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists."
        )
    
    # Hash password and create user in unverified state
    hashed_password = security.get_password_hash(user_in.password)
    db_user = User(
        email=user_in.email,
        name=user_in.name,
        password_hash=hashed_password,
        subscription_plan=user_in.subscription_plan or "free",
        is_verified=False
    )
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)
    
    # Generate Email Verification Token
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
    db_token = EmailVerificationToken(
        user_id=db_user.user_id,
        token=token,
        expires_at=expires_at
    )
    db.add(db_token)
    await db.commit()
    
    # Send verification email and capture actual delivery result
    email_delivered = await send_verification_email(db_user.email, db_user.name, token)
    email_configured = bool(settings.SMTP_USERNAME and settings.SMTP_PASSWORD)

    dev_notice = None
    if not email_delivered:
        dev_notice = (
            "Email delivery failed. "
            "Verification link is available in local_emails.log on the server."
        )
    
    return {
        "user_id": str(db_user.user_id),
        "email": db_user.email,
        "name": db_user.name,
        "subscription_plan": db_user.subscription_plan,
        "is_verified": db_user.is_verified,
        "created_at": db_user.created_at,
        "updated_at": db_user.updated_at,
        "email_configured": email_configured,
        "email_delivered": email_delivered,
        "dev_notice": dev_notice,
    }


@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    """OAuth2 compatible token login, retrieve access token (requires verified email)."""
    # Lookup user by email
    result = await db.execute(select(User).filter(User.email == form_data.username))
    user = result.scalars().first()
    
    if not user or not security.verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect email or password."
        )
    
    # Enforce verified email status
    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email address before logging in."
        )
    
    # Create and return JWT access token
    access_token = security.create_access_token(subject=user.user_id)
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(deps.get_current_user)):
    """Retrieve details of the logged-in user."""
    return current_user

@router.post("/verify-email")
async def verify_email(payload: EmailVerifyRequest, db: AsyncSession = Depends(get_db)):
    """Verifies a user email using verification token."""
    result = await db.execute(
        select(EmailVerificationToken).filter(EmailVerificationToken.token == payload.token)
    )
    token_record = result.scalars().first()
    
    if not token_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token."
        )
        
    if token_record.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        # Delete expired token
        await db.delete(token_record)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification token has expired."
        )
        
    # Get associated user
    user_result = await db.execute(select(User).filter(User.user_id == token_record.user_id))
    user = user_result.scalars().first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User associated with this token not found."
        )
        
    # Set verified and clean up token
    user.is_verified = True
    await db.delete(token_record)
    await db.commit()
    
    return {"status": "success", "message": "Email successfully verified. You may now sign in."}

@router.post("/forgot-password")
async def forgot_password(payload: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Initiates password reset process."""
    result = await db.execute(select(User).filter(User.email == payload.email))
    user = result.scalars().first()
    
    if not user:
        # Standard safety: do not reveal user presence
        return {"status": "success", "message": "If a matching account exists, a reset link has been sent."}
        
    # Clean up any existing tokens
    await db.execute(delete(PasswordResetToken).filter(PasswordResetToken.user_id == user.user_id))
    
    # Generate new token
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=2)
    db_token = PasswordResetToken(
        user_id=user.user_id,
        token=token,
        expires_at=expires_at
    )
    db.add(db_token)
    await db.commit()
    
    # Send password reset email and capture actual delivery result
    email_delivered = await send_password_reset_email(user.email, user.name, token)
    email_configured = bool(settings.SMTP_USERNAME and settings.SMTP_PASSWORD)

    dev_notice = None
    if not email_delivered:
        dev_notice = (
            "Email delivery failed. "
            "Reset link is available in local_emails.log on the server."
        )

    return {
        "status": "success",
        "message": "If a matching account exists, a reset link has been sent.",
        "email_configured": email_configured,
        "email_delivered": email_delivered,
        "dev_notice": dev_notice,
    }

@router.post("/reset-password")
async def reset_password(payload: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Resets user password using reset token."""
    result = await db.execute(
        select(PasswordResetToken).filter(PasswordResetToken.token == payload.token)
    )
    token_record = result.scalars().first()
    
    if not token_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token."
        )
        
    if token_record.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        await db.delete(token_record)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset token has expired."
        )
        
    # Get associated user
    user_result = await db.execute(select(User).filter(User.user_id == token_record.user_id))
    user = user_result.scalars().first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User associated with this token not found."
        )
        
    # Hash and set new password
    hashed_password = security.get_password_hash(payload.new_password)
    user.password_hash = hashed_password
    
    # Clean up token
    await db.delete(token_record)
    await db.commit()
    
    return {"status": "success", "message": "Password successfully reset. You may now sign in."}
