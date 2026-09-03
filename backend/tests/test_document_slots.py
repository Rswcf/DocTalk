from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest
from fastapi import HTTPException
from sqlalchemy.dialects import postgresql

from app.api import documents as documents_api
from app.core.config import settings
from app.services import doc_service as doc_service_module
from app.services.document_limits import count_plan_slot_documents


@pytest.mark.asyncio
async def test_errored_document_is_excluded_from_live_slot_count() -> None:
    db = SimpleNamespace(scalar=AsyncMock(side_effect=[2, 1]))
    user_id = uuid.uuid4()

    slot_count, errored_count = await count_plan_slot_documents(db, user_id)

    assert (slot_count, errored_count) == (2, 1)
    live_sql = str(
        db.scalar.await_args_list[0].args[0].compile(
            dialect=postgresql.dialect(),
            compile_kwargs={"literal_binds": True},
        )
    )
    error_sql = str(
        db.scalar.await_args_list[1].args[0].compile(
            dialect=postgresql.dialect(),
            compile_kwargs={"literal_binds": True},
        )
    )
    assert "documents.status NOT IN ('deleting', 'error')" in live_sql
    assert "documents.status = 'error'" in error_sql


@pytest.mark.asyncio
async def test_reparse_refuses_error_when_live_slots_are_full_and_preserves_status() -> None:
    # The auth dependency loaded Plus before a concurrent downgrade committed.
    # Capacity must use the Free plan read while acquiring the user-row lock.
    user = SimpleNamespace(id=uuid.uuid4(), plan="plus")
    doc = SimpleNamespace(id=uuid.uuid4(), user_id=user.id, status="error")
    db = SimpleNamespace(
        get=AsyncMock(return_value=doc),
        scalar=AsyncMock(side_effect=["free", settings.FREE_MAX_DOCUMENTS, 1]),
        refresh=AsyncMock(),
        rollback=AsyncMock(),
        execute=AsyncMock(),
    )

    with pytest.raises(HTTPException) as exc_info:
        await documents_api.reparse_document(doc.id, None, user, db)

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail["error"] == "DOCUMENT_LIMIT_REACHED"
    assert exc_info.value.detail["plan"] == "free"
    assert doc.status == "error"
    db.execute.assert_not_awaited()
    db.rollback.assert_awaited_once()
    lock_sql = str(
        db.scalar.await_args_list[0].args[0].compile(
            dialect=postgresql.dialect(),
            compile_kwargs={"literal_binds": True},
        )
    )
    assert "SELECT users.plan" in lock_sql
    assert "FOR UPDATE" in lock_sql


@pytest.mark.asyncio
async def test_reparse_winner_keeps_conditional_claim_and_dispatch_order(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = SimpleNamespace(id=uuid.uuid4(), plan="free")
    doc = SimpleNamespace(id=uuid.uuid4(), user_id=user.id, status="error")
    db = SimpleNamespace(
        get=AsyncMock(return_value=doc),
        scalar=AsyncMock(side_effect=["free", settings.FREE_MAX_DOCUMENTS - 1, 1]),
        refresh=AsyncMock(),
        rollback=AsyncMock(),
        execute=AsyncMock(return_value=SimpleNamespace(rowcount=1)),
        commit=AsyncMock(),
    )
    dispatched: list[str] = []
    monkeypatch.setattr(
        "app.workers.parse_worker.parse_document.delay",
        lambda document_id, **_kwargs: dispatched.append(document_id),
    )

    result = await documents_api.reparse_document(doc.id, None, user, db)

    assert result == {"status": "reparsing"}
    claim_sql = str(
        db.execute.await_args.args[0].compile(
            dialect=postgresql.dialect(),
            compile_kwargs={"literal_binds": True},
        )
    )
    assert "documents.status IN ('ready', 'error')" in claim_sql
    db.commit.assert_awaited_once()
    assert dispatched == [str(doc.id)]


@pytest.mark.asyncio
async def test_reparse_loser_after_user_lock_returns_processing_409() -> None:
    user = SimpleNamespace(id=uuid.uuid4(), plan="free")
    doc = SimpleNamespace(id=uuid.uuid4(), user_id=user.id, status="error")

    async def refresh(_doc, **_kwargs) -> None:
        doc.status = "parsing"

    db = SimpleNamespace(
        get=AsyncMock(return_value=doc),
        scalar=AsyncMock(return_value="free"),
        refresh=AsyncMock(side_effect=refresh),
        rollback=AsyncMock(),
        execute=AsyncMock(),
    )

    with pytest.raises(HTTPException) as exc_info:
        await documents_api.reparse_document(doc.id, None, user, db)

    assert exc_info.value.status_code == 409
    assert exc_info.value.detail["error"] == "DOCUMENT_PROCESSING"
    db.execute.assert_not_awaited()
    db.rollback.assert_awaited_once()


@pytest.mark.asyncio
async def test_authoritative_upload_reject_deletes_already_stored_object(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user_id = uuid.uuid4()
    stored_keys: list[str] = []
    deleted_keys: list[str] = []
    monkeypatch.setattr(
        doc_service_module.storage_service,
        "upload_file",
        lambda _data, key, _content_type: stored_keys.append(key),
    )
    monkeypatch.setattr(
        doc_service_module.storage_service,
        "delete_file",
        lambda key: deleted_keys.append(key),
    )
    db = SimpleNamespace(
        scalar=AsyncMock(side_effect=["free", settings.FREE_MAX_DOCUMENTS, 0]),
        rollback=AsyncMock(),
        add=Mock(),
        commit=AsyncMock(),
    )
    upload = SimpleNamespace(
        filename="race.pdf",
        content_type="application/pdf",
        read=AsyncMock(return_value=b"%PDF-race"),
    )

    with pytest.raises(HTTPException) as exc_info:
        await doc_service_module.doc_service.create_document(
            upload,
            db,
            user_id=user_id,
            file_type="pdf",
        )

    assert exc_info.value.status_code == 403
    assert stored_keys == deleted_keys
    db.rollback.assert_awaited_once()
    db.add.assert_not_called()
    db.commit.assert_not_awaited()
