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


async def test_failed_committed_extraction_does_not_release_reservation() -> None:
    from app.models.database import AsyncSessionLocal
    from app.models.tables import ChatSession, DocumentJob

    user_id, doc_id, [session_id], [job_id] = await _seed_user_document(sessions=1, jobs=1)
    try:
        await _claim_job(user_id, job_id)
        async with AsyncSessionLocal() as db:
            job = await db.get(DocumentJob, job_id)
            job.status = "failed"
            job.error_code = "EXTRACTION_FAILED"
            replacement = ChatSession(document_id=doc_id, user_id=user_id)
            db.add(replacement)
            await db.commit()
            replacement_id = replacement.id

        with pytest.raises(HTTPException):
            await _claim_session(user_id, replacement_id)
        assert await _usage_count(user_id) == 1
    finally:
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
