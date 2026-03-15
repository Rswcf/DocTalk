from __future__ import annotations

import uuid
from types import SimpleNamespace

import pytest

import app.services.doc_service as doc_service_module
import app.services.embedding_service as embedding_service_module
from app.workers import deletion_worker


@pytest.mark.asyncio
async def test_delete_document_queues_retry_for_converted_pdf_cleanup(monkeypatch) -> None:
    document_id = uuid.uuid4()
    captured: dict[str, object] = {}
    document = SimpleNamespace(
        id=document_id,
        storage_key="documents/original.pdf",
        converted_storage_key="documents/converted.pdf",
        user_id=uuid.uuid4(),
    )
    db = SimpleNamespace(
        execute=lambda *_args, **_kwargs: SimpleNamespace(scalar_one_or_none=lambda: document),
        delete=lambda _doc: None,
        commit=lambda: None,
    )

    async def fake_execute(*_args, **_kwargs):
        return SimpleNamespace(scalar_one_or_none=lambda: document)

    async def fake_delete(_doc):
        return None

    async def fake_commit():
        return None

    def fake_delete_file(storage_key: str) -> None:
        if storage_key.endswith("converted.pdf"):
            raise RuntimeError("converted cleanup failed")

    def fake_delay(doc_id: str, **kwargs) -> None:
        captured["doc_id"] = doc_id
        captured["kwargs"] = kwargs

    monkeypatch.setattr(doc_service_module.storage_service, "delete_file", fake_delete_file)
    monkeypatch.setattr(
        embedding_service_module.embedding_service,
        "get_qdrant_client",
        lambda: SimpleNamespace(delete=lambda **_kwargs: None),
    )
    monkeypatch.setattr(deletion_worker.retry_failed_deletion, "delay", fake_delay)

    db.execute = fake_execute
    db.delete = fake_delete
    db.commit = fake_commit

    deleted = await doc_service_module.doc_service.delete_document(document_id, db)

    assert deleted is True
    assert captured["doc_id"] == str(document_id)
    assert captured["kwargs"] == {
        "original_storage_key": None,
        "converted_storage_key": "documents/converted.pdf",
        "cleanup_qdrant": False,
    }


def test_retry_failed_deletion_retries_both_storage_keys(monkeypatch) -> None:
    deleted_keys: list[str] = []

    monkeypatch.setattr(
        "app.services.storage_service.storage_service.delete_file",
        lambda storage_key: deleted_keys.append(storage_key),
    )

    deletion_worker.retry_failed_deletion.run(
        "doc-123",
        original_storage_key="documents/original.pdf",
        converted_storage_key="documents/converted.pdf",
        cleanup_qdrant=False,
    )

    assert deleted_keys == [
        "documents/original.pdf",
        "documents/converted.pdf",
    ]
