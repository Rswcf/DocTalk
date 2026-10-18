"""Independent attacks on finite legacy settlement proofs; no live provider calls."""
import copy
import uuid
from datetime import datetime, timezone

import pytest
from sqlalchemy import select

from app.core.config import settings
from app.models.database import AsyncSessionLocal
from app.models.tables import CreditLedger, LegacyCreditSettlement, User
from app.services import legacy_settlement_service as legacy
from app.services import refund_service as refunds
from app.services.credit_service import reconcile_credits
from tests.test_refund_operations_integration import purchase as _purchase

purchase = _purchase

def row(**overrides):
    value = dict(id=str(uuid.uuid4()), user_id=str(uuid.uuid4()), delta=-3,
                 balance_after=497, reason="chat", ref_type="mode", ref_id="quick",
                 created_at=datetime(2026, 5, 7, tzinfo=timezone.utc), reconciled_at=None)
    value.update(overrides)
    return value


@pytest.mark.parametrize("mode,cost", [("quick", 5), ("quick", 10), ("balanced", 15), ("balanced", 30)])
def test_summary_and_ordinary_predebits_are_not_settlement_proof(mode, cost):
    with pytest.raises(ValueError):
        legacy.prove_row(row(ref_id=mode, delta=-cost))


@pytest.mark.parametrize("field,value", [("delta", -1.5), ("delta", "-3"), ("delta", True),
                                         ("balance_after", True), ("balance_after", 3.5)])
def test_proof_rejects_non_integer_accounting_fields(field, value):
    with pytest.raises(ValueError):
        legacy.prove_row(row(**{field: value}))


@pytest.mark.parametrize("changes", [{"reason": "unknown"}, {"ref_type": "message"},
                                     {"ref_id": "thorough"}, {"delta": 0},
                                     {"created_at": datetime(2026, 10, 19, tzinfo=timezone.utc)}])
def test_unknown_writer_or_modern_row_has_no_proof(changes):
    with pytest.raises(ValueError):
        legacy.prove_row(row(**changes))


async def add_legacy(uid):
    async with AsyncSessionLocal() as db:
        item = CreditLedger(**{**row(), "id": uuid.uuid4(), "user_id": uid})
        db.add(item)
        await db.commit()
        return item.id


async def attest(uid, lid, monkeypatch):
    monkeypatch.setenv("DOCTALK_LEGACY_SETTLEMENT_ADMIN", "1")
    monkeypatch.setattr(settings, "AUTO_REFUND_ENABLED", False)
    monkeypatch.setattr(settings, "AUTO_REFUND_PROVIDER_CREATES_ENABLED", False)
    async with AsyncSessionLocal() as db:
        manifest = await legacy.build_manifest(db, uid, [lid])
        await legacy.apply_manifest(db, manifest, "independent-test-reviewer")
        await db.commit()
    monkeypatch.setattr(settings, "AUTO_REFUND_ENABLED", True)
    monkeypatch.setattr(settings, "AUTO_REFUND_PROVIDER_CREATES_ENABLED", True)
    return manifest


@pytest.mark.integration
@pytest.mark.asyncio(loop_scope="session")
async def test_one_unknown_null_prevents_cash_create(purchase, monkeypatch):
    uid, invoice, provider = purchase
    lid = await add_legacy(uid)
    await attest(uid, lid, monkeypatch)
    async with AsyncSessionLocal() as db:
        db.add(CreditLedger(user_id=uid, delta=-3, balance_after=3247,
                            reason="chat", ref_type="mode", ref_id="quick"))
        await db.commit()
    async with AsyncSessionLocal() as db:
        op = await refunds.request_refund(db, uid, invoice, "commercial", provider=provider)
        assert op.status == "review" and op.review_reason == "inflight_predebit"
        await refunds.confirm_refund(db, uid, op.id, provider=provider)
        await refunds.process_operation(AsyncSessionLocal, op.id, provider)
    assert provider.creates == 0


@pytest.mark.integration
@pytest.mark.asyncio(loop_scope="session")
async def test_proof_kind_substitution_does_not_bypass_validation(purchase, monkeypatch):
    uid = purchase[0]
    lid = await add_legacy(uid)
    await attest(uid, lid, monkeypatch)
    async with AsyncSessionLocal() as db:
        proof = await db.get(LegacyCreditSettlement, lid)
        changed = copy.deepcopy(proof.evidence_json)
        changed["proof"] = {"kind": "atomic_extraction_result"}
        proof.evidence_json = changed
        await db.commit()
    async with AsyncSessionLocal() as db:
        item = await db.get(CreditLedger, lid)
        assert await legacy.attested_ledger_ids(db, [item]) == set()


@pytest.mark.integration
@pytest.mark.asyncio(loop_scope="session")
async def test_attested_reconcile_never_reapplies_money(purchase, monkeypatch):
    uid = purchase[0]
    lid = await add_legacy(uid)
    await attest(uid, lid, monkeypatch)
    async with AsyncSessionLocal() as db:
        before = (await db.get(User, uid)).credits_balance
        with pytest.raises((ValueError, RuntimeError)):
            await reconcile_credits(db, uid, lid, 5, 1)
        await db.rollback()
    async with AsyncSessionLocal() as db:
        assert (await db.get(User, uid)).credits_balance == before
        item = await db.get(CreditLedger, lid)
        assert item.delta == -3 and item.reconciled_at is None


@pytest.mark.integration
@pytest.mark.asyncio(loop_scope="session")
async def test_manifest_cross_user_and_changed_body_rejected(purchase, monkeypatch):
    monkeypatch.setenv("DOCTALK_LEGACY_SETTLEMENT_ADMIN", "1")
    uid = purchase[0]
    lid = await add_legacy(uid)
    monkeypatch.setattr(settings, "AUTO_REFUND_ENABLED", False)
    monkeypatch.setattr(settings, "AUTO_REFUND_PROVIDER_CREATES_ENABLED", False)
    async with AsyncSessionLocal() as db:
        with pytest.raises(ValueError):
            await legacy.build_manifest(db, uuid.uuid4(), [lid])
        manifest = await legacy.build_manifest(db, uid, [lid])
        manifest["entries"][0]["snapshot"]["delta"] = -4
        with pytest.raises(ValueError):
            await legacy.apply_manifest(db, manifest, "independent-test-reviewer")
        await db.rollback()
    async with AsyncSessionLocal() as db:
        assert await db.scalar(select(LegacyCreditSettlement).where(LegacyCreditSettlement.ledger_id == lid)) is None


@pytest.mark.integration
@pytest.mark.asyncio(loop_scope="session")
async def test_attestation_idempotent_and_refund_protection_keeps_pending_working(purchase, monkeypatch):
    from app.services.chat_service import _refund_predebit

    uid = purchase[0]
    lid = await add_legacy(uid)
    manifest = await attest(uid, lid, monkeypatch)
    monkeypatch.setattr(settings, "AUTO_REFUND_ENABLED", False)
    monkeypatch.setattr(settings, "AUTO_REFUND_PROVIDER_CREATES_ENABLED", False)
    async with AsyncSessionLocal() as db:
        assert await legacy.apply_manifest(db, manifest, "second-reviewer") == 1
        await db.commit()
    async with AsyncSessionLocal() as db:
        before = (await db.get(User, uid)).credits_balance
        assert not await _refund_predebit(db, uid, 5, lid)
    async with AsyncSessionLocal() as db:
        assert (await db.get(User, uid)).credits_balance == before
        assert (await db.get(CreditLedger, lid)).reconciled_at is None
        pending = CreditLedger(user_id=uid, delta=-5, balance_after=before - 5,
                               reason="chat", ref_type="mode", ref_id="quick")
        db.add(pending)
        await db.commit()
        pending_id = pending.id
        assert await _refund_predebit(db, uid, 5, pending_id)
        assert not await _refund_predebit(db, uid, 5, pending_id)
    async with AsyncSessionLocal() as db:
        assert await db.get(CreditLedger, pending_id) is None
        assert (await db.get(User, uid)).credits_balance == before + 5


@pytest.mark.integration
@pytest.mark.asyncio(loop_scope="session")
async def test_attested_ledger_fingerprint_drift_fails_closed(purchase, monkeypatch):
    uid = purchase[0]
    lid = await add_legacy(uid)
    await attest(uid, lid, monkeypatch)
    async with AsyncSessionLocal() as db:
        item = await db.get(CreditLedger, lid)
        item.balance_after += 1
        await db.commit()
    async with AsyncSessionLocal() as db:
        item = await db.get(CreditLedger, lid)
        assert await legacy.attested_ledger_ids(db, [item]) == set()


@pytest.mark.integration
@pytest.mark.asyncio(loop_scope="session")
async def test_stale_transaction_cannot_delete_newly_attested_ledger(purchase, monkeypatch):
    from sqlalchemy import delete, text
    from sqlalchemy.exc import DBAPIError

    uid = purchase[0]
    lid = await add_legacy(uid)
    async with AsyncSessionLocal() as stale:
        await stale.execute(text("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ"))
        assert await stale.get(CreditLedger, lid) is not None
        await attest(uid, lid, monkeypatch)
        # Bypass application predicates to reproduce an old worker/snapshot.
        # PostgreSQL's FK must still prevent the settled ledger disappearing.
        with pytest.raises(DBAPIError):
            await stale.execute(delete(CreditLedger).where(CreditLedger.id == lid))
            await stale.commit()
        await stale.rollback()
    async with AsyncSessionLocal() as db:
        assert await db.get(CreditLedger, lid) is not None
        assert await db.get(LegacyCreditSettlement, lid) is not None


@pytest.mark.integration
@pytest.mark.asyncio(loop_scope="session")
async def test_user_cascade_deletes_ledger_and_attestation_together(purchase, monkeypatch):
    from sqlalchemy import delete

    uid = purchase[0]
    lid = await add_legacy(uid)
    await attest(uid, lid, monkeypatch)
    async with AsyncSessionLocal() as db:
        await db.execute(delete(User).where(User.id == uid))
        await db.commit()
    async with AsyncSessionLocal() as db:
        assert await db.get(User, uid) is None
        assert await db.get(CreditLedger, lid) is None
        assert await db.get(LegacyCreditSettlement, lid) is None


@pytest.mark.integration
@pytest.mark.asyncio(loop_scope="session")
async def test_complete_attestation_allows_future_purchase_without_ledger_rewrite(purchase, monkeypatch):
    uid, invoice, provider = purchase
    lid = await add_legacy(uid)
    await attest(uid, lid, monkeypatch)
    async with AsyncSessionLocal() as db:
        before = legacy.snapshot(await db.get(CreditLedger, lid))
        balance = (await db.get(User, uid)).credits_balance
        op = await refunds.request_refund(db, uid, invoice, "commercial", provider=provider)
        assert op.status == "eligible"
        op = await refunds.confirm_refund(db, uid, op.id, provider=provider)
        assert op.status == "reserved"
        assert legacy.snapshot(await db.get(CreditLedger, lid)) == before
        assert (await db.get(User, uid)).credits_balance == balance
        assert provider.creates == 0  # No processing or real/provider money operation.


@pytest.mark.integration
@pytest.mark.asyncio(loop_scope="session")
async def test_attestation_does_not_weaken_complex_funding(purchase, monkeypatch):
    uid, invoice, provider = purchase
    lid = await add_legacy(uid)
    await attest(uid, lid, monkeypatch)
    async with AsyncSessionLocal() as db:
        db.add(CreditLedger(user_id=uid, delta=100, balance_after=3350,
                            reason="monthly_allowance", ref_type="monthly_cycle", ref_id="old-cycle"))
        await db.commit()
        op = await refunds.request_refund(db, uid, invoice, "commercial", provider=provider)
        assert op.status == "review" and op.review_reason == "complex_funding"
        assert provider.creates == 0


@pytest.mark.integration
@pytest.mark.asyncio(loop_scope="session")
async def test_waiting_old_delete_is_blocked_by_fk_after_attestation_commit(purchase, monkeypatch):
    import asyncio

    from sqlalchemy import delete, text
    from sqlalchemy.exc import DBAPIError

    uid = purchase[0]
    lid = await add_legacy(uid)
    monkeypatch.setenv("DOCTALK_LEGACY_SETTLEMENT_ADMIN", "1")
    monkeypatch.setattr(settings, "AUTO_REFUND_ENABLED", False)
    monkeypatch.setattr(settings, "AUTO_REFUND_PROVIDER_CREATES_ENABLED", False)
    ready = asyncio.Event()
    pid = None

    async def old_delete():
        nonlocal pid
        async with AsyncSessionLocal() as deleting:
            pid = await deleting.scalar(text("SELECT pg_backend_pid()"))
            ready.set()
            try:
                # This statement snapshots before attestation COMMIT, then waits
                # on apply's ledger lock. Its SQL lacks the new app protection.
                await deleting.execute(delete(CreditLedger).where(CreditLedger.id == lid))
                await deleting.commit()
            except DBAPIError:
                await deleting.rollback()
                return "fk_blocked"
            return "deleted"

    async with AsyncSessionLocal() as applying:
        manifest = await legacy.build_manifest(applying, uid, [lid])
        await legacy.apply_manifest(applying, manifest, "independent-test-reviewer")
        task = asyncio.create_task(old_delete())
        try:
            await asyncio.wait_for(ready.wait(), timeout=5)
            async with AsyncSessionLocal() as observer:
                for _ in range(100):
                    event = await observer.scalar(text("SELECT wait_event_type FROM pg_stat_activity WHERE pid=:pid"), {"pid": pid})
                    if event == "Lock":
                        break
                    await asyncio.sleep(0.01)
                    await observer.rollback()  # Refresh pg_stat_activity snapshot.
                else:
                    pytest.fail("Old DELETE never reached the expected PostgreSQL lock wait")
            await applying.commit()
            assert await asyncio.wait_for(task, timeout=5) == "fk_blocked"
        finally:
            await applying.rollback()
            if not task.done():
                task.cancel()
                await asyncio.gather(task, return_exceptions=True)
    async with AsyncSessionLocal() as db:
        assert await db.get(CreditLedger, lid) is not None
        assert await db.get(LegacyCreditSettlement, lid) is not None
