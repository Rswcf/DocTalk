"""Real PostgreSQL atomicity, concurrent delivery and failure fairness."""
import asyncio
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import Mock

import pytest
import pytest_asyncio
import sqlalchemy as sa
from sqlalchemy.orm import Session

from app.api import billing
from app.core.config import settings
from app.models.database import AsyncSessionLocal
from app.models.tables import AnnualCreditInstallment, CreditLedger, User
from app.services.annual_credit_service import (
    grant_installment,
    month_anniversary,
    register_annual_invoice,
)
from app.workers import annual_credit_worker as worker

pytestmark = [pytest.mark.integration, pytest.mark.asyncio(loop_scope='session')]
START = datetime(2025, 1, 31, 12, tzinfo=timezone.utc)


@pytest_asyncio.fixture(loop_scope='session')
async def account(monkeypatch):
    uid = uuid.uuid4()
    monkeypatch.setattr(settings, 'STRIPE_PRICE_PLUS_ANNUAL', 'price_annual_test')
    monkeypatch.setattr(worker, 'verify_paid_service', Mock(return_value=(None, False)))
    async with AsyncSessionLocal() as db:
        db.add(User(id=uid, email=f'annual-{uid}@example.com', plan='plus', credits_balance=300,
                    stripe_customer_id=f'cus_{uid.hex}', stripe_subscription_id=f'sub_{uid.hex}'))
        await db.commit()
    engine = sa.create_engine(settings.DATABASE_URL.replace('+asyncpg', '+psycopg'))
    yield uid, engine
    engine.dispose()
    async with AsyncSessionLocal() as db:
        await db.execute(sa.delete(User).where(User.id == uid))
        await db.commit()


def invoice(uid, suffix=''):
    return {'id': f'in_{uid.hex}{suffix}', 'customer': f'cus_{uid.hex}', 'subscription': f'sub_{uid.hex}',
            'billing_reason': 'subscription_create', 'status': 'paid', 'amount_paid': 100,
            'lines': {'has_more': False, 'data': [{'type': 'subscription', 'subscription': f'sub_{uid.hex}',
                'proration': False, 'price': {'id': 'price_annual_test'},
                'period': {'start': int(START.timestamp()), 'end': int(month_anniversary(START, 12).timestamp())}}]}}


async def deliver(item):
    async with AsyncSessionLocal() as db:
        return await billing._handle_invoice_payment_succeeded(item, db)


async def snapshot(uid):
    async with AsyncSessionLocal() as db:
        balance = (await db.get(User, uid)).credits_balance
        rows = list(await db.scalars(sa.select(AnnualCreditInstallment).where(AnnualCreditInstallment.user_id == uid).order_by(AnnualCreditInstallment.month_index)))
        ledger = list(await db.scalars(sa.select(CreditLedger).where(CreditLedger.user_id == uid)))
        return balance, rows, ledger


async def test_duplicate_invoice_and_concurrent_sweeps_grant_twelve_exact_months(account):
    uid, engine = account
    await asyncio.gather(deliver(invoice(uid)), deliver(invoice(uid)))
    balance, rows, ledger = await snapshot(uid)
    assert balance == 3300 and len(rows) == 12 and len(ledger) == 1
    assert rows[1].due_at == START.replace(month=2, day=28)
    assert rows[2].due_at == START.replace(month=3)
    assert await asyncio.to_thread(worker.deliver_due, engine, now=rows[1].due_at - timedelta(seconds=1)) == 0
    now = month_anniversary(START, 11)
    await asyncio.gather(asyncio.to_thread(worker.deliver_due, engine, now=now),
                         asyncio.to_thread(worker.deliver_due, engine, now=now), deliver(invoice(uid)))
    balance, rows, ledger = await snapshot(uid)
    assert balance == 36300 and len(ledger) == 12
    assert all(row.state == 'granted' for row in rows)
    assert sum(row.ref_type == 'stripe_invoice' for row in ledger) == 1
    assert await asyncio.to_thread(worker.deliver_due, engine, now=now) == 0


async def test_rollback_discards_balance_schedule_and_ledger(account):
    uid, engine = account
    def fail():
        with Session(engine) as db:
            db.scalar(sa.select(User).where(User.id == uid).with_for_update())
            register_annual_invoice(db, user_id=uid, invoice_id='in_rollback', subscription_id='sub_x',
                plan='plus', credits=3000, start=START, end=month_anniversary(START, 12))
            first = db.scalar(sa.select(AnnualCreditInstallment.id).where(AnnualCreditInstallment.invoice_id == 'in_rollback', AnnualCreditInstallment.month_index == 0))
            assert grant_installment(db, first, now=START)
            db.rollback()
    await asyncio.to_thread(fail)
    assert await snapshot(uid) == (300, [], [])
    await deliver(invoice(uid))
    assert (await snapshot(uid))[0] == 3300


@pytest.mark.parametrize('review', [False, True])
async def test_cancel_or_refund_before_delayed_invoice_stops_undelivered_months(account, monkeypatch, review):
    uid, engine = account
    monkeypatch.setattr(worker, 'verify_paid_service', Mock(return_value=(START - timedelta(seconds=1), review)))
    await deliver(invoice(uid))
    balance, rows, ledger = await snapshot(uid)
    assert balance == 300 and not ledger
    assert {row.state for row in rows} == ({'review'} if review else {'stopped'})


async def test_failed_first_invoice_does_not_starve_next_invoice(account, monkeypatch):
    uid, engine = account
    await deliver(invoice(uid))
    await deliver(invoice(uid, '_next'))
    _, rows, _ = await snapshot(uid)
    first_invoice = min((r for r in rows if r.month_index == 1), key=lambda r: r.id).invoice_id
    def verify(inv, *_):
        if inv == first_invoice:
            raise RuntimeError('Stripe unavailable')
        return None, False
    monkeypatch.setattr(worker, 'verify_paid_service', verify)
    now = month_anniversary(START, 1)
    assert await asyncio.to_thread(worker.deliver_due, engine, now=now, batch_size=1) == 0
    assert await asyncio.to_thread(worker.deliver_due, engine, now=now, batch_size=1) == 1
    _, rows, _ = await snapshot(uid)
    pending = next(r for r in rows if r.invoice_id == first_invoice and r.month_index == 1)
    assert pending.state == 'pending' and pending.retry_at > now


async def test_cross_month_metadata_cannot_consume_delayed_upgrade(account, monkeypatch):
    from unittest.mock import AsyncMock
    uid, _ = account
    await deliver(invoice(uid))
    monkeypatch.setattr(settings, 'STRIPE_PRICE_PRO_ANNUAL', 'price_pro_annual_test')
    monkeypatch.setattr(billing, '_invalidate_user_caches', AsyncMock())
    changed = datetime(2025, 3, 1, tzinfo=timezone.utc)
    sub = {'id': f'sub_{uid.hex}', 'customer': f'cus_{uid.hex}', 'status': 'active', 'latest_invoice': {'id': 'in_upgrade', 'status': 'paid', 'created': int(changed.timestamp())}, 'items': {'data': [{'price': {'id': 'price_pro_annual_test'}, 'current_period_start': int(START.timestamp())}]}}
    monkeypatch.setattr(billing.stripe.Subscription, 'retrieve', Mock(return_value=sub))
    async with AsyncSessionLocal() as db:
        await billing._handle_subscription_updated(sub, db, {'created': int(changed.replace(month=4).timestamp()), 'data': {'previous_attributes': {'metadata': {}}}})
    assert (await snapshot(uid))[0] == 3300
    event = {'created': int(changed.timestamp()), 'data': {'previous_attributes': {'items': {'data': [{'price': {'id': 'price_annual_test'}}]}}}}
    for _ in range(2):
        async with AsyncSessionLocal() as db:
            await billing._handle_subscription_updated(sub, db, event)
    balance, rows, ledger = await snapshot(uid)
    assert balance == 9300
    supplements = [r for r in ledger if r.ref_type == 'plan_change']
    assert len(supplements) == 1 and supplements[0].ref_id.endswith(str(int(month_anniversary(START, 1).timestamp())))
    assert rows[1].credits == 3000 and all(r.credits == 9000 for r in rows[2:])


async def test_delayed_paid_upgrade_tops_up_already_delivered_future_month_once(account, monkeypatch):
    from unittest.mock import AsyncMock
    uid, engine = account
    await deliver(invoice(uid))
    await asyncio.to_thread(worker.deliver_due, engine, now=month_anniversary(START, 3))
    assert (await snapshot(uid))[0] == 12300
    monkeypatch.setattr(settings, 'STRIPE_PRICE_PRO_ANNUAL', 'price_pro_annual_test')
    monkeypatch.setattr(billing, '_invalidate_user_caches', AsyncMock())
    changed = datetime(2025, 3, 1, tzinfo=timezone.utc)
    sub = {'id': f'sub_{uid.hex}', 'customer': f'cus_{uid.hex}', 'status': 'active',
           'latest_invoice': {'id': 'in_upgrade', 'status': 'paid', 'created': int(changed.timestamp())},
           'items': {'data': [{'price': {'id': 'price_pro_annual_test'}, 'current_period_start': int(START.timestamp())}]}}
    for _ in range(2):
        async with AsyncSessionLocal() as db:
            await billing._apply_confirmed_plan(db, uid, sub, effective_at=changed)
    balance, rows, ledger = await snapshot(uid)
    assert balance == 30300  # Four Plus months + current-cycle supplement + two delayed month adjustments.
    assert rows[2].credits == rows[3].credits == 9000
    assert len([row for row in ledger if ':adjust:pro' in (row.ref_id or '')]) == 2


async def test_refunded_upgrade_invoice_alone_holds_future_annual_delivery(account, monkeypatch):
    from unittest.mock import AsyncMock
    uid, engine = account
    await deliver(invoice(uid))
    monkeypatch.setattr(settings, 'STRIPE_PRICE_PRO_ANNUAL', 'price_pro_annual_test')
    monkeypatch.setattr(billing, '_invalidate_user_caches', AsyncMock())
    changed = datetime(2025, 2, 1, tzinfo=timezone.utc)
    sub = {'id': f'sub_{uid.hex}', 'customer': f'cus_{uid.hex}', 'status': 'active',
           'latest_invoice': {'id': 'in_upgrade', 'status': 'paid', 'created': int(changed.timestamp())},
           'items': {'data': [{'price': {'id': 'price_pro_annual_test'}, 'current_period_start': int(START.timestamp())}]}}
    async with AsyncSessionLocal() as db:
        await billing._apply_confirmed_plan(db, uid, sub, effective_at=changed)
    before = (await snapshot(uid))[0]
    monkeypatch.setattr(worker, 'verify_paid_service', Mock(side_effect=lambda inv, *_: (None, inv == 'in_upgrade')))
    assert await asyncio.to_thread(worker.deliver_due, engine, now=month_anniversary(START, 1)) == 0
    balance, rows, _ = await snapshot(uid)
    assert balance == before and all(row.state == 'review' for row in rows[1:])
