"""Read-only billing disclosure must follow Stripe prices and durable fulfillment."""
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException, Response

from app.api import billing


@pytest.fixture(autouse=True)
def clear_price_cache():
    billing._price_cache.clear()
    billing._price_failures.clear()
    yield
    billing._price_cache.clear()
    billing._price_failures.clear()


@pytest.mark.asyncio
async def test_subscription_prices_use_stripe_cycle_amounts(monkeypatch):
    monkeypatch.setattr(billing.settings, "STRIPE_SECRET_KEY", "sk_test_fixture")
    monkeypatch.setattr(billing, "_get_subscription_price_id", lambda plan, period: f"{plan}_{period}")
    monkeypatch.setattr(billing, "cache_get", AsyncMock(return_value=None))
    cached = AsyncMock()
    monkeypatch.setattr(billing, "cache_set", cached)
    amounts = {"plus_monthly": 999, "plus_annual": 9588, "pro_monthly": 1999, "pro_annual": 19188}

    def retrieve(price_id):
        return {"active": True, "currency": "usd", "unit_amount": amounts[price_id],
                "billing_scheme": "per_unit", "recurring": {"interval": "year" if "annual" in price_id else "month", "interval_count": 1}}

    monkeypatch.setattr(billing.stripe.Price, "retrieve", retrieve)
    result = await billing.subscription_prices()
    assert [item["amount_minor"] for item in result["prices"]] == [999, 9588, 1999, 19188]
    assert cached.call_args.kwargs == {"ttl_seconds": 60}


@pytest.mark.asyncio
@pytest.mark.parametrize("bad", [{"currency": "eur"}, {"unit_amount": None}, {"unit_amount": True},
                                  {"active": False}, {"recurring": {"interval": "month", "interval_count": 2}}])
async def test_unsupported_prices_do_not_fall_back_to_a_made_up_total(monkeypatch, bad):
    monkeypatch.setattr(billing.settings, "STRIPE_SECRET_KEY", "sk_test_fixture")
    monkeypatch.setattr(billing, "_get_subscription_price_id", lambda *_: "fixture")
    monkeypatch.setattr(billing, "cache_get", AsyncMock(return_value=None))
    monkeypatch.setattr(billing.stripe.Price, "retrieve", lambda _: {
        "active": True, "currency": "usd", "unit_amount": 999, "billing_scheme": "per_unit",
        "recurring": {"interval": "month", "interval_count": 1}, **bad})
    with pytest.raises(HTTPException) as exc:
        await billing.subscription_prices()
    assert exc.value.status_code == 503


@pytest.mark.asyncio
@pytest.mark.parametrize("mode,paid,applied,ledger,expected", [
    ("payment", "unpaid", False, True, "payment_pending"),
    ("payment", "paid", False, False, "processing"),
    ("payment", "paid", False, True, "complete"),
    ("subscription", "paid", False, True, "processing"),
    ("subscription", "paid", True, False, "processing"),
    ("subscription", "paid", True, True, "complete"),
])
async def test_checkout_requires_payment_and_all_entitlements(monkeypatch, mode, paid, applied, ledger, expected):
    user = SimpleNamespace(id=uuid.uuid4(), stripe_subscription_id="pending", plan="free")
    monkeypatch.setattr(billing.stripe.checkout.Session, "retrieve", lambda _: {
        "client_reference_id": str(user.id), "status": "complete", "payment_status": paid,
        "mode": mode, "invoice": "in_first", "payment_intent": "pi_first", "subscription": "sub_first"})
    scalar = AsyncMock(side_effect=([SimpleNamespace(status="complete" if applied else "open")] if mode == "subscription" else []) + [uuid.uuid4() if ledger else None])
    response = Response()
    result = await billing.checkout_status(response, "cs_fixture", user, SimpleNamespace(scalar=scalar))
    assert result == {"status": expected}
    assert response.headers["Cache-Control"] == "private, no-store"
    if paid == "unpaid":
        scalar.assert_not_awaited()
    elif expected != "processing" or mode == "payment" or applied:
        statement = scalar.call_args.args[0]
        params = statement.compile().params
        assert user.id in params.values()
        assert ("pi_first" if mode == "payment" else "in_first") in params.values()


@pytest.mark.asyncio
async def test_checkout_owner_is_verified_before_reading_fulfillment(monkeypatch):
    monkeypatch.setattr(billing.stripe.checkout.Session, "retrieve", lambda _: {"client_reference_id": str(uuid.uuid4())})
    db = SimpleNamespace(scalar=AsyncMock())
    with pytest.raises(HTTPException) as exc:
        await billing.checkout_status(Response(), "cs_other", SimpleNamespace(id=uuid.uuid4()), db)
    assert exc.value.status_code == 404
    db.scalar.assert_not_awaited()


@pytest.mark.asyncio
async def test_price_fallback_cache_coalesces_requests_without_redis(monkeypatch):
    import asyncio
    monkeypatch.setattr(billing, "_get_subscription_price_id", lambda p, t: f"{p}_{t}")
    load = AsyncMock(return_value={"prices": ["authoritative"]})
    monkeypatch.setattr(billing, "_load_subscription_prices", load)
    results = await asyncio.gather(*(billing.subscription_prices() for _ in range(12)))
    assert all(r == {"prices": ["authoritative"]} for r in results)
    load.assert_awaited_once()


@pytest.mark.asyncio
@pytest.mark.parametrize("endpoint", [billing.subscribe, billing.change_plan])
async def test_annual_sale_is_rejected_before_any_stripe_or_database_write(endpoint, monkeypatch):
    monkeypatch.setattr(billing.stripe.checkout.Session, "create", lambda **kw: pytest.fail("must not create payment"))
    with pytest.raises(HTTPException) as exc:
        await endpoint(billing.SubscribeRequest(plan="plus", billing="annual"), SimpleNamespace(), SimpleNamespace())
    assert exc.value.status_code == 503
    assert exc.value.detail["error"] == "ANNUAL_BILLING_UNAVAILABLE"


@pytest.mark.asyncio
async def test_status_and_price_limiters_reject_excessive_reads(monkeypatch):
    monkeypatch.setattr(billing._price_limiter, "is_allowed", AsyncMock(return_value=False))
    monkeypatch.setattr(billing._status_limiter, "is_allowed", AsyncMock(return_value=False))
    monkeypatch.setattr(billing, "get_client_ip", lambda _: "127.0.0.1")
    for call in [billing._limit_price_reads(SimpleNamespace()), billing._limit_status_reads(SimpleNamespace(id=uuid.uuid4()))]:
        with pytest.raises(HTTPException) as exc:
            await call
        assert exc.value.status_code == 429


@pytest.mark.asyncio
async def test_archived_or_missing_annual_prices_do_not_block_monthly(monkeypatch):
    monkeypatch.setattr(billing.settings, 'STRIPE_SECRET_KEY', 'sk_test_fixture')
    monkeypatch.setattr(billing, '_get_subscription_price_id', lambda p,t: f'{p}_{t}' if t == 'monthly' else '')
    monkeypatch.setattr(billing, 'cache_get', AsyncMock(return_value=None))
    monkeypatch.setattr(billing, 'cache_set', AsyncMock())
    calls=[]
    def retrieve(pid):
        calls.append(pid)
        return {'active':True,'currency':'usd','unit_amount':999,'billing_scheme':'per_unit','recurring':{'interval':'month','interval_count':1}}
    monkeypatch.setattr(billing.stripe.Price,'retrieve',retrieve)
    result=await billing.subscription_prices()
    assert len(result['prices']) == 2 and all(x['period']=='monthly' for x in result['prices'])
    assert set(calls)=={'plus_monthly','pro_monthly'}


@pytest.mark.asyncio
async def test_price_outage_has_brief_failure_cache(monkeypatch):
    monkeypatch.setattr(billing,'_get_subscription_price_id',lambda p,t:f'{p}_{t}')
    load=AsyncMock(side_effect=HTTPException(503,'temporary failure'))
    monkeypatch.setattr(billing,'_load_subscription_prices',load)
    for _ in range(3):
        with pytest.raises(HTTPException):
            await billing.subscription_prices()
    load.assert_awaited_once()
