"""Mock live evidence tests: no provider traffic and no claim of real cash acceptance."""
from unittest.mock import Mock

import pytest

from app.core.config import settings
from app.services import refund_service as r


@pytest.fixture
def live(monkeypatch):
    monkeypatch.setattr(settings, "AUTO_REFUND_LIVE_USER_IDS", ["user_fixture"])
    monkeypatch.setattr(settings, "AUTO_REFUND_MODE", "live")
    monkeypatch.setattr(settings, "AUTO_REFUND_EXPECTED_ACCOUNT_ID", "acct_live_fixture")
    monkeypatch.setattr(settings, "STRIPE_SECRET_KEY", "sk_live_dummy_never_sent")
    monkeypatch.setattr(settings, "AUTO_REFUND_ENABLED", True)
    monkeypatch.setattr(settings, "AUTO_REFUND_PROVIDER_CREATES_ENABLED", False)
    client = Mock()
    client.v1.accounts.retrieve_current.return_value = {"id": "acct_live_fixture"}
    monkeypatch.setattr(r.stripe, "StripeClient", Mock(return_value=client))
    return client


@pytest.mark.parametrize("mode,key,account", [
    ("live", "sk_test_dummy", "acct_fixture"),
    ("sandbox", "sk_live_dummy", "acct_fixture"),
    ("live", "rk_live_dummy", "acct_fixture"),
    ("live", "sk_live_dummy", None),
    ("unexpected", "sk_live_dummy", "acct_fixture"),
])
def test_incoherent_configuration_fails_before_sdk(monkeypatch, mode, key, account):
    monkeypatch.setattr(settings, "AUTO_REFUND_MODE", mode)
    monkeypatch.setattr(settings, "STRIPE_SECRET_KEY", key)
    monkeypatch.setattr(settings, "AUTO_REFUND_EXPECTED_ACCOUNT_ID", account)
    sdk = Mock(side_effect=AssertionError("must not initialize SDK"))
    monkeypatch.setattr(r.stripe, "StripeClient", sdk)
    with pytest.raises(ValueError, match="environment_unconfigured"):
        r.Provider()
    sdk.assert_not_called()


def test_account_mismatch_blocks_all_object_reads(live):
    live.v1.accounts.retrieve_current.return_value = {"id": "acct_wrong"}
    with pytest.raises(ValueError, match="account_mismatch"):
        r.Provider().refunds("ch_dummy")
    live.v1.refunds.list.assert_not_called()


def test_provider_create_rechecks_switch_before_post(live, monkeypatch):
    provider = r.Provider()
    op = {"user_id": "user_fixture", "provider_mode": "live", "provider_account_id": "acct_live_fixture"}
    with pytest.raises(ValueError, match="creates_disabled"):
        provider.create(op)
    live.v1.refunds.create.assert_not_called()
    monkeypatch.setattr(settings, "AUTO_REFUND_PROVIDER_CREATES_ENABLED", True)
    monkeypatch.setattr(settings, "AUTO_REFUND_ENABLED", False)
    with pytest.raises(ValueError, match="creates_disabled"):
        provider.create(op)
    live.v1.refunds.create.assert_not_called()


def test_pinned_client_refuses_runtime_environment_switch(live, monkeypatch):
    provider = r.Provider()
    monkeypatch.setattr(settings, "AUTO_REFUND_EXPECTED_ACCOUNT_ID", "acct_other")
    with pytest.raises(ValueError, match="environment_changed"):
        provider.refunds("ch_dummy")
    live.v1.accounts.retrieve_current.assert_not_called()


def test_old_null_identity_and_other_environment_never_match(live):
    assert not r.matches_environment({})
    assert not r.matches_environment({"provider_mode": "sandbox", "provider_account_id": "acct_live_fixture"})
    assert not r.matches_environment({"provider_mode": "live", "provider_account_id": "acct_other"})


def test_live_refund_missing_mode_uses_fresh_chain(live):
    data = dict(id="op", provider_mode="live", provider_account_id="acct_live_fixture", invoice_id="in_x", subscription_id="sub_x", payment_intent_id="pi_x", charge_id="ch_x", customer_id="cus_x", amount_minor=100, currency="usd")
    refund = dict(charge="ch_x", amount=100, currency="usd", metadata={"doctalk_refund_operation":"op"})
    facts = {name:dict(id=ident, customer="cus_x", livemode=True) for name,ident in [("invoice","in_x"),("subscription","sub_x"),("intent","pi_x"),("charge","ch_x")]}
    facts["charge"].update(amount=100, currency="usd")
    assert r.refund_identity(refund, data) and r.payment_chain_identity(facts, data)
    refund["livemode"] = False
    assert not r.refund_identity(refund, data)
    refund.pop("livemode")
    facts["charge"]["livemode"] = "true"
    assert not r.payment_chain_identity(facts, data)


@pytest.mark.parametrize("scope,user,allowed", [([], "user_fixture", False), (["other"], "user_fixture", False), (["user_fixture"], "user_fixture", True), (["*"], "another", True), (["user_fixture"], None, False)])
def test_live_canary_requires_explicit_user_scope(live, monkeypatch, scope, user, allowed):
    monkeypatch.setattr(settings, "AUTO_REFUND_LIVE_USER_IDS", scope)
    monkeypatch.setattr(settings, "AUTO_REFUND_POLICY_START_AT", "2026-01-01T00:00:00Z")
    assert r.user_in_scope(user) is allowed
    assert bool(r.enrollment(user_id=user)) is allowed


def test_sandbox_scope_is_independent_of_live_canary(live, monkeypatch):
    monkeypatch.setattr(settings, "AUTO_REFUND_MODE", "sandbox")
    monkeypatch.setattr(settings, "STRIPE_SECRET_KEY", "sk_test_dummy")
    monkeypatch.setattr(settings, "AUTO_REFUND_LIVE_USER_IDS", [])
    assert r.user_in_scope(None)
