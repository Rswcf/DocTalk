from __future__ import annotations

from typing import Optional
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.tables import CreditLedger, UsageRecord, User

# Token-to-credit rates by model tier
CREDIT_RATES = {
    # Budget tier: 1 input, 5 output per 1K tokens
    "deepseek/deepseek-v3.2": (1, 5),
    "qwen/qwen3-30b-a3b": (1, 5),
    # Standard tier: 2 input, 10 output per 1K tokens
    "mistralai/mistral-medium-3": (2, 10),
    "mistralai/mistral-medium-3.1": (2, 10),
    "mistralai/mistral-large-2512": (2, 10),
    # Legacy rates (kept for historical usage records)
    "openai/gpt-5.2": (3, 15),
    "x-ai/grok-4.1-fast": (1, 5),
    "minimax/minimax-m2.1": (1, 5),
    "moonshotai/kimi-k2.5": (1, 5),
    "google/gemini-3-flash-preview": (1, 5),
    "google/gemini-3-pro-preview": (3, 15),
    "anthropic/claude-sonnet-4.5": (3, 15),
    "anthropic/claude-opus-4.6": (15, 75),
}
DEFAULT_RATE = (3, 15)
MIN_CREDITS_FOR_CHAT = 100


def calculate_cost(prompt_tokens: int, completion_tokens: int, model: str, mode: str | None = None) -> int:
    """Calculate credit cost for token usage, with optional mode multiplier."""
    input_rate, output_rate = CREDIT_RATES.get(model, DEFAULT_RATE)
    input_cost = (prompt_tokens * input_rate) // 1000
    output_cost = (completion_tokens * output_rate) // 1000
    base_cost = max(1, input_cost + output_cost)
    # Apply mode multiplier
    multiplier = settings.MODE_CREDIT_MULTIPLIER.get(mode or "balanced", 1.0)
    return max(1, int(base_cost * multiplier))


async def get_user_credits(db: AsyncSession, user_id: UUID) -> int:
    """Get user's current credit balance."""
    user = await db.get(User, user_id)
    return user.credits_balance if user else 0


async def debit_credits(
    db: AsyncSession,
    user_id: UUID,
    cost: int,
    reason: str,
    ref_type: Optional[str] = None,
    ref_id: Optional[str] = None,
) -> bool:
    """Atomically debit credits. Returns True if successful, False if insufficient.

    The balance update and ledger entry are written in the same transaction.
    Caller must call db.commit() to persist changes.
    """
    if cost <= 0:
        raise ValueError("Cost must be positive")

    result = await db.execute(
        sa.update(User)
        .where(User.id == user_id)
        .where(User.credits_balance >= cost)
        .values(credits_balance=User.credits_balance - cost)
        .returning(User.credits_balance)
    )
    row = result.fetchone()

    if row is None:
        return False

    new_balance = row[0]
    ledger = CreditLedger(
        user_id=user_id,
        delta=-cost,
        balance_after=new_balance,
        reason=reason,
        ref_type=ref_type,
        ref_id=ref_id,
    )
    db.add(ledger)
    # Flush to ensure ledger is written in same transaction as balance update
    await db.flush()
    return True


async def credit_credits(
    db: AsyncSession,
    user_id: UUID,
    amount: int,
    reason: str,
    ref_type: Optional[str] = None,
    ref_id: Optional[str] = None,
) -> int:
    """Add credits. Returns new balance.

    The balance update and ledger entry are written in the same transaction.
    Caller must call db.commit() to persist changes.
    """
    if amount <= 0:
        raise ValueError("Amount must be positive")

    result = await db.execute(
        sa.update(User)
        .where(User.id == user_id)
        .values(credits_balance=User.credits_balance + amount)
        .returning(User.credits_balance)
    )
    new_balance = result.scalar_one()

    ledger = CreditLedger(
        user_id=user_id,
        delta=amount,
        balance_after=new_balance,
        reason=reason,
        ref_type=ref_type,
        ref_id=ref_id,
    )
    db.add(ledger)
    # Flush to ensure ledger is written in same transaction as balance update
    await db.flush()
    return new_balance


async def record_usage(
    db: AsyncSession,
    user_id: UUID,
    message_id: Optional[UUID],
    model: str,
    prompt_tokens: int,
    completion_tokens: int,
    cost_credits: int,
) -> UsageRecord:
    """Record detailed usage information."""
    usage = UsageRecord(
        user_id=user_id,
        message_id=message_id,
        model=model,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        total_tokens=prompt_tokens + completion_tokens,
        cost_credits=cost_credits,
    )
    db.add(usage)
    return usage


async def ensure_monthly_credits(db: AsyncSession, user: User) -> None:
    """Grant monthly credits if last grant was over 30 days ago.

    Idempotency: checks CreditLedger for any recent 'monthly_allowance' within 30 days.
    """
    from datetime import datetime, timedelta, timezone

    # Determine if grant needed based on timestamp
    now = datetime.now(timezone.utc)
    last = user.monthly_credits_granted_at
    if last is not None and last.tzinfo is None:
        # Treat naive as UTC
        last = last.replace(tzinfo=timezone.utc)
    needs_grant = last is None or (now - last) >= timedelta(days=30)
    if not needs_grant:
        return

    # Check ledger for idempotency within last 30 days
    cutoff = now - timedelta(days=30)
    existing = await db.scalar(
        sa.select(CreditLedger)
        .where(CreditLedger.user_id == user.id)
        .where(CreditLedger.reason == "monthly_allowance")
        .where(CreditLedger.created_at >= cutoff)
    )
    if existing:
        # Still update marker to avoid repeatedly checking in future requests
        user.monthly_credits_granted_at = now
        await db.flush()
        return

    # Determine allowance by plan
    plan = (user.plan or "free").lower()
    if plan == "pro":
        allowance = int(settings.PLAN_PRO_MONTHLY_CREDITS or 0)
    elif plan == "plus":
        allowance = int(settings.PLAN_PLUS_MONTHLY_CREDITS or 0)
    else:
        allowance = int(settings.PLAN_FREE_MONTHLY_CREDITS or 0)

    if allowance <= 0:
        # Nothing to grant
        user.monthly_credits_granted_at = now
        await db.flush()
        return

    # Grant credits and update marker
    await credit_credits(
        db,
        user_id=user.id,
        amount=allowance,
        reason="monthly_allowance",
        ref_type=None,
        ref_id=None,
    )
    user.monthly_credits_granted_at = now
    await db.flush()
