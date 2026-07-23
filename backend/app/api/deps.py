import uuid
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.config import settings
from app.database import get_db
from app.models.user import User

reusable_oauth2 = OAuth2PasswordBearer(
    tokenUrl="/api/auth/login"
)

async def get_current_user(
    db: AsyncSession = Depends(get_db),
    token: str = Depends(reusable_oauth2)
) -> User:
    """Dependency to retrieve and validate the current logged-in user."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
        )
        user_id_str: str = payload.get("sub")
        if user_id_str is None:
            raise credentials_exception
        user_id = uuid.UUID(user_id_str)
    except (JWTError, ValueError):
        raise credentials_exception
    
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

