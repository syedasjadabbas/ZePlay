import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base, GUID


class PaymentTransaction(Base):
    """Records simulated payment checkouts and transactions for subscriptions."""
    __tablename__ = "payment_transactions"

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
    plan_name = Column(String, nullable=False, default="premium")
    amount = Column(Float, nullable=False, default=9.99)
    currency = Column(String, nullable=False, default="USD")
    status = Column(String, nullable=False)  # "success" | "failed"
    card_brand = Column(String, nullable=False, default="Visa")
    last4 = Column(String, nullable=False, default="4242")
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    user = relationship("User", lazy="selectin")
