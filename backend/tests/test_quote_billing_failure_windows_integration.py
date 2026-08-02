"""Real-Postgres integration tests for FIX-4 (Codex r1 IMPORTANT #4): both
billing paths' post-debit failure windows.

Mocked-db unit tests (test_quotes_api.py, test_quote_intent_routing.py)
already cover the LOGIC; these tests prove the SAME behavior against a real
database — real predebit rows, real reconcile failures, real refund
queries — per the reviewer's explicit request that mocks alone aren't
sufficient evidence for billing-critical cancellation/failure paths.

Requires docker (Postgres) — SKIP_INTEGRATION=1 (the default) skips this
whole file.
"""
from __future__ import annotations

import sys
import uuid
from pathlib import Path
from unittest.mock import AsyncMock

import pytest
from sqlalchemy import select

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

pytestmark = [pytest.mark.integration, pytest.mark.asyncio(loop_scope="session")]


async def _grant_credits(user_id: uuid.UUID, amount: int) -> None:
    from app.models.database import AsyncSessionLocal
    from app.services import credit_service

    async with AsyncSessionLocal() as db:
        await credit_service.credit_credits(db, user_id, amount, reason="test_grant")
        await db.commit()


async def _create_ready_document(user_id: uuid.UUID, *, demo_slug=None) -> uuid.UUID:
    from app.models.database import AsyncSessionLocal
    from app.models.tables import Document

    async with AsyncSessionLocal() as db:
        doc = Document(
            filename="integration-test.pdf",
            file_size=100,
            storage_key=f"documents/{uuid.uuid4()}/integration-test.pdf",
            status="ready",
            user_id=user_id,
            demo_slug=demo_slug,
        )
        db.add(doc)
        await db.commit()
        await db.refresh(doc)
        return doc.id


async def _ledger_rows_for_user(user_id: uuid.UUID):
    from app.models.database import AsyncSessionLocal
    from app.models.tables import CreditLedger

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(CreditLedger).where(CreditLedger.user_id == user_id))
        return list(result.scalars().all())


async def _current_balance(user_id: uuid.UUID) -> int:
    from app.models.database import AsyncSessionLocal
    from app.models.tables import User

    async with AsyncSessionLocal() as db:
        user = await db.get(User, user_id)
        return user.credits_balance


class TestRestReconcileFailureRefund:
    async def test_reconcile_failure_deletes_ledger_row_and_restores_balance(
        self, client, auth_user, auth_headers, monkeypatch,
    ) -> None:
        import app.api.quotes as quotes_api
        from app.services.quote_search_service import QuoteSearchResult

        await _grant_credits(auth_user.id, 500)
        document_id = await _create_ready_document(auth_user.id)
        # auth_user's create_user() (and the grant above) may already leave
        # ledger rows / a non-zero balance — assert the DELTA this test
        # causes, not absolute values.
        balance_before = await _current_balance(auth_user.id)
        ledger_ids_before = {row.id for row in await _ledger_rows_for_user(auth_user.id)}

        monkeypatch.setattr(
            quotes_api.quote_search_service, "quote_search",
            AsyncMock(return_value=QuoteSearchResult(
                cards=[], proposed=0, verified=0, discarded=[], scanned_chunks=1,
                usage=(10, 5), model="deepseek-v4-pro",
            )),
        )
        # reconcile_credits — INSIDE the guarded region after FIX-4 — is what fails.
        monkeypatch.setattr(
            quotes_api.credit_service, "reconcile_credits",
            AsyncMock(side_effect=RuntimeError("simulated reconcile failure")),
        )

        response = await client.post(
            f"/api/documents/{document_id}/quote-search",
            json={"topic": "climate risk"},
            headers=auth_headers,
        )

        assert response.status_code == 500

        ledger_ids_after = {row.id for row in await _ledger_rows_for_user(auth_user.id)}
        assert ledger_ids_after == ledger_ids_before  # the predebit row was deleted — refunded, no NEW row remains
        balance_after = await _current_balance(auth_user.id)
        assert balance_after == balance_before  # fully restored, no net charge


class TestChatReconcileFailureAfterPersist:
    async def test_ordinary_reconcile_failure_after_persist_charges_predebit(
        self, auth_user, monkeypatch,
    ) -> None:
        """Chat's inverse case: the answer commits BEFORE billing, so an
        ordinary reconcile failure after that persist must NOT refund —
        the predebit (15) stands as the final charge for a real, delivered,
        persisted answer."""
        import app.services.chat_service as chat_service_module
        from app.models.database import AsyncSessionLocal
        from app.models.tables import ChatSession, Message
        from app.services.quote_search_service import QuoteCard, QuoteSearchResult

        await _grant_credits(auth_user.id, 500)
        document_id = await _create_ready_document(auth_user.id)

        async with AsyncSessionLocal() as db:
            session = ChatSession(document_id=document_id, user_id=auth_user.id)
            db.add(session)
            await db.commit()
            await db.refresh(session)
            session_id = session.id

        monkeypatch.setattr(
            chat_service_module.credit_service, "reconcile_credits",
            AsyncMock(side_effect=RuntimeError("simulated reconcile failure")),
        )
        monkeypatch.setattr(chat_service_module.credit_service, "record_usage", AsyncMock())
        monkeypatch.setattr(
            chat_service_module, "_get_llm_client",
            lambda *_a, **_k: (_ for _ in ()).throw(AssertionError("normal LLM path must not run")),
        )
        card = QuoteCard(
            display_text="the exact clause text", page=1, page_end=1, bboxes=[],
            tier="exact", source_kind="page_text", chunk_id=str(uuid.uuid4()), score=100.0,
        )
        result = QuoteSearchResult(
            cards=[card], proposed=1, verified=1, discarded=[],
            scanned_chunks=2, usage=(300, 80), model="deepseek-v4-pro",
        )
        monkeypatch.setattr(chat_service_module.quote_search_service, "quote_search", AsyncMock(return_value=result))

        # auth_user's create_user() may already grant a starting balance and
        # leave ledger rows — assert the DELTA this test causes, not
        # absolute values.
        balance_before = await _current_balance(auth_user.id)
        ledger_ids_before = {row.id for row in await _ledger_rows_for_user(auth_user.id)}

        async with AsyncSessionLocal() as db:
            events = [
                event
                async for event in chat_service_module.chat_service.chat_stream(
                    session_id=session_id,
                    user_message="Give me a direct quote about the termination clause.",
                    db=db,
                    user=auth_user,
                    mode="balanced",
                )
            ]

        assert events[-1]["event"] == "error"
        assert events[-1]["data"]["code"] == "QUOTE_SEARCH_BILLING_INCOMPLETE"

        # The message WAS persisted (real row, real Postgres).
        async with AsyncSessionLocal() as verify_db:
            result = await verify_db.execute(
                select(Message).where(Message.session_id == session_id, Message.role == "assistant")
            )
            persisted = result.scalars().all()
        assert len(persisted) == 1

        # Predebit stands as the charge — balance dropped by exactly 15, no refund.
        balance_after = await _current_balance(auth_user.id)
        assert balance_after == balance_before - 15

        ledger_rows_after = await _ledger_rows_for_user(auth_user.id)
        new_rows = [row for row in ledger_rows_after if row.id not in ledger_ids_before]
        assert len(new_rows) == 1  # exactly one new row — the predebit, never refunded
        assert new_rows[0].delta == -15
