import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class SubscriptionPlanResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    max_profiles: int
    supports_4k: bool
    supports_multi_device: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserSubscriptionResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    plan_id: uuid.UUID
    status: str
    start_date: datetime
    end_date: Optional[datetime] = None
    auto_renew: bool
    created_at: datetime
    updated_at: datetime
    plan: SubscriptionPlanResponse

    model_config = ConfigDict(from_attributes=True)


class UpgradeRequest(BaseModel):
    plan_name: str = "premium"


class DowngradeRequest(BaseModel):
    plan_name: str = "free"
