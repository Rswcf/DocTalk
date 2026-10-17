"""Signed local Stripe events: environment and cash-payment fulfillment gates."""
import hashlib
import hmac
import json
import time
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from app.api import billing

SECRET = "whsec_local_payment_guard_fixture"


def signed_request(event, *, invalid=False):
    body = json.dumps(event, separators=(",", ":")).encode()
    timestamp = str(int(time.time()))
    digest = hmac.new(
        ("wrong_secret" if invalid else SECRET).encode(),
        timestamp.encode() + b"." + body,
        hashlib.sha256,
    ).hexdigest()

    async def receive():
        return {"type": "http.request", "body": body}

    return Request({"type": "http", "headers": [
        (b"stripe-signature", f"t={timestamp},v1={digest}".encode()),
    ]}, receive)


def event(item=None, *, livemode=False, event_type="checkout.session.completed"):
    return {"id": "evt_local_fixture", "object": "event", "type": event_type,
            "livemode": livemode, "data": {"object": item or {"id": "cs_fixture"}}}


@pytest.mark.asyncio
@pytest.mark.parametrize("key,mode,expected", [
    ("sk_live_local", False, 400), ("sk_test_local", True, 400),
    ("rk_live_local", False, 400), ("rk_test_local", True, 400),
    ("", False, 503), ("unknown_local", False, 503),
    ("sk_test_local", 0, 400), ("sk_live_local", 1, 400),
    ("sk_test_local", "false", 400), ("sk_test_local", None, 400),
])
async def test_signed_wrong_or_unknown_environment_never_dispatches(monkeypatch, key, mode, expected):
    monkeypatch.setattr(billing.settings, "STRIPE_WEBHOOK_SECRET", SECRET)
    monkeypatch.setattr(billing.settings, "STRIPE_SECRET_KEY", key)
    handler = AsyncMock()
    monkeypatch.setattr(billing, "_handle_checkout_session_completed", handler)
    with pytest.raises(HTTPException) as exc:
        await billing.stripe_webhook(signed_request(event(livemode=mode)), object())
    assert exc.value.status_code == expected
    handler.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize("key,mode", [("sk_live_local", True), ("sk_test_local", False),
                                       ("rk_live_local", True), ("rk_test_local", False)])
async def test_signed_matching_environment_dispatches(monkeypatch, key, mode):
    monkeypatch.setattr(billing.settings, "STRIPE_WEBHOOK_SECRET", SECRET)
    monkeypatch.setattr(billing.settings, "STRIPE_SECRET_KEY", key)
    handler = AsyncMock(return_value={"received": True})
    monkeypatch.setattr(billing, "_handle_checkout_session_completed", handler)
    assert await billing.stripe_webhook(signed_request(event(livemode=mode)), object()) == {"received": True}
    handler.assert_awaited_once()


@pytest.mark.asyncio
async def test_invalid_signature_fails_before_dispatch(monkeypatch):
    monkeypatch.setattr(billing.settings, "STRIPE_WEBHOOK_SECRET", SECRET)
    monkeypatch.setattr(billing.settings, "STRIPE_SECRET_KEY", "sk_test_local")
    with pytest.raises(HTTPException) as exc:
        await billing.stripe_webhook(signed_request(event(), invalid=True), object())
    assert exc.value.status_code == 401


@pytest.mark.asyncio
@pytest.mark.parametrize("status", ["unpaid", "no_payment_required", None, "PAID"])
async def test_cash_credit_pack_requires_paid_before_any_database_access(status):
    # An object with no DB methods makes accidental access fail immediately.
    assert await billing._handle_checkout_session_completed(
        {"mode": "payment", "payment_status": status}, object()
    ) == {"received": True}


@pytest.mark.asyncio
async def test_subscription_completion_keeps_existing_routing(monkeypatch):
    handler = AsyncMock(return_value={"received": True})
    monkeypatch.setattr(billing, "_handle_checkout_session_subscription_completed", handler)
    session = {"mode": "subscription", "payment_status": "unpaid"}
    db = SimpleNamespace()
    await billing._handle_checkout_session_completed(session, db)
    handler.assert_awaited_once_with(session, db)
