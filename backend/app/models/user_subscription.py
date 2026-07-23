import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base, GUID


class UserSubscription(Base):
    """Records a user's active subscription to a plan."""
    __tablename__ = "user_subscriptions"

    id = Column(
        GUID,
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )
    user_id = Column(
        GUID,
        ForeignKey("users.user_id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    plan_id = Column(
        GUID,
        ForeignKey("subscription_plans.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )
    # Status: active | cancelled | expired
    status = Column(String, nullable=False, default="active")
    start_date = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    end_date = Column(DateTime(timezone=True), nullable=True)
    auto_renew = Column(Boolean, nullable=False, default=True)

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    # Relationships
    plan = relationship("SubscriptionPlan", lazy="selectin")
    user = relationship("User", back_populates="subscription")
