from __future__ import annotations

import hmac
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_db_session
from app.schemas.auth import (
    AccountResponse,
    CreateUserRequest,
    CreateVerificationTokenRequest,
    LinkAccountRequest,
    UpdateUserRequest,
    UserResponse,
    UseVerificationTokenRequest,
    VerificationTokenResponse,
)
from app.services import auth_service

router = APIRouter(prefix="/api/internal/auth", tags=["auth-internal"])


async def verify_adapter_secret(x_adapter_secret: str = Header(...)):
    """Verify the adapter secret for internal API calls using constant-time comparison."""
    if settings.ADAPTER_SECRET is None:
        raise HTTPException(status_code=401, detail="Adapter secret not configured")
    # Use constant-time comparison to prevent timing attacks
    if not hmac.compare_digest(x_adapter_secret, settings.ADAPTER_SECRET):
        raise HTTPException(status_code=401, detail="Invalid adapter secret")


# User endpoints
@router.post("/users", response_model=UserResponse)
async def create_user(
    data: CreateUserRequest,
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(verify_adapter_secret),
):
    user = await auth_service.create_user(
        db, data.email, data.name, data.image, data.email_verified
    )
    return user


@router.get("/users/{user_id}", response_model=Optional[UserResponse])
async def get_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(verify_adapter_secret),
):
    return await auth_service.get_user_by_id(db, user_id)


@router.get("/users/by-email/{email}", response_model=Optional[UserResponse])
async def get_user_by_email(
    email: str,
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(verify_adapter_secret),
):
    return await auth_service.get_user_by_email(db, email)


@router.get("/users/by-account/{provider}/{provider_account_id}", response_model=Optional[UserResponse])
async def get_user_by_account(
    provider: str,
    provider_account_id: str,
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(verify_adapter_secret),
):
    return await auth_service.get_user_by_account(db, provider, provider_account_id)


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    data: UpdateUserRequest,
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(verify_adapter_secret),
):
    user = await auth_service.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return await auth_service.update_user(db, user, **data.model_dump(exclude_unset=True))


@router.delete("/users/{user_id}", status_code=204)
async def delete_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(verify_adapter_secret),
):
    user = await auth_service.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await auth_service.delete_user(db, user)


# Account endpoints
@router.post("/accounts", response_model=AccountResponse)
async def link_account(
    data: LinkAccountRequest,
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(verify_adapter_secret),
):
    return await auth_service.link_account(
        db,
        data.user_id,
        data.provider,
        data.provider_account_id,
        type=data.type,
        refresh_token=data.refresh_token,
        access_token=data.access_token,
        expires_at=data.expires_at,
        token_type=data.token_type,
        scope=data.scope,
        id_token=data.id_token,
    )


@router.delete("/accounts/{provider}/{provider_account_id}", status_code=204)
async def unlink_account(
    provider: str,
    provider_account_id: str,
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(verify_adapter_secret),
):
    await auth_service.unlink_account(db, provider, provider_account_id)


# Verification token endpoints
@router.post("/verification-tokens", response_model=VerificationTokenResponse)
async def create_verification_token(
    data: CreateVerificationTokenRequest,
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(verify_adapter_secret),
):
    await auth_service.create_verification_token(db, data.identifier, data.token, data.expires)
    # Return raw token (not hashed) for Auth.js
    return {"identifier": data.identifier, "token": data.token, "expires": data.expires}


@router.post("/verification-tokens/use", response_model=Optional[VerificationTokenResponse])
async def use_verification_token(
    data: UseVerificationTokenRequest,
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(verify_adapter_secret),
):
    vt = await auth_service.use_verification_token(db, data.identifier, data.token)
    if not vt:
        return None
    return {"identifier": vt.identifier, "token": data.token, "expires": vt.expires}

