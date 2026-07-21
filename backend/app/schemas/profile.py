import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict

class ProfileBase(BaseModel):
    display_name: str = Field(..., min_length=1, max_length=50)
    avatar_url: Optional[str] = None
    is_kids_profile: Optional[bool] = False
    language_pref: Optional[str] = "en"

class ProfileCreate(ProfileBase):
    pass

class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    is_kids_profile: Optional[bool] = None
    language_pref: Optional[str] = None

class ProfileResponse(ProfileBase):
    profile_id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
