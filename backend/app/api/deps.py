import uuid
from typing import Optional
from fastapi import Depends, HTTPException, status, Query
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.config import settings
from app.database import get_db
from app.models.user import User

reusable_oauth2 = OAuth2PasswordBearer(
    tokenUrl="/api/auth/login",
    auto_error=False
)

async def get_current_user(
    token: Optional[str] = Query(None),
    header_token: Optional[str] = Depends(reusable_oauth2),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Dependency to retrieve and validate the current logged-in user."""
    auth_token = header_token or token
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not auth_token:
        raise credentials_exception

    try:
        payload = jwt.decode(
            auth_token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
        )
        user_id_str: str = payload.get("sub")
        if user_id_str is None:
            raise credentials_exception
        user_id = uuid.UUID(user_id_str)
    except (JWTError, ValueError):
        raise credentials_exception
    
    from app.services.cache_service import cache
    from datetime import datetime, timezone
    cache_key = f"auth:user:{user_id}"
    cached = await cache.get(cache_key)
    if cached is not None:
        try:
            created_at = datetime.fromisoformat(cached["created_at"]) if cached.get("created_at") else datetime.now(timezone.utc)
            updated_at = datetime.fromisoformat(cached["updated_at"]) if cached.get("updated_at") else datetime.now(timezone.utc)
            u = User(
                user_id=uuid.UUID(cached["user_id"]),
                email=cached["email"],
                name=cached["name"],
                is_active=cached["is_active"],
                is_admin=cached["is_admin"],
                is_verified=cached.get("is_verified", True),
                subscription_plan=cached.get("subscription_plan", "free"),
                created_at=created_at,
                updated_at=updated_at,
            )
            return u
        except Exception:
            pass

    # Retrieve user from the database
    result = await db.execute(select(User).filter(User.user_id == user_id))
    user = result.scalars().first()
    if user is None:
        raise credentials_exception
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been disabled."
        )
    
    await cache.set(
        cache_key,
        {
            "user_id": str(user.user_id),
            "email": user.email,
            "name": user.name,
            "is_active": bool(user.is_active),
            "is_admin": bool(user.is_admin),
            "is_verified": bool(getattr(user, "is_verified", True)),
            "subscription_plan": getattr(user, "subscription_plan", "free"),
            "created_at": user.created_at.isoformat() if getattr(user, "created_at", None) else None,
            "updated_at": user.updated_at.isoformat() if getattr(user, "updated_at", None) else None,
        },
        ttl=120
    )
    return user


async def get_current_admin_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Dependency to validate that current user has administrative privileges."""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The user does not have administrative privileges."
        )
    return current_user


async def verify_user_entitlement(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> User:
    """Verifies that the user has an active premium subscription or is an administrator."""
    if current_user.is_admin:
        return current_user

    # Query active premium subscription
    from app.models.user_subscription import UserSubscription
    from app.models.subscription_plan import SubscriptionPlan
    sub_result = await db.execute(
        select(UserSubscription)
        .join(SubscriptionPlan)
        .filter(
            UserSubscription.user_id == current_user.user_id,
            UserSubscription.status == "active",
            SubscriptionPlan.name == "premium"
        )
    )
    sub = sub_result.scalars().first()
    
    if not sub and current_user.subscription_plan != "premium":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Active premium subscription required to access this content. Please upgrade."
        )
    return current_user

