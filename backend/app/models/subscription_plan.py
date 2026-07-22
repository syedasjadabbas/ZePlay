import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, Integer, DateTime, UUID
from app.database import Base


class SubscriptionPlan(Base):
    """Defines available subscription tiers (e.g. Free, Premium)."""
    __tablename__ = "subscription_plans"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )
    name = Column(String, unique=True, nullable=False, index=True)   # "free" | "premium"
    description = Column(String, nullable=True)
    max_profiles = Column(Integer, nullable=False, default=1)
    supports_4k = Column(Boolean, nullable=False, default=False)
    supports_multi_device = Column(Boolean, nullable=False, default=False)

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )

