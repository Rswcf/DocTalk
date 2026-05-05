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


def _make_db(session_obj, doc_obj, *, assistant_message=None, execute_side_effect=None):
    async def fake_get(model, _id):
        if model is Document:
            return doc_obj
        if model is ChatSession:
            return session_obj
        if model is Message:
            return assistant_message
        return None

    return SimpleNamespace(
        execute=AsyncMock(side_effect=execute_side_effect or []),
        get=AsyncMock(side_effect=fake_get),
        add=lambda _obj: None,
        commit=AsyncMock(),
        rollback=AsyncMock(),
    )


def test_continuation_prompt_preserves_locale_language() -> None:
    prompt = chat_service_module._continuation_prompt("zh", "已经生成的中文回答")

    assert "Continue in Chinese" in prompt
    assert "Do not switch languages" in prompt


def test_continuation_prompt_infers_existing_response_language() -> None:
    prompt = chat_service_module._continuation_prompt(None, "这是已经生成的中文回答")

    assert "Continue in Chinese" in prompt
    assert "previous assistant response" in prompt


def test_citation_contract_rejects_uncited_answers() -> None:
    contract = chat_service_module._citation_contract()

    assert "Every answer" in contract
    assert "no [n] citations is invalid" in contract


def test_fallback_citations_anchor_uncited_answer_to_retrieved_chunks() -> None:
    chunk_id = uuid.uuid4()
    chunk = chat_service_module._ChunkInfo(
        id=chunk_id,
        page_start=8,
        page_end=9,
        bboxes=[{"x": 0.1, "y": 0.2, "w": 0.3, "h": 0.1, "page": 8}],
        text="纳什均衡 合作最优 过度自动化 市场失灵 自动化率",
        section_title="Equilibrium and Over-Automation",
        score=0.91,
    )

    citations = chat_service_module._fallback_citations(
        "文章使用纳什均衡分析企业自动化率，并与合作最优进行对比。",
        {1: chunk},
    )

    assert citations
    assert citations[0]["ref_index"] == 1
    assert citations[0]["chunk_id"] == str(chunk_id)
    assert citations[0]["page"] == 8
    assert citations[0]["offset"] > 0


@pytest.mark.asyncio
async def test_chat_stream_refunds_predebit_when_retrieval_fails(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session_id = uuid.uuid4()
    document_id = uuid.uuid4()
    user_id = uuid.uuid4()
    ledger_id = uuid.uuid4()
    session_obj = SimpleNamespace(id=session_id, document_id=document_id, collection_id=None, title=None)
    doc_obj = SimpleNamespace(demo_slug=None, custom_instructions=None)
    db = _make_db(
        session_obj,
        doc_obj,
        execute_side_effect=[
            _ScalarOneResult(session_obj),
            _MessagesResult([SimpleNamespace(role="user", content="hello")]),
        ],
    )
    refund_predebit = AsyncMock()

    monkeypatch.setattr(chat_service_module.credit_service, "get_estimated_cost", lambda _mode: 15)
    monkeypatch.setattr(
        chat_service_module.credit_service,
        "debit_credits",
        AsyncMock(return_value=ledger_id),
    )
    monkeypatch.setattr(
        chat_service_module.retrieval_service,
        "search",
        AsyncMock(side_effect=RuntimeError("qdrant down")),
    )
    monkeypatch.setattr(chat_service_module, "_refund_predebit", refund_predebit)

    events = [
        event
        async for event in chat_service_module.chat_service.chat_stream(
            session_id=session_id,
            user_message="hello",
            db=db,
            user=SimpleNamespace(id=user_id, plan="pro"),
            mode="balanced",
        )
    ]

    assert events[-1]["event"] == "error"
    assert events[-1]["data"]["code"] == "RETRIEVAL_ERROR"
    refund_predebit.assert_awaited_once_with(db, user_id, 15, ledger_id)


@pytest.mark.asyncio
async def test_continue_stream_refunds_predebit_when_setup_fails(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session_id = uuid.uuid4()
    document_id = uuid.uuid4()
    message_id = uuid.uuid4()
    user_id = uuid.uuid4()
    ledger_id = uuid.uuid4()
    session_obj = SimpleNamespace(id=session_id, document_id=document_id, collection_id=None)
    doc_obj = SimpleNamespace(demo_slug=None, custom_instructions=None)
    assistant_message = SimpleNamespace(
        role="assistant",
        session_id=session_id,
        citations=[{"chunk_id": "not-a-uuid", "ref_index": 1}],
        content="partial response",
        continuation_count=0,
    )
    db = _make_db(
        session_obj,
        doc_obj,
        assistant_message=assistant_message,
        execute_side_effect=[_ScalarOneResult(session_obj)],
    )
    refund_predebit = AsyncMock()

    monkeypatch.setattr(chat_service_module.credit_service, "get_estimated_cost", lambda _mode: 15)
    monkeypatch.setattr(
        chat_service_module.credit_service,
        "debit_credits",
        AsyncMock(return_value=ledger_id),
    )
    monkeypatch.setattr(chat_service_module, "_refund_predebit", refund_predebit)

    events = [
        event
        async for event in chat_service_module.chat_service.continue_stream(
            session_id=session_id,
            message_id=message_id,
            db=db,
            user=SimpleNamespace(id=user_id, plan="pro"),
            mode="balanced",
        )
    ]

    assert events[-1]["event"] == "error"
    assert events[-1]["data"]["code"] == "CHAT_SETUP_ERROR"
    refund_predebit.assert_awaited_once_with(db, user_id, 15, ledger_id)
