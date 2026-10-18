"""Historical protocol proof; these tests never call a payment provider."""
import uuid
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

from app.services.legacy_settlement_service import fingerprint, prove_row, snapshot


def ledger(**changes):
    values = dict(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        delta=-9,
        balance_after=381,
        reason="chat",
        ref_type="mode",
        ref_id="quick",
        created_at=datetime(2026, 5, 9, tzinfo=timezone.utc),
        reconciled_at=None,
    )
    values.update(changes)
    return SimpleNamespace(**values)


@pytest.mark.parametrize(
    "mode,amount", [("quick", 5), ("quick", 10), ("balanced", 15), ("balanced", 30)]
)
def test_every_initial_predebit_remains_unknown(mode, amount):
    with pytest.raises(ValueError, match="original_chat_predebit"):
        prove_row(ledger(ref_id=mode, delta=-amount))


def test_changed_chat_amount_proves_old_reconciliation_but_not_modern():
    row = ledger()
    assert prove_row(row)["kind"] == "changed_chat_predebit"
    row.created_at = datetime(2026, 10, 19, tzinfo=timezone.utc)
    with pytest.raises(ValueError, match="not_audited"):
        prove_row(row)


def test_fingerprint_covers_every_historical_field():
    row = ledger()
    original = fingerprint(row)
    for name, value in [
        ("delta", -8),
        ("balance_after", 382),
        ("ref_id", "balanced"),
        ("reason", "other"),
        ("user_id", uuid.uuid4()),
    ]:
        values = snapshot(row)
        values[name] = value
        assert fingerprint(values) != original


def test_extraction_requires_both_metadata_link_and_atomic_terminal_result():
    jid = uuid.uuid4()
    row = ledger(reason="extraction", ref_type="document_job", ref_id=str(jid))
    job = SimpleNamespace(
        id=jid,
        user_id=row.user_id,
        job_type="extraction",
        status="succeeded",
        completed_at=row.created_at,
        cost_credits=9,
        metadata_json={"pre_debited": 25, "predebit_ledger_id": str(row.id)},
    )
    result = SimpleNamespace(id=uuid.uuid4(), job_id=jid)
    assert prove_row(row, job, result)["kind"] == "atomic_extraction_result"
    job.metadata_json["predebit_ledger_id"] = str(uuid.uuid4())
    with pytest.raises(ValueError, match="extraction_proof_mismatch"):
        prove_row(row, job, result)
