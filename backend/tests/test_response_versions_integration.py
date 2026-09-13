from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio
from fastapi import HTTPException
from sqlalchemy import delete, func, select, update

from app.models.database import AsyncSessionLocal
from app.models.tables import (
    AnswerShare,
    ChatSession,
    ChatStreamLease,
    Document,
    Message,
    MessageRevision,
    User,
)
from app.services.chat_response_versions import (
    claim_operation,
    current_operation,
    fence_message_write,
    replace_answer,
    stream_with_operation,
)
from app.services.chat_service import chat_service

pytestmark = [pytest.mark.integration, pytest.mark.asyncio(loop_scope="session")]


@pytest_asyncio.fixture(loop_scope="session")
async def conversation():
    async with AsyncSessionLocal() as db:
        user = User(email=f"versions-{uuid.uuid4().hex}@example.com", plan="pro")
        db.add(user)
        await db.flush()
        doc = Document(user_id=user.id, filename="revision fixture.pdf", storage_key=f"versions-{uuid.uuid4()}", file_size=1, file_type="pdf", status="ready")
        db.add(doc)
        await db.flush()
        session = ChatSession(user_id=user.id, document_id=doc.id)
        db.add(session)
        await db.flush()
        now = datetime.now(timezone.utc)
        question = Message(session_id=session.id, role="user", content="What year?", created_at=now - timedelta(seconds=1))
        answer = Message(session_id=session.id, role="assistant", content="2023", citations=[{"page": 5}], metadata_json={}, continuation_count=1, created_at=now)
        db.add_all([question, answer])
        await db.commit()
    try:
        yield session, question, answer
    finally:
        async with AsyncSessionLocal() as db:
            await db.execute(delete(User).where(User.id == user.id))
            await db.commit()


async def consume(operation, source):
    async with AsyncSessionLocal() as db:
        return [ev async for ev in stream_with_operation(source(db), operation, db)]


async def finish(db):
    yield "done"


async def test_concurrent_claim_has_one_winner_and_stream_releases(conversation):
    session, _, _ = conversation
    results = await asyncio.gather(claim_operation(session.id), claim_operation(session.id), return_exceptions=True)
    winners = [r for r in results if not isinstance(r, Exception)]
    assert len(winners) == 1
    loser = next(r for r in results if isinstance(r, Exception))
    assert isinstance(loser, HTTPException) and loser.detail["error"] == "CHAT_IN_PROGRESS"
    assert await consume(winners[0], finish) == ["done"]
    assert current_operation.get() is None
    await consume(await claim_operation(session.id), finish)


async def test_replace_is_atomic_keeps_position_and_archives_original(conversation):
    session, question, answer = conversation
    async with AsyncSessionLocal() as db:
        shared = AnswerShare(user_id=session.user_id, session_id=session.id, message_id=answer.id,
            snapshot_digest="a" * 64, snapshot={"content": "2023"})
        db.add(shared)
        await db.commit()
    op = await claim_operation(session.id, regenerate_of=answer.id, question=question.content)

    async def replace(db):
        await chat_service._persist_user_message_and_title(db=db, session_id=session.id, user_message=question.content)
        result = await replace_answer(db, Message(session_id=session.id, role="assistant", content="May 2023", citations=[{"page": 6}], prompt_tokens=10, output_tokens=4))
        assert result.id == answer.id and result.created_at == answer.created_at
        assert result.continuation_count == 0 and result.response_version is not None
        yield "done"

    await consume(op, replace)
    async with AsyncSessionLocal() as db:
        messages = list((await db.execute(select(Message).where(Message.session_id == session.id).order_by(Message.created_at))).scalars())
        assert [m.content for m in messages] == ["What year?", "May 2023"]
        revision = (await db.execute(select(MessageRevision).where(MessageRevision.message_id == answer.id))).scalar_one()
        assert revision.snapshot["content"] == "2023"
        assert revision.snapshot["citations"] == [{"page": 5}]
        assert revision.snapshot["continuation_count"] == 1
        assert (await db.get(AnswerShare, shared.id)).snapshot == {"content": "2023"}
        # Normal conversation export uses the current Message row. Personal
        # data export additionally includes the separately retained revisions.
        from app.api.export import export_session
        from app.api.users import export_my_data
        user = await db.get(User, session.user_id)
        exported = await export_session(session.id, format="md", user=user, db=db)
        content = b"".join([part async for part in exported.body_iterator]).decode()
        assert content.count("What year?") == 1 and "May 2023" in content
        personal = await export_my_data(user=user, db=db)
        import json
        payload = json.loads(personal.body)
        assert payload["conversations"][0]["messages"][1]["previous_versions"][0]["content"] == "2023"
    with pytest.raises(HTTPException, match="409"):
        await claim_operation(session.id, regenerate_of=answer.id, question=question.content)


async def test_failed_replacement_preserves_answer_and_allows_retry(conversation):
    session, question, answer = conversation
    op = await claim_operation(session.id, regenerate_of=answer.id, question=question.content)

    async def fail(db):
        await chat_service._persist_user_message_and_title(db=db, session_id=session.id, user_message=question.content)
        yield "partial token"
        raise RuntimeError("LLM stopped")

    with pytest.raises(RuntimeError, match="LLM stopped"):
        await consume(op, fail)
    async with AsyncSessionLocal() as db:
        assert (await db.get(Message, answer.id)).content == "2023"
        assert (await db.execute(select(func.count()).select_from(MessageRevision).where(MessageRevision.message_id == answer.id))).scalar_one() == 0
    await consume(await claim_operation(session.id, regenerate_of=answer.id, question=question.content), finish)


async def test_expired_writer_cannot_replace_new_lease_holder(conversation):
    session, question, answer = conversation
    old = await claim_operation(session.id, regenerate_of=answer.id, question=question.content)
    async with AsyncSessionLocal() as db:
        await db.execute(update(ChatStreamLease).where(ChatStreamLease.session_id == session.id).values(expires_at=func.clock_timestamp() - timedelta(seconds=1)))
        await db.commit()
    winner = await claim_operation(session.id)
    context = current_operation.set(old)
    try:
        async with AsyncSessionLocal() as db:
            with pytest.raises(RuntimeError, match="lease expired"):
                await replace_answer(db, Message(session_id=session.id, role="assistant", content="late loser"))
            await db.rollback()
    finally:
        current_operation.reset(context)
    async with AsyncSessionLocal() as db:
        assert (await db.get(Message, answer.id)).content == "2023"
        assert (await db.get(ChatStreamLease, session.id)).token == winner.token
    await consume(winner, finish)


async def test_validation_rejects_foreign_stale_tool_and_changed_question(conversation):
    session, question, answer = conversation
    for kwargs in (
        {"regenerate_of": uuid.uuid4(), "question": question.content},
        {"regenerate_of": answer.id, "question": "different"},
        {"regenerate_of": answer.id, "question": question.content, "expected_version": uuid.uuid4()},
        {"regenerate_of": answer.id, "question": question.content, "retry_question": True},
        {"retry_question": True, "question": question.content},
        {"continue_id": question.id},
        {"continue_id": answer.id, "expected_version": uuid.uuid4(), "continue_version_supplied": True},
    ):
        with pytest.raises(HTTPException):
            await claim_operation(session.id, **kwargs)
        async with AsyncSessionLocal() as db:
            assert await db.get(ChatStreamLease, session.id) is None
    async with AsyncSessionLocal() as db:
        target = await db.get(Message, answer.id)
        target.metadata_json = {"artifacts": [{"type": "layout_translation"}]}
        await db.commit()
    with pytest.raises(HTTPException) as err:
        await claim_operation(session.id, regenerate_of=answer.id, question=question.content)
    assert err.value.detail["error"] == "TOOL_RETRY_UNSUPPORTED"


@pytest.mark.parametrize("question_was_saved", [True, False])
async def test_first_answer_retry_inserts_question_exactly_once(conversation, question_was_saved):
    session, question, answer = conversation
    async with AsyncSessionLocal() as db:
        empty_session = ChatSession(document_id=session.document_id, user_id=session.user_id)
        db.add(empty_session)
        await db.flush()
        if question_was_saved:
            db.add(Message(session_id=empty_session.id, role="user", content="Retry question"))
        await db.commit()
    op = await claim_operation(empty_session.id, retry_question=True, question="Retry question")

    async def retry(db):
        await chat_service._persist_user_message_and_title(db=db, session_id=empty_session.id, user_message="Retry question")
        await fence_message_write(db)
        db.add(Message(session_id=empty_session.id, role="assistant", content="Recovered"))
        await db.commit()
        yield "done"

    await consume(op, retry)
    async with AsyncSessionLocal() as db:
        messages = list((await db.execute(select(Message).where(Message.session_id == empty_session.id))).scalars())
        assert len(messages) == 2
        assert sum(m.role == "user" for m in messages) == 1


async def test_cancellation_closes_source_and_releases_lease(conversation):
    session, _, _ = conversation
    op = await claim_operation(session.id)
    started, closed = asyncio.Event(), asyncio.Event()

    async def wait(db):
        try:
            started.set()
            await asyncio.Event().wait()
            yield "never"
        finally:
            closed.set()

    task = asyncio.create_task(consume(op, wait))
    await started.wait()
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    assert closed.is_set()
    await consume(await claim_operation(session.id), finish)


async def test_running_stream_renews_without_holding_a_transaction(conversation, monkeypatch):
    import app.services.chat_response_versions as versions
    monkeypatch.setattr(versions, "RENEW_SECONDS", 0.01)
    session, _, _ = conversation
    op = await claim_operation(session.id)
    async with AsyncSessionLocal() as db:
        initial = (await db.get(ChatStreamLease, session.id)).expires_at
    started, done = asyncio.Event(), asyncio.Event()

    async def running(db):
        started.set()
        await done.wait()
        yield "done"

    task = asyncio.create_task(consume(op, running))
    await started.wait()
    try:
        async with asyncio.timeout(2):
            while True:
                async with AsyncSessionLocal() as db:
                    lease = await db.get(ChatStreamLease, session.id)
                    if lease.expires_at > initial:
                        break
                await asyncio.sleep(0.01)
        with pytest.raises(HTTPException):
            await claim_operation(session.id)
    finally:
        done.set()
        await task


async def test_replacement_commit_marker_survives_ambiguous_result_and_later_revision(conversation):
    from app.services.chat_response_versions import replacement_delivered
    session, question, answer = conversation
    op = await claim_operation(session.id, regenerate_of=answer.id, question=question.content)
    assert not await replacement_delivered(op)  # streamed-only candidate is not delivery

    async def replace(db):
        await replace_answer(db, Message(session_id=session.id, role="assistant", content="Delivered"))
        yield "done"

    await consume(op, replace)
    assert await replacement_delivered(op)  # even when caller lost commit acknowledgement
    newer = await claim_operation(session.id, regenerate_of=answer.id, expected_version=op.result_version, question=question.content)
    await consume(newer, replace)
    assert await replacement_delivered(op)  # durable archive resolves a later winner
    assert await replacement_delivered(newer)


async def test_unstarted_response_release_does_not_delete_a_new_owner(conversation):
    from app.services.chat_response_versions import release_operation
    session, _, _ = conversation
    old = await claim_operation(session.id)
    await release_operation(old)  # background task when body iterator never started
    winner = await claim_operation(session.id)
    await release_operation(old)
    with pytest.raises(HTTPException):
        await claim_operation(session.id)
    await consume(winner, finish)


async def test_single_heartbeat_db_blip_does_not_cancel_healthy_stream(conversation, monkeypatch):
    import app.services.chat_response_versions as versions
    monkeypatch.setattr(versions, "RENEW_SECONDS", 0.01)
    session, _, _ = conversation
    op = await claim_operation(session.id)
    real_fence = versions.fence_message_write
    calls = 0
    renewed = asyncio.Event()

    async def intermittent(db):
        nonlocal calls
        calls += 1
        if calls == 1:
            raise ConnectionError("temporary test DB blip")
        await real_fence(db)
        renewed.set()

    monkeypatch.setattr(versions, "fence_message_write", intermittent)

    async def source(db):
        async with asyncio.timeout(2):
            await renewed.wait()
        yield "done"

    assert await consume(op, source) == ["done"]
    assert calls >= 2


@pytest.mark.parametrize("commit_answer", [False, True])
async def test_replacement_failure_settles_only_durable_delivery(conversation, commit_answer):
    from app.models.tables import CreditLedger
    from app.services.chat_response_versions import replacement_delivered
    from app.services.chat_service import _settle_predebit_on_cancel
    session, question, answer = conversation
    async with AsyncSessionLocal() as db:
        await db.execute(update(User).where(User.id == session.user_id).values(credits_balance=95))
        ledger = CreditLedger(user_id=session.user_id, delta=-5, balance_after=95, reason="chat")
        db.add(ledger)
        await db.commit()
        ledger_id = ledger.id
    op = await claim_operation(session.id, regenerate_of=answer.id, question=question.content)

    async def source(db):
        if commit_answer:
            await replace_answer(db, Message(session_id=session.id, role="assistant", content="Actually saved"))
        # Model/transport failed after generating a candidate, possibly after commit.
        yield "error"

    await consume(op, source)
    for _ in range(2):
        await _settle_predebit_on_cancel(user_id=session.user_id, pre_debited=5,
            predebit_ledger_id=ledger_id, has_answer=await replacement_delivered(op),
            prompt_tokens=100, output_tokens=10, model="deepseek-v4-flash", mode="quick")
    async with AsyncSessionLocal() as db:
        entry = await db.get(CreditLedger, ledger_id)
        balance = await db.scalar(select(User.credits_balance).where(User.id == session.user_id))
        if commit_answer:
            assert entry is not None and entry.reconciled_at is not None
            assert balance == 100 + entry.delta
        else:
            assert entry is None and balance == 100


async def test_concurrent_reconciliation_applies_only_the_first_cost(conversation):
    from app.models.tables import CreditLedger
    from app.services.credit_service import reconcile_credits
    session, _, _ = conversation
    async with AsyncSessionLocal() as db:
        await db.execute(update(User).where(User.id == session.user_id).values(credits_balance=95))
        ledger = CreditLedger(user_id=session.user_id, delta=-5, balance_after=95, reason="chat")
        db.add(ledger)
        await db.commit()
        ledger_id = ledger.id

    async def reconcile(cost):
        async with AsyncSessionLocal() as db:
            balance = await reconcile_credits(db, session.user_id, ledger_id, 5, cost)
            await db.commit()
            return balance

    results = await asyncio.gather(reconcile(1), reconcile(3))
    assert results[0] == results[1] and results[0] in {97, 99}
    async with AsyncSessionLocal() as db:
        entry = await db.get(CreditLedger, ledger_id)
        assert entry.reconciled_at is not None
        assert results[0] == 100 + entry.delta


async def test_asgi_backpressure_cancellation_closes_source_before_releasing_lease(conversation):
    from contextlib import aclosing

    from starlette.background import BackgroundTask

    from app.services.chat_response_versions import (
        ChatStreamingResponse,
        release_operation,
    )
    session, _, _ = conversation
    op = await claim_operation(session.id)
    sending, cleaned = asyncio.Event(), asyncio.Event()
    async with AsyncSessionLocal() as db:
        async def source():
            try:
                yield 'chunk'
            finally:
                await fence_message_write(db)  # lease still held during source cleanup
                await db.commit()
                cleaned.set()

        async def body():
            async with aclosing(stream_with_operation(source(), op, db)) as events:
                async for event in events:
                    yield event

        async def send(message):
            if message['type'] == 'http.response.body':
                sending.set()
                await asyncio.Event().wait()

        response = ChatStreamingResponse(body(), background=BackgroundTask(release_operation, op))
        task = asyncio.create_task(response.stream_response(send))
        await sending.wait()
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task
        assert cleaned.is_set()
        await response.background()
    await consume(await claim_operation(session.id), finish)


async def test_hung_renewal_is_bounded_before_lease_expiry(conversation, monkeypatch):
    import app.services.chat_response_versions as versions
    session, _, _ = conversation
    op = await claim_operation(session.id)
    monkeypatch.setattr(versions, 'LEASE_SECONDS', 0.12)
    monkeypatch.setattr(versions, 'RENEW_SECONDS', 0.03)
    async def hang(db):
        await asyncio.Event().wait()
    monkeypatch.setattr(versions, 'fence_message_write', hang)
    async def source(db):
        await asyncio.Event().wait()
        yield 'never'
    async with asyncio.timeout(1):
        with pytest.raises(asyncio.CancelledError):
            await consume(op, source)
