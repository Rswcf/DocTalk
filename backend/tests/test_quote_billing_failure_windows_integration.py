"""Real-Postgres integration tests for FIX-4 (Codex r1 IMPORTANT #4) and
FIX2-B (Codex r2 #4, NOT ADDRESSED): both billing paths' post-debit failure
AND ambiguous-cancellation-during-commit windows.

Mocked-db unit tests (test_quotes_api.py, test_quote_intent_routing.py)
already cover the LOGIC; these tests prove the SAME behavior against a real
database — real predebit rows, real reconcile failures, real refund
queries — per the reviewer's explicit request that mocks alone aren't
sufficient evidence for billing-critical cancellation/failure paths.

FIX2-B note on "cancellation during commit": genuinely interrupting an
in-flight asyncpg COMMIT so that it lands on the server while the Python
await still raises CancelledError is a real network race that cannot be
reproduced deterministically in a test (it would require literally racing
connection-level timing). What CAN and must be proven against real
Postgres is the RESOLUTION LOGIC itself — that the settlement helpers
correctly distinguish "the row exists" from "the row doesn't exist" when
given real committed rows and real absent rows. The
TestChat/RestAmbiguousCommitResolution classes below do exactly that: one
case runs the real atomic commit to completion (proving `landed` resolves
correctly against genuine committed state) and one case never lets it
land (proving `not landed` resolves correctly and refunds exactly).

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
    async def test_ordinary_reconcile_failure_never_persists_and_fully_refunds(
        self, auth_user, monkeypatch,
    ) -> None:
        """FIX2-B(a) (Codex r2 #4, NOT ADDRESSED — supersedes the old
        "predebit stands" test): message-persist + reconcile + usage-record
        are now ONE ATOMIC commit, so an ORDINARY reconcile failure means
        db.commit() is NEVER REACHED — nothing lands, real Postgres included.
        This must now fully refund via the generic setup-phase handler; the
        OLD "predebit stands, answer already persisted" outcome required a
        separate, already-committed message-persist step that no longer
        exists (that separate-commit window was exactly the Codex r2 free-
        ride finding)."""
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
        assert events[-1]["data"]["code"] == "QUOTE_SEARCH_ERROR"

        # The message was NEVER persisted — real Postgres, real transaction
        # rollback (db.add() alone, without a landed commit, leaves no row).
        async with AsyncSessionLocal() as verify_db:
            result = await verify_db.execute(
                select(Message).where(Message.session_id == session_id, Message.role == "assistant")
            )
            persisted = result.scalars().all()
        assert persisted == []

        # Fully refunded — balance and ledger rows exactly restored.
        balance_after = await _current_balance(auth_user.id)
        assert balance_after == balance_before

        ledger_ids_after = {row.id for row in await _ledger_rows_for_user(auth_user.id)}
        assert ledger_ids_after == ledger_ids_before  # predebit row deleted, no new row remains


class TestChatAmbiguousCommitResolution:
    """FIX2-B(a)/(c) (Codex r2 #4, NOT ADDRESSED): chat's cancellation
    resolver for a CancelledError landing WHILE _run_verified_quote_search's
    single atomic commit is in flight — proven against REAL Postgres rows,
    not mocks. See the module docstring for why "landed" and "not landed"
    are tested as two real end-states rather than a literally-interrupted
    commit (not deterministically reproducible)."""

    async def test_landed_commit_resolves_to_no_refund_exact_ledger_state(self, auth_user) -> None:
        """The atomic commit (message + reconcile + usage) actually ran to
        completion for real — the resolver, given that message's REAL id,
        must recognize it landed and must NOT refund; the ledger row must
        remain at its RECONCILED delta, never restored to the raw predebit."""
        import app.services.chat_service as chat_service_module
        from app.models.database import AsyncSessionLocal
        from app.models.tables import ChatSession, Message
        from app.services import credit_service

        await _grant_credits(auth_user.id, 500)
        document_id = await _create_ready_document(auth_user.id)

        async with AsyncSessionLocal() as db:
            session = ChatSession(document_id=document_id, user_id=auth_user.id)
            db.add(session)
            await db.commit()
            await db.refresh(session)
            session_id = session.id

        balance_before = await _current_balance(auth_user.id)

        async with AsyncSessionLocal() as db:
            ledger_id = await credit_service.debit_credits(
                db, user_id=auth_user.id, cost=15, reason="chat", ref_type="mode", ref_id="balanced",
            )
            await db.commit()

        # Reproduce _run_verified_quote_search's atomic block for real:
        # message + reconcile + record_usage, ONE commit that genuinely lands.
        message_id = uuid.uuid4()
        async with AsyncSessionLocal() as db:
            asst_msg = Message(
                id=message_id, session_id=session_id, role="assistant",
                content="the exact clause text", metadata_json={},
            )
            db.add(asst_msg)
            await credit_service.reconcile_credits(db, auth_user.id, ledger_id, 15, 9)
            await credit_service.record_usage(
                db, user_id=auth_user.id, message_id=message_id, model="deepseek-v4-pro",
                prompt_tokens=300, completion_tokens=80, cost_credits=9,
            )
            await db.commit()

        # Simulate the cancellation handler running AFTER the fact — exactly
        # as if the caller's own `await db.commit()` had raised
        # CancelledError despite this commit having genuinely succeeded.
        await chat_service_module._settle_verified_quote_predebit_on_cancel(
            user_id=auth_user.id, pre_debited=15, predebit_ledger_id=ledger_id,
            candidate_message_id=message_id,
        )

        # No refund — balance reflects the RECONCILED cost (9), not restored
        # to pre-search, and definitely not double-refunded on top of it.
        balance_after = await _current_balance(auth_user.id)
        assert balance_after == balance_before - 9

        ledger_rows_after = await _ledger_rows_for_user(auth_user.id)
        reconciled_row = next(r for r in ledger_rows_after if r.id == ledger_id)
        assert reconciled_row.delta == -9  # untouched — still the reconciled amount

    async def test_never_landed_commit_resolves_to_full_refund_exact_ledger_state(self, auth_user) -> None:
        """candidate_message_id was generated but the atomic commit never
        ran (simulating a CancelledError that struck before it) — the
        resolver, finding no such Message row, must refund the full
        predebit and leave no trace of the ledger row."""
        import app.services.chat_service as chat_service_module
        from app.models.database import AsyncSessionLocal
        from app.services import credit_service

        await _grant_credits(auth_user.id, 500)
        balance_before = await _current_balance(auth_user.id)
        ledger_ids_before = {row.id for row in await _ledger_rows_for_user(auth_user.id)}

        async with AsyncSessionLocal() as db:
            ledger_id = await credit_service.debit_credits(
                db, user_id=auth_user.id, cost=15, reason="chat", ref_type="mode", ref_id="balanced",
            )
            await db.commit()

        # A candidate id was generated but NOTHING was ever committed for it.
        never_landed_message_id = uuid.uuid4()

        await chat_service_module._settle_verified_quote_predebit_on_cancel(
            user_id=auth_user.id, pre_debited=15, predebit_ledger_id=ledger_id,
            candidate_message_id=never_landed_message_id,
        )

        balance_after = await _current_balance(auth_user.id)
        assert balance_after == balance_before  # fully restored

        ledger_ids_after = {row.id for row in await _ledger_rows_for_user(auth_user.id)}
        assert ledger_ids_after == ledger_ids_before  # predebit row deleted, nothing new


class TestRestAmbiguousCommitResolution:
    """FIX2-B(b)/(c) (Codex r2 #4, NOT ADDRESSED): REST's equivalent
    cancellation resolver — proven against REAL Postgres rows, mirroring
    TestChatAmbiguousCommitResolution above."""

    async def test_landed_commit_resolves_to_no_refund_exact_ledger_state(self, auth_user) -> None:
        import app.api.quotes as quotes_api
        from app.models.database import AsyncSessionLocal
        from app.models.tables import UsageRecord
        from app.services import credit_service

        await _grant_credits(auth_user.id, 500)
        balance_before = await _current_balance(auth_user.id)

        async with AsyncSessionLocal() as db:
            ledger_id = await credit_service.debit_credits(
                db, user_id=auth_user.id, cost=15, reason="quote_search",
                ref_type="document", ref_id=str(uuid.uuid4()),
            )
            await db.commit()

        # Reproduce the endpoint's atomic block for real: reconcile + usage
        # record, ONE commit that genuinely lands.
        usage_record_id = uuid.uuid4()
        async with AsyncSessionLocal() as db:
            await credit_service.reconcile_credits(db, auth_user.id, ledger_id, 15, 11)
            db.add(UsageRecord(
                id=usage_record_id, user_id=auth_user.id, message_id=None, model="deepseek-v4-pro",
                prompt_tokens=200, completion_tokens=60, total_tokens=260, cost_credits=11,
            ))
            await db.commit()

        await quotes_api._settle_quote_search_predebit_on_cancel(
            auth_user.id, 15, ledger_id, usage_record_id,
        )

        balance_after = await _current_balance(auth_user.id)
        assert balance_after == balance_before - 11

        ledger_rows_after = await _ledger_rows_for_user(auth_user.id)
        reconciled_row = next(r for r in ledger_rows_after if r.id == ledger_id)
        assert reconciled_row.delta == -11  # untouched — still the reconciled amount

    async def test_never_landed_commit_resolves_to_full_refund_exact_ledger_state(self, auth_user) -> None:
        import app.api.quotes as quotes_api
        from app.models.database import AsyncSessionLocal
        from app.services import credit_service

        await _grant_credits(auth_user.id, 500)
        balance_before = await _current_balance(auth_user.id)
        ledger_ids_before = {row.id for row in await _ledger_rows_for_user(auth_user.id)}

        async with AsyncSessionLocal() as db:
            ledger_id = await credit_service.debit_credits(
                db, user_id=auth_user.id, cost=15, reason="quote_search",
                ref_type="document", ref_id=str(uuid.uuid4()),
            )
            await db.commit()

        never_landed_usage_record_id = uuid.uuid4()

        await quotes_api._settle_quote_search_predebit_on_cancel(
            auth_user.id, 15, ledger_id, never_landed_usage_record_id,
        )

        balance_after = await _current_balance(auth_user.id)
        assert balance_after == balance_before  # fully restored

        ledger_ids_after = {row.id for row in await _ledger_rows_for_user(auth_user.id)}
        assert ledger_ids_after == ledger_ids_before  # predebit row deleted, nothing new
