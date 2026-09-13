"""Calendar boundaries and paid-service provenance; no real Stripe writes."""
from datetime import datetime, timezone
from unittest.mock import Mock

import pytest

from app.services.annual_credit_service import month_anniversary
from app.workers import annual_credit_worker as worker


def test_calendar_months_keep_original_day():
    start = datetime(2024, 1, 31, 9, tzinfo=timezone.utc)
    assert month_anniversary(start, 1) == start.replace(month=2, day=29)
    assert month_anniversary(start, 2) == start.replace(month=3)
    assert month_anniversary(start.replace(month=2, day=29), 12) == start.replace(year=2025, month=2, day=28)
    with pytest.raises(ValueError):
        month_anniversary(start.replace(tzinfo=None), 1)


@pytest.fixture
def payments(monkeypatch):
    invoice = {'customer': 'cus_1', 'subscription': 'sub_1', 'status': 'paid', 'amount_paid': 100}
    sub = {'customer': 'cus_1', 'status': 'active', 'cancel_at_period_end': True}
    monkeypatch.setattr(worker.stripe.Invoice, 'retrieve', Mock(return_value=invoice))
    monkeypatch.setattr(worker.stripe.Subscription, 'retrieve', Mock(return_value=sub))
    return invoice, sub


def test_second_payment_page_refund_is_not_missed(payments, monkeypatch):
    def page(ref, intent):
        return {'data': [{'id': ref, 'amount_paid': 50, 'payment': {'type': 'payment_intent', 'payment_intent': intent}}]}
    listing = Mock(side_effect=[{**page('a', 'pi_a'), 'has_more': True}, {**page('b', 'pi_b'), 'has_more': False}])
    monkeypatch.setattr(worker.stripe.InvoicePayment, 'list', listing)
    monkeypatch.setattr(worker.stripe.PaymentIntent, 'retrieve', Mock(side_effect=[
        {'latest_charge': {'paid': True, 'amount_refunded': 0}},
        {'latest_charge': {'paid': True, 'amount_refunded': 50}}]))
    assert worker.verify_paid_service('in_1', 'sub_1', 'cus_1') == (None, True)
    assert listing.call_args.kwargs['starting_after'] == 'a'


@pytest.mark.parametrize('change', ['owner', 'unpaid', 'incomplete_payments', 'missing_end'])
def test_unresolved_payment_does_not_authorize_grant(payments, monkeypatch, change):
    invoice, sub = payments
    monkeypatch.setattr(worker.stripe.InvoicePayment, 'list', Mock(return_value={'data': [], 'has_more': False}))
    if change == 'owner':
        invoice['customer'] = 'cus_other'
    elif change == 'unpaid':
        invoice['status'] = 'open'
    elif change == 'missing_end':
        sub['status'] = 'canceled'
    with pytest.raises(ValueError):
        worker.verify_paid_service('in_1', 'sub_1', 'cus_1')


def test_end_of_period_cancel_and_zero_cash_invoice(payments):
    invoice, sub = payments
    invoice['amount_paid'] = 0
    assert worker.verify_paid_service('in_1', 'sub_1', 'cus_1') == (None, False)
    sub.update(status='canceled', ended_at=1706745600)
    assert worker.verify_paid_service('in_1', 'sub_1', 'cus_1')[0] == datetime(2024, 2, 1, tzinfo=timezone.utc)
