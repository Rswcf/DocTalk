"""Unit tests for `POST /api/billing/cancel` state machine.

Covers branches D (already free), E (pending sentinel), A (active /
canceled / other statuses), F (malformed sub_id), C (multi / single /
no cancellable subs), B (admin-promoted fallback), and fail-closed
Stripe error behaviour.

These are logic-level tests that mock out `db`, Stripe client calls,
and cache invalidation. They run without Postgres / Stripe / Redis.
"""

from __future__ import annotations

import uuid
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from app.api import billing as billing_api


@pytest.fixture
def fake_db() -> Any:
    """A db stand-in that captures PlanTransition adds and commits."""
    added: list = []

    def add(obj):
        added.append(obj)

    db = SimpleNamespace(
        add=add,
        commit=AsyncMock(),
        execute=AsyncMock(),
        _added=added,
    )
    return db


def _user(**overrides) -> Any:
    base = dict(
        id=uuid.uuid4(),
        plan="pro",
        stripe_subscription_id="sub_abc123",
        stripe_customer_id="cus_abc123",
        monthly_credits_granted_at=None,
    )
    base.update(overrides)
    return SimpleNamespace(**base)


def _lock_result(user) -> Any:
    """Emulate `db.execute(select(...).with_for_update(...)).scalar_one()`."""
    result = MagicMock()
    result.scalar_one.return_value = user
    return result


def _patch_cache(monkeypatch):
    monkeypatch.setattr(billing_api, "cache_delete", AsyncMock())


def _patch_settings(monkeypatch):
    monkeypatch.setattr(billing_api.settings, "STRIPE_SECRET_KEY", "sk_test_dummy")


# -------------------- Branch D: already free --------------------


@pytest.mark.asyncio
async def test_branch_d_already_free_raises_400(fake_db, monkeypatch):
    _patch_settings(monkeypatch)
    user = _user(plan="free", stripe_subscription_id=None, stripe_customer_id=None)
    with pytest.raises(HTTPException) as excinfo:
        await billing_api.cancel_subscription(user=user, db=fake_db)
    assert excinfo.value.status_code == 400
    assert fake_db._added == []


# -------------------- Branch E: pending sentinel --------------------


@pytest.mark.asyncio
async def test_branch_e_pending_sentinel_raises_409(fake_db, monkeypatch):
    _patch_settings(monkeypatch)
    user = _user(stripe_subscription_id="pending")
    with pytest.raises(HTTPException) as excinfo:
        await billing_api.cancel_subscription(user=user, db=fake_db)
    assert excinfo.value.status_code == 409
    assert "progress" in excinfo.value.detail.lower()


# -------------------- Branch A: active subscription --------------------


@pytest.mark.asyncio
async def test_branch_a_active_schedules_cancel(fake_db, monkeypatch):
    _patch_settings(monkeypatch)
    _patch_cache(monkeypatch)
    user = _user(stripe_subscription_id="sub_abc123")
    monkeypatch.setattr(billing_api.asyncio, "to_thread", AsyncMock(side_effect=[
        {"status": "active", "current_period_end": 1_800_000_000},
        {"current_period_end": 1_800_000_000},
    ]))

    result = await billing_api.cancel_subscription(user=user, db=fake_db)

    assert result["status"] == "scheduled_cancel"
    assert result["effective_at"] is not None
    # One audit row written.
    assert len(fake_db._added) == 1
    audit = fake_db._added[0]
    assert audit.source == "self_serve_cancel"
    assert audit.from_plan == "pro"
    assert audit.to_plan == "pro"  # not yet demoted at cancel-at-period-end time
    assert audit.metadata_json["cancel_at_period_end"] is True
    assert audit.metadata_json["status_at_cancel"] == "active"


@pytest.mark.asyncio
async def test_branch_a_trialing_also_cancellable(fake_db, monkeypatch):
    _patch_settings(monkeypatch)
    _patch_cache(monkeypatch)
    user = _user(stripe_subscription_id="sub_trial1")
    monkeypatch.setattr(billing_api.asyncio, "to_thread", AsyncMock(side_effect=[
        {"status": "trialing", "current_period_end": 1_800_000_000},
        {"current_period_end": 1_800_000_000},
    ]))
    result = await billing_api.cancel_subscription(user=user, db=fake_db)
    assert result["status"] == "scheduled_cancel"


@pytest.mark.asyncio
async def test_branch_a_past_due_also_cancellable(fake_db, monkeypatch):
    _patch_settings(monkeypatch)
    _patch_cache(monkeypatch)
    user = _user(stripe_subscription_id="sub_pd1")
    monkeypatch.setattr(billing_api.asyncio, "to_thread", AsyncMock(side_effect=[
        {"status": "past_due", "current_period_end": 1_800_000_000},
        {"current_period_end": 1_800_000_000},
    ]))
    result = await billing_api.cancel_subscription(user=user, db=fake_db)
    assert result["status"] == "scheduled_cancel"


@pytest.mark.asyncio
async def test_branch_a_already_canceled_syncs_local(fake_db, monkeypatch):
    _patch_settings(monkeypatch)
    _patch_cache(monkeypatch)
    user = _user(stripe_subscription_id="sub_done", plan="pro", monthly_credits_granted_at="2026-04-01")
    monkeypatch.setattr(billing_api.asyncio, "to_thread", AsyncMock(return_value={"status": "canceled"}))
    fake_db.execute = AsyncMock(return_value=_lock_result(user))

    result = await billing_api.cancel_subscription(user=user, db=fake_db)

    assert result["status"] == "immediate_revert"
    assert user.plan == "free"
    assert user.stripe_subscription_id is None
    assert user.monthly_credits_granted_at is None
    assert len(fake_db._added) == 1
    assert fake_db._added[0].to_plan == "free"
    assert fake_db._added[0].metadata_json["reason"] == "stripe_already_canceled_sync"


@pytest.mark.asyncio
async def test_branch_a_incomplete_status_409(fake_db, monkeypatch):
    _patch_settings(monkeypatch)
    user = _user(stripe_subscription_id="sub_ic1")
    monkeypatch.setattr(billing_api.asyncio, "to_thread", AsyncMock(return_value={"status": "incomplete"}))
    with pytest.raises(HTTPException) as excinfo:
        await billing_api.cancel_subscription(user=user, db=fake_db)
    assert excinfo.value.status_code == 409
    assert "incomplete" in excinfo.value.detail
    assert fake_db._added == []


@pytest.mark.asyncio
async def test_branch_a_stripe_retrieve_error_fails_closed(fake_db, monkeypatch):
    _patch_settings(monkeypatch)
    user = _user(stripe_subscription_id="sub_err")

    async def raise_err(*args, **kwargs):
        raise billing_api.stripe.StripeError("Stripe down")

    monkeypatch.setattr(billing_api.asyncio, "to_thread", raise_err)
    with pytest.raises(HTTPException) as excinfo:
        await billing_api.cancel_subscription(user=user, db=fake_db)
    assert excinfo.value.status_code == 502
    assert fake_db._added == []


@pytest.mark.asyncio
async def test_branch_a_stripe_modify_error_fails_closed(fake_db, monkeypatch):
    """retrieve succeeds, modify fails → 502, no audit row written."""
    _patch_settings(monkeypatch)
    user = _user(stripe_subscription_id="sub_xyz")
    call_count = {"n": 0}

    async def fake_to_thread(fn, *args, **kwargs):
        call_count["n"] += 1
        if call_count["n"] == 1:
            return {"status": "active", "current_period_end": 1_800_000_000}
        raise billing_api.stripe.StripeError("Modify boom")

    monkeypatch.setattr(billing_api.asyncio, "to_thread", fake_to_thread)
    with pytest.raises(HTTPException) as excinfo:
        await billing_api.cancel_subscription(user=user, db=fake_db)
    assert excinfo.value.status_code == 502
    assert fake_db._added == []


# -------------------- Branch F: malformed sub_id --------------------


@pytest.mark.asyncio
async def test_branch_f_malformed_sub_id_409(fake_db, monkeypatch):
    _patch_settings(monkeypatch)
    user = _user(stripe_subscription_id="garbage-not-stripe")
    with pytest.raises(HTTPException) as excinfo:
        await billing_api.cancel_subscription(user=user, db=fake_db)
    assert excinfo.value.status_code == 409
    assert "malformed" in excinfo.value.detail.lower()
    assert fake_db._added == []


# -------------------- Branch C: drift (no sub_id but customer_id) --------------------


@pytest.mark.asyncio
async def test_branch_c_single_sub_auto_heals(fake_db, monkeypatch):
    _patch_settings(monkeypatch)
    _patch_cache(monkeypatch)
    user = _user(stripe_subscription_id=None)
    monkeypatch.setattr(
        billing_api,
        "_list_customer_subscriptions",
        AsyncMock(return_value=[
            {"id": "sub_healed", "status": "active"},
        ]),
    )
    monkeypatch.setattr(billing_api.asyncio, "to_thread", AsyncMock(return_value={"current_period_end": 1_800_000_000}))
    fake_db.execute = AsyncMock(return_value=_lock_result(user))

    result = await billing_api.cancel_subscription(user=user, db=fake_db)

    assert result["status"] == "scheduled_cancel"
    assert user.stripe_subscription_id == "sub_healed"
    assert len(fake_db._added) == 1
    assert fake_db._added[0].metadata_json["reason"] == "branch_c_auto_heal"


@pytest.mark.asyncio
async def test_branch_c_multi_subs_409(fake_db, monkeypatch):
    _patch_settings(monkeypatch)
    user = _user(stripe_subscription_id=None)
    monkeypatch.setattr(
        billing_api,
        "_list_customer_subscriptions",
        AsyncMock(return_value=[
            {"id": "sub_1", "status": "active"},
            {"id": "sub_2", "status": "active"},
        ]),
    )
    with pytest.raises(HTTPException) as excinfo:
        await billing_api.cancel_subscription(user=user, db=fake_db)
    assert excinfo.value.status_code == 409
    assert "multiple" in excinfo.value.detail.lower()
    assert fake_db._added == []


@pytest.mark.asyncio
async def test_branch_c_zero_subs_falls_through_to_b(fake_db, monkeypatch):
    _patch_settings(monkeypatch)
    _patch_cache(monkeypatch)
    user = _user(stripe_subscription_id=None, plan="pro")
    monkeypatch.setattr(
        billing_api,
        "_list_customer_subscriptions",
        AsyncMock(return_value=[]),  # no cancellable subs
    )
    fake_db.execute = AsyncMock(return_value=_lock_result(user))

    result = await billing_api.cancel_subscription(user=user, db=fake_db)

    assert result["status"] == "immediate_revert"
    assert user.plan == "free"
    assert user.stripe_subscription_id is None
    # Two committed writes: no, just the final. begin_nested was removed.
    assert len(fake_db._added) == 1
    assert fake_db._added[0].metadata_json["reason"] == "admin_promoted_revert"
    # had_customer_id=True because user had customer_id set.
    assert fake_db._added[0].metadata_json["had_customer_id"] is True


@pytest.mark.asyncio
async def test_branch_c_stripe_list_error_fails_closed(fake_db, monkeypatch):
    _patch_settings(monkeypatch)
    user = _user(stripe_subscription_id=None)

    async def raise_err(*args, **kwargs):
        raise billing_api.stripe.StripeError("list boom")

    monkeypatch.setattr(billing_api, "_list_customer_subscriptions", raise_err)
    with pytest.raises(HTTPException) as excinfo:
        await billing_api.cancel_subscription(user=user, db=fake_db)
    assert excinfo.value.status_code == 502
    assert fake_db._added == []


@pytest.mark.asyncio
async def test_branch_c_auto_heal_stripe_modify_error_fails_closed(fake_db, monkeypatch):
    """Branch C finds single sub, heals DB, then Stripe modify fails → 502."""
    _patch_settings(monkeypatch)
    _patch_cache(monkeypatch)
    user = _user(stripe_subscription_id=None)
    monkeypatch.setattr(
        billing_api,
        "_list_customer_subscriptions",
        AsyncMock(return_value=[{"id": "sub_healed", "status": "active"}]),
    )

    async def raise_err(*args, **kwargs):
        raise billing_api.stripe.StripeError("modify after heal boom")

    monkeypatch.setattr(billing_api.asyncio, "to_thread", raise_err)
    fake_db.execute = AsyncMock(return_value=_lock_result(user))

    with pytest.raises(HTTPException) as excinfo:
        await billing_api.cancel_subscription(user=user, db=fake_db)
    assert excinfo.value.status_code == 502
    # Auto-heal committed (stripe_subscription_id set), but no audit row yet.
    assert user.stripe_subscription_id == "sub_healed"
    assert fake_db._added == []


# -------------------- Branch B: admin-promoted (no Stripe linkage) --------------------


@pytest.mark.asyncio
async def test_branch_b_admin_promoted_immediate_revert(fake_db, monkeypatch):
    _patch_settings(monkeypatch)
    _patch_cache(monkeypatch)
    user = _user(stripe_subscription_id=None, stripe_customer_id=None, plan="pro",
                 monthly_credits_granted_at="2026-04-01")
    fake_db.execute = AsyncMock(return_value=_lock_result(user))

    result = await billing_api.cancel_subscription(user=user, db=fake_db)

    assert result["status"] == "immediate_revert"
    assert user.plan == "free"
    assert user.stripe_subscription_id is None
    assert user.monthly_credits_granted_at is None
    assert len(fake_db._added) == 1
    audit = fake_db._added[0]
    assert audit.source == "self_serve_cancel"
    assert audit.from_plan == "pro"
    assert audit.to_plan == "free"
    assert audit.metadata_json["reason"] == "admin_promoted_revert"
    assert audit.metadata_json["had_customer_id"] is False


@pytest.mark.asyncio
async def test_branch_b_locked_reread_sees_free_raises_400(fake_db, monkeypatch):
    """Race: another request already set plan=free before we locked."""
    _patch_settings(monkeypatch)
    _patch_cache(monkeypatch)
    user = _user(stripe_subscription_id=None, stripe_customer_id=None, plan="pro")
    # After lock, db sees user.plan already changed to "free"
    locked_copy = _user(id=user.id, stripe_subscription_id=None, stripe_customer_id=None, plan="free")
    fake_db.execute = AsyncMock(return_value=_lock_result(locked_copy))

    with pytest.raises(HTTPException) as excinfo:
        await billing_api.cancel_subscription(user=user, db=fake_db)
    assert excinfo.value.status_code == 400
    assert fake_db._added == []


# -------------------- No Stripe configured --------------------


@pytest.mark.asyncio
async def test_503_when_stripe_key_missing(fake_db, monkeypatch):
    monkeypatch.setattr(billing_api.settings, "STRIPE_SECRET_KEY", "")
    user = _user()
    with pytest.raises(HTTPException) as excinfo:
        await billing_api.cancel_subscription(user=user, db=fake_db)
    assert excinfo.value.status_code == 503
