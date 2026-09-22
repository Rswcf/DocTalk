"""A shared beyond-document answer must never look like a cited one (design
.collab/reviews/2026-09-22-needs-analysis/07-scope-rule-design-fable.md §2.4, criterion 11).

The answer-share snapshot is digested, and re-sharing an unchanged answer is matched on that digest, so a
grounded snapshot has to stay byte-identical: the scope is present only on a beyond answer.
"""
from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.api import sharing as sharing_api

MESSAGE_ID = uuid.UUID("12345678-90ab-4def-8123-456789abcdef")
ANCHOR = "msg-1234567890ab4def"
TEXT = "The author was a nineteenth-century writer."


def _answer(meta):
    return SimpleNamespace(
        id=MESSAGE_ID, role="assistant", content=TEXT, citations=None, metadata_json=meta,
        created_at=datetime(2026, 9, 22, tzinfo=timezone.utc),
    )


def _session():
    return SimpleNamespace(document=SimpleNamespace(filename="novel.pdf"))


def _grounded_snapshot():
    return {
        "scope": "answer",
        "session_title": "Shared answer",
        "document_name": "novel.pdf",
        "created_at": "2026-09-22T00:00:00+00:00",
        "messages": [{"id": ANCHOR, "role": "assistant", "content": TEXT, "citations": []}],
    }


def test_a_grounded_snapshot_and_its_digest_are_unchanged():
    snapshot, digest = sharing_api._answer_snapshot(_session(), _answer({}))

    assert snapshot == _grounded_snapshot()
    expected = hashlib.sha256(json.dumps(_grounded_snapshot(), sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    assert digest == expected


def test_a_beyond_snapshot_carries_its_scope_through_the_read_validation():
    snapshot, digest = sharing_api._answer_snapshot(_session(), _answer({"answer_scope": "beyond_document"}))

    assert snapshot["messages"][0]["answer_scope"] == "beyond_document"
    assert snapshot["messages"][0]["citations"] == []
    assert digest != sharing_api._answer_snapshot(_session(), _answer({}))[1]
    read_back = sharing_api.AnswerSnapshot.model_validate(snapshot).model_dump()
    assert read_back["messages"][0]["answer_scope"] == "beyond_document"


def test_a_snapshot_stored_before_the_field_reads_back_without_it():
    read_back = sharing_api.AnswerSnapshot.model_validate(_grounded_snapshot()).model_dump()

    assert "answer_scope" not in read_back["messages"][0]


def test_a_snapshot_cannot_claim_any_other_scope():
    tampered = _grounded_snapshot()
    tampered["messages"][0]["answer_scope"] = "document"

    with pytest.raises(Exception):
        sharing_api.AnswerSnapshot.model_validate(tampered)


class _Result:
    def __init__(self, *, scalar_one_or_none=None, scalars_all=None, first=None):
        self._scalar_one_or_none = scalar_one_or_none
        self._scalars_all = scalars_all or []
        self._first = first

    def scalar_one_or_none(self):
        return self._scalar_one_or_none

    def scalars(self):
        return iter(self._scalars_all)

    def first(self):
        return self._first


@pytest.mark.asyncio
async def test_a_shared_conversation_marks_beyond_turns_and_only_those(monkeypatch):
    from fastapi import FastAPI
    from httpx import ASGITransport, AsyncClient

    from app.core import deps as deps_module

    api_app = FastAPI()
    api_app.include_router(sharing_api.router)
    session_id = uuid.uuid4()
    now = datetime.now(timezone.utc)
    share = SimpleNamespace(session_id=session_id, expires_at=None)
    session = SimpleNamespace(id=session_id, title="Novel questions", document_id=uuid.uuid4(), created_at=now)
    rows = [
        SimpleNamespace(id=uuid.uuid4(), role="user", content="Who wrote this?", citations=None, metadata_json=None),
        SimpleNamespace(id=uuid.uuid4(), role="assistant", content="The document does not say.", citations=None,
                        metadata_json={}),
        SimpleNamespace(id=uuid.uuid4(), role="user", content="Who wrote this?", citations=None,
                        metadata_json={"answer_scope": "beyond_document"}),
        SimpleNamespace(id=uuid.uuid4(), role="assistant", content=TEXT, citations=None,
                        metadata_json={"answer_scope": "beyond_document", "truncated": True}),
    ]
    execute = AsyncMock(side_effect=[
        _Result(scalar_one_or_none=share),
        _Result(scalar_one_or_none=session),
        _Result(scalars_all=rows),
        _Result(first=("novel.pdf",)),
    ])
    db = SimpleNamespace(execute=execute, scalar=AsyncMock(return_value=None))

    async def _get_db():
        yield db

    api_app.dependency_overrides[deps_module.get_db_session] = _get_db
    monkeypatch.setattr(sharing_api.shared_view_limiter, "is_allowed", AsyncMock(return_value=True))

    async with AsyncClient(transport=ASGITransport(app=api_app), base_url="http://test") as client:
        response = await client.get(f"/api/shared/{uuid.uuid4()}")

    assert response.status_code == 200
    scopes = [m.get("answer_scope") for m in response.json()["messages"]]
    assert scopes == [None, None, "beyond_document", "beyond_document"]
    assert "truncated" not in response.text, "no other metadata reaches the public page"
