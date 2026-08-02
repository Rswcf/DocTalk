from __future__ import annotations

from typing import Optional
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.tables import CreditLedger, UsageRecord, User

# Token-to-credit rates by model tier
CREDIT_RATES = {
    # Active models (reachable via mode system)
    "deepseek-v4-flash": (1, 3),
    "deepseek-v4-pro": (2, 6),
    "deepseek/deepseek-v3.2": (1, 5),
    "mistralai/mistral-medium-3.1": (2, 10),
    "mistralai/mistral-large-2512": (2, 10),
    # Fallback models (in ALLOWED_MODELS)
    "qwen/qwen3-30b-a3b": (1, 5),
    "mistralai/mistral-medium-3": (2, 10),
    "openai/gpt-5.2": (3, 15),
    # Legacy rates (kept for historical UsageRecord cost lookups)
    "x-ai/grok-4.1-fast": (1, 5),
    "minimax/minimax-m2.1": (1, 5),
    "moonshotai/kimi-k2.5": (1, 5),
    "google/gemini-3-flash-preview": (1, 5),
    "google/gemini-3-pro-preview": (3, 15),
    "anthropic/claude-sonnet-4.5": (3, 15),
    "anthropic/claude-opus-4.6": (15, 75),
}
DEFAULT_RATE = (3, 15)
MIN_CREDITS_FOR_CHAT = 10

# Estimated cost per mode for pre-debit (generous upper bound to avoid under-debit).
# Internal mode IDs are kept for compatibility: quick=Flash, balanced=Pro.
MODE_ESTIMATED_COST: dict[str, int] = {"quick": 5, "balanced": 15}


def get_estimated_cost(mode: str) -> int:
    """Return estimated credit cost for a mode (used for pre-debit)."""
    return MODE_ESTIMATED_COST.get(mode, MODE_ESTIMATED_COST["balanced"])


def calculate_cost(prompt_tokens: int, completion_tokens: int, model: str, mode: str | None = None) -> int:
    """Calculate credit cost for token usage, with optional mode multiplier."""
    input_rate, output_rate = CREDIT_RATES.get(model, DEFAULT_RATE)
    input_cost = round(prompt_tokens * input_rate / 1000)
    output_cost = round(completion_tokens * output_rate / 1000)
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
) -> Optional[UUID]:
    """Atomically debit credits. Returns the CreditLedger entry ID on success, None if insufficient.

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
        return None

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
    return ledger.id


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


async def reconcile_credits(
    db: AsyncSession,
    user_id: UUID,
    predebit_ledger_id: UUID,
    pre_debited: int,
    actual_cost: int,
) -> int:
    """Reconcile pre-debited credits against actual cost after streaming.

    Updates the ORIGINAL ledger entry in-place so each chat produces exactly
    one ledger row (reason="chat") instead of two (predebit + reconcile).

    - If pre_debited == actual_cost → no-op (still returns the current balance)
    - If diff != 0 → adjust user balance and update the original ledger entry

    FIX2-B(b) (Codex r2 #4, NOT ADDRESSED): returns the resulting balance so
    callers (quotes.py's REST endpoint in particular) never need a SEPARATE
    get_user_credits() query after this returns. That extra round-trip was a
    second failure point AFTER money had already correctly moved and the
    work was committed — a probe showed it could 500 the client with zero
    refund attempted (correctly, since nothing was actually wrong with the
    charge) but also zero result delivered. Existing callers that don't use
    the return value are unaffected (Python allows ignoring it).

    FIX3-A(b) (Codex r3 #4, NOT ADDRESSED): ALWAYS touches the ledger row —
    including the equal-cost/no-op path, which previously left it
    completely untouched — locking it first via SELECT ... FOR UPDATE and
    stamping reconciled_at=now() unconditionally. This is what SERIALIZES
    reconciliation against a concurrent settlement resolver's conditional
    refund (_refund_predebit's DELETE ... WHERE reconciled_at IS NULL,
    FIX3-A(c)): whichever of the two transactions gets here first blocks
    the other until it commits or rolls back, so there is no window where
    a resolver can read "not yet reconciled" and a landed commit
    simultaneously. A one-shot existence check (e.g. "does the Message row
    exist yet") could never provide this guarantee — reconciled_at is a
    durable, lockable column, not a read that can race a landing commit.
    """
    # Lock the ledger row FIRST, before deciding whether diff == 0 — this
    # lock is what a concurrent _refund_predebit blocks on, regardless of
    # which branch below actually runs.
    locked = await db.execute(
        sa.select(CreditLedger).where(CreditLedger.id == predebit_ledger_id).with_for_update()
    )
    ledger_row = locked.scalar_one_or_none()
    if ledger_row is None:
        raise RuntimeError(
            f"Predebit ledger {predebit_ledger_id} not found during credit reconciliation"
        )

    diff = pre_debited - actual_cost
    if diff == 0:
        await db.execute(
            sa.update(CreditLedger)
            .where(CreditLedger.id == predebit_ledger_id)
            .values(reconciled_at=sa.func.now())
        )
        user = await db.get(User, user_id)
        if user is None:
            raise RuntimeError(f"User {user_id} not found during credit reconciliation")
        await db.flush()
        return user.credits_balance

    balance_result = await db.execute(
        sa.update(User)
        .where(User.id == user_id)
        .values(credits_balance=User.credits_balance + diff)
        .returning(User.credits_balance)
    )
    new_balance = balance_result.scalar_one_or_none()
    if new_balance is None:
        raise RuntimeError(f"User {user_id} not found during credit reconciliation")

    # Update the original ledger entry to reflect actual cost — reconciled_at
    # is now durably stamped in the SAME statement as the delta/balance_after
    # update, never a separate step that could itself be skipped.
    await db.execute(
        sa.update(CreditLedger)
        .where(CreditLedger.id == predebit_ledger_id)
        .values(
            delta=-actual_cost,
            balance_after=CreditLedger.balance_after + diff,
            reconciled_at=sa.func.now(),
        )
    )
    await db.flush()
    return new_balance


async def ensure_monthly_credits(db: AsyncSession, user: User) -> None:
    """Grant monthly credits if last grant was over 30 days ago.

    Idempotency: checks CreditLedger for any recent 'monthly_allowance' within 30 days.
    """
    from datetime import datetime, timedelta, timezone

    if (user.plan or "free").lower() != "free":
        return

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

    # Only free users are eligible in this path.
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
        ref_type="monthly_cycle",
        ref_id=f"monthly_{now.year}_{now.month}",
    )
    user.monthly_credits_granted_at = now
    await db.flush()
