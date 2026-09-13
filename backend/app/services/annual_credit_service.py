"""Calendar-month delivery of annual credits, separate from Stripe charge cadence.

All writes use the same user -> installment lock order. The first installment
retains the existing stripe_invoice reference; later ones use monthly_cycle.
The grant, balance and installment marker share one transaction.
"""
from __future__ import annotations

import calendar
from datetime import datetime, timezone
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models.tables import AnnualCreditInstallment, CreditLedger, User


def month_anniversary(start: datetime, offset: int) -> datetime:
    """Always derive from the original day (Jan 31 -> Feb 28 -> Mar 31)."""
    if start.tzinfo is None:
        raise ValueError('Annual period must have a timezone')
    start = start.astimezone(timezone.utc)
    year, month = divmod(start.year * 12 + start.month - 1 + offset, 12)
    return start.replace(year=year, month=month + 1,
                         day=min(start.day, calendar.monthrange(year, month + 1)[1]))


def register_annual_invoice(db: Session, *, user_id: UUID, invoice_id: str,
                            subscription_id: str, plan: str, credits: int,
                            start: datetime, end: datetime) -> None:
    if plan not in {'plus', 'pro'} or credits <= 0 or end != month_anniversary(start, 12):
        raise ValueError('Unsupported annual invoice period or allowance')
    # Caller owns the user lock. Never change a previously registered contract
    # merely because a duplicate invoice is replayed after a plan/config change.
    rows = [dict(user_id=user_id, invoice_id=invoice_id, subscription_id=subscription_id,
                 month_index=index, plan=plan, credits=credits,
                 due_at=month_anniversary(start, index), period_end=end)
            for index in range(12)]
    db.execute(insert(AnnualCreditInstallment).values(rows).on_conflict_do_nothing(
        constraint='uq_annual_invoice_month'))
    owners = db.scalars(sa.select(AnnualCreditInstallment.user_id).where(
        AnnualCreditInstallment.invoice_id == invoice_id)).all()
    if len(owners) != 12 or any(owner != user_id for owner in owners):
        raise ValueError('Annual invoice ownership or schedule conflicts')


def grant_installment(db: Session, installment_id: UUID, *, now: datetime) -> bool:
    """Caller may already own the user lock. Does not commit or call Stripe."""
    owner_id = db.scalar(sa.select(AnnualCreditInstallment.user_id).where(
        AnnualCreditInstallment.id == installment_id))
    if owner_id is None:
        return False
    user = db.scalar(sa.select(User).where(User.id == owner_id).with_for_update(
        of=User).execution_options(populate_existing=True))
    row = db.scalar(sa.select(AnnualCreditInstallment).where(
        AnnualCreditInstallment.id == installment_id).with_for_update(
        of=AnnualCreditInstallment).execution_options(populate_existing=True))
    if user is None or row is None or row.state != 'pending' or row.due_at > now:
        return False
    ref_type = 'stripe_invoice' if row.month_index == 0 else 'monthly_cycle'
    ref_id = row.invoice_id if row.month_index == 0 else f'annual:{row.invoice_id}:{row.month_index}'
    existing = db.scalar(sa.select(CreditLedger).where(
        CreditLedger.user_id == user.id, CreditLedger.ref_type == ref_type,
        CreditLedger.ref_id == ref_id))
    if existing:
        # In particular, never blindly supplement or overwrite a legacy grant.
        if existing.delta != row.credits or existing.delta <= 0:
            row.state = 'review'
            return False
        row.ledger_id, row.granted_at, row.state = existing.id, existing.created_at, 'granted'
        return False
    balance = db.scalar(sa.update(User).where(User.id == user.id).values(
        credits_balance=User.credits_balance + row.credits).returning(User.credits_balance))
    ledger = CreditLedger(user_id=user.id, delta=row.credits, balance_after=balance,
                          reason='monthly_allowance', ref_type=ref_type, ref_id=ref_id)
    db.add(ledger)
    db.flush()
    row.ledger_id, row.granted_at, row.state = ledger.id, now, 'granted'
    return True


def update_future_plan(db: Session, *, user_id: UUID, subscription_id: str,
                       plan: str, credits: int, now: datetime) -> None:
    """Only after Stripe confirmed a paid/valid plan change; caller locks user."""
    if plan not in {'plus', 'pro'} or credits <= 0:
        raise ValueError('Unsupported allowance plan')
    # A price-change webhook may arrive after a later monthly sweep. Pay the
    # missing difference for those already-delivered months as well; changing
    # only pending rows would permanently under-deliver a delayed upgrade.
    delivered = db.scalars(sa.select(AnnualCreditInstallment).where(
        AnnualCreditInstallment.user_id == user_id,
        AnnualCreditInstallment.subscription_id == subscription_id,
        AnnualCreditInstallment.state == 'granted', AnnualCreditInstallment.due_at > now,
        AnnualCreditInstallment.credits < credits,
    ).with_for_update(of=AnnualCreditInstallment)).all()
    for row in delivered:
        delta = credits - row.credits
        ref_id = f'annual:{row.invoice_id}:{row.month_index}:adjust:{plan}'
        if db.scalar(sa.select(CreditLedger.id).where(CreditLedger.user_id == user_id,
            CreditLedger.ref_type == 'monthly_cycle', CreditLedger.ref_id == ref_id)):
            continue
        balance = db.scalar(sa.update(User).where(User.id == user_id).values(
            credits_balance=User.credits_balance + delta).returning(User.credits_balance))
        db.add(CreditLedger(user_id=user_id, delta=delta, balance_after=balance,
            reason='annual_upgrade_adjustment', ref_type='monthly_cycle', ref_id=ref_id))
        row.credits, row.plan = credits, plan
        db.flush()
    db.execute(sa.update(AnnualCreditInstallment).where(
        AnnualCreditInstallment.user_id == user_id,
        AnnualCreditInstallment.subscription_id == subscription_id,
        AnnualCreditInstallment.state == 'pending', AnnualCreditInstallment.due_at > now,
    ).values(plan=plan, credits=credits))


def stop_future_installments(db: Session, *, user_id: UUID, subscription_id: str,
                             cutoff: datetime, state: str = 'stopped') -> None:
    """Cancel only undelivered future periods; paid service already due remains owed."""
    db.execute(sa.update(AnnualCreditInstallment).where(
        AnnualCreditInstallment.user_id == user_id,
        AnnualCreditInstallment.subscription_id == subscription_id,
        AnnualCreditInstallment.state == 'pending', AnnualCreditInstallment.due_at >= cutoff,
    ).values(state=state))
