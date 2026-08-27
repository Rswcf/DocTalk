"""Accepted-publication-loss coverage for every predebited job boundary.

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


async def _grant_credits(user_id: uuid.UUID, amount: int) -> None:
    from app.models.database import AsyncSessionLocal
    from app.services import credit_service

    async with AsyncSessionLocal() as db:
        await credit_service.credit_credits(db, user_id, amount, reason="test_grant")
        await db.commit()


async def _recovery_state(
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
        User,
    )

    async with AsyncSessionLocal() as db:
        job = await db.get(DocumentJob, job_id)
        ledger = await db.get(CreditLedger, ledger_id)
        result_count = await db.scalar(
            select(func.count())
            .select_from(ExtractionResult)
            .where(ExtractionResult.job_id == job_id)
        )
        trial_count = await db.scalar(
            select(func.count())
            .select_from(FeatureTrialUsage)
            .where(FeatureTrialUsage.owning_job_id == job_id)
        )
        balance = await db.scalar(
            select(User.credits_balance).where(User.id == user_id)
        )
        assert job is not None
        return {
            "status": job.status,
            "cost": job.cost_credits,
            "error_code": job.error_code,
            "claim_token": job.worker_claim_token,
            "claim_attempts": job.worker_claim_attempts,
            "lease": job.worker_lease_expires_at,
            "result_count": int(result_count or 0),
            "trial_count": int(trial_count or 0),
            "ledger_exists": ledger is not None,
            "ledger_delta": ledger.delta if ledger else None,
            "ledger_reconciled": (
                ledger.reconciled_at is not None if ledger else False
            ),
            "balance": balance,
        }


async def _expire_job_lease(
    job_id: uuid.UUID,
    *,
    null_lease: bool = False,
) -> None:
    from app.models.database import AsyncSessionLocal
    from app.models.tables import DocumentJob
    from app.services.predebited_job_service import PREDEBITED_JOB_LEASE_SECONDS

    now = datetime.now(timezone.utc)
    values: dict[str, Any] = {
        "worker_lease_expires_at": (None if null_lease else now - timedelta(seconds=1)),
    }
    if null_lease:
        # Prove the watchdog's structural fallback: a producer/legacy row with
        # no lease is eligible only after the full broker-safe lease window.
        values["created_at"] = now - timedelta(seconds=PREDEBITED_JOB_LEASE_SECONDS + 1)
    async with AsyncSessionLocal() as db:
        await db.execute(
            update(DocumentJob).where(DocumentJob.id == job_id).values(**values)
        )
        await db.commit()


async def _exhaust_lost_recovery_dispatches(
    job_id: uuid.UUID,
    *,
    first_lease_is_null: bool = False,
) -> tuple[int, int, int]:
    from app.workers import extraction_worker

    await _expire_job_lease(job_id, null_lease=first_lease_is_null)
    first = await asyncio.to_thread(extraction_worker.requeue_stale_running_extractions)
    await _expire_job_lease(job_id)
    second = await asyncio.to_thread(
        extraction_worker.requeue_stale_running_extractions
    )
    await _expire_job_lease(job_id)
    terminal = await asyncio.to_thread(
        extraction_worker.requeue_stale_running_extractions
    )
    return first, second, terminal


async def test_chat_native_accepted_message_loss_refunds_exactly_and_null_lease_is_swept(
    auth_user: Any,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.models.database import AsyncSessionLocal
    from app.models.tables import Document, User
    from app.services.action_planner import ActionPlan, ChatAction
    from app.services.chat_tool_executor import _queue_extraction
    from app.services.extraction_service import EXTRACTION_PREDEBIT_CREDITS
    from app.workers.extraction_worker import run_extraction_job

    await _grant_credits(auth_user.id, 100)
    monkeypatch.setattr(run_extraction_job, "delay", lambda *_args: None)

    async with AsyncSessionLocal() as db:
        user = await db.get(User, auth_user.id)
        assert user is not None
        balance_before = user.credits_balance
        document = Document(
            filename="chat-native-loss.pdf",
            file_size=100,
            storage_key=f"documents/{uuid.uuid4()}/chat-native-loss.pdf",
            status="ready",
            user_id=user.id,
        )
        db.add(document)
        await db.commit()
        await db.refresh(document)

        execution = await _queue_extraction(
            user=user,
            db=db,
            doc=document,
            plan=ActionPlan(
                action=ChatAction.EXTRACT_DELIVERABLE,
                confidence=1.0,
                requires_confirmation=False,
                template_key="executive_summary",
            ),
            locale="en",
            domain_mode=None,
        )
        assert execution.artifact is not None
        assert execution.artifact.status == "queued"
        job_id = uuid.UUID(execution.artifact.job_id or "")

    ledger_id = uuid.UUID(str((await _job_metadata(job_id))["predebit_ledger_id"]))
    queued = await _recovery_state(
        user_id=auth_user.id,
        job_id=job_id,
        ledger_id=ledger_id,
    )
    assert queued["status"] == "queued"
    assert queued["cost"] == 0
    assert queued["claim_token"] is None
    assert queued["claim_attempts"] == 0
    assert queued["lease"] > datetime.now(timezone.utc)
    assert queued["result_count"] == 0
    assert queued["trial_count"] == 0
    assert queued["ledger_exists"] is True
    assert queued["ledger_delta"] == -EXTRACTION_PREDEBIT_CREDITS
    assert queued["ledger_reconciled"] is False
    assert queued["balance"] == balance_before - EXTRACTION_PREDEBIT_CREDITS

    # A fresh queued job is younger than both the 45-minute lease and Redis's
    # 40-minute visibility timeout, so recovery must not race its first claim.
    from app.workers import extraction_worker

    assert (
        await asyncio.to_thread(extraction_worker.requeue_stale_running_extractions)
        == 0
    )
    assert (
        await _recovery_state(
            user_id=auth_user.id,
            job_id=job_id,
            ledger_id=ledger_id,
        )
        == queued
    )

    assert await _exhaust_lost_recovery_dispatches(
        job_id,
        first_lease_is_null=True,
    ) == (1, 1, 0)
    failed = await _recovery_state(
        user_id=auth_user.id,
        job_id=job_id,
        ledger_id=ledger_id,
    )
    assert failed == {
        "status": "failed",
        "cost": 0,
        "error_code": "EXTRACTION_RECOVERY_EXHAUSTED",
        "claim_token": None,
        "claim_attempts": 2,
        "lease": None,
        "result_count": 0,
        "trial_count": 0,
        "ledger_exists": False,
        "ledger_delta": None,
        "ledger_reconciled": False,
        "balance": balance_before,
    }


async def _job_metadata(job_id: uuid.UUID) -> dict[str, Any]:
    from app.models.database import AsyncSessionLocal
    from app.models.tables import DocumentJob

    async with AsyncSessionLocal() as db:
        job = await db.get(DocumentJob, job_id)
        assert job is not None
        return job.metadata_json or {}


async def test_question_template_accepted_message_loss_refunds_exactly(
    auth_user: Any,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.api import question_templates as templates_api
    from app.models.database import AsyncSessionLocal
    from app.models.tables import Document, QuestionTemplate, User
    from app.services.question_template_service import estimated_template_cost
    from app.workers.question_template_worker import run_batch_template_job

    await _grant_credits(auth_user.id, 100)
    monkeypatch.setattr(
        templates_api, "_enqueue_batch_template_job", lambda *_args: None
    )
    monkeypatch.setattr(run_batch_template_job, "delay", lambda *_args: None)

    async with AsyncSessionLocal() as db:
        user = await db.get(User, auth_user.id)
        assert user is not None
        balance_before = user.credits_balance
        document = Document(
            filename="template-loss.pdf",
            file_size=100,
            storage_key=f"documents/{uuid.uuid4()}/template-loss.pdf",
            status="ready",
            user_id=user.id,
        )
        template = QuestionTemplate(
            user_id=user.id,
            name="Loss recovery questions",
            questions=["What is the term?", "What is the amount?"],
        )
        db.add_all([document, template])
        await db.commit()
        await db.refresh(document)
        await db.refresh(template)

        job = await templates_api._create_run(
            user=user,
            db=db,
            template=template,
            document_ids=[document.id],
            locale="en",
            document_id=document.id,
        )
        job_id = job.id
        ledger_id = uuid.UUID(str(job.metadata_json["predebit_ledger_id"]))

    predebit = estimated_template_cost(2, 1)
    queued = await _recovery_state(
        user_id=auth_user.id,
        job_id=job_id,
        ledger_id=ledger_id,
    )
    assert queued["status"] == "queued"
    assert queued["cost"] == 0
    assert queued["claim_token"] is None
    assert queued["claim_attempts"] == 0
    assert queued["lease"] > datetime.now(timezone.utc)
    assert queued["result_count"] == 0
    assert queued["trial_count"] == 0
    assert queued["ledger_exists"] is True
    assert queued["ledger_delta"] == -predebit
    assert queued["ledger_reconciled"] is False
    assert queued["balance"] == balance_before - predebit

    assert await _exhaust_lost_recovery_dispatches(job_id) == (1, 1, 0)
    failed = await _recovery_state(
        user_id=auth_user.id,
        job_id=job_id,
        ledger_id=ledger_id,
    )
    assert failed == {
        "status": "failed",
        "cost": 0,
        "error_code": "BATCH_TEMPLATE_RECOVERY_EXHAUSTED",
        "claim_token": None,
        "claim_attempts": 2,
        "lease": None,
        "result_count": 0,
        "trial_count": 0,
        "ledger_exists": False,
        "ledger_delta": None,
        "ledger_reconciled": False,
        "balance": balance_before,
    }
