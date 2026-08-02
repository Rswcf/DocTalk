"""Tests for strict verbatim-quote chat-intent routing (B5, plan §8.4.3).

Two layers:
1. `action_planner.deterministic_plan` — the STRICT matcher (SEPARATE from the
   broad `_CITATION_RE`) must fire only on unambiguous direct-quote requests
   ("direct quote", "verbatim", "quote ... with page", 逐字引用, cita textual,
   ...) and NEVER on ordinary citation-quality questions ("where is this
   discussed", "what page is this on", bare "quote"/"source").
2. `chat_service.chat_stream` routing — when the strict intent fires in an
   AUTHED, non-demo, single-document session, the chat pipeline runs B3's
   verified quote_search instead of the normal LLM answer, bills through the
   SAME chat predebit/reconcile (no double-billing), and emits cards as a
   chat artifact + an honest empty-result message. Anonymous, demo, and
   collection sessions fall through to the untouched normal chat path even
   when the strict matcher fires.
"""
from __future__ import annotations

import asyncio
import sys
import uuid
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import app.services.chat_service as chat_service_module  # noqa: E402
from app.models.tables import ChatSession, Document, Message  # noqa: E402
from app.services.action_planner import ChatAction, deterministic_plan  # noqa: E402
from app.services.query_router import QueryIntent  # noqa: E402
from app.services.quote_search_service import QuoteCard, QuoteSearchResult  # noqa: E402

# ---------------------------------------------------------------------------
# Layer 1: strict matcher (pure, no DB/LLM)
# ---------------------------------------------------------------------------

class TestStrictQuoteMatcherPositives:
    @pytest.mark.parametrize(
        "message",
        [
            "Give me a direct quote about climate risk.",
            "I need the exact quotation on liability.",
            "Quote the clause verbatim.",
            "Can you quote the definition of force majeure, with the page number?",
            "What does it say word for word about termination?",
            "逐字引用一下关于责任的条款",
            "请给出原文引用，并注明页码",
            "这段话一字不差地是怎么写的？",
            "Necesito una cita textual sobre el riesgo climático.",
            "Copia tal cual la cláusula de fuerza mayor.",
            "¿Qué dice textualmente sobre la terminación?",
        ],
    )
    def test_strict_patterns_route_to_verified_quote_search(self, message: str) -> None:
        plan = deterministic_plan(message)
        assert plan.action == ChatAction.VERIFIED_QUOTE_SEARCH
        assert plan.confidence >= 0.78  # bypasses the LLM re-classification


class TestStrictQuoteMatcherNegatives:
    @pytest.mark.parametrize(
        "message",
        [
            "Where is this discussed in the document?",
            "What page is this on?",
            "What's the source for this claim?",
            "Can you cite where you got that?",
            "在哪页提到了这个？",
            "这个信息的出处是什么？",
            "Quote me a price for this service.",  # bare "quote", not a verbatim-text request
            "What is the citation format used here?",
            # ES: review round 1 SHOULD-FIX-1 — the un-anchored alternation
            # false-matched these ordinary interpretive questions before the
            # \b word-boundary fix ("textualmente" inside "Contextualmente",
            # "cita textual" inside "cita textualidad").
            "Contextualmente, ¿qué significa esto?",
            "Según cita textualidad del informe",
            "cita esta fuente, por favor",
            "¿Cuál es la fuente de esta cita?",
        ],
    )
    def test_broad_citation_language_does_not_trigger_strict_routing(self, message: str) -> None:
        plan = deterministic_plan(message)
        assert plan.action != ChatAction.VERIFIED_QUOTE_SEARCH


class TestStrictQuoteMatcherNegationAndMetalinguisticGuards:
    """FIX-5 (Codex r1 IMPORTANT #5): the matcher detected vocabulary, not
    affirmative intent — these five Codex r1 probes all incorrectly routed
    to the billed Quote Finder before this fix. A negation ("don't", "should
    not", "不要") or metalinguistic use ("translate the phrase X", "what does
    X mean", "qué significa") near the trigger word must suppress routing."""

    @pytest.mark.parametrize(
        "message",
        [
            "Don't quote this verbatim—explain it.",
            "The answer should not be a direct quote; summarize it.",
            "Translate the phrase exact quotation into Spanish.",
            "¿Qué significa la palabra textualmente?",
            "不要原文引用，请总结。",
        ],
    )
    def test_codex_r1_probes_do_not_route_to_quote_search(self, message: str) -> None:
        plan = deterministic_plan(message)
        assert plan.action != ChatAction.VERIFIED_QUOTE_SEARCH

    @pytest.mark.parametrize(
        "message",
        [
            "Give me a direct quote about the termination clause.",
            "Quote the clause verbatim.",
            "逐字引用一下关于责任的条款",
            "Necesito una cita textual sobre el riesgo climático.",
        ],
    )
    def test_affirmative_forms_still_route(self, message: str) -> None:
        """The guards must not be so broad they suppress genuine requests —
        none of these contain a negation or metalinguistic marker."""
        plan = deterministic_plan(message)
        assert plan.action == ChatAction.VERIFIED_QUOTE_SEARCH


class TestStrictQuoteMatcherNegationScopedToTrigger:
    """FIX2-C (Codex r2 #5, NOT ADDRESSED): the FIX-5 window-proximity guard
    suppressed on ANY nearby negation regardless of what it actually
    negates. "Give me a direct quote, without paraphrasing." has "without"
    near "direct quote", but "without" negates "paraphrasing", not the
    quote request — the message is an AFFIRMATIVE strict-quote request
    that also rules out paraphrasing. Negation must be scoped: when a
    paraphrase/summary-class token sits CLOSER to the negation than the
    quote trigger does, the negation governs that token, not the trigger,
    so strict routing STANDS."""

    @pytest.mark.parametrize(
        "message",
        [
            "Give me a direct quote, without paraphrasing.",
            "Never paraphrase; quote the clause verbatim.",
            "不要总结，请逐字引用责任条款。",
            "No la parafrasees; necesito una cita textual.",
        ],
    )
    def test_codex_r2_probes_still_route_to_quote_search(self, message: str) -> None:
        plan = deterministic_plan(message)
        assert plan.action == ChatAction.VERIFIED_QUOTE_SEARCH

    @pytest.mark.parametrize(
        "message",
        [
            "Don't quote this verbatim—explain it.",
            "The answer should not be a direct quote; summarize it.",
            "Translate the phrase exact quotation into Spanish.",
            "¿Qué significa la palabra textualmente?",
            "不要原文引用，请总结。",
        ],
    )
    def test_original_five_negatives_still_do_not_route(self, message: str) -> None:
        """The original FIX-5 negatives must remain negative — in every one
        of these, the negation directly precedes/governs the quote trigger
        itself (no closer paraphrase/summary token), so suppression is
        still correct."""
        plan = deterministic_plan(message)
        assert plan.action != ChatAction.VERIFIED_QUOTE_SEARCH


def test_verified_quote_search_uses_rag_answer_path() -> None:
    """Must fall through the setup/predebit code path in chat_stream (shared
    with ANSWER_WITH_RAG/CITATION_LOOKUP), not the tool-action early return —
    that's how it reuses the chat message's own two-stage debit."""
    plan = deterministic_plan("Give me a direct quote about climate risk.")
    assert plan.uses_rag_answer_path is True


# ---------------------------------------------------------------------------
# Layer 2: chat_stream routing (mirrors tests/test_chat_setup_refunds.py's
# fake-DB scaffolding — no docker/infra required)
# ---------------------------------------------------------------------------

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


class _FakeStream:
    def __init__(self, chunks):
        self._chunks = chunks

    def __aiter__(self):
        return self._iterate()

    async def _iterate(self):
        for chunk in self._chunks:
            yield chunk


def _make_db(session_obj, doc_obj, *, execute_side_effect=None):
    async def fake_get(model, _id):
        if model is Document:
            return doc_obj
        if model is ChatSession:
            return session_obj
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


def _quote_action_plan():
    return SimpleNamespace(
        action=ChatAction.VERIFIED_QUOTE_SEARCH,
        uses_rag_answer_path=True,
        confidence=0.9,
        reason="strict quote intent",
        user_visible_status="",
    )


def _base_session_and_doc(document_id, session_id, *, demo_slug=None):
    session_obj = SimpleNamespace(
        id=session_id, document_id=document_id, collection_id=None, title=None, domain_mode=None,
    )
    doc_obj = SimpleNamespace(id=document_id, demo_slug=demo_slug, custom_instructions=None, page_count=10)
    return session_obj, doc_obj


def _never_called(*_a, **_k):
    raise AssertionError("normal LLM path must not run for a routed quote search")


class TestAuthedRoutingEmitsArtifact:
    @pytest.mark.asyncio
    async def test_authed_single_doc_strict_intent_runs_quote_search_and_emits_artifact(
        self, monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        session_id = uuid.uuid4()
        document_id = uuid.uuid4()
        user_id = uuid.uuid4()
        ledger_id = uuid.uuid4()
        chunk_id = uuid.uuid4()
        session_obj, doc_obj = _base_session_and_doc(document_id, session_id)
        db = _make_db(session_obj, doc_obj, execute_side_effect=[_ScalarOneResult(session_obj)])

        monkeypatch.setattr(chat_service_module.action_planner, "plan", AsyncMock(return_value=_quote_action_plan()))
        monkeypatch.setattr(chat_service_module.credit_service, "get_estimated_cost", lambda _mode: 15)
        monkeypatch.setattr(chat_service_module.credit_service, "debit_credits", AsyncMock(return_value=ledger_id))
        reconcile_mock = AsyncMock()
        record_usage_mock = AsyncMock()
        monkeypatch.setattr(chat_service_module.credit_service, "reconcile_credits", reconcile_mock)
        monkeypatch.setattr(chat_service_module.credit_service, "record_usage", record_usage_mock)
        monkeypatch.setattr(chat_service_module.credit_service, "calculate_cost", lambda *_a, **_k: 6)
        monkeypatch.setattr(chat_service_module, "_get_llm_client", _never_called)

        card = QuoteCard(
            display_text="the exact clause text",
            page=3, page_end=3, bboxes=[], tier="exact",
            source_kind="page_text", chunk_id=str(chunk_id), score=100.0,
        )
        # proposed=3, verified=1 (one card survives dedup of 2 verified
        # duplicates from overlapping chunks), discarded=1 (one truly
        # rejected proposal). proposed - verified = 2 != len(discarded) = 1 —
        # deliberately chosen so a frontend re-deriving "discarded" as
        # proposed-verified would overcount; discarded_count must come from
        # the real discarded list (Wave F review MEDIUM-3).
        result = QuoteSearchResult(
            cards=[card], proposed=3, verified=1, discarded=[("not_located", "dropped", 0.0)],
            scanned_chunks=9, usage=(300, 80), model="deepseek-v4-pro",
        )
        quote_search_mock = AsyncMock(return_value=result)
        monkeypatch.setattr(chat_service_module.quote_search_service, "quote_search", quote_search_mock)

        events = [
            event
            async for event in chat_service_module.chat_service.chat_stream(
                session_id=session_id,
                user_message="Give me a direct quote about the termination clause.",
                db=db,
                user=SimpleNamespace(id=user_id, plan="pro"),
                mode="balanced",
            )
        ]

        event_types = [e["event"] for e in events]
        assert "artifact" in event_types
        assert event_types[-1] == "done"
        artifact = next(e for e in events if e["event"] == "artifact")
        assert artifact["data"]["artifact_type"] == "quote_search"
        # MEDIUM-2 (Wave F review): every other artifact producer uses
        # "succeeded"; ChatArtifactCard's isDone check relies on it.
        assert artifact["data"]["status"] == "succeeded"
        assert len(artifact["data"]["citations"]) == 1
        assert artifact["data"]["citations"][0]["chunk_id"] == str(chunk_id)
        # MEDIUM-3 (Wave F review): mirrors the REST response's
        # discarded_count = len(result.discarded), NOT proposed - verified
        # (which overcounts — see the result construction above).
        assert artifact["data"]["preview"]["discarded_count"] == 1

        quote_search_mock.assert_awaited_once()
        assert quote_search_mock.await_args.kwargs["topic"] == "Give me a direct quote about the termination clause."

        # Billing: the CHAT message's own predebit/reconcile — no separate quote-search debit.
        reconcile_mock.assert_awaited_once_with(db, user_id, ledger_id, 15, 6)
        record_usage_mock.assert_awaited_once()
        assert record_usage_mock.await_args.kwargs["prompt_tokens"] == 300
        assert record_usage_mock.await_args.kwargs["completion_tokens"] == 80

    @pytest.mark.asyncio
    async def test_verified_empty_yields_honest_message_no_artifact(
        self, monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        session_id = uuid.uuid4()
        document_id = uuid.uuid4()
        user_id = uuid.uuid4()
        ledger_id = uuid.uuid4()
        session_obj, doc_obj = _base_session_and_doc(document_id, session_id)
        db = _make_db(session_obj, doc_obj, execute_side_effect=[_ScalarOneResult(session_obj)])

        monkeypatch.setattr(chat_service_module.action_planner, "plan", AsyncMock(return_value=_quote_action_plan()))
        monkeypatch.setattr(chat_service_module.credit_service, "get_estimated_cost", lambda _mode: 15)
        monkeypatch.setattr(chat_service_module.credit_service, "debit_credits", AsyncMock(return_value=ledger_id))
        monkeypatch.setattr(chat_service_module.credit_service, "reconcile_credits", AsyncMock())
        monkeypatch.setattr(chat_service_module.credit_service, "record_usage", AsyncMock())
        monkeypatch.setattr(chat_service_module.credit_service, "calculate_cost", lambda *_a, **_k: 5)
        monkeypatch.setattr(chat_service_module, "_get_llm_client", _never_called)

        empty_result = QuoteSearchResult(
            cards=[], proposed=2, verified=0, discarded=[("not_located", "dropped", 0.0)],
            scanned_chunks=14, usage=(250, 40), model="deepseek-v4-pro",
        )
        monkeypatch.setattr(
            chat_service_module.quote_search_service, "quote_search", AsyncMock(return_value=empty_result)
        )

        events = [
            event
            async for event in chat_service_module.chat_service.chat_stream(
                session_id=session_id,
                user_message="Give me a verbatim quote about warranties.",
                db=db,
                user=SimpleNamespace(id=user_id, plan="pro"),
                mode="balanced",
            )
        ]

        event_types = [e["event"] for e in events]
        assert "artifact" not in event_types  # no cards -> no artifact
        token_events = [e for e in events if e["event"] == "token"]
        assert token_events, "must still emit an honest text answer"
        combined_text = "".join(e["data"]["text"] for e in token_events)
        assert "14" in combined_text  # scanned-count transparency (§8.6)
        # Never claim an unverified fallback answer.
        assert "the exact clause" not in combined_text

    @pytest.mark.asyncio
    async def test_late_cancellation_after_reconcile_does_not_double_refund(
        self, monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """A client disconnect injected AFTER reconcile_credits has already
        committed (i.e. during the final SSE yields) must NOT ALSO trigger
        the setup-cancellation handler's full refund — that would hand back
        the predebit on top of an already-correct reconcile. Mirrors the
        `settled` guard the main RAG path already relies on for the exact
        same race (see credit_service.reconcile_credits call sites)."""
        session_id = uuid.uuid4()
        document_id = uuid.uuid4()
        user_id = uuid.uuid4()
        ledger_id = uuid.uuid4()
        session_obj, doc_obj = _base_session_and_doc(document_id, session_id)
        db = _make_db(session_obj, doc_obj, execute_side_effect=[_ScalarOneResult(session_obj)])

        monkeypatch.setattr(chat_service_module.action_planner, "plan", AsyncMock(return_value=_quote_action_plan()))
        monkeypatch.setattr(chat_service_module.credit_service, "get_estimated_cost", lambda _mode: 15)
        monkeypatch.setattr(chat_service_module.credit_service, "debit_credits", AsyncMock(return_value=ledger_id))
        monkeypatch.setattr(chat_service_module.credit_service, "reconcile_credits", AsyncMock())
        monkeypatch.setattr(chat_service_module.credit_service, "record_usage", AsyncMock())
        monkeypatch.setattr(chat_service_module.credit_service, "calculate_cost", lambda *_a, **_k: 6)
        monkeypatch.setattr(chat_service_module, "_get_llm_client", _never_called)

        card = QuoteCard(
            display_text="the exact clause text", page=3, page_end=3, bboxes=[],
            tier="exact", source_kind="page_text", chunk_id=str(uuid.uuid4()), score=100.0,
        )
        result = QuoteSearchResult(
            cards=[card], proposed=1, verified=1, discarded=[],
            scanned_chunks=9, usage=(300, 80), model="deepseek-v4-pro",
        )
        monkeypatch.setattr(chat_service_module.quote_search_service, "quote_search", AsyncMock(return_value=result))

        settle_mock = AsyncMock()
        monkeypatch.setattr(chat_service_module, "_settle_predebit_on_cancel", settle_mock)

        agen = chat_service_module.chat_service.chat_stream(
            session_id=session_id,
            user_message="Give me a direct quote about the termination clause.",
            db=db,
            user=SimpleNamespace(id=user_id, plan="pro"),
            mode="balanced",
        )
        # Advance past reconcile (which happens before ANY yield in
        # _run_verified_quote_search) through the artifact + token events —
        # by the time we've consumed "token", settled is already True.
        seen_types = []
        while True:
            ev = await agen.__anext__()
            seen_types.append(ev["event"])
            if ev["event"] == "token":
                break

        with pytest.raises(asyncio.CancelledError):
            await agen.athrow(asyncio.CancelledError())

        settle_mock.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_chat_stream_cancellation_during_atomic_commit_calls_new_settlement_with_candidate_id(
        self, monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """FIX2-B(a)/(c) (Codex r2 #4, NOT ADDRESSED): message-persist +
        reconcile + usage-record are now ONE atomic commit — a CancelledError
        landing WHILE that commit's own await is in flight (simulated here
        by making db.commit() itself raise) is the genuinely ambiguous
        window the fix targets. Wiring test: chat_stream's CancelledError
        handler must call the NEW _settle_verified_quote_predebit_on_cancel
        (which resolves the ambiguity by checking the DB directly) with a
        non-None candidate_message_id — NOT the generic
        _settle_predebit_on_cancel, which would blindly re-reconcile.
        _settle_verified_quote_predebit_on_cancel's own DB-resolution logic
        is unit-tested directly in TestSettleVerifiedQuotePredebitOnCancel
        below."""
        session_id = uuid.uuid4()
        document_id = uuid.uuid4()
        user_id = uuid.uuid4()
        ledger_id = uuid.uuid4()
        session_obj, doc_obj = _base_session_and_doc(document_id, session_id)
        db = _make_db(session_obj, doc_obj, execute_side_effect=[_ScalarOneResult(session_obj)])

        monkeypatch.setattr(chat_service_module.action_planner, "plan", AsyncMock(return_value=_quote_action_plan()))
        monkeypatch.setattr(chat_service_module.credit_service, "get_estimated_cost", lambda _mode: 15)
        monkeypatch.setattr(chat_service_module.credit_service, "debit_credits", AsyncMock(return_value=ledger_id))
        monkeypatch.setattr(chat_service_module.credit_service, "reconcile_credits", AsyncMock(return_value=9))
        monkeypatch.setattr(chat_service_module.credit_service, "record_usage", AsyncMock())
        monkeypatch.setattr(chat_service_module.credit_service, "calculate_cost", lambda *_a, **_k: 6)
        monkeypatch.setattr(chat_service_module, "_get_llm_client", _never_called)
        # db.commit() is called 3 times in setup BEFORE the strict route
        # even starts (user-message/title persist, then predebit) and once
        # more for _run_verified_quote_search's own atomic commit — only
        # THAT 4th call is the ambiguous window this fix targets, so the
        # earlier 3 succeed normally and only the 4th raises.
        commit_calls = {"n": 0}

        async def _commit_side_effect():
            commit_calls["n"] += 1
            if commit_calls["n"] >= 4:
                raise asyncio.CancelledError()

        db.commit = AsyncMock(side_effect=_commit_side_effect)

        card = QuoteCard(
            display_text="the exact clause text", page=3, page_end=3, bboxes=[],
            tier="exact", source_kind="page_text", chunk_id=str(uuid.uuid4()), score=100.0,
        )
        result = QuoteSearchResult(
            cards=[card], proposed=1, verified=1, discarded=[],
            scanned_chunks=9, usage=(300, 80), model="deepseek-v4-pro",
        )
        monkeypatch.setattr(chat_service_module.quote_search_service, "quote_search", AsyncMock(return_value=result))

        settle_mock = AsyncMock()
        monkeypatch.setattr(chat_service_module, "_settle_verified_quote_predebit_on_cancel", settle_mock)
        old_generic_settle_mock = AsyncMock()
        monkeypatch.setattr(chat_service_module, "_settle_predebit_on_cancel", old_generic_settle_mock)

        agen = chat_service_module.chat_service.chat_stream(
            session_id=session_id,
            user_message="Give me a direct quote about the termination clause.",
            db=db,
            user=SimpleNamespace(id=user_id, plan="pro"),
            mode="balanced",
        )
        with pytest.raises(asyncio.CancelledError):
            await agen.__anext__()

        settle_mock.assert_awaited_once()
        assert settle_mock.await_args.kwargs["user_id"] == user_id
        assert settle_mock.await_args.kwargs["pre_debited"] == 15
        assert settle_mock.await_args.kwargs["predebit_ledger_id"] == ledger_id
        # candidate_message_id was recorded BEFORE the commit was attempted —
        # always known regardless of whether the commit itself landed.
        assert settle_mock.await_args.kwargs["candidate_message_id"] is not None
        # NOT the generic helper — that would blindly re-reconcile a
        # transaction that may (or may not) have already landed.
        old_generic_settle_mock.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_ordinary_reconcile_failure_never_persists_and_fully_refunds(
        self, monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """FIX2-B(a) (Codex r2 #4, NOT ADDRESSED): message-persist + reconcile
        + usage-record are now ONE ATOMIC commit — an ORDINARY
        (non-cancellation) reconcile_credits failure means db.commit() is
        NEVER REACHED, so nothing landed. This must now reach the generic
        setup-phase handler and issue a FULL REFUND — the OLD "predebit
        stands, the answer was already persisted" outcome required a
        separate, already-committed message-persist step that no longer
        exists (that was precisely the free-ride window Codex r2 found)."""
        session_id = uuid.uuid4()
        document_id = uuid.uuid4()
        user_id = uuid.uuid4()
        ledger_id = uuid.uuid4()
        session_obj, doc_obj = _base_session_and_doc(document_id, session_id)
        db = _make_db(session_obj, doc_obj, execute_side_effect=[_ScalarOneResult(session_obj)])

        monkeypatch.setattr(chat_service_module.action_planner, "plan", AsyncMock(return_value=_quote_action_plan()))
        monkeypatch.setattr(chat_service_module.credit_service, "get_estimated_cost", lambda _mode: 15)
        monkeypatch.setattr(chat_service_module.credit_service, "debit_credits", AsyncMock(return_value=ledger_id))
        # reconcile_credits fails with an ORDINARY exception (not CancelledError).
        monkeypatch.setattr(
            chat_service_module.credit_service, "reconcile_credits",
            AsyncMock(side_effect=RuntimeError("db blip")),
        )
        record_usage_mock = AsyncMock()
        monkeypatch.setattr(chat_service_module.credit_service, "record_usage", record_usage_mock)
        monkeypatch.setattr(chat_service_module.credit_service, "calculate_cost", lambda *_a, **_k: 6)
        monkeypatch.setattr(chat_service_module, "_get_llm_client", _never_called)
        refund_mock = AsyncMock()
        monkeypatch.setattr(chat_service_module, "_refund_predebit", refund_mock)

        card = QuoteCard(
            display_text="the exact clause text", page=3, page_end=3, bboxes=[],
            tier="exact", source_kind="page_text", chunk_id=str(uuid.uuid4()), score=100.0,
        )
        result = QuoteSearchResult(
            cards=[card], proposed=1, verified=1, discarded=[],
            scanned_chunks=9, usage=(300, 80), model="deepseek-v4-pro",
        )
        monkeypatch.setattr(chat_service_module.quote_search_service, "quote_search", AsyncMock(return_value=result))

        events = [
            event
            async for event in chat_service_module.chat_service.chat_stream(
                session_id=session_id,
                user_message="Give me a direct quote about the termination clause.",
                db=db,
                user=SimpleNamespace(id=user_id, plan="pro"),
                mode="balanced",
            )
        ]

        assert events[-1]["event"] == "error"
        assert events[-1]["data"]["code"] == "QUOTE_SEARCH_ERROR"
        # reconcile_credits raised BEFORE record_usage or the atomic commit
        # were ever reached — proves the atomic block never landed (the
        # message add() before it was therefore never actually persisted).
        record_usage_mock.assert_not_awaited()
        # Full refund via the generic setup-phase handler.
        refund_mock.assert_awaited_once()
        assert refund_mock.await_args.args[1] == user_id
        assert refund_mock.await_args.args[3] == ledger_id


class _FakeSettleSession:
    """Stand-in for the INDEPENDENT AsyncSessionLocal
    _settle_verified_quote_predebit_on_cancel opens — controls whether the
    candidate message id "landed" (simulating the real-DB outcome of an
    ambiguous atomic commit)."""

    def __init__(self, *, message_found: bool):
        self._message_found = message_found

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def get(self, model, obj_id):
        if model is Message and self._message_found:
            return SimpleNamespace(id=obj_id)
        return None


class TestSettleVerifiedQuotePredebitOnCancel:
    """FIX2-B(c) (Codex r2 #4, NOT ADDRESSED): direct unit coverage for the
    ambiguous-commit resolver. A CancelledError landing WHILE
    _run_verified_quote_search's single atomic commit is in flight cannot
    be resolved by trusting progress.message_id alone — that IS the
    ambiguity (the commit may have landed on the DB even though our await
    never returned). This function resolves it by querying, via an
    independent session, whether the candidate message id (known BEFORE the
    commit was even attempted) now exists as a real row."""

    @pytest.mark.asyncio
    async def test_candidate_message_found_means_commit_landed_no_refund(self, monkeypatch):
        monkeypatch.setattr(
            chat_service_module, "AsyncSessionLocal", lambda: _FakeSettleSession(message_found=True),
        )
        refund_mock = AsyncMock()
        monkeypatch.setattr(chat_service_module, "_refund_predebit", refund_mock)

        await chat_service_module._settle_verified_quote_predebit_on_cancel(
            user_id=uuid.uuid4(), pre_debited=15, predebit_ledger_id=uuid.uuid4(),
            candidate_message_id=uuid.uuid4(),
        )

        refund_mock.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_candidate_message_not_found_means_commit_never_landed_refunds(self, monkeypatch):
        monkeypatch.setattr(
            chat_service_module, "AsyncSessionLocal", lambda: _FakeSettleSession(message_found=False),
        )
        refund_mock = AsyncMock()
        monkeypatch.setattr(chat_service_module, "_refund_predebit", refund_mock)
        user_id = uuid.uuid4()
        ledger_id = uuid.uuid4()

        await chat_service_module._settle_verified_quote_predebit_on_cancel(
            user_id=user_id, pre_debited=15, predebit_ledger_id=ledger_id,
            candidate_message_id=uuid.uuid4(),
        )

        refund_mock.assert_awaited_once()
        assert refund_mock.await_args.args[1] == user_id
        assert refund_mock.await_args.args[3] == ledger_id

    @pytest.mark.asyncio
    async def test_no_candidate_message_id_at_all_refunds(self, monkeypatch):
        """CancelledError struck before even the candidate id was generated
        (e.g. inside quote_search() itself) — nothing to check, must refund."""
        monkeypatch.setattr(
            chat_service_module, "AsyncSessionLocal", lambda: _FakeSettleSession(message_found=True),
        )
        refund_mock = AsyncMock()
        monkeypatch.setattr(chat_service_module, "_refund_predebit", refund_mock)

        await chat_service_module._settle_verified_quote_predebit_on_cancel(
            user_id=uuid.uuid4(), pre_debited=15, predebit_ledger_id=uuid.uuid4(),
            candidate_message_id=None,
        )

        refund_mock.assert_awaited_once()


class TestUngatedContextsFallThroughToNormalChat:
    @pytest.mark.asyncio
    async def test_anonymous_user_falls_through_to_normal_chat(
        self, monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        session_id = uuid.uuid4()
        document_id = uuid.uuid4()
        session_obj, doc_obj = _base_session_and_doc(document_id, session_id)
        db = _make_db(
            session_obj, doc_obj,
            execute_side_effect=[
                _ScalarOneResult(session_obj),
                _MessagesResult([SimpleNamespace(role="user", content="Give me a direct quote.")]),
            ],
        )

        monkeypatch.setattr(chat_service_module.action_planner, "plan", AsyncMock(return_value=_quote_action_plan()))
        monkeypatch.setattr(
            chat_service_module.query_router, "route",
            lambda *_a, **_k: SimpleNamespace(primary_intent=QueryIntent.LOCAL_QA),
        )
        monkeypatch.setattr(
            chat_service_module.corrective_retrieval_service, "retrieve_single",
            AsyncMock(return_value=SimpleNamespace(retrieved=[], strategy="semantic_top_k", evaluation=None, plan=None)),
        )
        quote_search_mock = AsyncMock()
        monkeypatch.setattr(chat_service_module.quote_search_service, "quote_search", quote_search_mock)

        create = AsyncMock(
            return_value=_FakeStream([
                _FakeChunk("A normal answer."),
                _FakeChunk(None, finish_reason="stop", usage=SimpleNamespace(prompt_tokens=10, completion_tokens=5)),
            ])
        )
        fake_client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
        monkeypatch.setattr(chat_service_module, "_get_llm_client", lambda _model: fake_client)

        events = [
            event
            async for event in chat_service_module.chat_service.chat_stream(
                session_id=session_id,
                user_message="Give me a direct quote.",
                db=db,
                user=None,  # anonymous — demo doc has no demo_slug here but user=None still gates it off
                mode="quick",
            )
        ]

        assert events[-1]["event"] == "done"
        quote_search_mock.assert_not_awaited()  # untouched chat path, byte-for-byte
        create.assert_awaited()  # normal LLM path DID run

    @pytest.mark.asyncio
    async def test_demo_document_falls_through_to_normal_chat(
        self, monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        session_id = uuid.uuid4()
        document_id = uuid.uuid4()
        user_id = uuid.uuid4()
        ledger_id = uuid.uuid4()
        session_obj, doc_obj = _base_session_and_doc(document_id, session_id, demo_slug="attention-paper")
        db = _make_db(
            session_obj, doc_obj,
            execute_side_effect=[
                _ScalarOneResult(session_obj),
                _MessagesResult([SimpleNamespace(role="user", content="Give me a direct quote.")]),
            ],
        )

        monkeypatch.setattr(chat_service_module.action_planner, "plan", AsyncMock(return_value=_quote_action_plan()))
        monkeypatch.setattr(
            chat_service_module.query_router, "route",
            lambda *_a, **_k: SimpleNamespace(primary_intent=QueryIntent.LOCAL_QA),
        )
        monkeypatch.setattr(
            chat_service_module.corrective_retrieval_service, "retrieve_single",
            AsyncMock(return_value=SimpleNamespace(retrieved=[], strategy="semantic_top_k", evaluation=None, plan=None)),
        )
        monkeypatch.setattr(chat_service_module.credit_service, "get_estimated_cost", lambda _mode: 15)
        monkeypatch.setattr(chat_service_module.credit_service, "debit_credits", AsyncMock(return_value=ledger_id))
        quote_search_mock = AsyncMock()
        monkeypatch.setattr(chat_service_module.quote_search_service, "quote_search", quote_search_mock)

        create = AsyncMock(
            return_value=_FakeStream([
                _FakeChunk("A normal answer."),
                _FakeChunk(None, finish_reason="stop", usage=SimpleNamespace(prompt_tokens=10, completion_tokens=5)),
            ])
        )
        fake_client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
        monkeypatch.setattr(chat_service_module, "_get_llm_client", lambda _model: fake_client)

        events = [
            event
            async for event in chat_service_module.chat_service.chat_stream(
                session_id=session_id,
                user_message="Give me a direct quote.",
                db=db,
                user=SimpleNamespace(id=user_id, plan="free"),
                mode="quick",
            )
        ]

        assert events[-1]["event"] == "done"
        quote_search_mock.assert_not_awaited()
        create.assert_awaited()
