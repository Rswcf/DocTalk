"""Retryable monthly delivery for prepaid annual invoices.

Stripe reads finish before row locks. A failed lookup leaves the installment
pending, and the next scheduled sweep retries it. Refunds require review; this
worker never performs refunds or takes back credits already delivered.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

import sqlalchemy as sa
import stripe
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.tables import AnnualCreditInstallment, PlanTransition, User
from app.services.annual_credit_service import (
    grant_installment,
    stop_future_installments,
)
from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


def _id(value):
    return value.get('id') if isinstance(value, dict) else value


def verify_paid_service(invoice_id: str, subscription_id: str, customer_id: str):
    """Return terminal cutoff and whether payment needs manual review.

    Check every invoice payment, including Basil's paginated payments relation.
    Out-of-band or unknown payment provenance fails closed for review.
    """
    options = {'api_key': settings.STRIPE_SECRET_KEY}
    invoice = stripe.Invoice.retrieve(invoice_id, **options)
    subscription = stripe.Subscription.retrieve(subscription_id, **options)
    parent = invoice.get('parent') or {}
    invoice_sub = _id(invoice.get('subscription')) or _id((parent.get('subscription_details') or {}).get('subscription'))
    if (_id(invoice.get('customer')) != customer_id or _id(subscription.get('customer')) != customer_id
            or invoice_sub != subscription_id or invoice.get('status') != 'paid'):
        raise ValueError('Annual payment ownership or status unresolved')
    cutoff = None
    if subscription.get('status') in {'canceled', 'incomplete_expired'}:
        ended = subscription.get('ended_at')
        if type(ended) is not int:
            raise ValueError('Terminal subscription has no service end')
        cutoff = datetime.fromtimestamp(ended, timezone.utc)
    elif subscription.get('status') not in {'active', 'past_due', 'trialing', 'paused', 'unpaid'}:
        raise ValueError('Annual subscription status unresolved')
    if invoice.get('paid_out_of_band') or invoice.get('post_payment_credit_notes_amount', 0) > 0:
        return cutoff, True
    if invoice.get('amount_paid') == 0:
        return cutoff, False  # Fully discounted/credit-balanced paid invoice.

    def refunded(charge):
        if isinstance(charge, str):
            charge = stripe.Charge.retrieve(charge, **options)
        if not isinstance(charge, dict) or charge.get('paid') is not True:
            raise ValueError('Annual charge unresolved')
        return bool(charge.get('amount_refunded') or charge.get('disputed'))

    if invoice.get('charge'):
        return cutoff, refunded(invoice['charge'])
    if invoice.get('payment_intent'):
        intent = stripe.PaymentIntent.retrieve(_id(invoice['payment_intent']), **options)
        return cutoff, refunded(intent.get('latest_charge'))
    page = stripe.InvoicePayment.list(invoice=invoice_id, status='paid', limit=100, **options)
    seen = set()
    total = 0
    review = False
    while True:
        for payment in page['data']:
            total += int(payment.get('amount_paid') or 0)
            detail = payment.get('payment') or {}
            if detail.get('type') == 'payment_intent':
                intent = stripe.PaymentIntent.retrieve(_id(detail.get('payment_intent')), **options)
                review = refunded(intent.get('latest_charge')) or review
            elif detail.get('type') == 'charge':
                review = refunded(detail.get('charge')) or review
            else:
                review = True
        if not page.get('has_more'):
            break
        cursor = _id(page['data'][-1]) if page['data'] else None
        if not cursor or cursor in seen or len(seen) >= 10:
            raise ValueError('Annual payment pagination incomplete')
        seen.add(cursor)
        page = stripe.InvoicePayment.list(invoice=invoice_id, status='paid', limit=100, starting_after=cursor, **options)
    if total < invoice['amount_paid']:
        raise ValueError('Annual invoice payments incomplete')
    return cutoff, review


def deliver_due(engine, *, now: datetime, batch_size: int = 100) -> int:
    with Session(engine) as db:
        candidates = db.execute(sa.select(
            AnnualCreditInstallment.id, AnnualCreditInstallment.invoice_id,
            AnnualCreditInstallment.subscription_id, AnnualCreditInstallment.user_id,
            User.stripe_customer_id,
        ).join(User, User.id == AnnualCreditInstallment.user_id).where(
            AnnualCreditInstallment.state == 'pending', AnnualCreditInstallment.due_at <= now,
            sa.or_(AnnualCreditInstallment.retry_at.is_(None), AnnualCreditInstallment.retry_at <= now),
        ).order_by(AnnualCreditInstallment.due_at, AnnualCreditInstallment.id).limit(batch_size)).all()
    granted = 0
    for installment_id, invoice_id, sub_id, user_id, customer_id in candidates:
        try:
            cutoff, review = verify_paid_service(invoice_id, sub_id, customer_id)
            with Session(engine) as read_db:
                row = read_db.get(AnnualCreditInstallment, installment_id)
                if row is None:
                    continue
                start = read_db.scalar(sa.select(sa.func.min(AnnualCreditInstallment.due_at)).where(
                    AnnualCreditInstallment.invoice_id == invoice_id))
                funding = read_db.scalars(sa.select(PlanTransition.metadata_json).where(
                    PlanTransition.user_id == user_id, PlanTransition.source == 'plan_change',
                    PlanTransition.metadata_json['subscription_id'].astext == sub_id,
                    PlanTransition.effective_at >= start, PlanTransition.effective_at < row.due_at,
                )).all()
            # An upgraded installment also depends on its paid upgrade invoice.
            # Refunding that charge may leave the original annual invoice paid.
            for funded_by in {item.get('funding_invoice') for item in funding} - {None, invoice_id}:
                _, funding_review = verify_paid_service(funded_by, sub_id, customer_id)
                review = review or funding_review
            with Session(engine) as db, db.begin():
                db.scalar(sa.select(User).where(User.id == user_id).with_for_update(of=User))
                if review:
                    # All remaining installments from this refunded invoice need
                    # review, including overdue ones; never silently re-enable.
                    db.execute(sa.update(AnnualCreditInstallment).where(
                        AnnualCreditInstallment.invoice_id == invoice_id,
                        AnnualCreditInstallment.state == 'pending',
                    ).values(state='review'))
                    logger.error('annual_credits.payment_review invoice=%s', invoice_id)
                else:
                    if cutoff:
                        stop_future_installments(db, user_id=user_id, subscription_id=sub_id, cutoff=cutoff)
                    granted += grant_installment(db, installment_id, now=now)
        except Exception:
            logger.exception('annual_credits.delivery_failed invoice=%s', invoice_id)
            # Move a failing invoice out of the front of the queue so a Stripe
            # or provenance problem cannot starve unrelated customers forever.
            with Session(engine) as db, db.begin():
                db.execute(sa.update(AnnualCreditInstallment).where(
                    AnnualCreditInstallment.invoice_id == invoice_id,
                    AnnualCreditInstallment.state == 'pending',
                ).values(retry_at=now + timedelta(minutes=15)))
    return granted


@celery_app.task(name='deliver_annual_credit_installments', soft_time_limit=240, time_limit=270)
def deliver_annual_credit_installments() -> int:
    # Runs regardless of the sales flag: disabling new sales must never stop
    # delivery of an already paid subscription.
    engine = sa.create_engine(settings.DATABASE_URL.replace('postgresql+asyncpg://', 'postgresql+psycopg://'),
                              connect_args={'options': '-c statement_timeout=15000 -c lock_timeout=5000'})
    try:
        return deliver_due(engine, now=datetime.now(timezone.utc))
    finally:
        engine.dispose()
