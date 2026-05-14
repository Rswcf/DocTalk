from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

import app.services.chat_service as chat_service_module
from app.models.tables import ChatSession, Document, Message, ProductEvent
from app.services.query_router import QueryIntent


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


class _ScalarsResult:
    def __init__(self, values):
        self._values = values

    def scalars(self):
        values = self._values

        class _Scalars:
            def __iter__(self):
                return iter(values)

            def all(self):
                return values

        return _Scalars()


class _FakeChoice:
    def __init__(self, content: str | None = None, finish_reason: str | None = None):
        self.delta = SimpleNamespace(content=content)
        self.finish_reason = finish_reason


class _FakeChunk:
    def __init__(self, content: str | None = None, *, finish_reason: str | None = None, usage=None):
        self.choices = [_FakeChoice(content=content, finish_reason=finish_reason)]
        self.usage = usage


class _FakeMessageChoice:
    def __init__(self, content: str):
        self.message = SimpleNamespace(content=content)


class _FakeResponse:
    def __init__(self, content: str, *, prompt_tokens: int = 0, completion_tokens: int = 0):
        self.choices = [_FakeMessageChoice(content)]
        self.usage = SimpleNamespace(prompt_tokens=prompt_tokens, completion_tokens=completion_tokens)


class _FakeStream:
    def __init__(self, chunks):
        self._chunks = chunks

    def __aiter__(self):
        return self._iterate()

    async def _iterate(self):
        for chunk in self._chunks:
            yield chunk


def _make_db(session_obj, doc_obj, *, assistant_message=None, execute_side_effect=None):
    async def fake_get(model, _id):
        if model is Document:
            return doc_obj
        if model is ChatSession:
            return session_obj
        if model is Message:
            return assistant_message
        return None

    added: list[object] = []

    def add(obj):
        if isinstance(obj, Message):
            if getattr(obj, "id", None) is None:
                obj.id = uuid.uuid4()
            if getattr(obj, "continuation_count", None) is None:
                obj.continuation_count = 0
        added.append(obj)

    return SimpleNamespace(
        execute=AsyncMock(side_effect=execute_side_effect or []),
        get=AsyncMock(side_effect=fake_get),
        add=add,
        added=added,
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
async def test_rag_repair_rewrites_answer_and_rechecks_citations() -> None:
    chunk_id = uuid.uuid4()
    chunk = chat_service_module._ChunkInfo(
        id=chunk_id,
        page_start=7,
        page_end=7,
        bboxes=[],
        text="MetaX 2028 revenue is RMB 7.8 billion.",
        section_title="Valuation",
        score=0.91,
    )
    chunk_map = {1: chunk}
    draft = "MetaX 2028 revenue is RMB 9.1 billion."
    draft_citations = [chat_service_module._citation_payload(1, chunk, len(draft))]
    draft_report = chat_service_module.claim_verifier_service.verify(
        draft,
        draft_citations,
        set(chunk_map.keys()),
        retrieved_count=len(chunk_map),
    )
    fake_client = SimpleNamespace(
        chat=SimpleNamespace(
            completions=SimpleNamespace(
                create=AsyncMock(return_value=_FakeResponse(
                    "MetaX 2028 revenue is RMB 7.8 billion.[1]",
                    prompt_tokens=50,
                    completion_tokens=12,
                ))
            )
        )
    )

    result = await chat_service_module._try_repair_rag_answer(
        client=fake_client,
        model="deepseek-v4-flash",
        profile=chat_service_module.get_model_profile("deepseek-v4-flash"),
        user_message="What is MetaX 2028 revenue?",
        assistant_text=draft,
        citations=draft_citations,
        chunk_map=chunk_map,
        numbered_chunks=["[1] MetaX 2028 revenue is RMB 7.8 billion."],
        verification=draft_report.to_payload(),
        locale="en",
    )

    assert result is not None
    assert result.applied is True
    assert result.metadata["repair_applied"] is True
    assert result.prompt_tokens == 50
    assert result.output_tokens == 12
    assert result.text == "MetaX 2028 revenue is RMB 7.8 billion."
    assert result.verification["status"] == "pass"
    assert result.citations[0]["ref_index"] == 1


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
        chat_service_module.corrective_retrieval_service,
        "retrieve_single",
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
async def test_chat_stream_returns_sse_error_when_llm_client_unavailable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session_id = uuid.uuid4()
    document_id = uuid.uuid4()
    user_id = uuid.uuid4()
    ledger_id = uuid.uuid4()
    session_obj = SimpleNamespace(id=session_id, document_id=document_id, collection_id=None, title=None, domain_mode=None)
    doc_obj = SimpleNamespace(id=document_id, demo_slug=None, custom_instructions=None)
    db = _make_db(
        session_obj,
        doc_obj,
        execute_side_effect=[
            _ScalarOneResult(session_obj),
            _MessagesResult([SimpleNamespace(role="user", content="hello")]),
        ],
    )
    refund_predebit = AsyncMock()
    corrective_result = SimpleNamespace(retrieved=[], strategy="semantic_top_k", evaluation=None, plan=None)

    monkeypatch.setattr(chat_service_module.credit_service, "get_estimated_cost", lambda _mode: 15)
    monkeypatch.setattr(
        chat_service_module.credit_service,
        "debit_credits",
        AsyncMock(return_value=ledger_id),
    )
    monkeypatch.setattr(
        chat_service_module.corrective_retrieval_service,
        "retrieve_single",
        AsyncMock(return_value=corrective_result),
    )
    monkeypatch.setattr(chat_service_module, "_get_llm_client", lambda _model: (_ for _ in ()).throw(RuntimeError("missing key")))
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
    assert events[-1]["data"]["code"] == "LLM_ERROR"
    assert "temporarily unavailable" in events[-1]["data"]["message"]
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


@pytest.mark.asyncio
async def test_continue_stream_refunds_predebit_when_llm_client_unavailable(
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
        id=message_id,
        role="assistant",
        session_id=session_id,
        citations=[],
        content="partial response",
        continuation_count=0,
    )
    db = _make_db(
        session_obj,
        doc_obj,
        assistant_message=assistant_message,
        execute_side_effect=[
            _ScalarOneResult(session_obj),
            _MessagesResult([assistant_message]),
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
        chat_service_module,
        "_get_llm_client",
        lambda _model: (_ for _ in ()).throw(RuntimeError("missing key")),
    )
    monkeypatch.setattr(chat_service_module, "_refund_predebit", refund_predebit)

    events = [
        event
        async for event in chat_service_module.chat_service.continue_stream(
            session_id=session_id,
            message_id=message_id,
            db=db,
            user=SimpleNamespace(id=user_id, plan="pro"),
            mode="quick",
        )
    ]

    assert events[-1]["event"] == "error"
    assert events[-1]["data"]["code"] == "LLM_ERROR"
    refund_predebit.assert_awaited_once_with(db, user_id, 15, ledger_id)


@pytest.mark.asyncio
async def test_chat_stream_reconciles_predebit_and_records_usage(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session_id = uuid.uuid4()
    document_id = uuid.uuid4()
    user_id = uuid.uuid4()
    ledger_id = uuid.uuid4()
    chunk_id = uuid.uuid4()
    session_obj = SimpleNamespace(id=session_id, document_id=document_id, collection_id=None, title=None, domain_mode=None)
    doc_obj = SimpleNamespace(id=document_id, demo_slug=None, custom_instructions=None)
    db = _make_db(
        session_obj,
        doc_obj,
        execute_side_effect=[
            _ScalarOneResult(session_obj),
            _MessagesResult([SimpleNamespace(role="user", content="What is MetaX?")]),
        ],
    )
    fake_retrieval = SimpleNamespace(
        retrieved=[
            {
                "chunk_id": chunk_id,
                "document_id": document_id,
                "text": "MetaX 2028 revenue is RMB 7.8 billion.",
                "page": 7,
                "page_end": 7,
                "bboxes": [],
                "section_title": "Valuation",
                "score": 0.91,
            }
        ],
        strategy="semantic_top_k",
        evaluation=None,
        plan=None,
    )
    create = AsyncMock(
        return_value=_FakeStream(
            [
                _FakeChunk("MetaX 2028 revenue is RMB 7.8 billion.[1]"),
                _FakeChunk(
                    None,
                    finish_reason="stop",
                    usage=SimpleNamespace(prompt_tokens=1200, completion_tokens=350),
                ),
            ]
        )
    )
    fake_client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
    reconcile_credits = AsyncMock()
    record_usage = AsyncMock()

    monkeypatch.setattr(
        chat_service_module.action_planner,
        "plan",
        AsyncMock(return_value=SimpleNamespace(uses_rag_answer_path=True)),
    )
    monkeypatch.setattr(
        chat_service_module.query_router,
        "route",
        lambda *_args, **_kwargs: SimpleNamespace(primary_intent=QueryIntent.LOCAL_QA),
    )
    monkeypatch.setattr(chat_service_module.credit_service, "get_estimated_cost", lambda _mode: 15)
    monkeypatch.setattr(
        chat_service_module.credit_service,
        "debit_credits",
        AsyncMock(return_value=ledger_id),
    )
    monkeypatch.setattr(
        chat_service_module.corrective_retrieval_service,
        "retrieve_single",
        AsyncMock(return_value=fake_retrieval),
    )
    monkeypatch.setattr(chat_service_module, "_get_llm_client", lambda _model: fake_client)
    monkeypatch.setattr(chat_service_module.credit_service, "calculate_cost", lambda *_args, **_kwargs: 4)
    monkeypatch.setattr(chat_service_module.credit_service, "reconcile_credits", reconcile_credits)
    monkeypatch.setattr(chat_service_module.credit_service, "record_usage", record_usage)

    events = [
        event
        async for event in chat_service_module.chat_service.chat_stream(
            session_id=session_id,
            user_message="What is MetaX?",
            db=db,
            user=SimpleNamespace(id=user_id, plan="pro"),
            mode="quick",
        )
    ]

    assert events[-1]["event"] == "done"
    reconcile_credits.assert_awaited_once_with(db, user_id, ledger_id, 15, 4)
    record_usage.assert_awaited_once()
    assert record_usage.await_args.kwargs["prompt_tokens"] == 1200
    assert record_usage.await_args.kwargs["completion_tokens"] == 350
    assert record_usage.await_args.kwargs["cost_credits"] == 4


@pytest.mark.asyncio
async def test_continue_stream_records_rag_verification_event(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session_id = uuid.uuid4()
    document_id = uuid.uuid4()
    message_id = uuid.uuid4()
    chunk_id = uuid.uuid4()
    session_obj = SimpleNamespace(id=session_id, document_id=document_id, collection_id=None)
    doc_obj = SimpleNamespace(demo_slug=None, custom_instructions=None)
    original_citation = {
        "ref_index": 1,
        "chunk_id": str(chunk_id),
        "page": 7,
        "page_end": 7,
        "bboxes": [],
        "context_text": "MetaX 2028 revenue is listed as RMB 7.8 billion in the valuation table.",
    }
    assistant_message = SimpleNamespace(
        id=message_id,
        role="assistant",
        session_id=session_id,
        citations=[original_citation],
        content="MetaX 2028 revenue is listed as RMB 7.8 billion in the valuation table.",
        continuation_count=0,
        output_tokens=10,
    )
    chunk = SimpleNamespace(
        id=chunk_id,
        page_start=7,
        page_end=7,
        bboxes=[],
        text="MetaX 2028 revenue is listed as RMB 7.8 billion in the valuation table.",
        section_title="Valuation",
        document_id=document_id,
    )
    db = _make_db(
        session_obj,
        doc_obj,
        assistant_message=assistant_message,
        execute_side_effect=[
            _ScalarOneResult(session_obj),
            _ScalarsResult([chunk]),
            _MessagesResult([assistant_message]),
        ],
    )
    create = AsyncMock(
        return_value=_FakeStream(
            [
                _FakeChunk(" Continued analysis keeps the same MetaX revenue citation.[1]"),
                _FakeChunk(
                    None,
                    finish_reason="stop",
                    usage=SimpleNamespace(prompt_tokens=8, completion_tokens=7),
                ),
            ]
        )
    )
    fake_client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
    monkeypatch.setattr(chat_service_module, "_get_llm_client", lambda _model: fake_client)

    events = [
        event
        async for event in chat_service_module.chat_service.continue_stream(
            session_id=session_id,
            message_id=message_id,
            db=db,
            user=None,
            mode="quick",
        )
    ]

    assert events[-1]["event"] == "done"
    assert events[-1]["data"]["verification"]["status"] == "pass"
    assert assistant_message.continuation_count == 1
    verification_events = [item for item in db.added if isinstance(item, ProductEvent)]
    assert len(verification_events) == 1
    assert verification_events[0].event_name == "rag_verification_completed"
    assert verification_events[0].metadata_json["retrieval_strategy"] == "continuation"


@pytest.mark.asyncio
async def test_continue_stream_reconciles_predebit_and_records_usage(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session_id = uuid.uuid4()
    document_id = uuid.uuid4()
    message_id = uuid.uuid4()
    user_id = uuid.uuid4()
    ledger_id = uuid.uuid4()
    chunk_id = uuid.uuid4()
    session_obj = SimpleNamespace(id=session_id, document_id=document_id, collection_id=None)
    doc_obj = SimpleNamespace(demo_slug=None, custom_instructions=None)
    original_citation = {
        "ref_index": 1,
        "chunk_id": str(chunk_id),
        "page": 7,
        "page_end": 7,
        "bboxes": [],
        "context_text": "MetaX 2028 revenue is RMB 7.8 billion.",
    }
    assistant_message = SimpleNamespace(
        id=message_id,
        role="assistant",
        session_id=session_id,
        citations=[original_citation],
        content="MetaX 2028 revenue is RMB 7.8 billion.",
        continuation_count=0,
        output_tokens=10,
    )
    chunk = SimpleNamespace(
        id=chunk_id,
        page_start=7,
        page_end=7,
        bboxes=[],
        text="MetaX 2028 revenue is RMB 7.8 billion.",
        section_title="Valuation",
        document_id=document_id,
    )
    db = _make_db(
        session_obj,
        doc_obj,
        assistant_message=assistant_message,
        execute_side_effect=[
            _ScalarOneResult(session_obj),
            _ScalarsResult([chunk]),
            _MessagesResult([assistant_message]),
        ],
    )
    create = AsyncMock(
        return_value=_FakeStream(
            [
                _FakeChunk(" Continued analysis uses the same cited revenue.[1]"),
                _FakeChunk(
                    None,
                    finish_reason="stop",
                    usage=SimpleNamespace(prompt_tokens=800, completion_tokens=160),
                ),
            ]
        )
    )
    fake_client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
    reconcile_credits = AsyncMock()
    record_usage = AsyncMock()

    monkeypatch.setattr(chat_service_module.credit_service, "get_estimated_cost", lambda _mode: 15)
    monkeypatch.setattr(
        chat_service_module.credit_service,
        "debit_credits",
        AsyncMock(return_value=ledger_id),
    )
    monkeypatch.setattr(chat_service_module, "_get_llm_client", lambda _model: fake_client)
    monkeypatch.setattr(chat_service_module.credit_service, "calculate_cost", lambda *_args, **_kwargs: 3)
    monkeypatch.setattr(chat_service_module.credit_service, "reconcile_credits", reconcile_credits)
    monkeypatch.setattr(chat_service_module.credit_service, "record_usage", record_usage)

    events = [
        event
        async for event in chat_service_module.chat_service.continue_stream(
            session_id=session_id,
            message_id=message_id,
            db=db,
            user=SimpleNamespace(id=user_id, plan="pro"),
            mode="quick",
        )
    ]

    assert events[-1]["event"] == "done"
    reconcile_credits.assert_awaited_once_with(db, user_id, ledger_id, 15, 3)
    record_usage.assert_awaited_once()
    assert record_usage.await_args.kwargs["message_id"] == message_id
    assert record_usage.await_args.kwargs["prompt_tokens"] == 800
    assert record_usage.await_args.kwargs["completion_tokens"] == 160
    assert record_usage.await_args.kwargs["cost_credits"] == 3
