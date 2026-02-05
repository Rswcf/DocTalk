from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr


# User schemas
class CreateUserRequest(BaseModel):
    email: EmailStr
    name: Optional[str] = None
    image: Optional[str] = None
    email_verified: Optional[datetime] = None


class UserResponse(BaseModel):
    id: UUID
    email: str
    name: Optional[str]
    image: Optional[str]
    email_verified: Optional[datetime]
    credits_balance: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UpdateUserRequest(BaseModel):
    name: Optional[str] = None
    image: Optional[str] = None
    email_verified: Optional[datetime] = None


# Account schemas
class LinkAccountRequest(BaseModel):
    user_id: UUID
    type: str
    provider: str
    provider_account_id: str
    refresh_token: Optional[str] = None
    access_token: Optional[str] = None
    expires_at: Optional[int] = None
    token_type: Optional[str] = None
    scope: Optional[str] = None
    id_token: Optional[str] = None


class AccountResponse(BaseModel):
    id: UUID
    user_id: UUID
    type: str
    provider: str
    provider_account_id: str

    class Config:
        from_attributes = True


# Verification token schemas
class CreateVerificationTokenRequest(BaseModel):
    identifier: str  # email
    token: str  # raw token (will be hashed before storage)
    expires: datetime


class UseVerificationTokenRequest(BaseModel):
    identifier: str
    token: str


class VerificationTokenResponse(BaseModel):
    identifier: str
    token: str
    expires: datetime

