"""Checkout replay retains provider session identity after fulfillment."""
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.api import billing


@pytest.mark.asyncio
async def test_completed_attempt_replay_keeps_session_identity(monkeypatch):
    user = SimpleNamespace(id=uuid.uuid4(), plan="pro", stripe_subscription_id=None,
                           stripe_customer_id="cus_test")
    db = SimpleNamespace(execute=AsyncMock(return_value=SimpleNamespace(
        scalar_one_or_none=lambda: user)), commit=AsyncMock())
    record = AsyncMock()
    monkeypatch.setattr(billing, "_checkout_attempt_for_session",
                        AsyncMock(return_value=SimpleNamespace(status="complete")))
    monkeypatch.setattr(billing, "_invalidate_user_caches", AsyncMock())
    monkeypatch.setattr(billing, "_record_product_event", record)
    session = {"id": "cs_same", "client_reference_id": str(user.id), "customer": "cus_test"}
    for _ in range(2):
        await billing._handle_checkout_session_subscription_completed(session, db)
    assert record.await_count == 2
    for call in record.await_args_list:
        assert call.kwargs["deduplication_key"] == "stripe_checkout_completed:cs_same"
        assert call.kwargs["metadata"]["checkout_session_id"] == "cs_same"
    session.pop("id")
    await billing._handle_checkout_session_subscription_completed(session, db)
    assert record.await_count == 2
