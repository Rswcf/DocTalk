"""Real-Postgres integration tests for FIX-4 (Codex r1 IMPORTANT #4), FIX2-B
(Codex r2 #4, NOT ADDRESSED), and FIX3-A (Codex r3 #4, NOT ADDRESSED): both
billing paths' post-debit failure AND ambiguous-cancellation/failure-
during-commit windows.

Mocked-db unit tests (test_quotes_api.py, test_quote_intent_routing.py)
already cover the LOGIC; these tests prove the SAME behavior against a real
database — real predebit rows, real reconcile failures, real refund
queries, real CONCURRENT transactions racing for the same ledger row — per
the reviewer's explicit request that mocks alone aren't sufficient evidence
for billing-critical cancellation/failure paths.

FIX3-A superseded FIX2-B(c)'s Message/UsageRecord-marker existence check
(which could only resolve a SEQUENTIAL "did this land before I checked"
question, not a genuinely concurrent race) with a durable ledger-row state
(credit_ledger.reconciled_at, stamped under SELECT ... FOR UPDATE by every
reconcile_credits() call) plus an atomic conditional refund (DELETE ...
WHERE reconciled_at IS NULL). TestChat/RestDurableSettlement below prove
three things against real Postgres: (1) sequential "landed"/"never landed"
end-states resolve correctly (mirrors the old marker-check tests); (2) a
resolver failure leaves the predebit exactly as it was, no partial state;
(3) — the REQUIRED reproduction of Codex's exact deterministic-schedule
finding ("a probe ended at balance 106 from a starting balance of 100,
[predebit 15, actual_cost 9], with the marker present and its ledger
deleted") — a REAL concurrent reconcile_credits() and _refund_predebit()
racing for the same row via asyncio.gather across two independent
connections, asserting the final balance is NEVER the wrong "reconciled
AND refunded" value, regardless of which side wins the row lock.

Requires docker (Postgres) — SKIP_INTEGRATION=1 (the default) skips this
whole file.
"""
from __future__ import annotations

import asyncio
import sys
import uuid
from pathlib import Path
from types import SimpleNamespace
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


class TestDomainModeSyncNeverHalfCommits:
    """P1 hygiene r2 (Codex, 2026-08-03): the domain_mode session-sync
    assignment (_sync_session_domain_mode) must ride each branch's OWN
    existing atomic commit, never a standalone one — a failure at that
    commit must leave NO half-committed domain_mode, and (for the billed
    Quote Finder path) no unrefunded charge either. Mirrors this file's
    established real-Postgres injected-failure pattern: mock a call the
    atomic commit depends on to raise, letting the REAL rollback run on a
    REAL connection, then verify the end state via a totally separate,
    fresh session/connection."""

    async def test_tool_action_commit_failure_leaves_domain_mode_uncommitted(
        self, auth_user, monkeypatch,
    ) -> None:
        """Codex r2's exact tool-action finding: the r1 fix committed the
        sync BEFORE the tool ran, so a subsequent tool failure left the
        domain_mode change committed anyway. This reproduces the
        CORRECTED shape instead — the assignment now happens right before
        the branch's OWN final commit, inside its exception boundary — by
        failing THAT commit and proving nothing landed, stale value
        included."""
        import app.services.chat_service as chat_service_module
        from app.models.database import AsyncSessionLocal
        from app.models.tables import ChatSession, Message
        from app.services.action_planner import ChatAction

        document_id = await _create_ready_document(auth_user.id)

        async with AsyncSessionLocal() as db:
            session = ChatSession(
                document_id=document_id, user_id=auth_user.id,
                domain_mode="legal", title="Existing title",  # pre-set: skips
                # _persist_user_message_and_title's conditional 2nd commit,
                # so exactly ONE commit (the user-message persist) happens
                # before the tool-action branch's OWN final commit below.
            )
            db.add(session)
            await db.commit()
            await db.refresh(session)
            session_id = session.id

        tool_action_plan = SimpleNamespace(
            action=ChatAction.EXPORT_TABLES, uses_rag_answer_path=False, confidence=0.9,
            reason="table export markers", user_visible_status="",
            quote_finder_hint=False, quote_finder_hint_topic=None,
        )
        monkeypatch.setattr(chat_service_module.action_planner, "plan", AsyncMock(return_value=tool_action_plan))
        execution = SimpleNamespace(message="Here are the exported tables.", artifact=None)
        monkeypatch.setattr(chat_service_module.chat_tool_executor, "execute", AsyncMock(return_value=execution))

        async with AsyncSessionLocal() as db:
            real_commit = db.commit
            calls = {"n": 0}

            async def _flaky_commit():
                calls["n"] += 1
                if calls["n"] == 1:
                    return await real_commit()  # the user-message persist commit lands for real
                raise RuntimeError("simulated tool-action final commit failure")

            monkeypatch.setattr(db, "commit", _flaky_commit)

            events = [
                event
                async for event in chat_service_module.chat_service.chat_stream(
                    session_id=session_id,
                    user_message="Export all tables to CSV.",
                    db=db,
                    user=auth_user,
                    mode="balanced",
                    domain_mode=None,  # omitted — should clear the stale "legal" value
                )
            ]

        assert events[-1]["event"] == "error"
        assert events[-1]["data"]["code"] == "CHAT_SETUP_ERROR"

        # Real Postgres, real rollback (via a totally separate connection):
        # the domain_mode assignment never landed (still the stale
        # "legal" value), and neither did the assistant message it was
        # bundled with in the SAME failed commit.
        async with AsyncSessionLocal() as verify_db:
            survivor = await verify_db.get(ChatSession, session_id)
            assert survivor.domain_mode == "legal"  # NOT half-committed to None
            msg_result = await verify_db.execute(
                select(Message).where(Message.session_id == session_id, Message.role == "assistant")
            )
            assert msg_result.scalars().all() == []

    async def test_quote_finder_commit_failure_leaves_domain_mode_uncommitted_and_fully_refunds(
        self, auth_user, monkeypatch,
    ) -> None:
        """Codex r2's exact Quote Finder finding: the r1 fix committed the
        sync AFTER the real answer+billing+usage atomic commit succeeded —
        a failure in that EXTRA, separate commit meant the client got
        QUOTE_SEARCH_ERROR while the real answer stayed persisted and
        charged with no way back. This test targets that exact window: a
        failure AFTER the domain_mode assignment has happened in memory,
        at the point where a commit was needed to make it durable — unlike
        TestChatReconcileFailureAfterPersist above (which fails
        reconcile_credits BEFORE the atomic commit is ever attempted,
        never reaching the assignment at all), this fails the atomic
        commit ITSELF, with the assignment already dirtying the session
        object, proving the corrected fold-in shape rolls BOTH back
        together rather than leaving one committed and the other not."""
        import app.services.chat_service as chat_service_module
        from app.models.database import AsyncSessionLocal
        from app.models.tables import ChatSession, Message
        from app.services.quote_search_service import QuoteCard, QuoteSearchResult

        await _grant_credits(auth_user.id, 500)
        document_id = await _create_ready_document(auth_user.id)

        async with AsyncSessionLocal() as db:
            session = ChatSession(
                document_id=document_id, user_id=auth_user.id,
                domain_mode="legal", title="Existing title",  # pre-set: skips
                # _persist_user_message_and_title's conditional 2nd commit,
                # so exactly TWO commits (predebit, user-message persist)
                # happen before _run_verified_quote_search's OWN atomic
                # commit — the one this test fails.
            )
            db.add(session)
            await db.commit()
            await db.refresh(session)
            session_id = session.id

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

        balance_before = await _current_balance(auth_user.id)
        ledger_ids_before = {row.id for row in await _ledger_rows_for_user(auth_user.id)}

        async with AsyncSessionLocal() as db:
            real_commit = db.commit
            calls = {"n": 0}

            async def _flaky_commit():
                calls["n"] += 1
                # Fail ONLY the 3rd call (the atomic quote-finder commit).
                # Calls 1-2 (predebit, user-message persist) land for real;
                # call 4+ must ALSO land for real — that's the refund
                # resolver's OWN commit (_refund_predebit reuses this same
                # `db` session for ordinary exceptions), which must succeed
                # normally or the refund itself would be broken by this mock.
                if calls["n"] == 3:
                    raise RuntimeError("simulated quote-finder atomic-commit failure")
                return await real_commit()

            monkeypatch.setattr(db, "commit", _flaky_commit)

            events = [
                event
                async for event in chat_service_module.chat_service.chat_stream(
                    session_id=session_id,
                    user_message="Give me a direct quote about the termination clause.",
                    db=db,
                    user=auth_user,
                    mode="balanced",
                    domain_mode=None,  # omitted — should clear the stale "legal" value
                )
            ]

        # 4 commits total: predebit, user-message persist, the (failed) atomic
        # quote-finder commit, and the refund resolver's own commit — confirms
        # the injected failure landed exactly where intended and the resolver
        # still ran to completion afterward.
        assert calls["n"] == 4
        assert events[-1]["event"] == "error"
        assert events[-1]["data"]["code"] == "QUOTE_SEARCH_ERROR"

        # Real Postgres, real rollback: the domain_mode assignment and the
        # assistant message it was bundled into the SAME atomic commit
        # with never landed together.
        async with AsyncSessionLocal() as verify_db:
            survivor = await verify_db.get(ChatSession, session_id)
            assert survivor.domain_mode == "legal"  # NOT half-committed to None
            msg_result = await verify_db.execute(
                select(Message).where(Message.session_id == session_id, Message.role == "assistant")
            )
            assert msg_result.scalars().all() == []

        # Fully refunded — no unrefunded charge left behind by the failure.
        balance_after = await _current_balance(auth_user.id)
        assert balance_after == balance_before

        ledger_ids_after = {row.id for row in await _ledger_rows_for_user(auth_user.id)}
        assert ledger_ids_after == ledger_ids_before  # predebit row deleted, no new row remains


class TestChatDurableSettlement:
    """FIX3-A (Codex r3 #4, NOT ADDRESSED): chat's settlement resolver,
    proven against REAL Postgres rows and REAL concurrent transactions —
    the durable credit_ledger.reconciled_at marker (stamped under a row
    lock by every reconcile_credits() call) plus the atomic conditional
    refund (_refund_predebit's DELETE ... WHERE reconciled_at IS NULL)
    supersede FIX2-B(c)'s Message-marker existence check entirely."""

    async def test_landed_commit_resolves_to_no_refund_exact_ledger_state(self, auth_user) -> None:
        """The atomic commit (message + reconcile + usage) actually ran to
        completion for real — the resolver must recognize it landed (via
        reconciled_at) and must NOT refund; the ledger row must remain at
        its RECONCILED delta, never restored to the raw predebit."""
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

        # Simulate the cancellation/failure handler running AFTER the fact
        # — exactly as if the caller's own `await db.commit()` had raised
        # despite this commit having genuinely succeeded.
        await chat_service_module._settle_verified_quote_predebit_after_failure(
            user_id=auth_user.id, pre_debited=15, predebit_ledger_id=ledger_id,
            use_independent_session=True,
        )

        # No refund — balance reflects the RECONCILED cost (9), not restored
        # to pre-search, and definitely not double-refunded on top of it.
        balance_after = await _current_balance(auth_user.id)
        assert balance_after == balance_before - 9

        ledger_rows_after = await _ledger_rows_for_user(auth_user.id)
        reconciled_row = next(r for r in ledger_rows_after if r.id == ledger_id)
        assert reconciled_row.delta == -9  # untouched — still the reconciled amount
        assert reconciled_row.reconciled_at is not None

    async def test_never_landed_commit_resolves_to_full_refund_exact_ledger_state(self, auth_user) -> None:
        """The atomic commit never ran at all (simulating a failure that
        struck before it) — the resolver, finding reconciled_at still NULL,
        must refund the full predebit and leave no trace of the row."""
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

        await chat_service_module._settle_verified_quote_predebit_after_failure(
            user_id=auth_user.id, pre_debited=15, predebit_ledger_id=ledger_id,
            use_independent_session=True,
        )

        balance_after = await _current_balance(auth_user.id)
        assert balance_after == balance_before  # fully restored

        ledger_ids_after = {row.id for row in await _ledger_rows_for_user(auth_user.id)}
        assert ledger_ids_after == ledger_ids_before  # predebit row deleted, nothing new

    async def test_resolver_failure_leaves_predebit_standing_untouched(self, auth_user, monkeypatch) -> None:
        """FIX3-A(d) (Codex r3 #4, NOT ADDRESSED): if the resolver's own
        DB operation fails, the predebit must be left EXACTLY as it was —
        no refund, no reconciliation, no partial state — for ops to review
        manually. Simulated by making _refund_predebit itself raise."""
        import app.services.chat_service as chat_service_module
        from app.models.database import AsyncSessionLocal
        from app.services import credit_service

        await _grant_credits(auth_user.id, 500)
        balance_before = await _current_balance(auth_user.id)

        async with AsyncSessionLocal() as db:
            ledger_id = await credit_service.debit_credits(
                db, user_id=auth_user.id, cost=15, reason="chat", ref_type="mode", ref_id="balanced",
            )
            await db.commit()

        monkeypatch.setattr(
            chat_service_module, "_refund_predebit",
            AsyncMock(side_effect=RuntimeError("simulated DB blip during settlement")),
        )

        with pytest.raises(RuntimeError):
            await chat_service_module._settle_verified_quote_predebit_after_failure(
                user_id=auth_user.id, pre_debited=15, predebit_ledger_id=ledger_id,
                use_independent_session=True,
            )

        # Untouched: still predebited, still unreconciled.
        balance_after = await _current_balance(auth_user.id)
        assert balance_after == balance_before - 15

        ledger_rows_after = await _ledger_rows_for_user(auth_user.id)
        row = next(r for r in ledger_rows_after if r.id == ledger_id)
        assert row.delta == -15
        assert row.reconciled_at is None

    async def test_reconcile_vs_refund_race_never_produces_the_wrong_balance(self, auth_user) -> None:
        """Codex r3's exact deterministic-schedule finding: "A deterministic
        schedule probe for both helpers ended at balance 106 from a
        starting balance of 100 [predebit 15, actual_cost 9], with the
        message/usage marker present and its ledger deleted" — i.e. the OLD
        code reconciled to 9 (91) AND ALSO refunded the flat 15 on top
        (106): a genuine double-charge-in-reverse. Reproduced here with a
        REAL concurrent reconcile_credits() and _refund_predebit() racing
        for the SAME ledger row via asyncio.gather across two independent
        Postgres connections — real row-level locking, not simulated
        interleaving. Whichever side wins the row lock, the final balance
        must be EXACTLY one of the two correct outcomes (91: reconciled,
        refund correctly no-ops; or 100: refunded, reconcile correctly
        fails since the row is gone) — NEVER 106."""
        import app.api.quotes as quotes_api
        from app.models.database import AsyncSessionLocal
        from app.services import credit_service

        await _grant_credits(auth_user.id, 500)
        balance_before = await _current_balance(auth_user.id)

        async with AsyncSessionLocal() as db:
            ledger_id = await credit_service.debit_credits(
                db, user_id=auth_user.id, cost=15, reason="chat", ref_type="mode", ref_id="balanced",
            )
            await db.commit()

        async def _reconcile() -> str:
            async with AsyncSessionLocal() as db:
                try:
                    await credit_service.reconcile_credits(db, auth_user.id, ledger_id, 15, 9)
                    await db.commit()
                    return "reconciled"
                except RuntimeError:
                    return "reconcile_failed"

        async def _refund() -> str:
            async with AsyncSessionLocal() as db:
                refunded = await quotes_api._refund_predebit(db, auth_user.id, 15, ledger_id)
                return "refunded" if refunded else "refund_no_op"

        reconcile_outcome, refund_outcome = await asyncio.gather(_reconcile(), _refund())

        balance_after = await _current_balance(auth_user.id)
        ledger_rows_after = await _ledger_rows_for_user(auth_user.id)
        ledger_row = next((r for r in ledger_rows_after if r.id == ledger_id), None)

        # The Codex-documented bug value must never occur.
        assert balance_after != balance_before + 6  # (would be -15+6+15 relative to before -> the "106" shape)

        if reconcile_outcome == "reconciled":
            assert refund_outcome == "refund_no_op"
            assert ledger_row is not None
            assert ledger_row.delta == -9
            assert ledger_row.reconciled_at is not None
            assert balance_after == balance_before - 9
        else:
            assert reconcile_outcome == "reconcile_failed"
            assert refund_outcome == "refunded"
            assert ledger_row is None
            assert balance_after == balance_before


class TestRestDurableSettlement:
    """FIX3-A (Codex r3 #4, NOT ADDRESSED): REST's equivalent settlement
    resolver — proven against REAL Postgres rows, mirroring
    TestChatDurableSettlement above."""

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
        async with AsyncSessionLocal() as db:
            await credit_service.reconcile_credits(db, auth_user.id, ledger_id, 15, 11)
            db.add(UsageRecord(
                user_id=auth_user.id, message_id=None, model="deepseek-v4-pro",
                prompt_tokens=200, completion_tokens=60, total_tokens=260, cost_credits=11,
            ))
            await db.commit()

        await quotes_api._settle_quote_search_predebit_after_failure(
            user_id=auth_user.id, pre_debited=15, ledger_id=ledger_id,
            use_independent_session=True,
        )

        balance_after = await _current_balance(auth_user.id)
        assert balance_after == balance_before - 11

        ledger_rows_after = await _ledger_rows_for_user(auth_user.id)
        reconciled_row = next(r for r in ledger_rows_after if r.id == ledger_id)
        assert reconciled_row.delta == -11  # untouched — still the reconciled amount
        assert reconciled_row.reconciled_at is not None

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

        await quotes_api._settle_quote_search_predebit_after_failure(
            user_id=auth_user.id, pre_debited=15, ledger_id=ledger_id,
            use_independent_session=True,
        )

        balance_after = await _current_balance(auth_user.id)
        assert balance_after == balance_before  # fully restored

        ledger_ids_after = {row.id for row in await _ledger_rows_for_user(auth_user.id)}
        assert ledger_ids_after == ledger_ids_before  # predebit row deleted, nothing new

    async def test_resolver_failure_leaves_predebit_standing_untouched(self, auth_user, monkeypatch) -> None:
        import app.api.quotes as quotes_api
        from app.models.database import AsyncSessionLocal
        from app.services import credit_service

        await _grant_credits(auth_user.id, 500)
        balance_before = await _current_balance(auth_user.id)

        async with AsyncSessionLocal() as db:
            ledger_id = await credit_service.debit_credits(
                db, user_id=auth_user.id, cost=15, reason="quote_search",
                ref_type="document", ref_id=str(uuid.uuid4()),
            )
            await db.commit()

        monkeypatch.setattr(
            quotes_api, "_refund_predebit",
            AsyncMock(side_effect=RuntimeError("simulated DB blip during settlement")),
        )

        with pytest.raises(RuntimeError):
            await quotes_api._settle_quote_search_predebit_after_failure(
                user_id=auth_user.id, pre_debited=15, ledger_id=ledger_id,
                use_independent_session=True,
            )

        balance_after = await _current_balance(auth_user.id)
        assert balance_after == balance_before - 15

        ledger_rows_after = await _ledger_rows_for_user(auth_user.id)
        row = next(r for r in ledger_rows_after if r.id == ledger_id)
        assert row.delta == -15
        assert row.reconciled_at is None

    async def test_reconcile_vs_refund_race_never_produces_the_wrong_balance(self, auth_user) -> None:
        """Mirrors TestChatDurableSettlement's race test — same underlying
        primitives (credit_service.reconcile_credits / quotes_api._refund_predebit),
        proven again on REST's own predebit reason/ref shape."""
        import app.api.quotes as quotes_api
        from app.models.database import AsyncSessionLocal
        from app.services import credit_service

        await _grant_credits(auth_user.id, 500)
        balance_before = await _current_balance(auth_user.id)

        async with AsyncSessionLocal() as db:
            ledger_id = await credit_service.debit_credits(
                db, user_id=auth_user.id, cost=15, reason="quote_search",
                ref_type="document", ref_id=str(uuid.uuid4()),
            )
            await db.commit()

        async def _reconcile() -> str:
            async with AsyncSessionLocal() as db:
                try:
                    await credit_service.reconcile_credits(db, auth_user.id, ledger_id, 15, 11)
                    await db.commit()
                    return "reconciled"
                except RuntimeError:
                    return "reconcile_failed"

        async def _refund() -> str:
            async with AsyncSessionLocal() as db:
                refunded = await quotes_api._refund_predebit(db, auth_user.id, 15, ledger_id)
                return "refunded" if refunded else "refund_no_op"

        reconcile_outcome, refund_outcome = await asyncio.gather(_reconcile(), _refund())

        balance_after = await _current_balance(auth_user.id)
        ledger_rows_after = await _ledger_rows_for_user(auth_user.id)
        ledger_row = next((r for r in ledger_rows_after if r.id == ledger_id), None)

        assert balance_after != balance_before + 4  # the "reconciled AND refunded" shape

        if reconcile_outcome == "reconciled":
            assert refund_outcome == "refund_no_op"
            assert ledger_row is not None
            assert ledger_row.delta == -11
            assert ledger_row.reconciled_at is not None
            assert balance_after == balance_before - 11
        else:
            assert reconcile_outcome == "reconcile_failed"
            assert refund_outcome == "refunded"
            assert ledger_row is None
            assert balance_after == balance_before
