"""Unit tests for `compute_billing_state` (billing_state projection)."""

from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.api import billing as billing_api


def _user(**overrides):
    base = dict(
        id=uuid.uuid4(),
        plan="pro",
        stripe_subscription_id="sub_abc",
        stripe_customer_id="cus_abc",
    )
    base.update(overrides)
    return SimpleNamespace(**base)


def _patch_cache_miss(monkeypatch):
    monkeypatch.setattr(billing_api, "cache_get", AsyncMock(return_value=None))
    monkeypatch.setattr(billing_api, "cache_set", AsyncMock())


def _patch_cache_hit(monkeypatch, cached_value):
    monkeypatch.setattr(billing_api, "cache_get", AsyncMock(return_value=cached_value))
    monkeypatch.setattr(billing_api, "cache_set", AsyncMock())


# -------------------- Fast paths (no Stripe call) --------------------


@pytest.mark.asyncio
async def test_free_user_no_stripe_linkage_returns_none(monkeypatch):
    _patch_cache_miss(monkeypatch)
    user = _user(plan="free", stripe_subscription_id=None, stripe_customer_id=None)
    state = await billing_api.compute_billing_state(user)
    assert state == {
        "managed_by": "none",
        "can_cancel": False,
        "interval": None,
        "period_end": None,
        "cancel_at_period_end": False,
        "status": "none",
    }


@pytest.mark.asyncio
async def test_pending_sentinel_shows_pending_no_cancel(monkeypatch):
    _patch_cache_miss(monkeypatch)
    user = _user(stripe_subscription_id="pending")
    state = await billing_api.compute_billing_state(user)
    assert state["status"] == "pending"
    assert state["can_cancel"] is False
    assert state["managed_by"] == "stripe"


@pytest.mark.asyncio
async def test_malformed_sub_id_blocks_cancel(monkeypatch):
    _patch_cache_miss(monkeypatch)
    user = _user(stripe_subscription_id="garbage")
    state = await billing_api.compute_billing_state(user)
    assert state["can_cancel"] is False
    assert state["status"] == "none"


# -------------------- Cache --------------------


@pytest.mark.asyncio
async def test_cache_hit_short_circuits_stripe(monkeypatch):
    cached = {
        "managed_by": "stripe",
        "can_cancel": True,
        "interval": "month",
        "period_end": "2026-05-14T12:00:00+00:00",
        "cancel_at_period_end": False,
        "status": "active",
    }
    _patch_cache_hit(monkeypatch, cached)
    # Stripe call should never happen — explicitly fail if attempted.
    monkeypatch.setattr(
        billing_api.asyncio, "to_thread",
        AsyncMock(side_effect=AssertionError("Should not call Stripe on cache hit")),
    )
    user = _user()
    state = await billing_api.compute_billing_state(user)
    assert state == cached


# -------------------- Stripe sub projection --------------------


@pytest.mark.asyncio
async def test_active_sub_projects_correctly(monkeypatch):
    _patch_cache_miss(monkeypatch)
    user = _user(stripe_subscription_id="sub_active")
    monkeypatch.setattr(
        billing_api.asyncio,
        "to_thread",
        AsyncMock(return_value={
            "status": "active",
            "current_period_end": 1_800_000_000,
            "cancel_at_period_end": False,
            "items": {"data": [{"price": {"recurring": {"interval": "month"}}}]},
        }),
    )
    state = await billing_api.compute_billing_state(user)
    assert state["managed_by"] == "stripe"
    assert state["can_cancel"] is True
    assert state["interval"] == "month"
    assert state["status"] == "active"
    assert state["cancel_at_period_end"] is False
    assert state["period_end"] is not None


@pytest.mark.asyncio
async def test_already_cancel_at_period_end_disables_cancel(monkeypatch):
    """After user clicks cancel, can_cancel should flip off to avoid double-click."""
    _patch_cache_miss(monkeypatch)
    user = _user(stripe_subscription_id="sub_scheduled")
    monkeypatch.setattr(
        billing_api.asyncio,
        "to_thread",
        AsyncMock(return_value={
            "status": "active",
            "current_period_end": 1_800_000_000,
            "cancel_at_period_end": True,
            "items": {"data": [{"price": {"recurring": {"interval": "year"}}}]},
        }),
    )
    state = await billing_api.compute_billing_state(user)
    assert state["cancel_at_period_end"] is True
    assert state["can_cancel"] is False
    assert state["interval"] == "year"


@pytest.mark.asyncio
async def test_canceled_status_labels_correctly(monkeypatch):
    _patch_cache_miss(monkeypatch)
    user = _user(stripe_subscription_id="sub_done")
    monkeypatch.setattr(
        billing_api.asyncio,
        "to_thread",
        AsyncMock(return_value={
            "status": "canceled",
            "items": {"data": []},
        }),
    )
    state = await billing_api.compute_billing_state(user)
    assert state["status"] == "canceled"
    assert state["can_cancel"] is False  # already canceled on Stripe side


# -------------------- Branch C mirroring --------------------


@pytest.mark.asyncio
async def test_no_sub_id_with_customer_single_cancellable_sub(monkeypatch):
    _patch_cache_miss(monkeypatch)
    user = _user(stripe_subscription_id=None)
    monkeypatch.setattr(
        billing_api,
        "_list_customer_subscriptions",
        AsyncMock(return_value=[{"id": "sub_x", "status": "active",
                                  "current_period_end": 1_800_000_000,
                                  "items": {"data": [{"price": {"recurring": {"interval": "month"}}}]}}]),
    )
    state = await billing_api.compute_billing_state(user)
    assert state["managed_by"] == "stripe"
    assert state["can_cancel"] is True


@pytest.mark.asyncio
async def test_no_sub_id_with_customer_multi_subs_marks_uncancellable(monkeypatch):
    _patch_cache_miss(monkeypatch)
    user = _user(stripe_subscription_id=None)
    monkeypatch.setattr(
        billing_api,
        "_list_customer_subscriptions",
        AsyncMock(return_value=[
            {"id": "sub_1", "status": "active"},
            {"id": "sub_2", "status": "active"},
        ]),
    )
    state = await billing_api.compute_billing_state(user)
    assert state["managed_by"] == "stripe"
    assert state["can_cancel"] is False  # ambiguous


@pytest.mark.asyncio
async def test_no_sub_id_no_subs_on_customer_reports_admin(monkeypatch):
    _patch_cache_miss(monkeypatch)
    user = _user(stripe_subscription_id=None, plan="pro")
    monkeypatch.setattr(
        billing_api,
        "_list_customer_subscriptions",
        AsyncMock(return_value=[]),
    )
    state = await billing_api.compute_billing_state(user)
    assert state["managed_by"] == "admin"
    assert state["can_cancel"] is True  # Branch B path is valid


# -------------------- Failure degradation --------------------


@pytest.mark.asyncio
async def test_stripe_error_degrades_gracefully(monkeypatch):
    _patch_cache_miss(monkeypatch)
    user = _user(stripe_subscription_id="sub_err", plan="pro")

    async def raise_err(*args, **kwargs):
        raise billing_api.stripe.StripeError("Stripe down")

    monkeypatch.setattr(billing_api.asyncio, "to_thread", raise_err)
    state = await billing_api.compute_billing_state(user)
    # Degraded but doesn't 500 — profile endpoint stays up.
    assert state["managed_by"] == "stripe"
    assert state["status"] == "none"
    # can_cancel True based on plan alone — endpoint will fail-closed if clicked.
    assert state["can_cancel"] is True
