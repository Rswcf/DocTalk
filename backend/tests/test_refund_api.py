import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.api import refunds
from app.core.config import settings
from app.services import refund_service


@pytest.mark.asyncio
async def test_disabled_options_does_not_touch_provider(monkeypatch):
    monkeypatch.setattr(settings, "AUTO_REFUND_ENABLED", False)
    provider = Mock(side_effect=AssertionError("no provider on disabled options"))
    monkeypatch.setattr(refund_service, "Provider", provider)
    result = await refunds.refund_options(
        SimpleNamespace(id=uuid.uuid4(), stripe_customer_id="cus_fixture")
    )
    assert result["enabled"] is False and result["options"] == []
    provider.assert_not_called()


@pytest.mark.asyncio
async def test_cross_user_read_is_not_found():
    db = SimpleNamespace(
        get=AsyncMock(return_value=SimpleNamespace(user_id=uuid.uuid4()))
    )
    with pytest.raises(HTTPException) as exc:
        await refunds.get_refund(uuid.uuid4(), SimpleNamespace(id=uuid.uuid4()), db)
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_confirmation_requires_three_explicit_booleans():
    with pytest.raises(HTTPException) as exc:
        await refunds.confirm_refund(
            uuid.uuid4(),
            refunds.RefundConfirmation(confirm_full_refund=True),
            SimpleNamespace(id=uuid.uuid4()),
            None,
        )
    assert exc.value.status_code == 409
    with pytest.raises(ValidationError):
        refunds.RefundConfirmation(confirm_full_refund="true")


def test_enrollment_default_off_future_only_and_live_is_hard_block(monkeypatch):
    monkeypatch.setattr(settings, "AUTO_REFUND_MODE", "sandbox")
    monkeypatch.setattr(settings, "AUTO_REFUND_EXPECTED_ACCOUNT_ID", "acct_fixture")
    monkeypatch.setattr(settings, "AUTO_REFUND_ENABLED", True)
    monkeypatch.setattr(
        settings, "AUTO_REFUND_POLICY_START_AT", "2999-01-01T00:00:00+00:00"
    )
    monkeypatch.setattr(settings, "STRIPE_SECRET_KEY", "sk_test_fixture")
    assert refund_service.enrollment() == {}
    monkeypatch.setattr(
        settings, "AUTO_REFUND_POLICY_START_AT", "2026-01-01T00:00:00+00:00"
    )
    assert refund_service.enrollment()["refund_policy_version"] == refund_service.POLICY
    monkeypatch.setattr(settings, "STRIPE_SECRET_KEY", "sk_live_fixture")
    assert refund_service.enrollment() == {}
    with pytest.raises(ValueError, match="refund_environment_unconfigured"):
        refund_service.Provider()
