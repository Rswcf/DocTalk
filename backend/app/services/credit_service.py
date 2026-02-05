from __future__ import annotations

from typing import Optional
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tables import CreditLedger, UsageRecord, User


# Token-to-credit rates by model tier
CREDIT_RATES = {
    # Small tier: 3 input, 15 output per 1K tokens
    "anthropic/claude-sonnet-4.5": (3, 15),
    "openai/gpt-5.2": (3, 15),
    "google/gemini-3-pro-preview": (3, 15),
    "mistralai/mistral-large-2512": (3, 15),
    # Large tier: 15 input, 75 output per 1K tokens
    "anthropic/claude-opus-4.5": (15, 75),
    "openai/gpt-5.2-pro": (15, 75),
    # Budget tier: 1 input, 5 output per 1K tokens
    "deepseek/deepseek-v3.2": (1, 5),
    "qwen/qwen3-coder-next": (1, 5),
}
DEFAULT_RATE = (3, 15)
MIN_CREDITS_FOR_CHAT = 100


def calculate_cost(prompt_tokens: int, completion_tokens: int, model: str) -> int:
    """Calculate credit cost for token usage."""
    input_rate, output_rate = CREDIT_RATES.get(model, DEFAULT_RATE)
    input_cost = (prompt_tokens * input_rate) // 1000
    output_cost = (completion_tokens * output_rate) // 1000
    return max(1, input_cost + output_cost)  # Minimum 1 credit


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

