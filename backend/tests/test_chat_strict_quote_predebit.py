"""Tests for FIX-3 (Codex r1 BLOCKER #3): predebit must reflect the balanced
quote engine, not the user-selected chat mode.

A strict-routed message ALWAYS runs quote_search_service's balanced-model
pipeline regardless of `mode="quick"` — both the REST endpoint's optimistic
pre-check (app/api/chat.py) and chat_service's own predebit must charge the
balanced estimate (15), not quick's (5), or a low-balance user could pass a
quick-mode pre-check and have reconciliation push their account negative to
cover the overrun.
"""
from __future__ import annotations

import sys
import uuid
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import app.api.chat as chat_api  # noqa: E402
import app.services.chat_service as chat_service_module  # noqa: E402
from app.models.tables import ChatSession, Document, Message  # noqa: E402
from app.schemas.chat import ChatRequest  # noqa: E402
from app.services.action_planner import ChatAction  # noqa: E402


def _session(*, demo_slug=None, is_collection=False, document_id=None, user_id=None):
    doc = None if is_collection else SimpleNamespace(id=document_id or uuid.uuid4(), demo_slug=demo_slug, status="ready")
    return SimpleNamespace(
        id=uuid.uuid4(),
        document=doc,
        document_id=None if is_collection else doc.id,
        collection_id=uuid.uuid4() if is_collection else None,
        user_id=user_id,
    )


class TestChatStrictQuoteRoutedPredicate:
    """Pure unit coverage — no I/O — for the shared gate used by both the
    REST pre-check and chat_service's own predebit decision."""

    def test_strict_message_on_single_authed_document_routes(self):
        session = _session()
        assert chat_api._chat_strict_quote_routed(
            session, "Give me a direct quote about the termination clause."
        ) is True

    def test_ordinary_message_does_not_route(self):
        session = _session()
        assert chat_api._chat_strict_quote_routed(session, "What does this document say about pricing?") is False

    def test_demo_document_does_not_route_even_with_strict_message(self):
        session = _session(demo_slug="attention-paper")
        assert chat_api._chat_strict_quote_routed(
            session, "Give me a direct quote about attention mechanisms."
        ) is False

    def test_collection_session_does_not_route_even_with_strict_message(self):
        session = _session(is_collection=True)
        assert chat_api._chat_strict_quote_routed(
            session, "Give me a direct quote about the termination clause."
        ) is False


class TestRestEndpointPreCheckUsesBalancedEstimate:
    @pytest.mark.asyncio
    async def test_quick_mode_strict_message_balance_10_gets_402_at_balanced_rate(
        self, monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """quick predebit=5, balanced predebit=15 — balance 10 must fail the
        strict-routed pre-check (needs 15) even though quick mode alone
        would have passed it (5 <= 10)."""
        session = _session()
        monkeypatch.setattr(chat_api, "verify_session_access", AsyncMock(return_value=session))
        monkeypatch.setattr(chat_api, "enforce_free_mode_limits", AsyncMock())
        monkeypatch.setattr(chat_api.credit_service, "get_user_credits", AsyncMock(return_value=10))
        monkeypatch.setattr(chat_api.auth_chat_limiter, "is_allowed", AsyncMock(return_value=True))
        import app.services.credit_service as credit_service_module
        monkeypatch.setattr(credit_service_module, "ensure_monthly_credits", AsyncMock())

        user = SimpleNamespace(id=uuid.uuid4(), plan="pro")
        db = SimpleNamespace(commit=AsyncMock())
        body = ChatRequest(message="Give me a direct quote about the termination clause.", mode="quick")

        with pytest.raises(Exception) as exc_info:
            await chat_api.chat_stream(
                session_id=session.id, body=body,
                request=SimpleNamespace(headers={}, client=None),
                user=user, db=db,
            )

        assert exc_info.value.status_code == 402
        assert exc_info.value.detail["required"] == 15
        assert exc_info.value.detail["balance"] == 10

    @pytest.mark.asyncio
    async def test_quick_mode_strict_message_balance_20_passes_pre_check(
        self, monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """balance 20 covers the balanced rate (15) even though the request
        selected quick mode — pre-check must pass (proceeds to stream)."""
        session = _session()
        monkeypatch.setattr(chat_api, "verify_session_access", AsyncMock(return_value=session))
        monkeypatch.setattr(chat_api, "enforce_free_mode_limits", AsyncMock())
        monkeypatch.setattr(chat_api.credit_service, "get_user_credits", AsyncMock(return_value=20))
        monkeypatch.setattr(chat_api.auth_chat_limiter, "is_allowed", AsyncMock(return_value=True))
        import app.services.credit_service as credit_service_module
        monkeypatch.setattr(credit_service_module, "ensure_monthly_credits", AsyncMock())

        async def fake_chat_stream(*_a, **_k):
            yield {"event": "done", "data": {}}

        monkeypatch.setattr(chat_api.chat_service, "chat_stream", fake_chat_stream)

        user = SimpleNamespace(id=uuid.uuid4(), plan="pro")
        db = SimpleNamespace(commit=AsyncMock())
        body = ChatRequest(message="Give me a direct quote about the termination clause.", mode="quick")

        response = await chat_api.chat_stream(
            session_id=session.id, body=body,
            request=SimpleNamespace(headers={}, client=None),
            user=user, db=db,
        )

        # No exception raised -> pre-check passed; response is the SSE stream.
        assert response is not None


class TestChatServicePredebitsBalancedRateForStrictMessages:
    """chat_service.py's OWN predebit (the one that actually commits a
    ledger row) must ALSO use the balanced estimate for a strict-routed
    message — the REST pre-check above is only optimistic."""

    @pytest.mark.asyncio
    async def test_quick_mode_strict_message_predebits_15_not_5(self, monkeypatch: pytest.MonkeyPatch) -> None:
        session_id = uuid.uuid4()
        document_id = uuid.uuid4()
        user_id = uuid.uuid4()
        ledger_id = uuid.uuid4()

        class _ScalarOneResult:
            def __init__(self, value):
                self._value = value

            def scalar_one_or_none(self):
                return self._value

        session_obj = SimpleNamespace(
            id=session_id, document_id=document_id, collection_id=None, title=None, domain_mode=None,
        )
        doc_obj = SimpleNamespace(id=document_id, demo_slug=None, custom_instructions=None, page_count=10)

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

        db = SimpleNamespace(
            execute=AsyncMock(side_effect=[_ScalarOneResult(session_obj)]),
            get=AsyncMock(side_effect=fake_get),
            add=add,
            added=added,
            commit=AsyncMock(),
            rollback=AsyncMock(),
        )

        monkeypatch.setattr(
            chat_service_module.action_planner, "plan",
            AsyncMock(return_value=SimpleNamespace(
                action=ChatAction.VERIFIED_QUOTE_SEARCH, uses_rag_answer_path=True,
                confidence=0.88, reason="strict verbatim-quote markers", user_visible_status="",
            )),
        )
        debit_mock = AsyncMock(return_value=ledger_id)
        monkeypatch.setattr(chat_service_module.credit_service, "debit_credits", debit_mock)
        monkeypatch.setattr(chat_service_module.credit_service, "reconcile_credits", AsyncMock())
        monkeypatch.setattr(chat_service_module.credit_service, "record_usage", AsyncMock())
        monkeypatch.setattr(chat_service_module.credit_service, "calculate_cost", lambda *_a, **_k: 6)
        monkeypatch.setattr(chat_service_module, "_get_llm_client", lambda *_a, **_k: (_ for _ in ()).throw(AssertionError("normal LLM path must not run")))

        from app.services.quote_search_service import QuoteSearchResult
        monkeypatch.setattr(
            chat_service_module.quote_search_service, "quote_search",
            AsyncMock(return_value=QuoteSearchResult(
                cards=[], proposed=0, verified=0, discarded=[], scanned_chunks=3,
                usage=(100, 20), model="deepseek-v4-pro",
            )),
        )

        events = [
            event
            async for event in chat_service_module.chat_service.chat_stream(
                session_id=session_id,
                user_message="Give me a direct quote about the termination clause.",
                db=db,
                user=SimpleNamespace(id=user_id, plan="free"),
                mode="quick",  # <-- user selected quick, but strict routing forces balanced billing
            )
        ]

        assert events[-1]["event"] == "done"
        debit_mock.assert_awaited_once()
        assert debit_mock.await_args.kwargs["cost"] == 15
        assert debit_mock.await_args.kwargs["reason"] == "chat"
