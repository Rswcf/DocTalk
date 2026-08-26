"""Real-Postgres coverage for extraction's durable settlement marker.

Requires docker. ``SKIP_INTEGRATION=1`` (the default) skips this file.
"""
from __future__ import annotations

import asyncio
import uuid

import pytest
from sqlalchemy import select

pytestmark = [pytest.mark.integration, pytest.mark.asyncio(loop_scope="session")]


async def _grant_credits(user_id: uuid.UUID, amount: int) -> None:
    from app.models.database import AsyncSessionLocal
    from app.services import credit_service

    async with AsyncSessionLocal() as db:
        await credit_service.credit_credits(db, user_id, amount, reason="test_grant")
        await db.commit()


async def test_commit_landed_acknowledgement_lost_keeps_extraction_succeeded(
    auth_user,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The success COMMIT lands, then its acknowledgement is lost.

    The worker's fresh-session resolver must observe ``reconciled_at`` and
    leave the result, usage, job, trial claim, ledger, and exact charged
    balance untouched. In particular it must not restore the 25-credit
    predebit on top of the already-reconciled balance.
    """
    from app.models import sync_database
    from app.models.database import AsyncSessionLocal
    from app.models.tables import (
        Chunk,
        CreditLedger,
        Document,
        DocumentJob,
        ExtractionResult,
        FeatureTrialUsage,
        UsageRecord,
        User,
    )
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
                "key_points": [
                    {"text": "Supported finding", "source_refs": [1]}
                ],
                "risks_or_open_questions": [],
            },
            100,
            20,
        ),
    )
    monkeypatch.setattr(extraction_service, "calculate_cost", lambda *_args, **_kwargs: 9)

    real_session_factory = sync_database.SyncSessionLocal
    opened_sessions = 0

    def session_factory():
        nonlocal opened_sessions
        opened_sessions += 1
        session = real_session_factory()
        if opened_sessions == 1:
            real_commit = session.commit
            commit_count = 0

            def commit_with_lost_acknowledgement() -> None:
                nonlocal commit_count
                commit_count += 1
                real_commit()
                if commit_count == 2:
                    raise ConnectionError("commit acknowledgement lost")

            session.commit = commit_with_lost_acknowledgement  # type: ignore[method-assign]
        return session

    monkeypatch.setattr(sync_database, "SyncSessionLocal", session_factory)

    await asyncio.to_thread(extraction_service.run_extraction_job_sync, str(job_id))

    async with AsyncSessionLocal() as db:
        persisted_job = await db.get(DocumentJob, job_id)
        result = await db.scalar(
            select(ExtractionResult).where(ExtractionResult.job_id == job_id)
        )
        ledger = await db.get(CreditLedger, ledger_id)
        usage_rows = list(
            (
                await db.scalars(
                    select(UsageRecord).where(
                        UsageRecord.user_id == auth_user.id,
                        UsageRecord.model == extraction_service.EXTRACTION_MODEL,
                        UsageRecord.prompt_tokens == 100,
                        UsageRecord.completion_tokens == 20,
                        UsageRecord.cost_credits == 9,
                    )
                )
            ).all()
        )
        trial = await db.scalar(
            select(FeatureTrialUsage).where(
                FeatureTrialUsage.owning_job_id == job_id
            )
        )
        balance_after = await db.scalar(
            select(User.credits_balance).where(User.id == auth_user.id)
        )

    assert opened_sessions == 2  # worker session + fresh settlement resolver
    assert persisted_job is not None
    assert persisted_job.status == "succeeded"
    assert persisted_job.cost_credits == 9
    assert result is not None
    assert result.rendered_markdown
    assert len(usage_rows) == 1
    assert ledger is not None
    assert ledger.delta == -9
    assert ledger.reconciled_at is not None
    assert trial is not None
    assert balance_after == balance_before - 9
