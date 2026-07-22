import uuid
import re
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict, field_validator

class ProfileBase(BaseModel):
    display_name: str = Field(..., min_length=1, max_length=50)
    avatar_url: Optional[str] = None
    is_kids_profile: Optional[bool] = False
    language_pref: Optional[str] = "en"

class ProfileCreate(ProfileBase):
    pin: Optional[str] = Field(None, description="Optional 4-digit numeric PIN lock")

    @field_validator('pin')
    @classmethod
    def validate_pin(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v == "":
            return None
        if not re.match(r'^\d{4}$', v):
            raise ValueError('PIN must be exactly 4 digits.')
        return v

class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    is_kids_profile: Optional[bool] = None
    language_pref: Optional[str] = None
    pin: Optional[str] = Field(None, description="Optional 4-digit numeric PIN lock")

    @field_validator('pin')
    @classmethod
    def validate_pin(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v == "":
            return None
        if not re.match(r'^\d{4}$', v):
            raise ValueError('PIN must be exactly 4 digits.')
        return v

class ProfileResponse(ProfileBase):
    profile_id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime
    has_pin: bool = False

    model_config = ConfigDict(from_attributes=True)

class ProfilePinVerify(BaseModel):
    pin: str = Field(..., description="4-digit numeric PIN lock")

    @field_validator('pin')
    @classmethod
    def validate_pin(cls, v: str) -> str:
        if not re.match(r'^\d{4}$', v):
            raise ValueError('PIN must be exactly 4 digits.')
        return v
