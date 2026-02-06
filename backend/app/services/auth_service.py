from __future__ import annotations

import hashlib
import logging
from datetime import datetime
from typing import Optional
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tables import User, Account, VerificationToken, CreditLedger

logger = logging.getLogger(__name__)

SIGNUP_BONUS_CREDITS = 10000


def hash_token(token: str) -> str:
    """Hash a verification token using SHA-256 hex encoding."""
    return hashlib.sha256(token.encode()).hexdigest()


async def create_user(
    db: AsyncSession,
    email: str,
    name: Optional[str] = None,
    image: Optional[str] = None,
    email_verified: Optional[datetime] = None,
) -> User:
    """Create a new user with signup bonus.

    Raises:
        IntegrityError: If user with this email already exists.
    """
    # Check if user already exists
    existing = await get_user_by_email(db, email)
    if existing:
        logger.warning("Attempted to create duplicate user: %s", email)
        raise IntegrityError(
            statement=None,
            params=None,
            orig=Exception(f"User with email {email} already exists"),
        )

    user = User(
        email=email,
        name=name,
        image=image,
        email_verified=email_verified,
        credits_balance=SIGNUP_BONUS_CREDITS,
        signup_bonus_granted_at=datetime.utcnow(),
        monthly_credits_granted_at=datetime.utcnow(),
    )
    db.add(user)

    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        logger.warning("IntegrityError creating user: %s", email)
        raise

    # Record signup bonus in ledger
    ledger = CreditLedger(
        user_id=user.id,
        delta=SIGNUP_BONUS_CREDITS,
        balance_after=SIGNUP_BONUS_CREDITS,
        reason="signup_bonus",
    )
    db.add(ledger)
    await db.commit()
    await db.refresh(user)
    return user


async def get_user_by_id(db: AsyncSession, user_id: UUID) -> Optional[User]:
    return await db.get(User, user_id)


async def get_user_by_email(db: AsyncSession, email: str) -> Optional[User]:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def get_user_by_account(db: AsyncSession, provider: str, provider_account_id: str) -> Optional[User]:
    result = await db.execute(
        select(User)
        .join(Account, Account.user_id == User.id)
        .where(Account.provider == provider)
        .where(Account.provider_account_id == provider_account_id)
    )
    return result.scalar_one_or_none()


async def update_user(db: AsyncSession, user: User, **kwargs) -> User:
    for key, value in kwargs.items():
        if hasattr(user, key) and value is not None:
            setattr(user, key, value)
    await db.commit()
    await db.refresh(user)
    return user


async def delete_user(db: AsyncSession, user: User) -> None:
    await db.delete(user)
    await db.commit()


async def link_account(
    db: AsyncSession,
    user_id: UUID,
    provider: str,
    provider_account_id: str,
    **kwargs,
) -> Account:
    account = Account(
        user_id=user_id,
        provider=provider,
        provider_account_id=provider_account_id,
        **kwargs,
    )
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return account


async def unlink_account(db: AsyncSession, provider: str, provider_account_id: str) -> None:
    result = await db.execute(
        select(Account).where(Account.provider == provider).where(Account.provider_account_id == provider_account_id)
    )
    account = result.scalar_one_or_none()
    if account:
        await db.delete(account)
        await db.commit()


async def create_verification_token(
    db: AsyncSession, identifier: str, token: str, expires: datetime
) -> VerificationToken:
    hashed = hash_token(token)
    vt = VerificationToken(identifier=identifier, token=hashed, expires=expires)
    await db.merge(vt)  # Upsert
    await db.commit()
    return vt


async def use_verification_token(
    db: AsyncSession, identifier: str, token: str
) -> Optional[VerificationToken]:
    """Use and delete a verification token atomically.

    Uses FOR UPDATE to prevent race conditions where the same token
    is used concurrently.
    """
    hashed = hash_token(token)

    # Use FOR UPDATE to lock the row and prevent concurrent use
    result = await db.execute(
        select(VerificationToken)
        .where(VerificationToken.identifier == identifier)
        .where(VerificationToken.token == hashed)
        .with_for_update()
    )
    vt = result.scalar_one_or_none()

    if not vt:
        return None

    # Check expiration and delete in single transaction
    if vt.expires < datetime.utcnow():
        await db.delete(vt)
        await db.commit()
        return None

    # Delete after use - atomic with the lock
    await db.delete(vt)
    await db.commit()
    return vt
