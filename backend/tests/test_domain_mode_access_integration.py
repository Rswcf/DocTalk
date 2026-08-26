"""Real-Postgres proofs for durable, atomic Domain Mode trial ownership."""
from __future__ import annotations

import asyncio
import uuid

import pytest
from fastapi import HTTPException
from sqlalchemy import delete as sa_delete
from sqlalchemy import func, select

pytestmark = [pytest.mark.integration, pytest.mark.asyncio(loop_scope="session")]


async def _seed_user_document(*, sessions: int = 0, jobs: int = 0):
    from app.models.database import AsyncSessionLocal
    from app.models.tables import ChatSession, Document, DocumentJob, User

    async with AsyncSessionLocal() as db:
        user = User(
            email=f"domain-trial-{uuid.uuid4()}@example.com",
            plan="free",
            credits_balance=500,
        )
        db.add(user)
        await db.flush()
        doc = Document(
            filename="trial.pdf",
            file_size=100,
            storage_key=f"documents/{uuid.uuid4()}/trial.pdf",
            status="ready",
            user_id=user.id,
            file_type="pdf",
        )
        db.add(doc)
        await db.flush()
        session_rows = [ChatSession(document_id=doc.id, user_id=user.id) for _ in range(sessions)]
        job_rows = [
            DocumentJob(
                id=uuid.uuid4(),
                user_id=user.id,
                document_id=doc.id,
                job_type="extraction",
                status="queued",
            )
            for _ in range(jobs)
        ]
        db.add_all([*session_rows, *job_rows])
        await db.commit()
        return user.id, doc.id, [row.id for row in session_rows], [row.id for row in job_rows]


async def _cleanup_user(user_id: uuid.UUID) -> None:
    from app.models.database import AsyncSessionLocal
    from app.models.tables import Document, User

    async with AsyncSessionLocal() as db:
        await db.execute(sa_delete(Document).where(Document.user_id == user_id))
        await db.execute(sa_delete(User).where(User.id == user_id))
        await db.commit()


async def _claim_session(user_id: uuid.UUID, session_id: uuid.UUID) -> None:
    from app.models.database import AsyncSessionLocal
    from app.models.tables import User
    from app.services.domain_mode_access import enforce_domain_mode_access

    async with AsyncSessionLocal() as db:
        user = await db.get(User, user_id)
        await enforce_domain_mode_access(
            db,
            user,
            "legal",
            owning_session_id=session_id,
            commit_claim=True,
        )


async def _claim_job(user_id: uuid.UUID, job_id: uuid.UUID) -> None:
    from app.models.database import AsyncSessionLocal
    from app.models.tables import User
    from app.services.domain_mode_access import enforce_domain_mode_access

    async with AsyncSessionLocal() as db:
        user = await db.get(User, user_id)
        await enforce_domain_mode_access(
            db,
            user,
            "academic",
            owning_job_id=job_id,
            commit_claim=True,
        )


async def _usage_count(user_id: uuid.UUID) -> int:
    from app.models.database import AsyncSessionLocal
    from app.models.tables import FeatureTrialUsage

    async with AsyncSessionLocal() as db:
        count = await db.scalar(
            select(func.count()).select_from(FeatureTrialUsage).where(
                FeatureTrialUsage.user_id == user_id,
                FeatureTrialUsage.feature == "domain_mode",
            )
        )
        return int(count or 0)


async def _mark_failed_and_release(user_id: uuid.UUID, job_id: uuid.UUID) -> bool:
    from app.models.database import AsyncSessionLocal
    from app.models.tables import DocumentJob
    from app.services.domain_mode_access import release_failed_extraction_trial

    async with AsyncSessionLocal() as db:
        job = await db.get(DocumentJob, job_id)
        job.status = "failed"
        job.error_code = "EXTRACTION_FAILED"
        released = await release_failed_extraction_trial(
            db,
            user_id=user_id,
            owning_job_id=job_id,
        )
        await db.commit()
        return released


async def test_concurrent_fresh_sessions_can_claim_only_one_slot() -> None:
    user_id, _doc_id, session_ids, _job_ids = await _seed_user_document(sessions=2)
    try:
        results = await asyncio.gather(
            *(_claim_session(user_id, session_id) for session_id in session_ids),
            return_exceptions=True,
        )

        assert sum(result is None for result in results) == 1
        denials = [result for result in results if isinstance(result, HTTPException)]
        assert len(denials) == 1
        assert denials[0].status_code == 403
        assert await _usage_count(user_id) == 1
    finally:
        await _cleanup_user(user_id)


async def test_clear_mode_then_retry_and_multi_message_keep_session_ownership() -> None:
    from app.models.database import AsyncSessionLocal
    from app.models.tables import ChatSession

    user_id, _doc_id, [session_id], _job_ids = await _seed_user_document(sessions=1)
    try:
        await _claim_session(user_id, session_id)
        async with AsyncSessionLocal() as db:
            session = await db.get(ChatSession, session_id)
            session.domain_mode = "legal"
            await db.commit()
            session.domain_mode = None
            await db.commit()

        await _claim_session(user_id, session_id)
        await _claim_session(user_id, session_id)
        assert await _usage_count(user_id) == 1
    finally:
        await _cleanup_user(user_id)


async def test_delete_session_then_retry_does_not_restore_slot() -> None:
    from app.models.database import AsyncSessionLocal
    from app.models.tables import ChatSession, FeatureTrialUsage

    user_id, doc_id, [session_id], _job_ids = await _seed_user_document(sessions=1)
    try:
        await _claim_session(user_id, session_id)
        async with AsyncSessionLocal() as db:
            await db.execute(sa_delete(ChatSession).where(ChatSession.id == session_id))
            replacement = ChatSession(document_id=doc_id, user_id=user_id)
            db.add(replacement)
            await db.commit()
            usage = await db.scalar(
                select(FeatureTrialUsage).where(FeatureTrialUsage.user_id == user_id)
            )
            assert usage.owning_session_id is None
            replacement_id = replacement.id

        with pytest.raises(HTTPException) as exc_info:
            await _claim_session(user_id, replacement_id)
        assert exc_info.value.status_code == 403
    finally:
        await _cleanup_user(user_id)


async def test_delete_document_then_retry_does_not_restore_chat_or_job_slot(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.core.config import settings
    from app.models.database import AsyncSessionLocal
    from app.models.tables import ChatSession, Document, FeatureTrialUsage

    monkeypatch.setattr(settings, "FREE_DOMAIN_MODE_TRIALS", 2)
    user_id, doc_id, [session_id], [job_id] = await _seed_user_document(sessions=1, jobs=1)
    try:
        await _claim_session(user_id, session_id)
        await _claim_job(user_id, job_id)
        async with AsyncSessionLocal() as db:
            await db.execute(sa_delete(Document).where(Document.id == doc_id))
            replacement_doc = Document(
                filename="replacement.pdf",
                file_size=100,
                storage_key=f"documents/{uuid.uuid4()}/replacement.pdf",
                status="ready",
                user_id=user_id,
                file_type="pdf",
            )
            db.add(replacement_doc)
            await db.flush()
            replacement_session = ChatSession(document_id=replacement_doc.id, user_id=user_id)
            db.add(replacement_session)
            await db.commit()
            usages = list((await db.scalars(
                select(FeatureTrialUsage).where(FeatureTrialUsage.user_id == user_id)
            )).all())
            assert len(usages) == 2
            assert all(usage.owning_session_id is None for usage in usages)
            assert all(usage.owning_job_id is None for usage in usages)
            replacement_id = replacement_session.id

        with pytest.raises(HTTPException):
            await _claim_session(user_id, replacement_id)
    finally:
        await _cleanup_user(user_id)


async def test_chat_and_extraction_share_the_same_allowance() -> None:
    user_id, _doc_id, [session_id], [job_id] = await _seed_user_document(sessions=1, jobs=1)
    try:
        await _claim_session(user_id, session_id)
        with pytest.raises(HTTPException) as exc_info:
            await _claim_job(user_id, job_id)
        assert exc_info.value.status_code == 403
        assert await _usage_count(user_id) == 1
    finally:
        await _cleanup_user(user_id)


async def test_failed_extraction_releases_slot_and_allows_one_retry() -> None:
    from app.models.database import AsyncSessionLocal
    from app.models.tables import ChatSession, FeatureTrialUsage

    user_id, doc_id, [_session_id], [job_id] = await _seed_user_document(sessions=1, jobs=1)
    try:
        await _claim_job(user_id, job_id)
        assert await _mark_failed_and_release(user_id, job_id) is True

        async with AsyncSessionLocal() as db:
            replacement = ChatSession(document_id=doc_id, user_id=user_id)
            db.add(replacement)
            await db.commit()
            replacement_id = replacement.id

        await _claim_session(user_id, replacement_id)
        assert await _usage_count(user_id) == 1
        async with AsyncSessionLocal() as db:
            usage = await db.scalar(
                select(FeatureTrialUsage).where(FeatureTrialUsage.user_id == user_id)
            )
            assert usage.owning_session_id == replacement_id
            assert usage.owning_job_id is None
    finally:
        await _cleanup_user(user_id)


async def test_succeeded_extraction_never_releases_slot() -> None:
    from app.models.database import AsyncSessionLocal
    from app.models.tables import DocumentJob
    from app.services.domain_mode_access import release_failed_extraction_trial

    user_id, _doc_id, [session_id], [job_id] = await _seed_user_document(sessions=1, jobs=1)
    try:
        await _claim_job(user_id, job_id)
        async with AsyncSessionLocal() as db:
            job = await db.get(DocumentJob, job_id)
            job.status = "succeeded"
            released = await release_failed_extraction_trial(
                db,
                user_id=user_id,
                owning_job_id=job_id,
            )
            await db.commit()
        assert released is False

        with pytest.raises(HTTPException):
            await _claim_session(user_id, session_id)
        assert await _usage_count(user_id) == 1
    finally:
        await _cleanup_user(user_id)


async def test_failed_extraction_release_is_idempotent() -> None:
    from app.models.database import AsyncSessionLocal
    from app.models.tables import DocumentJob
    from app.services.domain_mode_access import release_failed_extraction_trial

    user_id, _doc_id, _session_ids, [job_id] = await _seed_user_document(jobs=1)
    try:
        await _claim_job(user_id, job_id)
        async with AsyncSessionLocal() as db:
            job = await db.get(DocumentJob, job_id)
            job.status = "failed"
            first = await release_failed_extraction_trial(
                db,
                user_id=user_id,
                owning_job_id=job_id,
            )
            second = await release_failed_extraction_trial(
                db,
                user_id=user_id,
                owning_job_id=job_id,
            )
            await db.commit()
        assert first is True
        assert second is False
        assert await _usage_count(user_id) == 0
    finally:
        await _cleanup_user(user_id)


async def test_concurrent_release_then_claim_serializes_without_double_claim() -> None:
    from app.models.database import AsyncSessionLocal
    from app.models.tables import DocumentJob, User
    from app.services.domain_mode_access import release_failed_extraction_trial

    user_id, _doc_id, [session_id], [job_id] = await _seed_user_document(sessions=1, jobs=1)
    claim_task: asyncio.Task[None] | None = None
    try:
        await _claim_job(user_id, job_id)
        async with AsyncSessionLocal() as release_db:
            await release_db.scalar(
                select(User.id).where(User.id == user_id).with_for_update()
            )
            job = await release_db.get(DocumentJob, job_id)
            job.status = "failed"
            await release_db.flush()

            claim_task = asyncio.create_task(_claim_session(user_id, session_id))
            with pytest.raises(asyncio.TimeoutError):
                await asyncio.wait_for(asyncio.shield(claim_task), timeout=0.1)

            released = await release_failed_extraction_trial(
                release_db,
                user_id=user_id,
                owning_job_id=job_id,
            )
            await release_db.commit()

        assert released is True
        await claim_task
        assert await _usage_count(user_id) == 1
    finally:
        if claim_task is not None and not claim_task.done():
            claim_task.cancel()
        await _cleanup_user(user_id)


async def test_trial_cap_above_one_allocates_distinct_slots(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.core.config import settings

    monkeypatch.setattr(settings, "FREE_DOMAIN_MODE_TRIALS", 2)
    user_id, _doc_id, session_ids, _job_ids = await _seed_user_document(sessions=3)
    try:
        await _claim_session(user_id, session_ids[0])
        await _claim_session(user_id, session_ids[1])
        await _claim_session(user_id, session_ids[0])
        with pytest.raises(HTTPException):
            await _claim_session(user_id, session_ids[2])
        assert await _usage_count(user_id) == 2
    finally:
        await _cleanup_user(user_id)
