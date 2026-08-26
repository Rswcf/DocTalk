"""Real-Postgres coverage for extraction claim and settlement durability.

Requires docker. ``SKIP_INTEGRATION=1`` (the default) skips this file.
"""
from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import pytest
from sqlalchemy import func, select, update

pytestmark = [pytest.mark.integration, pytest.mark.asyncio(loop_scope="session")]


class SimulatedWorkerDeath(BaseException):
    """Bypass ordinary failure settlement like a hard-dead worker process."""


async def _grant_credits(user_id: uuid.UUID, amount: int) -> None:
    from app.models.database import AsyncSessionLocal
    from app.services import credit_service

    async with AsyncSessionLocal() as db:
        await credit_service.credit_credits(db, user_id, amount, reason="test_grant")
        await db.commit()


async def _prepare_predebited_extraction(
    auth_user: Any,
    monkeypatch: pytest.MonkeyPatch,
) -> dict[str, Any]:
    from app.models.database import AsyncSessionLocal
    from app.models.tables import Chunk, Document, DocumentJob, FeatureTrialUsage, User
    from app.services import credit_service, extraction_service

    await _grant_credits(auth_user.id, 500)

    async with AsyncSessionLocal() as db:
        balance_before = await db.scalar(
            select(User.credits_balance).where(User.id == auth_user.id)
        )
        document = Document(
            filename="durable-settlement.pdf",
            file_size=100,
            storage_key=f"documents/{uuid.uuid4()}/durable-settlement.pdf",
            status="ready",
            user_id=auth_user.id,
        )
        job = DocumentJob(
            user_id=auth_user.id,
            document=document,
            job_type="extraction",
            status="queued",
            input_scope={"template_key": "executive_summary", "domain_mode": "legal"},
            worker_lease_expires_at=datetime.now(timezone.utc)
            + timedelta(seconds=extraction_service.EXTRACTION_LEASE_SECONDS),
        )
        db.add_all([document, job])
        await db.flush()
        ledger_id = await credit_service.debit_credits(
            db,
            user_id=auth_user.id,
            cost=extraction_service.EXTRACTION_PREDEBIT_CREDITS,
            reason="extraction",
            ref_type="document_job",
            ref_id=str(job.id),
        )
        assert ledger_id is not None
        job.metadata_json = {
            "predebit_ledger_id": str(ledger_id),
            "pre_debited": extraction_service.EXTRACTION_PREDEBIT_CREDITS,
        }
        db.add(
            FeatureTrialUsage(
                user_id=auth_user.id,
                feature="domain_mode",
                slot_index=0,
                owning_job_id=job.id,
            )
        )
        await db.commit()
        job_id = job.id
        document_id = document.id

    chunk = Chunk(
        id=uuid.uuid4(),
        document_id=document_id,
        page_start=1,
        page_end=1,
        section_title="Summary",
        text="The source passage used by the extraction.",
        bboxes=[],
    )
    monkeypatch.setattr(
        extraction_service,
        "retrieve_extraction_chunks",
        lambda *_args, **_kwargs: [(chunk, 0.99)],
    )
    monkeypatch.setattr(
        extraction_service,
        "_call_llm",
        lambda *_args, **_kwargs: (
            {
                "title": "Durable result",
                "summary": "The result was delivered.",
                "key_points": [{"text": "Supported finding", "source_refs": [1]}],
                "risks_or_open_questions": [],
            },
            100,
            20,
        ),
    )
    monkeypatch.setattr(extraction_service, "calculate_cost", lambda *_args, **_kwargs: 9)
    return {
        "job_id": job_id,
        "ledger_id": ledger_id,
        "balance_before": balance_before,
    }


async def _persisted_state(
    *,
    user_id: uuid.UUID,
    job_id: uuid.UUID,
    ledger_id: uuid.UUID,
) -> dict[str, Any]:
    from app.models.database import AsyncSessionLocal
    from app.models.tables import (
        CreditLedger,
        DocumentJob,
        ExtractionResult,
        FeatureTrialUsage,
        UsageRecord,
        User,
    )
    from app.services import extraction_service

    async with AsyncSessionLocal() as db:
        job = await db.get(DocumentJob, job_id)
        result = await db.scalar(
            select(ExtractionResult).where(ExtractionResult.job_id == job_id)
        )
        ledger = await db.get(CreditLedger, ledger_id)
        usage_count = await db.scalar(
            select(func.count())
            .select_from(UsageRecord)
            .where(
                UsageRecord.user_id == user_id,
                UsageRecord.model == extraction_service.EXTRACTION_MODEL,
                UsageRecord.prompt_tokens == 100,
                UsageRecord.completion_tokens == 20,
                UsageRecord.cost_credits == 9,
            )
        )
        trial = await db.scalar(
            select(FeatureTrialUsage).where(FeatureTrialUsage.owning_job_id == job_id)
        )
        balance = await db.scalar(
            select(User.credits_balance).where(User.id == user_id)
        )
        assert job is not None
        return {
            "job_status": job.status,
            "job_cost": job.cost_credits,
            "job_error_code": job.error_code,
            "claim_token": job.worker_claim_token,
            "claim_attempts": job.worker_claim_attempts,
            "lease_expires_at": job.worker_lease_expires_at,
            "result_exists": result is not None,
            "rendered_markdown": result.rendered_markdown if result else "",
            "ledger_exists": ledger is not None,
            "ledger_delta": ledger.delta if ledger else None,
            "ledger_reconciled": ledger.reconciled_at is not None if ledger else False,
            "usage_count": usage_count,
            "trial_exists": trial is not None,
            "balance": balance,
        }


def _assert_exact_success(state: dict[str, Any], balance_before: int) -> None:
    assert state["job_status"] == "succeeded"
    assert state["job_cost"] == 9
    assert state["job_error_code"] is None
    assert state["claim_token"] is None
    assert state["lease_expires_at"] is None
    assert state["result_exists"] is True
    assert state["rendered_markdown"]
    assert state["usage_count"] == 1
    assert state["ledger_exists"] is True
    assert state["ledger_delta"] == -9
    assert state["ledger_reconciled"] is True
    assert state["trial_exists"] is True
    assert state["balance"] == balance_before - 9


async def test_success_commit_landed_acknowledgement_lost_keeps_extraction_succeeded(
    auth_user: Any,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A lost acknowledgement from the final settlement cannot mint credits."""
    from app.models import sync_database
    from app.services import extraction_service

    prepared = await _prepare_predebited_extraction(auth_user, monkeypatch)
    real_session_factory = sync_database.SyncSessionLocal
    opened_sessions = 0

    def session_factory():
        nonlocal opened_sessions
        opened_sessions += 1
        session = real_session_factory()
        if opened_sessions == 2:  # claim session, then work/settlement session
            real_commit = session.commit

            def commit_with_lost_acknowledgement() -> None:
                real_commit()
                raise ConnectionError("success commit acknowledgement lost")

            session.commit = commit_with_lost_acknowledgement  # type: ignore[method-assign]
        return session

    monkeypatch.setattr(sync_database, "SyncSessionLocal", session_factory)
    await asyncio.to_thread(
        extraction_service.run_extraction_job_sync,
        str(prepared["job_id"]),
    )

    state = await _persisted_state(
        user_id=auth_user.id,
        job_id=prepared["job_id"],
        ledger_id=prepared["ledger_id"],
    )
    assert opened_sessions == 3  # claim + work + fresh settlement resolver
    assert state["claim_attempts"] == 1
    _assert_exact_success(state, prepared["balance_before"])


async def test_claim_commit_landed_acknowledgement_lost_resolves_in_fresh_session(
    auth_user: Any,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The first commit lands; its fresh resolver recognizes the same token."""
    from app.models import sync_database
    from app.services import extraction_service

    prepared = await _prepare_predebited_extraction(auth_user, monkeypatch)
    real_session_factory = sync_database.SyncSessionLocal
    opened_sessions = 0

    def session_factory():
        nonlocal opened_sessions
        opened_sessions += 1
        session = real_session_factory()
        if opened_sessions == 1:
            real_commit = session.commit

            def commit_with_lost_acknowledgement() -> None:
                real_commit()
                raise ConnectionError("claim commit acknowledgement lost")

            session.commit = commit_with_lost_acknowledgement  # type: ignore[method-assign]
        return session

    monkeypatch.setattr(sync_database, "SyncSessionLocal", session_factory)
    await asyncio.to_thread(
        extraction_service.run_extraction_job_sync,
        str(prepared["job_id"]),
    )

    state = await _persisted_state(
        user_id=auth_user.id,
        job_id=prepared["job_id"],
        ledger_id=prepared["ledger_id"],
    )
    assert opened_sessions == 3  # ambiguous claim + fresh resolver + work
    assert state["claim_attempts"] == 1
    _assert_exact_success(state, prepared["balance_before"])


async def test_worker_dies_after_claim_late_ack_redelivery_reclaims_after_lease(
    auth_user: Any,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A hard-dead first worker is recoverable, but only after its lease."""
    from app.models.database import AsyncSessionLocal
    from app.models.tables import DocumentJob
    from app.services import extraction_service
    from app.workers.celery_app import celery_app

    prepared = await _prepare_predebited_extraction(auth_user, monkeypatch)
    successful_call = extraction_service._call_llm
    calls = 0

    def die_once(*args, **kwargs):
        nonlocal calls
        calls += 1
        if calls == 1:
            raise SimulatedWorkerDeath("worker process died after claim")
        return successful_call(*args, **kwargs)

    monkeypatch.setattr(extraction_service, "_call_llm", die_once)
    with pytest.raises(SimulatedWorkerDeath):
        await asyncio.to_thread(
            extraction_service.run_extraction_job_sync,
            str(prepared["job_id"]),
        )

    stranded = await _persisted_state(
        user_id=auth_user.id,
        job_id=prepared["job_id"],
        ledger_id=prepared["ledger_id"],
    )
    assert stranded["job_status"] == "running"
    assert stranded["job_cost"] == 0
    assert stranded["claim_token"] is not None
    assert stranded["claim_attempts"] == 1
    assert stranded["lease_expires_at"] is not None
    assert stranded["result_exists"] is False
    assert stranded["usage_count"] == 0
    assert stranded["ledger_exists"] is True
    assert stranded["ledger_delta"] == -25
    assert stranded["ledger_reconciled"] is False
    assert stranded["trial_exists"] is True
    assert stranded["balance"] == prepared["balance_before"] - 25

    visibility_timeout = celery_app.conf.broker_transport_options["visibility_timeout"]
    assert extraction_service.EXTRACTION_LEASE_SECONDS > visibility_timeout

    # Redis can redeliver the late-ack message at 40 minutes, but the 45-minute
    # database lease still wins. The delivery must not run or settle early.
    await asyncio.to_thread(
        extraction_service.run_extraction_job_sync,
        str(prepared["job_id"]),
    )
    before_expiry = await _persisted_state(
        user_id=auth_user.id,
        job_id=prepared["job_id"],
        ledger_id=prepared["ledger_id"],
    )
    assert before_expiry == stranded
    assert calls == 1

    async with AsyncSessionLocal() as db:
        await db.execute(
            update(DocumentJob)
            .where(DocumentJob.id == prepared["job_id"])
            .values(
                worker_lease_expires_at=datetime.now(timezone.utc) - timedelta(seconds=1),
                updated_at=datetime.now(timezone.utc) - timedelta(seconds=visibility_timeout + 1),
            )
        )
        await db.commit()

    # This is the original late-ack delivery (no watchdog token). Its fresh
    # claim is permitted only because the durable lease is now expired.
    await asyncio.to_thread(
        extraction_service.run_extraction_job_sync,
        str(prepared["job_id"]),
    )

    recovered = await _persisted_state(
        user_id=auth_user.id,
        job_id=prepared["job_id"],
        ledger_id=prepared["ledger_id"],
    )
    assert recovered["claim_attempts"] == 2
    _assert_exact_success(recovered, prepared["balance_before"])


async def test_expired_final_claim_atomically_refunds_fails_and_releases_trial(
    auth_user: Any,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A second dead claim cannot strand money or its Domain Mode slot."""
    from app.models.database import AsyncSessionLocal
    from app.models.tables import DocumentJob
    from app.workers import extraction_worker

    prepared = await _prepare_predebited_extraction(auth_user, monkeypatch)
    async with AsyncSessionLocal() as db:
        await db.execute(
            update(DocumentJob)
            .where(DocumentJob.id == prepared["job_id"])
            .values(
                status="running",
                worker_claim_token=uuid.uuid4(),
                worker_claim_attempts=2,
                worker_lease_expires_at=datetime.now(timezone.utc) - timedelta(seconds=1),
                updated_at=datetime.now(timezone.utc) - timedelta(hours=1),
            )
        )
        await db.commit()

    dispatched: list[tuple[Any, ...]] = []
    monkeypatch.setattr(
        extraction_worker.run_extraction_job,
        "delay",
        lambda *args: dispatched.append(args),
    )
    assert await asyncio.to_thread(extraction_worker.requeue_stale_running_extractions) == 0
    assert dispatched == []

    settled = await _persisted_state(
        user_id=auth_user.id,
        job_id=prepared["job_id"],
        ledger_id=prepared["ledger_id"],
    )
    assert settled["job_status"] == "failed"
    assert settled["job_cost"] == 0
    assert settled["job_error_code"] == "EXTRACTION_RECOVERY_EXHAUSTED"
    assert settled["claim_token"] is None
    assert settled["claim_attempts"] == 2
    assert settled["lease_expires_at"] is None
    assert settled["result_exists"] is False
    assert settled["usage_count"] == 0
    assert settled["ledger_exists"] is False
    assert settled["trial_exists"] is False
    assert settled["balance"] == prepared["balance_before"]
