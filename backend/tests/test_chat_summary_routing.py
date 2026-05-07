from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

import app.services.chat_service as chat_service_module
from app.models.tables import ChatSession, Document, Message


class _ScalarOneResult:
    def __init__(self, value):
        self._value = value

    def scalar_one_or_none(self):
        return self._value


class _MessagesResult:
    def __init__(self, messages):
        self._messages = messages

    def scalars(self):
        return SimpleNamespace(all=lambda: self._messages)


class _RowsResult:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


class _FakeChoice:
    def __init__(self, content: str | None = None, finish_reason: str | None = None):
        self.delta = SimpleNamespace(content=content)
        self.finish_reason = finish_reason


class _FakeChunk:
    def __init__(
        self,
        content: str | None = None,
        *,
        finish_reason: str | None = None,
        usage: object | None = None,
    ):
        self.choices = [_FakeChoice(content=content, finish_reason=finish_reason)]
        self.usage = usage


class _FakeStream:
    def __init__(self, chunks):
        self._chunks = chunks

    def __aiter__(self):
        return self._iterate()

    async def _iterate(self):
        for chunk in self._chunks:
            yield chunk


def _make_db(session_obj, doc_obj):
    async def fake_get(model, _id):
        if model is Document:
            return doc_obj
        if model is ChatSession:
            return session_obj
        return None

    def add(obj):
        if isinstance(obj, Message):
            if getattr(obj, "id", None) is None:
                obj.id = uuid.uuid4()
            if obj.role == "assistant" and getattr(obj, "continuation_count", None) is None:
                obj.continuation_count = 0

    return SimpleNamespace(
        execute=AsyncMock(
            side_effect=[
                _ScalarOneResult(session_obj),
                _MessagesResult([SimpleNamespace(role="user", content="请总结这篇文档的要点")]),
            ]
        ),
        get=AsyncMock(side_effect=fake_get),
        add=add,
        commit=AsyncMock(),
        rollback=AsyncMock(),
    )


def _make_collection_db(session_obj, document_ids):
    async def fake_get(model, _id):
        if model is ChatSession:
            return session_obj
        return None

    def add(obj):
        if isinstance(obj, Message):
            if getattr(obj, "id", None) is None:
                obj.id = uuid.uuid4()
            if obj.role == "assistant" and getattr(obj, "continuation_count", None) is None:
                obj.continuation_count = 0

    return SimpleNamespace(
        execute=AsyncMock(
            side_effect=[
                _ScalarOneResult(session_obj),
                _RowsResult([(doc_id,) for doc_id in document_ids]),
                _RowsResult([(doc_id, f"Document {idx}.pdf") for idx, doc_id in enumerate(document_ids)]),
                _MessagesResult([SimpleNamespace(role="user", content="Summarize these documents")]),
            ]
        ),
        get=AsyncMock(side_effect=fake_get),
        add=add,
        commit=AsyncMock(),
        rollback=AsyncMock(),
    )


@pytest.mark.asyncio
async def test_whole_document_summary_uses_brief_context_not_semantic_retrieval(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session_id = uuid.uuid4()
    document_id = uuid.uuid4()
    chunk_id = uuid.uuid4()
    session_obj = SimpleNamespace(
        id=session_id,
        document_id=document_id,
        collection_id=None,
        title=None,
        domain_mode=None,
    )
    doc_obj = SimpleNamespace(demo_slug=None, custom_instructions=None)
    db = _make_db(session_obj, doc_obj)

    summary_context = AsyncMock(
        return_value=[
            {
                "chunk_id": chunk_id,
                "text": "This report explains China's AI accelerator market and company positioning.",
                "page": 1,
                "page_end": 1,
                "bboxes": [{"x": 0.1, "y": 0.1, "w": 0.4, "h": 0.1, "page": 1}],
                "score": 1.0,
                "section_title": "China's AI Accelerators",
                "document_id": document_id,
            }
        ]
    )
    corrective_retrieval = AsyncMock(return_value=None)
    create = AsyncMock(
        return_value=_FakeStream(
            [
                _FakeChunk("这份报告总结了中国 AI 加速器市场的核心竞争格局。[1]"),
                _FakeChunk(
                    None,
                    finish_reason="stop",
                    usage=SimpleNamespace(prompt_tokens=10, completion_tokens=12),
                ),
            ]
        )
    )
    fake_client = SimpleNamespace(
        chat=SimpleNamespace(completions=SimpleNamespace(create=create))
    )

    monkeypatch.setattr(
        chat_service_module.document_brief_service,
        "get_summary_context",
        summary_context,
    )
    monkeypatch.setattr(
        chat_service_module.corrective_retrieval_service,
        "retrieve_single",
        corrective_retrieval,
    )
    monkeypatch.setattr(chat_service_module, "_get_llm_client", lambda _model: fake_client)

    events = [
        event
        async for event in chat_service_module.chat_service.chat_stream(
            session_id=session_id,
            user_message="请总结这篇文档的要点",
            db=db,
            user=None,
            mode="balanced",
        )
    ]

    summary_context.assert_awaited_once_with(db, document_id, max_chunks=18)
    corrective_retrieval.assert_not_awaited()
    assert any(event["event"] == "citation" for event in events)
    assert events[-1]["event"] == "done"


@pytest.mark.asyncio
async def test_collection_summary_uses_collection_brief_context_not_search_multi(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session_id = uuid.uuid4()
    collection_id = uuid.uuid4()
    document_ids = [uuid.uuid4(), uuid.uuid4()]
    chunk_id = uuid.uuid4()
    session_obj = SimpleNamespace(
        id=session_id,
        document_id=None,
        collection_id=collection_id,
        title=None,
        domain_mode=None,
    )
    db = _make_collection_db(session_obj, document_ids)

    collection_summary_context = AsyncMock(
        return_value=[
            {
                "chunk_id": chunk_id,
                "text": "Document one covers contract obligations and renewal terms.",
                "page": 1,
                "page_end": 1,
                "bboxes": [{"x": 0.1, "y": 0.1, "w": 0.4, "h": 0.1, "page": 1}],
                "score": 1.0,
                "section_title": "Summary",
                "document_id": document_ids[0],
            }
        ]
    )
    corrective_retrieval = AsyncMock(return_value=None)
    create = AsyncMock(
        return_value=_FakeStream(
            [
                _FakeChunk("The collection mainly covers obligations and renewals.[1]"),
                _FakeChunk(
                    None,
                    finish_reason="stop",
                    usage=SimpleNamespace(prompt_tokens=10, completion_tokens=12),
                ),
            ]
        )
    )
    fake_client = SimpleNamespace(
        chat=SimpleNamespace(completions=SimpleNamespace(create=create))
    )

    monkeypatch.setattr(
        chat_service_module.document_brief_service,
        "get_collection_summary_context",
        collection_summary_context,
    )
    monkeypatch.setattr(
        chat_service_module.corrective_retrieval_service,
        "retrieve_multi",
        corrective_retrieval,
    )
    monkeypatch.setattr(chat_service_module, "_get_llm_client", lambda _model: fake_client)

    events = [
        event
        async for event in chat_service_module.chat_service.chat_stream(
            session_id=session_id,
            user_message="Summarize these documents",
            db=db,
            user=None,
            mode="balanced",
        )
    ]

    collection_summary_context.assert_awaited_once_with(
        db,
        document_ids,
        max_chunks=24,
        max_docs=8,
    )
    corrective_retrieval.assert_not_awaited()
    assert any(event["event"] == "citation" for event in events)
    assert events[-1]["event"] == "done"
