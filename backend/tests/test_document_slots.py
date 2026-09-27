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


@pytest.fixture
def stored_file_present(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    """No object store in unit tests: report the original as present and
    record which keys were checked."""
    checked: list[str] = []

    def _present(key: str) -> bool:
        checked.append(key)
        return True

    monkeypatch.setattr(documents_api.storage_service, "object_exists", _present)
    return checked


@pytest.mark.asyncio
async def test_reparse_refuses_error_when_live_slots_are_full_and_preserves_status(
    stored_file_present: list[str],
) -> None:
    # The auth dependency loaded Plus before a concurrent downgrade committed.
    # Capacity must use the Free plan read while acquiring the user-row lock.
    user = SimpleNamespace(id=uuid.uuid4(), plan="plus")
    doc = SimpleNamespace(
        id=uuid.uuid4(), user_id=user.id, status="error", storage_key="documents/a.pdf"
    )
    db = SimpleNamespace(
        scalar=AsyncMock(
            side_effect=[doc, "free", settings.FREE_MAX_DOCUMENTS, 1]
        ),
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
    document_lock_sql = str(
        db.scalar.await_args_list[0].args[0].compile(
            dialect=postgresql.dialect(),
            compile_kwargs={"literal_binds": True},
        )
    )
    user_lock_sql = str(
        db.scalar.await_args_list[1].args[0].compile(
            dialect=postgresql.dialect(),
            compile_kwargs={"literal_binds": True},
        )
    )
    assert "FROM documents" in document_lock_sql
    assert "FOR NO KEY UPDATE" in document_lock_sql
    assert "SELECT users.plan" in user_lock_sql
    assert "FOR UPDATE" in user_lock_sql


@pytest.mark.asyncio
async def test_reparse_winner_keeps_conditional_claim_and_dispatch_order(
    monkeypatch: pytest.MonkeyPatch,
    stored_file_present: list[str],
) -> None:
    user = SimpleNamespace(id=uuid.uuid4(), plan="free")
    doc = SimpleNamespace(
        id=uuid.uuid4(), user_id=user.id, status="error", storage_key="documents/a.pdf"
    )
    db = SimpleNamespace(
        scalar=AsyncMock(
            side_effect=[doc, "free", settings.FREE_MAX_DOCUMENTS - 1, 1]
        ),
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
async def test_ready_reparse_skips_user_lock(
    monkeypatch: pytest.MonkeyPatch,
    stored_file_present: list[str],
) -> None:
    user = SimpleNamespace(id=uuid.uuid4(), plan="free")
    doc = SimpleNamespace(
        id=uuid.uuid4(), user_id=user.id, status="ready", storage_key="documents/a.pdf"
    )
    db = SimpleNamespace(
        scalar=AsyncMock(return_value=doc),
        rollback=AsyncMock(),
        execute=AsyncMock(return_value=SimpleNamespace(rowcount=1)),
        commit=AsyncMock(),
    )
    monkeypatch.setattr(
        "app.workers.parse_worker.parse_document.delay",
        lambda *_args, **_kwargs: None,
    )

    result = await documents_api.reparse_document(doc.id, None, user, db)

    assert result == {"status": "reparsing"}
    assert stored_file_present == ["documents/a.pdf"]
    assert db.scalar.await_count == 1
    lock_sql = str(
        db.scalar.await_args.args[0].compile(
            dialect=postgresql.dialect(),
            compile_kwargs={"literal_binds": True},
        )
    )
    assert "FROM documents" in lock_sql
    assert "FOR NO KEY UPDATE" in lock_sql


@pytest.mark.asyncio
async def test_reparse_locked_processing_status_returns_409() -> None:
    user = SimpleNamespace(id=uuid.uuid4(), plan="free")
    doc = SimpleNamespace(id=uuid.uuid4(), user_id=user.id, status="parsing")

    db = SimpleNamespace(
        scalar=AsyncMock(return_value=doc),
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
@pytest.mark.parametrize("locked_status", ["ready", "error"])
async def test_reparse_refuses_missing_original_before_claim(
    monkeypatch: pytest.MonkeyPatch,
    locked_status: str,
) -> None:
    user = SimpleNamespace(id=uuid.uuid4(), plan="free")
    doc = SimpleNamespace(
        id=uuid.uuid4(), user_id=user.id, status=locked_status, storage_key="documents/gone.pdf"
    )
    db = SimpleNamespace(
        scalar=AsyncMock(return_value=doc),
        rollback=AsyncMock(),
        execute=AsyncMock(),
        commit=AsyncMock(),
    )
    monkeypatch.setattr(documents_api.storage_service, "object_exists", lambda _key: False)
    dispatched: list[str] = []
    monkeypatch.setattr(
        "app.workers.parse_worker.parse_document.delay",
        lambda document_id, **_kwargs: dispatched.append(document_id),
    )

    with pytest.raises(HTTPException) as exc_info:
        await documents_api.reparse_document(doc.id, None, user, db)

    assert exc_info.value.status_code == 410
    assert exc_info.value.detail["error"] == "FILE_MISSING"
    assert exc_info.value.detail["variant"] == "original"
    # Only the document lock was taken: no users lock, no slot count, no
    # claim UPDATE, no commit and no dispatch.
    assert db.scalar.await_count == 1
    db.execute.assert_not_awaited()
    db.commit.assert_not_awaited()
    db.rollback.assert_awaited_once()
    assert dispatched == []
    assert doc.status == locked_status


@pytest.mark.asyncio
async def test_reparse_storage_outage_is_503_not_missing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = SimpleNamespace(id=uuid.uuid4(), plan="free")
    doc = SimpleNamespace(
        id=uuid.uuid4(), user_id=user.id, status="ready", storage_key="documents/a.pdf"
    )
    db = SimpleNamespace(
        scalar=AsyncMock(return_value=doc),
        rollback=AsyncMock(),
        execute=AsyncMock(),
        commit=AsyncMock(),
    )

    def _down(_key: str) -> bool:
        raise RuntimeError("storage down")

    monkeypatch.setattr(documents_api.storage_service, "object_exists", _down)

    with pytest.raises(HTTPException) as exc_info:
        await documents_api.reparse_document(doc.id, None, user, db)

    assert exc_info.value.status_code == 503
    assert exc_info.value.detail["error"] == "STORAGE_UNAVAILABLE"
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
