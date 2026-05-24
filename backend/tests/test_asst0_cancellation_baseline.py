"""asst=0 reliability — cancellation/disconnect baseline tests (Group R).

These encode the DESIRED post-fix behavior for the asst=0 bug found in the
2026-05-23 funnel review (4 users / 15 sessions with a user message but zero
assistant row; ~36 charged-but-no-answer credit events).

Root cause (consensus 2026-05-24): the assistant Message + credit settlement
only happen at the very end of the pipeline (chat_service.py:1352). A client
disconnect / Vercel 60s abort injects asyncio.CancelledError (a BaseException)
at a suspended `yield`, which bypasses every `except Exception` and the absent
`finally`/shield -> the streamed answer is discarded AND the pre-debit is never
refunded/reconciled.

We simulate the disconnect faithfully with `agen.athrow(asyncio.CancelledError)`
at a token yield (exactly what Starlette does on disconnect).

EXPECTED ON CURRENT (UNFIXED) CODE: these tests FAIL (the baseline snapshot).
EXPECTED AFTER THE FIX: they PASS.

Run: SKIP_INTEGRATION=1 python3 -m pytest tests/test_asst0_cancellation_baseline.py -v
(no infra required — DB + LLM are faked, same pattern as test_chat_setup_refunds.py)
"""
from __future__ import annotations

import asyncio
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

import app.services.chat_service as chat_service_module
from app.models.tables import ChatSession, Document, Message
from app.services.query_router import QueryIntent


# --- minimal fakes (mirror tests/test_chat_setup_refunds.py) -----------------
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


class _FakeChoice:
    def __init__(self, content=None, finish_reason=None):
        self.delta = SimpleNamespace(content=content)
        self.finish_reason = finish_reason


class _FakeChunk:
    def __init__(self, content=None, *, finish_reason=None, usage=None):
        self.choices = [_FakeChoice(content=content, finish_reason=finish_reason)]
        self.usage = usage


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


class _SlowStream:
    """Async stream that yields tokens forever until cancelled (lets us suspend mid-stream)."""

    def __aiter__(self):
        return self._iterate()

    async def _iterate(self):
        i = 0
        while True:
            i += 1
            await asyncio.sleep(0)  # cooperative suspension point
            yield _FakeChunk(f"token{i} ")


class _FiniteStream:
    def __init__(self, chunks):
        self._chunks = chunks

    def __aiter__(self):
        return self._iterate()

    async def _iterate(self):
        for chunk in self._chunks:
            await asyncio.sleep(0)
            yield chunk


class _PartialThenErrorStream:
    def __init__(self, exc: Exception):
        self._exc = exc

    def __aiter__(self):
        return self._iterate()

    async def _iterate(self):
        await asyncio.sleep(0)
        yield _FakeChunk("partial ")
        raise self._exc


class _PassVerificationReport:
    status = "pass"
    score = 1.0
    claim_count = 1
    citation_count = 1
    reasons = ()

    def to_payload(self):
        return {
            "status": "pass",
            "score": 1.0,
            "claim_count": 1,
            "citation_count": 1,
            "reasons": [],
        }


class _FakePersistSession:
    """Stand-in for the INDEPENDENT AsyncSessionLocal the cancel path opens.

    Keeps the gate hermetic: the real helper would connect to a DB; here we record
    adds/commits in `store` so we can assert the partial answer was persisted,
    without any network/DB I/O (which previously made the test hit a real pg and
    block on asyncpg's 60s connect timeout under the shield).
    """

    def __init__(self, store):
        self.store = store

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def get(self, _model, _id):
        return None

    def add(self, obj):
        self.store.append(obj)

    async def commit(self):
        return None

    async def rollback(self):
        return None


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


def _patch_common(monkeypatch, ledger_id, document_id, *, refund, reconcile, record_usage, persist_store):
    fake_retrieval = SimpleNamespace(
        retrieved=[{
            "chunk_id": uuid.uuid4(), "document_id": document_id,
            "text": "MetaX 2028 revenue is RMB 7.8 billion.", "page": 7, "page_end": 7,
            "bboxes": [], "section_title": "Valuation", "score": 0.91,
        }],
        strategy="semantic_top_k", evaluation=None, plan=None,
    )
    fake_client = SimpleNamespace(
        chat=SimpleNamespace(completions=SimpleNamespace(create=AsyncMock(return_value=_SlowStream())))
    )
    monkeypatch.setattr(chat_service_module.action_planner, "plan",
                        AsyncMock(return_value=SimpleNamespace(uses_rag_answer_path=True)))
    monkeypatch.setattr(chat_service_module.query_router, "route",
                        lambda *a, **k: SimpleNamespace(primary_intent=QueryIntent.LOCAL_QA))
    monkeypatch.setattr(chat_service_module.credit_service, "get_estimated_cost", lambda _m: 15)
    monkeypatch.setattr(chat_service_module.credit_service, "debit_credits",
                        AsyncMock(return_value=ledger_id))
    monkeypatch.setattr(chat_service_module.corrective_retrieval_service, "retrieve_single",
                        AsyncMock(return_value=fake_retrieval))
    monkeypatch.setattr(chat_service_module, "_get_llm_client", lambda _m: fake_client)
    monkeypatch.setattr(chat_service_module.credit_service, "calculate_cost", lambda *a, **k: 4)
    monkeypatch.setattr(chat_service_module.credit_service, "reconcile_credits", reconcile)
    monkeypatch.setattr(chat_service_module.credit_service, "record_usage", record_usage)
    monkeypatch.setattr(chat_service_module, "_refund_predebit", refund)
    # Cancel-path persist/settle use an INDEPENDENT AsyncSessionLocal (watershed
    # decision). Fake it so the gate is hermetic + fast (never touches a real DB).
    monkeypatch.setattr(
        chat_service_module, "AsyncSessionLocal", lambda: _FakePersistSession(persist_store)
    )


async def _drive_until_token_then_cancel(agen):
    """Consume events until a token is streamed, then inject a client-disconnect cancel."""
    streamed_token = False
    while True:
        ev = await agen.__anext__()
        if ev["event"] == "token":
            streamed_token = True
            break
    assert streamed_token, "stream never produced a token; test setup wrong"
    with pytest.raises(asyncio.CancelledError):
        await agen.athrow(asyncio.CancelledError())


@pytest.mark.asyncio
async def test_chat_stream_midstream_cancel_settles_credits(monkeypatch):
    """TC-R1: client disconnects mid-stream -> pre-debit must be refunded/reconciled (no hanging charge).

    BASELINE: FAILS on current code (CancelledError bypasses except Exception; no finally).
    """
    session_id, document_id, user_id, ledger_id = (uuid.uuid4() for _ in range(4))
    session_obj = SimpleNamespace(id=session_id, document_id=document_id, collection_id=None,
                                  title=None, domain_mode=None)
    doc_obj = SimpleNamespace(id=document_id, demo_slug=None, custom_instructions=None)
    db = _make_db(session_obj, doc_obj, execute_side_effect=[
        _ScalarOneResult(session_obj),
        _MessagesResult([SimpleNamespace(role="user", content="What is MetaX?")]),
    ])
    refund, reconcile, record_usage = (AsyncMock() for _ in range(3))
    persist_store: list = []
    _patch_common(monkeypatch, ledger_id, document_id,
                  refund=refund, reconcile=reconcile, record_usage=record_usage, persist_store=persist_store)

    agen = chat_service_module.chat_service.chat_stream(
        session_id=session_id, user_message="What is MetaX?", db=db,
        user=SimpleNamespace(id=user_id, plan="pro"), mode="quick",
    ).__aiter__()
    await _drive_until_token_then_cancel(agen)

    settled = refund.await_count + reconcile.await_count
    assert settled >= 1, (
        "asst=0 CREDIT LEAK: pre-debit not settled after mid-stream cancel "
        "(neither _refund_predebit nor reconcile_credits awaited)."
    )


@pytest.mark.asyncio
async def test_chat_stream_midstream_cancel_persists_partial_answer(monkeypatch):
    """TC-R1b: the partial streamed answer must not be silently discarded.

    Asserts via the persist seam the fix is expected to add
    (_persist_partial_on_cancel). BASELINE: FAILS (seam absent / not called).
    """
    session_id, document_id, user_id, ledger_id = (uuid.uuid4() for _ in range(4))
    session_obj = SimpleNamespace(id=session_id, document_id=document_id, collection_id=None,
                                  title=None, domain_mode=None)
    doc_obj = SimpleNamespace(id=document_id, demo_slug=None, custom_instructions=None)
    db = _make_db(session_obj, doc_obj, execute_side_effect=[
        _ScalarOneResult(session_obj),
        _MessagesResult([SimpleNamespace(role="user", content="What is MetaX?")]),
    ])
    refund, reconcile, record_usage = (AsyncMock() for _ in range(3))
    persist_store: list = []
    _patch_common(monkeypatch, ledger_id, document_id,
                  refund=refund, reconcile=reconcile, record_usage=record_usage, persist_store=persist_store)

    agen = chat_service_module.chat_service.chat_stream(
        session_id=session_id, user_message="What is MetaX?", db=db,
        user=SimpleNamespace(id=user_id, plan="pro"), mode="quick",
    ).__aiter__()
    await _drive_until_token_then_cancel(agen)

    assert any(getattr(o, "role", None) == "assistant" for o in persist_store), (
        "asst=0 DATA LOSS: partial answer not persisted (no assistant Message written "
        "via the independent cancel-path session)."
    )


@pytest.mark.asyncio
async def test_continue_stream_midstream_cancel_settles_credits(monkeypatch):
    """TC-R4: continue_stream has the SAME cancel-loss/no-refund bug (Codex r1 finding).

    BASELINE: FAILS on current code.
    """
    session_id, document_id, user_id, ledger_id, message_id = (uuid.uuid4() for _ in range(5))
    session_obj = SimpleNamespace(id=session_id, document_id=document_id, collection_id=None)
    doc_obj = SimpleNamespace(id=document_id, demo_slug=None, custom_instructions=None)
    assistant_message = SimpleNamespace(
        id=message_id, role="assistant", session_id=session_id,
        citations=[], content="partial", continuation_count=0, output_tokens=10,
    )
    db = _make_db(session_obj, doc_obj, assistant_message=assistant_message, execute_side_effect=[
        _ScalarOneResult(session_obj),
        _MessagesResult([assistant_message]),
    ])
    refund, reconcile, record_usage = (AsyncMock() for _ in range(3))
    persist_store: list = []
    monkeypatch.setattr(chat_service_module.credit_service, "get_estimated_cost", lambda _m: 15)
    monkeypatch.setattr(chat_service_module.credit_service, "debit_credits", AsyncMock(return_value=ledger_id))
    monkeypatch.setattr(chat_service_module, "_get_llm_client",
                        lambda _m: SimpleNamespace(chat=SimpleNamespace(
                            completions=SimpleNamespace(create=AsyncMock(return_value=_SlowStream())))))
    monkeypatch.setattr(chat_service_module.credit_service, "calculate_cost", lambda *a, **k: 3)
    monkeypatch.setattr(chat_service_module.credit_service, "reconcile_credits", reconcile)
    monkeypatch.setattr(chat_service_module.credit_service, "record_usage", record_usage)
    monkeypatch.setattr(chat_service_module, "_refund_predebit", refund)
    monkeypatch.setattr(
        chat_service_module, "AsyncSessionLocal", lambda: _FakePersistSession(persist_store)
    )

    agen = chat_service_module.chat_service.continue_stream(
        session_id=session_id, message_id=message_id, db=db,
        user=SimpleNamespace(id=user_id, plan="pro"), mode="quick",
    ).__aiter__()
    await _drive_until_token_then_cancel(agen)

    settled = refund.await_count + reconcile.await_count
    assert settled >= 1, (
        "asst=0 CREDIT LEAK (continue_stream): pre-debit not settled after mid-stream cancel."
    )


@pytest.mark.asyncio
async def test_chat_stream_setup_cancel_settles_via_cancel_path(monkeypatch):
    """CancelledError during setup must still settle pre-debit via cancel-path helper."""
    session_id, document_id, user_id, ledger_id = (uuid.uuid4() for _ in range(4))
    session_obj = SimpleNamespace(
        id=session_id,
        document_id=document_id,
        collection_id=None,
        title=None,
        domain_mode=None,
    )
    doc_obj = SimpleNamespace(id=document_id, demo_slug=None, custom_instructions=None)
    db = _make_db(
        session_obj,
        doc_obj,
        execute_side_effect=[
            _ScalarOneResult(session_obj),
            _MessagesResult([SimpleNamespace(role="user", content="What is MetaX?")]),
        ],
    )
    refund, reconcile, record_usage = (AsyncMock() for _ in range(3))
    persist_store: list = []
    _patch_common(
        monkeypatch,
        ledger_id,
        document_id,
        refund=refund,
        reconcile=reconcile,
        record_usage=record_usage,
        persist_store=persist_store,
    )
    monkeypatch.setattr(
        chat_service_module.chat_service,
        "_persist_user_message_and_title",
        AsyncMock(return_value=None),
    )
    monkeypatch.setattr(
        chat_service_module.corrective_retrieval_service,
        "retrieve_single",
        AsyncMock(side_effect=asyncio.CancelledError()),
    )
    settle_on_cancel = AsyncMock()
    monkeypatch.setattr(chat_service_module, "_settle_predebit_on_cancel", settle_on_cancel)

    agen = chat_service_module.chat_service.chat_stream(
        session_id=session_id,
        user_message="What is MetaX?",
        db=db,
        user=SimpleNamespace(id=user_id, plan="pro"),
        mode="quick",
    ).__aiter__()
    with pytest.raises(asyncio.CancelledError):
        await agen.__anext__()

    assert settle_on_cancel.await_count == 1
    assert settle_on_cancel.await_args.kwargs["has_answer"] is False
    assert refund.await_count == 0


@pytest.mark.asyncio
async def test_continue_stream_setup_cancel_settles_via_cancel_path(monkeypatch):
    """CancelledError in continuation setup must settle pre-debit in finally."""
    session_id, document_id, user_id, ledger_id, message_id = (uuid.uuid4() for _ in range(5))
    session_obj = SimpleNamespace(id=session_id, document_id=document_id, collection_id=None)
    doc_obj = SimpleNamespace(id=document_id, demo_slug=None, custom_instructions=None)
    assistant_message = SimpleNamespace(
        id=message_id,
        role="assistant",
        session_id=session_id,
        citations=[],
        content="base answer",
        continuation_count=0,
        output_tokens=5,
    )
    db = _make_db(
        session_obj,
        doc_obj,
        assistant_message=assistant_message,
        execute_side_effect=[
            _ScalarOneResult(session_obj),
            asyncio.CancelledError(),
        ],
    )
    refund = AsyncMock()
    monkeypatch.setattr(chat_service_module.credit_service, "get_estimated_cost", lambda _m: 15)
    monkeypatch.setattr(
        chat_service_module.credit_service,
        "debit_credits",
        AsyncMock(return_value=ledger_id),
    )
    monkeypatch.setattr(chat_service_module, "_refund_predebit", refund)
    monkeypatch.setattr(
        chat_service_module,
        "_get_llm_client",
        lambda _m: SimpleNamespace(
            chat=SimpleNamespace(completions=SimpleNamespace(create=AsyncMock(return_value=_SlowStream())))
        ),
    )
    settle_on_cancel = AsyncMock()
    monkeypatch.setattr(chat_service_module, "_settle_predebit_on_cancel", settle_on_cancel)

    agen = chat_service_module.chat_service.continue_stream(
        session_id=session_id,
        message_id=message_id,
        db=db,
        user=SimpleNamespace(id=user_id, plan="pro"),
        mode="quick",
    ).__aiter__()
    with pytest.raises(asyncio.CancelledError):
        await agen.__anext__()

    assert settle_on_cancel.await_count == 1
    assert settle_on_cancel.await_args.kwargs["has_answer"] is False
    assert refund.await_count == 0


@pytest.mark.asyncio
async def test_chat_stream_llm_error_after_partial_answer_does_not_full_refund(monkeypatch):
    """Partial answer + LLM_ERROR must reconcile in finally, not full-refund early."""
    session_id, document_id, user_id, ledger_id = (uuid.uuid4() for _ in range(4))
    session_obj = SimpleNamespace(
        id=session_id,
        document_id=document_id,
        collection_id=None,
        title=None,
        domain_mode=None,
    )
    doc_obj = SimpleNamespace(id=document_id, demo_slug=None, custom_instructions=None)
    db = _make_db(
        session_obj,
        doc_obj,
        execute_side_effect=[
            _ScalarOneResult(session_obj),
            _MessagesResult([SimpleNamespace(role="user", content="What is MetaX?")]),
        ],
    )
    refund, reconcile, record_usage = (AsyncMock() for _ in range(3))
    persist_store: list = []
    _patch_common(
        monkeypatch,
        ledger_id,
        document_id,
        refund=refund,
        reconcile=reconcile,
        record_usage=record_usage,
        persist_store=persist_store,
    )
    monkeypatch.setattr(
        chat_service_module,
        "_get_llm_client",
        lambda _m: SimpleNamespace(
            chat=SimpleNamespace(
                completions=SimpleNamespace(
                    create=AsyncMock(return_value=_PartialThenErrorStream(RuntimeError("llm failed")))
                )
            )
        ),
    )
    settle_on_cancel = AsyncMock()
    monkeypatch.setattr(chat_service_module, "_settle_predebit_on_cancel", settle_on_cancel)

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

    assert events[-1]["event"] == "error"
    assert events[-1]["data"]["code"] == "LLM_ERROR"
    assert refund.await_count == 0
    assert settle_on_cancel.await_count == 1
    assert settle_on_cancel.await_args.kwargs["has_answer"] is True


@pytest.mark.asyncio
async def test_continue_stream_llm_error_after_partial_answer_does_not_full_refund(monkeypatch):
    session_id, document_id, user_id, ledger_id, message_id = (uuid.uuid4() for _ in range(5))
    session_obj = SimpleNamespace(id=session_id, document_id=document_id, collection_id=None)
    doc_obj = SimpleNamespace(id=document_id, demo_slug=None, custom_instructions=None)
    chunk_id = uuid.uuid4()
    assistant_message = SimpleNamespace(
        id=message_id,
        role="assistant",
        session_id=session_id,
        citations=[{"chunk_id": str(chunk_id), "ref_index": 1}],
        content="base answer",
        continuation_count=0,
        output_tokens=5,
    )
    fake_chunk = SimpleNamespace(
        id=chunk_id,
        document_id=document_id,
        chunk_index=1,
        page_start=3,
        page_end=3,
        bboxes=[],
        text="MetaX revenue on page 3.",
        section_title="Section A",
    )
    db = _make_db(
        session_obj,
        doc_obj,
        assistant_message=assistant_message,
        execute_side_effect=[
            _ScalarOneResult(session_obj),
            _ScalarsResult([fake_chunk]),
            _MessagesResult([assistant_message]),
        ],
    )
    refund = AsyncMock()
    monkeypatch.setattr(chat_service_module.credit_service, "get_estimated_cost", lambda _m: 15)
    monkeypatch.setattr(
        chat_service_module.credit_service,
        "debit_credits",
        AsyncMock(return_value=ledger_id),
    )
    monkeypatch.setattr(chat_service_module, "_refund_predebit", refund)
    monkeypatch.setattr(
        chat_service_module,
        "_get_llm_client",
        lambda _m: SimpleNamespace(
            chat=SimpleNamespace(
                completions=SimpleNamespace(
                    create=AsyncMock(return_value=_PartialThenErrorStream(RuntimeError("llm failed")))
                )
            )
        ),
    )
    monkeypatch.setattr(
        chat_service_module.claim_verifier_service,
        "verify",
        lambda *args, **kwargs: _PassVerificationReport(),
    )
    monkeypatch.setattr(
        chat_service_module, "AsyncSessionLocal", lambda: _FakePersistSession([])
    )
    settle_on_cancel = AsyncMock()
    monkeypatch.setattr(chat_service_module, "_settle_predebit_on_cancel", settle_on_cancel)

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
    assert refund.await_count == 0
    assert settle_on_cancel.await_count == 1
    assert settle_on_cancel.await_args.kwargs["has_answer"] is True


@pytest.mark.asyncio
async def test_chat_stream_persist_failed_with_partial_answer_does_not_full_refund(monkeypatch):
    session_id, document_id, user_id, ledger_id = (uuid.uuid4() for _ in range(4))
    session_obj = SimpleNamespace(
        id=session_id,
        document_id=document_id,
        collection_id=None,
        title=None,
        domain_mode=None,
    )
    doc_obj = SimpleNamespace(id=document_id, demo_slug=None, custom_instructions=None)
    db = _make_db(
        session_obj,
        doc_obj,
        execute_side_effect=[
            _ScalarOneResult(session_obj),
            _MessagesResult([SimpleNamespace(role="user", content="What is MetaX?")]),
        ],
    )
    original_add = db.add

    def fail_on_assistant_add(obj):
        if isinstance(obj, Message) and getattr(obj, "role", "") == "assistant":
            raise RuntimeError("persist failed")
        original_add(obj)

    db.add = fail_on_assistant_add
    refund, reconcile, record_usage = (AsyncMock() for _ in range(3))
    persist_store: list = []
    _patch_common(
        monkeypatch,
        ledger_id,
        document_id,
        refund=refund,
        reconcile=reconcile,
        record_usage=record_usage,
        persist_store=persist_store,
    )
    monkeypatch.setattr(
        chat_service_module,
        "_get_llm_client",
        lambda _m: SimpleNamespace(
            chat=SimpleNamespace(
                completions=SimpleNamespace(
                    create=AsyncMock(
                        return_value=_FiniteStream(
                            [
                                _FakeChunk("partial "),
                                _FakeChunk(
                                    None,
                                    finish_reason="stop",
                                    usage=SimpleNamespace(prompt_tokens=9, completion_tokens=3),
                                ),
                            ]
                        )
                    )
                )
            )
        ),
    )
    settle_on_cancel = AsyncMock()
    monkeypatch.setattr(chat_service_module, "_settle_predebit_on_cancel", settle_on_cancel)

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

    assert events[-1]["event"] == "error"
    assert events[-1]["data"]["code"] == "PERSIST_FAILED"
    assert refund.await_count == 0
    assert settle_on_cancel.await_count == 1
    assert settle_on_cancel.await_args.kwargs["has_answer"] is True


@pytest.mark.asyncio
async def test_continue_stream_persist_failed_with_partial_answer_does_not_full_refund(monkeypatch):
    session_id, document_id, user_id, ledger_id, message_id = (uuid.uuid4() for _ in range(5))
    session_obj = SimpleNamespace(id=session_id, document_id=document_id, collection_id=None)
    doc_obj = SimpleNamespace(id=document_id, demo_slug=None, custom_instructions=None)
    assistant_message = SimpleNamespace(
        id=message_id,
        role="assistant",
        session_id=session_id,
        citations=[],
        content="base answer",
        continuation_count=0,
        output_tokens=5,
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
    db.commit = AsyncMock(side_effect=[None, RuntimeError("persist failed")])

    refund = AsyncMock()
    monkeypatch.setattr(chat_service_module.credit_service, "get_estimated_cost", lambda _m: 15)
    monkeypatch.setattr(
        chat_service_module.credit_service,
        "debit_credits",
        AsyncMock(return_value=ledger_id),
    )
    monkeypatch.setattr(chat_service_module, "_refund_predebit", refund)
    monkeypatch.setattr(
        chat_service_module,
        "_get_llm_client",
        lambda _m: SimpleNamespace(
            chat=SimpleNamespace(
                completions=SimpleNamespace(
                    create=AsyncMock(
                        return_value=_FiniteStream(
                            [
                                _FakeChunk("continued "),
                                _FakeChunk(
                                    None,
                                    finish_reason="length",
                                    usage=SimpleNamespace(prompt_tokens=7, completion_tokens=2),
                                ),
                            ]
                        )
                    )
                )
            )
        ),
    )
    monkeypatch.setattr(
        chat_service_module.claim_verifier_service,
        "verify",
        lambda *args, **kwargs: _PassVerificationReport(),
    )
    monkeypatch.setattr(
        chat_service_module, "AsyncSessionLocal", lambda: _FakePersistSession([])
    )
    settle_on_cancel = AsyncMock()
    monkeypatch.setattr(chat_service_module, "_settle_predebit_on_cancel", settle_on_cancel)

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
    assert events[-1]["data"]["code"] == "PERSIST_FAILED"
    assert refund.await_count == 0
    assert settle_on_cancel.await_count == 1
    assert settle_on_cancel.await_args.kwargs["has_answer"] is True


@pytest.mark.asyncio
async def test_chat_stream_accounting_error_still_runs_fallback_settlement(monkeypatch):
    session_id, document_id, user_id, ledger_id = (uuid.uuid4() for _ in range(4))
    session_obj = SimpleNamespace(
        id=session_id,
        document_id=document_id,
        collection_id=None,
        title=None,
        domain_mode=None,
    )
    doc_obj = SimpleNamespace(id=document_id, demo_slug=None, custom_instructions=None)
    db = _make_db(
        session_obj,
        doc_obj,
        execute_side_effect=[
            _ScalarOneResult(session_obj),
            _MessagesResult([SimpleNamespace(role="user", content="What is MetaX?")]),
        ],
    )
    refund, reconcile, record_usage = (AsyncMock() for _ in range(3))
    reconcile.side_effect = RuntimeError("acct fail")
    persist_store: list = []
    _patch_common(
        monkeypatch,
        ledger_id,
        document_id,
        refund=refund,
        reconcile=reconcile,
        record_usage=record_usage,
        persist_store=persist_store,
    )
    monkeypatch.setattr(
        chat_service_module.claim_verifier_service,
        "verify",
        lambda *args, **kwargs: _PassVerificationReport(),
    )
    monkeypatch.setattr(
        chat_service_module,
        "_get_llm_client",
        lambda _m: SimpleNamespace(
            chat=SimpleNamespace(
                completions=SimpleNamespace(
                    create=AsyncMock(
                        return_value=_FiniteStream(
                            [
                                _FakeChunk("answer "),
                                _FakeChunk(
                                    None,
                                    finish_reason="length",
                                    usage=SimpleNamespace(prompt_tokens=10, completion_tokens=4),
                                ),
                            ]
                        )
                    )
                )
            )
        ),
    )
    settle_on_cancel = AsyncMock()
    monkeypatch.setattr(chat_service_module, "_settle_predebit_on_cancel", settle_on_cancel)

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

    assert any(e["event"] == "warn" and e["data"]["code"] == "ACCOUNTING_ERROR" for e in events)
    assert events[-1]["event"] == "done"
    assert settle_on_cancel.await_count == 1
    assert settle_on_cancel.await_args.kwargs["has_answer"] is True


@pytest.mark.asyncio
async def test_continue_stream_accounting_error_still_runs_fallback_settlement(monkeypatch):
    session_id, document_id, user_id, ledger_id, message_id = (uuid.uuid4() for _ in range(5))
    session_obj = SimpleNamespace(id=session_id, document_id=document_id, collection_id=None)
    doc_obj = SimpleNamespace(id=document_id, demo_slug=None, custom_instructions=None)
    chunk_id = uuid.uuid4()
    assistant_message = SimpleNamespace(
        id=message_id,
        role="assistant",
        session_id=session_id,
        citations=[{"chunk_id": str(chunk_id), "ref_index": 1}],
        content="base answer",
        continuation_count=0,
        output_tokens=5,
    )
    fake_chunk = SimpleNamespace(
        id=chunk_id,
        document_id=document_id,
        chunk_index=1,
        page_start=3,
        page_end=3,
        bboxes=[],
        text="MetaX revenue on page 3.",
        section_title="Section A",
    )
    db = _make_db(
        session_obj,
        doc_obj,
        assistant_message=assistant_message,
        execute_side_effect=[
            _ScalarOneResult(session_obj),
            _ScalarsResult([fake_chunk]),
            _MessagesResult([assistant_message]),
        ],
    )
    refund = AsyncMock()
    reconcile = AsyncMock(side_effect=RuntimeError("acct fail"))
    monkeypatch.setattr(chat_service_module.credit_service, "get_estimated_cost", lambda _m: 15)
    monkeypatch.setattr(
        chat_service_module.credit_service,
        "debit_credits",
        AsyncMock(return_value=ledger_id),
    )
    monkeypatch.setattr(chat_service_module.credit_service, "calculate_cost", lambda *a, **k: 3)
    monkeypatch.setattr(chat_service_module.credit_service, "reconcile_credits", reconcile)
    monkeypatch.setattr(chat_service_module.credit_service, "record_usage", AsyncMock())
    monkeypatch.setattr(chat_service_module, "_refund_predebit", refund)
    monkeypatch.setattr(
        chat_service_module.claim_verifier_service,
        "verify",
        lambda *args, **kwargs: _PassVerificationReport(),
    )
    monkeypatch.setattr(
        chat_service_module,
        "_get_llm_client",
        lambda _m: SimpleNamespace(
            chat=SimpleNamespace(
                completions=SimpleNamespace(
                    create=AsyncMock(
                        return_value=_FiniteStream(
                            [
                                _FakeChunk("continued "),
                                _FakeChunk(
                                    None,
                                    finish_reason="length",
                                    usage=SimpleNamespace(prompt_tokens=8, completion_tokens=3),
                                ),
                            ]
                        )
                    )
                )
            )
        ),
    )
    settle_on_cancel = AsyncMock()
    monkeypatch.setattr(chat_service_module, "_settle_predebit_on_cancel", settle_on_cancel)

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

    assert any(e["event"] == "warn" and e["data"]["code"] == "ACCOUNTING_ERROR" for e in events)
    assert events[-1]["event"] == "done"
    assert settle_on_cancel.await_count == 1
    assert settle_on_cancel.await_args.kwargs["has_answer"] is True
