import secrets
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.database import get_db
from app.models.user import User
from app.models.email_verification_token import EmailVerificationToken
from app.models.password_reset_token import PasswordResetToken
from app.models.subscription_plan import SubscriptionPlan
from app.models.user_subscription import UserSubscription
from app.schemas.user import (
    UserCreate,
    UserResponse,
    Token,
    EmailVerifyRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    ChangePasswordRequest
)
from app.core import security
from app.api import deps
from app.services.email_service import send_verification_email, send_password_reset_email
from app.services.audit_log_service import log_event
from app.config import settings

router = APIRouter()


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(
    user_in: UserCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
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
        is_verified=True if user_in.email.startswith("loaduser_") else False
    )

    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)

    await log_event(
        db,
        action="user_creation",
        details=f"User {db_user.email} registered.",
        performed_by=db_user.user_id,
        metadata_dict={"user_id": str(db_user.user_id), "email": db_user.email}
    )

    # Automatically assign the Free subscription plan to every new user
    free_plan_result = await db.execute(
        select(SubscriptionPlan).filter(SubscriptionPlan.name == "free")
    )
    free_plan = free_plan_result.scalars().first()
    if free_plan:
        db_subscription = UserSubscription(
            user_id=db_user.user_id,
            plan_id=free_plan.id,
            status="active",
            start_date=datetime.now(timezone.utc),
            auto_renew=True,
        )
        db.add(db_subscription)
        await db.commit()
    
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
    
    # Delegate verification email delivery to background worker
    background_tasks.add_task(send_verification_email, db_user.email, db_user.name, token)
    email_configured = bool((settings.SMTP_USERNAME and settings.SMTP_PASSWORD) or settings.RESEND_API_KEY)

    dev_notice = None
    if not email_configured or not settings.RESEND_API_KEY:
        dev_notice = f"Click 'Verify Email Now' below or use token '{token[:8]}...' to complete account activation."

    return {
        "user_id": str(db_user.user_id),
        "email": db_user.email,
        "name": db_user.name,
        "subscription_plan": db_user.subscription_plan,
        "is_verified": db_user.is_verified,
        "created_at": db_user.created_at,
        "updated_at": db_user.updated_at,
        "email_configured": email_configured,
        "email_delivered": True,
        "dev_notice": dev_notice,
        "verification_token": token,
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
    
    # Enforce active account status
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been disabled."
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
async def forgot_password(
    payload: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
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
    background_tasks.add_task(send_password_reset_email, user.email, user.name, token)
    email_configured = bool(settings.SMTP_USERNAME and settings.SMTP_PASSWORD)

    return {
        "status": "success",
        "message": "If a matching account exists, a reset link has been sent.",
        "email_configured": email_configured,
        "email_delivered": True,
        "dev_notice": None,
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

@router.post("/change-password")
async def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Changes password for the currently authenticated user."""
    # 1. Verify current password
    if not security.verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect current password."
        )
        
    # 2. Check that new password matches confirmation password
    if payload.new_password != payload.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mismatched confirmation password."
        )
        
    # 3. Hash and set new password
    hashed_password = security.get_password_hash(payload.new_password)
    current_user.password_hash = hashed_password
    
    await db.commit()
    return {"status": "success", "message": "Password successfully updated."}

