"""Real-Postgres proofs for predebit-safe parent deletion.

Requires docker. ``SKIP_INTEGRATION=1`` (the default) skips this file.
"""

from __future__ import annotations

import asyncio
import threading
import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from typing import Any

import pytest
import sqlalchemy as sa
from sqlalchemy import func, select

pytestmark = [pytest.mark.integration, pytest.mark.asyncio(loop_scope="session")]


async def _seed_active_predebit(
    *,
    parent: str,
    claim_trial: bool = False,
) -> dict[str, Any]:
    from app.models.database import AsyncSessionLocal
    from app.models.tables import Collection, Document, FeatureTrialUsage, User
    from app.services.predebited_job_service import create_predebited_document_job

    async with AsyncSessionLocal() as db:
        user = User(
            email=f"delete-predebit-{uuid.uuid4()}@example.com",
            plan="free",
            credits_balance=10_000,
        )
        db.add(user)
        await db.flush()

        document = None
        collection = None
        if parent == "document":
            document = Document(
                filename="active-job.pdf",
                file_size=100,
                storage_key=f"documents/{uuid.uuid4()}/active-job.pdf",
                status="ready",
                user_id=user.id,
                file_type="pdf",
            )
            db.add(document)
            await db.flush()
            job_type = "extraction"
            reason = "extraction"
            predebit = 25
        elif parent == "collection":
            collection = Collection(
                name="Active job collection",
                user_id=user.id,
            )
            db.add(collection)
            await db.flush()
            job_type = "document_diff"
            reason = "document_diff"
            predebit = 60
        else:  # pragma: no cover - helper contract
            raise ValueError(parent)

        job, ledger_id = await create_predebited_document_job(
            db,
            user_id=user.id,
            document_id=document.id if document else None,
            collection_id=collection.id if collection else None,
            job_type=job_type,
            input_scope={},
            predebit=predebit,
            reason=reason,
        )
        assert ledger_id is not None
        if claim_trial:
            db.add(
                FeatureTrialUsage(
                    user_id=user.id,
                    feature="domain_mode",
                    slot_index=0,
                    owning_job_id=job.id,
                )
            )
        await db.commit()
        return {
            "user_id": user.id,
            "document_id": document.id if document else None,
            "collection_id": collection.id if collection else None,
            "job_id": job.id,
            "ledger_id": ledger_id,
            "predebit": predebit,
            "balance_before": 10_000,
        }


async def _state(seed: dict[str, Any]) -> dict[str, Any]:
    from app.models.database import AsyncSessionLocal
    from app.models.tables import (
        Collection,
        CreditLedger,
        Document,
        DocumentJob,
        FeatureTrialUsage,
        User,
    )

    async with AsyncSessionLocal() as db:
        trial_count = await db.scalar(
            select(func.count())
            .select_from(FeatureTrialUsage)
            .where(FeatureTrialUsage.user_id == seed["user_id"])
        )
        orphan_trial_count = await db.scalar(
            select(func.count())
            .select_from(FeatureTrialUsage)
            .where(
                FeatureTrialUsage.user_id == seed["user_id"],
                FeatureTrialUsage.owning_session_id.is_(None),
                FeatureTrialUsage.owning_job_id.is_(None),
            )
        )
        return {
            "balance": await db.scalar(
                select(User.credits_balance).where(User.id == seed["user_id"])
            ),
            "document_exists": (
                await db.get(Document, seed["document_id"])
                if seed["document_id"]
                else None
            )
            is not None,
            "collection_exists": (
                await db.get(Collection, seed["collection_id"])
                if seed["collection_id"]
                else None
            )
            is not None,
            "job_exists": await db.get(DocumentJob, seed["job_id"]) is not None,
            "ledger_exists": await db.get(CreditLedger, seed["ledger_id"]) is not None,
            "trial_count": int(trial_count or 0),
            "orphan_trial_count": int(orphan_trial_count or 0),
        }


async def _cleanup_user(user_id: uuid.UUID) -> None:
    from app.models.database import AsyncSessionLocal
    from app.models.tables import Document, User

    async with AsyncSessionLocal() as db:
        await db.execute(sa.delete(Document).where(Document.user_id == user_id))
        await db.execute(sa.delete(User).where(User.id == user_id))
        await db.commit()


def _disable_external_document_cleanup(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.services import doc_service
    from app.services.embedding_service import embedding_service

    monkeypatch.setattr(doc_service.storage_service, "delete_file", lambda *_args: None)
    monkeypatch.setattr(
        embedding_service,
        "get_qdrant_client",
        lambda: SimpleNamespace(delete=lambda **_kwargs: None),
    )


async def _delete_document(document_id: uuid.UUID) -> None:
    from app.models.database import AsyncSessionLocal
    from app.services.doc_service import doc_service

    async with AsyncSessionLocal() as db:
        assert await doc_service.delete_document(document_id, db) is True


async def test_delete_document_with_active_job_refunds_and_releases_trial(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    seed = await _seed_active_predebit(parent="document", claim_trial=True)
    _disable_external_document_cleanup(monkeypatch)
    try:
        before = await _state(seed)
        assert before["balance"] == seed["balance_before"] - seed["predebit"]
        assert before["job_exists"] is True
        assert before["ledger_exists"] is True
        assert before["trial_count"] == 1

        await _delete_document(seed["document_id"])

        after = await _state(seed)
        assert after == {
            "balance": seed["balance_before"],
            "document_exists": False,
            "collection_exists": False,
            "job_exists": False,
            "ledger_exists": False,
            "trial_count": 0,
            "orphan_trial_count": 0,
        }
    finally:
        await _cleanup_user(seed["user_id"])


async def test_delete_and_error_reparse_do_not_form_cross_session_lock_cycle(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from fastapi import HTTPException

    from app.api.documents import reparse_document
    from app.models.database import AsyncSessionLocal
    from app.models.tables import Document
    from app.services import extraction_service

    seed = await _seed_active_predebit(parent="document")
    _disable_external_document_cleanup(monkeypatch)
    monkeypatch.setattr(
        "app.workers.parse_worker.parse_document.delay",
        lambda *_args, **_kwargs: None,
    )

    async with AsyncSessionLocal() as db:
        await db.execute(
            sa.update(Document)
            .where(Document.id == seed["document_id"])
            .values(status="error")
        )
        await db.commit()

    resolver_entered = threading.Event()
    release_resolver = threading.Event()
    original_resolver = extraction_service._settle_extraction_predebit_after_failure_sync

    def blocked_resolver(**kwargs: Any) -> bool:
        resolver_entered.set()
        if not release_resolver.wait(timeout=5):
            raise AssertionError("test did not release the predebit resolver")
        return original_resolver(**kwargs)

    monkeypatch.setattr(
        extraction_service,
        "_settle_extraction_predebit_after_failure_sync",
        blocked_resolver,
    )

    delete_task: asyncio.Task[None] | None = None
    reparse_task: asyncio.Task[int | dict[str, str]] | None = None
    try:
        delete_task = asyncio.create_task(_delete_document(seed["document_id"]))
        assert await asyncio.to_thread(resolver_entered.wait, 3)

        async with AsyncSessionLocal() as reparse_db:
            await reparse_db.execute(sa.text("SET LOCAL lock_timeout = '2s'"))
            reparse_backend_pid = await reparse_db.scalar(
                sa.text("SELECT pg_backend_pid()")
            )

            async def attempt_reparse() -> int | dict[str, str]:
                try:
                    return await reparse_document(
                        seed["document_id"],
                        None,
                        SimpleNamespace(id=seed["user_id"], plan="free"),
                        reparse_db,
                    )
                except HTTPException as exc:
                    return exc.status_code

            reparse_task = asyncio.create_task(attempt_reparse())

            # Wait until PostgreSQL confirms reparse is blocked on the parent
            # row. Under the old user-first order it reached this same wait
            # while holding users; under the new order it holds no user lock.
            async with AsyncSessionLocal() as observer_db:
                for _ in range(200):
                    wait_event_type = await observer_db.scalar(
                        sa.text(
                            "SELECT wait_event_type FROM pg_stat_activity "
                            "WHERE pid = :pid"
                        ),
                        {"pid": reparse_backend_pid},
                    )
                    if wait_event_type == "Lock":
                        break
                    assert not reparse_task.done(), (
                        "reparse completed before waiting on the locked document"
                    )
                    await asyncio.sleep(0.01)
                else:
                    pytest.fail("reparse never waited on the locked document")

            release_resolver.set()
            delete_result, reparse_result = await asyncio.wait_for(
                asyncio.gather(delete_task, reparse_task),
                timeout=5,
            )

        assert delete_result is None
        # Deletion commits first, so the reparse's locked SELECT re-evaluates
        # to no row and preserves the endpoint's existing 404 contract.
        assert reparse_result == 404
        after = await _state(seed)
        assert after["balance"] == seed["balance_before"]
        assert after["document_exists"] is False
        assert after["job_exists"] is False
        assert after["ledger_exists"] is False
    finally:
        release_resolver.set()
        for task in (delete_task, reparse_task):
            if task is not None and not task.done():
                task.cancel()
        await _cleanup_user(seed["user_id"])


async def test_delete_collection_with_active_job_refunds_before_cascade() -> None:
    from app.api.collections import delete_collection
    from app.models.database import AsyncSessionLocal

    seed = await _seed_active_predebit(parent="collection")
    try:
        async with AsyncSessionLocal() as db:
            await delete_collection(
                collection_id=seed["collection_id"],
                user=SimpleNamespace(id=seed["user_id"]),
                db=db,
            )

        after = await _state(seed)
        assert after["balance"] == seed["balance_before"]
        assert after["collection_exists"] is False
        assert after["job_exists"] is False
        assert after["ledger_exists"] is False
    finally:
        await _cleanup_user(seed["user_id"])


async def test_worker_claim_between_delete_check_and_cascade_settles_exactly_once(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.models.database import AsyncSessionLocal, async_engine
    from app.models.tables import DocumentJob
    from app.services.extraction_service import (
        _settle_extraction_predebit_after_failure_sync,
    )
    from app.services.predebited_job_service import PREDEBITED_JOB_LOCK_NAMESPACE

    seed = await _seed_active_predebit(parent="document", claim_trial=True)
    _disable_external_document_cleanup(monkeypatch)
    delete_task: asyncio.Task[None] | None = None
    try:
        async with async_engine.connect() as worker_lock:
            await worker_lock.execute(
                sa.text("SELECT pg_advisory_lock(:ns, hashtext(:key))"),
                {"ns": PREDEBITED_JOB_LOCK_NAMESPACE, "key": str(seed["job_id"])},
            )
            delete_task = asyncio.create_task(_delete_document(seed["document_id"]))
            await asyncio.sleep(0.15)
            assert not delete_task.done(), "deletion must wait for the worker's job lock"

            # The worker wins the queued->running claim after deletion's first
            # candidate read, then fails terminally while retaining its lock.
            async with AsyncSessionLocal() as claim_db:
                await claim_db.execute(
                    sa.update(DocumentJob)
                    .where(DocumentJob.id == seed["job_id"])
                    .values(status="running", worker_claim_attempts=1)
                )
                await claim_db.commit()
            won_refund = await asyncio.to_thread(
                _settle_extraction_predebit_after_failure_sync,
                job_id=seed["job_id"],
                error_code="EXTRACTION_FAILED",
                error_message="Worker failed during deletion race",
                release_trial=True,
            )
            assert won_refund is True
            await worker_lock.execute(
                sa.text("SELECT pg_advisory_unlock(:ns, hashtext(:key))"),
                {"ns": PREDEBITED_JOB_LOCK_NAMESPACE, "key": str(seed["job_id"])},
            )

        await asyncio.wait_for(delete_task, timeout=5)
        after = await _state(seed)
        assert after["balance"] == seed["balance_before"]
        assert after["document_exists"] is False
        assert after["job_exists"] is False
        assert after["ledger_exists"] is False
        assert after["trial_count"] == 0
    finally:
        if delete_task is not None and not delete_task.done():
            delete_task.cancel()
        await _cleanup_user(seed["user_id"])


async def test_orphaned_job_ledger_refund_releases_null_owner_trial() -> None:
    from app.models.database import AsyncSessionLocal
    from app.models.tables import Document, FeatureTrialUsage
    from app.workers.extraction_worker import _recover_orphaned_predebits

    seed = await _seed_active_predebit(parent="document", claim_trial=True)
    try:
        # Reproduce the pre-fix CASCADE directly: job/result disappear, ledger
        # remains unreconciled, and the trial owner FK becomes NULL.
        async with AsyncSessionLocal() as db:
            await db.execute(
                sa.delete(Document).where(Document.id == seed["document_id"])
            )
            # A different historical NULL-owner row must remain consumed. The
            # lost job pointer is correlated safely through the job trial and
            # ledger rows' shared transaction-scoped created_at timestamp.
            db.add(
                FeatureTrialUsage(
                    user_id=seed["user_id"],
                    feature="domain_mode",
                    slot_index=1,
                    created_at=datetime.now(timezone.utc) - timedelta(days=1),
                )
            )
            await db.commit()

        orphaned = await _state(seed)
        assert orphaned["job_exists"] is False
        assert orphaned["ledger_exists"] is True
        assert orphaned["trial_count"] == 2
        assert orphaned["orphan_trial_count"] == 2
        assert orphaned["balance"] == seed["balance_before"] - seed["predebit"]

        assert await asyncio.to_thread(_recover_orphaned_predebits) == 1

        healed = await _state(seed)
        assert healed["ledger_exists"] is False
        assert healed["trial_count"] == 1
        assert healed["orphan_trial_count"] == 1
        assert healed["balance"] == seed["balance_before"]
    finally:
        await _cleanup_user(seed["user_id"])
