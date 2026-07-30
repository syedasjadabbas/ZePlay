import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class SimulatedPaymentRequest(BaseModel):
    cardholder_name: str = Field(..., min_length=2, description="Full name on payment card")
    card_number: str = Field(..., min_length=12, description="Card number (fake test number)")
    expiry: str = Field(..., min_length=4, description="Card expiry MM/YY or MM/YYYY")
    cvv: str = Field(..., min_length=3, max_length=4, description="3 or 4 digit security code")
    plan_name: str = Field("premium", description="Target plan to upgrade to")


class PaymentTransactionResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    user_email: Optional[str] = None
    plan_name: str
    amount: float
    currency: str
    status: str
    card_brand: str
    last4: str
    created_at: datetime

    class Config:
        from_attributes = True
