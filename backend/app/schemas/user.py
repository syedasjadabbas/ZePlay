import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field, ConfigDict

# Common base schema properties
class UserBase(BaseModel):
    email: EmailStr
    name: str
    subscription_plan: Optional[str] = "free"

# Inbound creation schema
class UserCreate(UserBase):
    password: str = Field(..., min_length=8, description="User password (min 8 characters)")

# Inbound update schema
class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    name: Optional[str] = None
    password: Optional[str] = None
    subscription_plan: Optional[str] = None

# Outbound database model representation
class UserResponse(UserBase):
    user_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    is_verified: bool
    is_admin: bool = False

    model_config = ConfigDict(from_attributes=True)

# Token structures
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    user_id: Optional[uuid.UUID] = None

# New Verification and Password Reset Schemas
class EmailVerifyRequest(BaseModel):
    token: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8, description="New password (min 8 characters)")

