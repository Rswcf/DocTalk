"""Real-Postgres proof that per-user document-slot claims serialize."""
from __future__ import annotations

import asyncio
import uuid
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from sqlalchemy import delete, select

pytestmark = [pytest.mark.integration, pytest.mark.asyncio(loop_scope="session")]


async def test_two_concurrent_error_reparses_cannot_both_claim_last_slot(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.api.documents import reparse_document
    from app.models.database import AsyncSessionLocal
    from app.models.tables import Document, User

    monkeypatch.setattr(
        "app.workers.parse_worker.parse_document.delay",
        lambda *_args, **_kwargs: None,
    )
    async with AsyncSessionLocal() as db:
        user = User(
            email=f"document-slots-{uuid.uuid4()}@example.com",
            plan="free",
            credits_balance=300,
        )
        db.add(user)
        await db.flush()
        docs = [
            Document(
                filename=f"live-{index}.pdf",
                file_size=100,
                storage_key=f"documents/{uuid.uuid4()}/live-{index}.pdf",
                status="ready",
                user_id=user.id,
                file_type="pdf",
            )
            for index in range(2)
        ]
        error_docs = [
            Document(
                filename=f"error-{index}.pdf",
                file_size=100,
                storage_key=f"documents/{uuid.uuid4()}/error-{index}.pdf",
                status="error",
                user_id=user.id,
                file_type="pdf",
            )
            for index in range(2)
        ]
        db.add_all([*docs, *error_docs])
        await db.commit()
        user_id = user.id
        error_ids = [doc.id for doc in error_docs]

    async def claim(document_id: uuid.UUID):
        async with AsyncSessionLocal() as claim_db:
            return await reparse_document(
                document_id,
                None,
                SimpleNamespace(id=user_id, plan="free"),
                claim_db,
            )

    try:
        results = await asyncio.gather(
            *(claim(document_id) for document_id in error_ids),
            return_exceptions=True,
        )
        assert sum(isinstance(result, dict) for result in results) == 1
        denials = [result for result in results if isinstance(result, HTTPException)]
        assert len(denials) == 1
        assert denials[0].status_code == 403
        assert denials[0].detail["error"] == "DOCUMENT_LIMIT_REACHED"

        async with AsyncSessionLocal() as db:
            statuses = list((await db.scalars(
                select(Document.status).where(Document.id.in_(error_ids))
            )).all())
            assert sorted(statuses) == ["error", "parsing"]
    finally:
        async with AsyncSessionLocal() as db:
            await db.execute(delete(Document).where(Document.user_id == user_id))
            await db.execute(delete(User).where(User.id == user_id))
            await db.commit()


async def test_two_concurrent_reparses_of_same_document_claim_once_and_loser_409(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.api.documents import reparse_document
    from app.models.database import AsyncSessionLocal
    from app.models.tables import Document, User

    dispatched: list[str] = []
    monkeypatch.setattr(
        "app.workers.parse_worker.parse_document.delay",
        lambda document_id, **_kwargs: dispatched.append(document_id),
    )
    async with AsyncSessionLocal() as db:
        user = User(
            email=f"same-document-reparse-{uuid.uuid4()}@example.com",
            plan="free",
            credits_balance=300,
        )
        db.add(user)
        await db.flush()
        document = Document(
            filename="same-document.pdf",
            file_size=100,
            storage_key=f"documents/{uuid.uuid4()}/same-document.pdf",
            status="ready",
            user_id=user.id,
            file_type="pdf",
        )
        db.add(document)
        await db.commit()
        user_id = user.id
        document_id = document.id

    async def claim():
        async with AsyncSessionLocal() as claim_db:
            return await reparse_document(
                document_id,
                None,
                SimpleNamespace(id=user_id, plan="free"),
                claim_db,
            )

    try:
        results = await asyncio.gather(claim(), claim(), return_exceptions=True)
        assert sum(result == {"status": "reparsing"} for result in results) == 1
        conflicts = [result for result in results if isinstance(result, HTTPException)]
        assert len(conflicts) == 1
        assert conflicts[0].status_code == 409
        assert conflicts[0].detail == {
            "error": "DOCUMENT_PROCESSING",
            "message": "Document is still processing",
            "status": "parsing",
        }
        assert dispatched == [str(document_id)]
    finally:
        async with AsyncSessionLocal() as db:
            await db.execute(delete(Document).where(Document.user_id == user_id))
            await db.execute(delete(User).where(User.id == user_id))
            await db.commit()
