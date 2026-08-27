from __future__ import annotations

import ast
import uuid
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.services import credit_service
from app.services.predebited_job_service import (
    PREDEBITED_JOB_LEASE_SECONDS,
    create_predebited_document_job,
)


@pytest.mark.asyncio
@pytest.mark.parametrize("job_type", ["extraction", "batch_template", "document_diff"])
async def test_registered_predebited_job_creation_always_sets_recovery_lease(
    job_type: str,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    added: list[object] = []
    db = SimpleNamespace(add=added.append, flush=AsyncMock())
    ledger_id = uuid.uuid4()
    debit = AsyncMock(return_value=ledger_id)
    monkeypatch.setattr(credit_service, "debit_credits", debit)
    before = datetime.now(timezone.utc)

    job, created_ledger_id = await create_predebited_document_job(
        db,
        user_id=uuid.uuid4(),
        document_id=uuid.uuid4(),
        job_type=job_type,
        input_scope={"source": "test"},
        predebit=25,
        reason="test",
    )

    assert created_ledger_id == ledger_id
    assert added == [job]
    assert job.status == "queued"
    assert job.worker_claim_token is None
    assert job.worker_lease_expires_at is not None
    lease_seconds = (job.worker_lease_expires_at - before).total_seconds()
    assert (
        PREDEBITED_JOB_LEASE_SECONDS - 1
        <= lease_seconds
        <= PREDEBITED_JOB_LEASE_SECONDS + 1
    )
    assert job.metadata_json == {
        "predebit_ledger_id": str(ledger_id),
        "pre_debited": 25,
    }
    debit.assert_awaited_once()
    assert debit.await_args.kwargs["ref_type"] == "document_job"
    assert debit.await_args.kwargs["ref_id"] == str(job.id)


@pytest.mark.asyncio
async def test_predebited_job_without_registered_recovery_policy_is_rejected(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db = SimpleNamespace(add=lambda _row: None, flush=AsyncMock())
    debit = AsyncMock()
    monkeypatch.setattr(credit_service, "debit_credits", debit)

    with pytest.raises(ValueError, match="has no recovery policy"):
        await create_predebited_document_job(
            db,
            user_id=uuid.uuid4(),
            job_type="future_paid_job",
            input_scope={},
            predebit=10,
            reason="future_paid_job",
        )

    debit.assert_not_awaited()


def test_document_job_predebit_creation_is_exclusive_to_shared_helper() -> None:
    """A future producer cannot silently bypass lease/recovery registration."""
    app_dir = Path(__file__).resolve().parents[1] / "app"
    producer_files: set[str] = set()

    for path in app_dir.rglob("*.py"):
        tree = ast.parse(path.read_text(), filename=str(path))
        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue
            function_name = (
                node.func.attr
                if isinstance(node.func, ast.Attribute)
                else (node.func.id if isinstance(node.func, ast.Name) else "")
            )
            if function_name != "debit_credits":
                continue
            ref_type = next(
                (keyword.value for keyword in node.keywords if keyword.arg == "ref_type"),
                None,
            )
            if (
                isinstance(ref_type, ast.Constant)
                and ref_type.value == "document_job"
            ):
                producer_files.add(path.relative_to(app_dir).as_posix())

    assert producer_files == {"services/predebited_job_service.py"}
