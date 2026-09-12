"""Answer-only privacy, ownership, lifecycle and quota guarantees on real PG."""

from __future__ import annotations

import asyncio
import copy
import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from fastapi import FastAPI, HTTPException, Response
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete, func, select

from app.api import sharing
from app.core.deps import get_db_session
from app.models.database import AsyncSessionLocal
from app.models.tables import (
    AnswerShare,
    ChatSession,
    Document,
    Message,
    SharedSession,
    User,
)

pytestmark = [pytest.mark.integration, pytest.mark.asyncio(loop_scope="session")]


@pytest_asyncio.fixture(loop_scope="session")
async def case(monkeypatch):
    monkeypatch.setattr(
        sharing.shared_view_limiter, "is_allowed", AsyncMock(return_value=True)
    )
    async with AsyncSessionLocal() as db:
        owner = User(email=f"answer-share-{uuid.uuid4().hex}@example.com", plan="free")
        stranger = User(
            email=f"answer-share-{uuid.uuid4().hex}@example.com", plan="pro"
        )
        db.add_all([owner, stranger])
        await db.flush()
        doc = Document(
            filename="shared-source.txt",
            file_size=1,
            storage_key="qa-answer-share",
            user_id=owner.id,
            status="ready",
        )
        db.add(doc)
        await db.flush()
        session = ChatSession(
            document_id=doc.id, user_id=owner.id, title="PRIVATE initial question"
        )
        other = ChatSession(
            document_id=doc.id, user_id=owner.id, title="PRIVATE other session"
        )
        db.add_all([session, other])
        await db.flush()
        question = Message(
            session_id=session.id, role="user", content="PRIVATE question"
        )
        answer = Message(
            session_id=session.id,
            role="assistant",
            content="Selected answer.",
            citations=[
                {
                    "ref_index": 1,
                    "offset": 16,
                    "page": 2,
                    "page_end": 3,
                    "text_snippet": "Selected excerpt.",
                    "document_filename": doc.filename,
                    "chunk_id": str(uuid.uuid4()),
                    "document_id": str(doc.id),
                    "bboxes": [{"x": 0.1}],
                }
            ],
            metadata_json={"artifact": {"download_url": "PRIVATE signed storage URL"}},
        )
        later = Message(
            session_id=session.id, role="assistant", content="PRIVATE other answer"
        )
        foreign = Message(
            session_id=other.id, role="assistant", content="PRIVATE foreign answer"
        )
        db.add_all([question, answer, later, foreign])
        await db.commit()
        result = SimpleNamespace(
            owner=owner.id,
            stranger=stranger.id,
            doc=doc.id,
            session=session.id,
            other=other.id,
            question=question.id,
            answer=answer.id,
            later=later.id,
            foreign=foreign.id,
        )
    try:
        yield result
    finally:
        async with AsyncSessionLocal() as db:
            await db.execute(delete(Document).where(Document.id == result.doc))
            await db.execute(
                delete(User).where(User.id.in_([result.owner, result.stranger]))
            )
            await db.commit()


async def preview(case, *, message=None, user=None):
    async with AsyncSessionLocal() as db:
        actor = await db.get(User, user or case.owner)
        return await sharing.answer_share_state(
            case.session, message or case.answer, Response(), actor, db
        )


async def create(
    case, *, message=None, digest=None, user=None, full=False, session=None
):
    async with AsyncSessionLocal() as db:
        actor = await db.get(User, user or case.owner)
        if full:
            return await sharing.create_share(session or case.session, actor, db)
        state = await sharing.answer_share_state(
            case.session, message or case.answer, Response(), actor, db
        )
        return await sharing.create_answer_share(
            case.session,
            message or case.answer,
            sharing.AnswerShareCreateRequest(
                snapshot_digest=digest or state["snapshot_digest"]
            ),
            actor,
            db,
        )


async def public(token):
    app = FastAPI()
    app.include_router(sharing.router)

    async def get_db():
        async with AsyncSessionLocal() as db:
            yield db

    app.dependency_overrides[get_db_session] = get_db
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        return await client.get(f"/api/shared/{token}")


async def test_preview_creates_no_link_and_public_snapshot_excludes_other_messages(
    case,
):
    state = await preview(case)
    async with AsyncSessionLocal() as db:
        assert (
            await db.scalar(
                select(func.count())
                .select_from(AnswerShare)
                .where(AnswerShare.user_id == case.owner)
            )
            == 0
        )
    share = await create(case, digest=state["snapshot_digest"])
    response = await public(share.share_token)
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert response.json() == state["preview"]
    body = response.json()
    assert body["scope"] == "answer"
    assert body["session_title"] == "Shared answer"
    assert len(body["messages"]) == 1
    assert body["messages"][0]["content"] == "Selected answer.[1]"
    assert body["messages"][0]["citations"][0]["page_end"] == 3
    for private in (
        "PRIVATE",
        "bboxes",
        "chunk_id",
        "document_id",
        "metadata_json",
        "download_url",
    ):
        assert private not in response.text


@pytest.mark.parametrize("operation", ["preview", "create", "revoke"])
@pytest.mark.parametrize(
    "invalid", ["stranger", "question", "foreign", "anonymous_session", "demo_stranger"]
)
async def test_answer_routes_fail_closed(case, operation, invalid):
    actor_id, message_id = case.owner, case.answer
    if invalid.endswith("stranger"):
        actor_id = case.stranger
    if invalid in ("question", "foreign"):
        message_id = getattr(case, invalid)
    async with AsyncSessionLocal() as db:
        if invalid == "anonymous_session":
            (await db.get(ChatSession, case.session)).user_id = None
        if invalid == "demo_stranger":
            (await db.get(Document, case.doc)).demo_slug = f"qa-{uuid.uuid4().hex}"
        await db.commit()
        user = await db.get(User, actor_id)
        with pytest.raises(HTTPException) as exc:
            if operation == "preview":
                await sharing.answer_share_state(
                    case.session, message_id, Response(), user, db
                )
            elif operation == "create":
                await sharing.create_answer_share(
                    case.session,
                    message_id,
                    sharing.AnswerShareCreateRequest(snapshot_digest="0" * 64),
                    user,
                    db,
                )
            else:
                await sharing.revoke_answer_shares(case.session, message_id, user, db)
        assert exc.value.status_code == 404


async def test_snapshot_is_immutable_and_changed_preview_requires_new_consent(case):
    before = await preview(case)
    original = await create(case)
    async with AsyncSessionLocal() as db:
        message = await db.get(Message, case.answer)
        message.content = "Revised selected answer."
        message.citations = []
        (await db.get(ChatSession, case.session)).title = "PRIVATE changed title"
        db.add(
            Message(
                session_id=case.session,
                role="assistant",
                content="PRIVATE future answer",
            )
        )
        await db.commit()
    with pytest.raises(HTTPException) as exc:
        await create(case, digest=before["snapshot_digest"])
    assert exc.value.status_code == 409
    assert exc.value.detail["error"] == "SHARE_CHANGED"
    assert (await public(original.share_token)).json() == before["preview"]
    revised = await create(case)
    assert revised.share_token != original.share_token
    assert (await public(revised.share_token)).json()["messages"][0][
        "content"
    ] == "Revised selected answer."
    assert "PRIVATE" not in (await public(revised.share_token)).text


async def synchronize_creators(monkeypatch):
    original = sharing._lock_share_user
    both = asyncio.Event()
    arrived = 0

    async def lock(*args):
        nonlocal arrived
        arrived += 1
        if arrived == 2:
            both.set()
        await asyncio.wait_for(both.wait(), timeout=5)
        return await original(*args)

    monkeypatch.setattr(sharing, "_lock_share_user", lock)


async def test_duplicate_concurrent_create_is_idempotent(case, monkeypatch):
    await synchronize_creators(monkeypatch)
    results = await asyncio.wait_for(
        asyncio.gather(create(case), create(case)), timeout=10
    )
    assert results[0].share_token == results[1].share_token
    async with AsyncSessionLocal() as db:
        assert (
            await db.scalar(
                select(func.count())
                .select_from(AnswerShare)
                .where(AnswerShare.user_id == case.owner)
            )
            == 1
        )


async def test_concurrent_full_and_answer_share_jointly_enforce_last_free_slot(
    case, monkeypatch
):
    await create(case, full=True, session=case.other)
    await create(case, message=case.later)
    await synchronize_creators(monkeypatch)
    results = await asyncio.wait_for(
        asyncio.gather(create(case), create(case, full=True), return_exceptions=True),
        timeout=10,
    )
    assert sum(isinstance(result, sharing.ShareResponse) for result in results) == 1
    error = next(result for result in results if isinstance(result, HTTPException))
    assert error.status_code == 403
    assert error.detail["error"] == "SHARE_LIMIT_REACHED"
    async with AsyncSessionLocal() as db:
        counts = [
            await db.scalar(
                select(func.count())
                .select_from(model)
                .where(model.user_id == case.owner)
            )
            for model in (AnswerShare, SharedSession)
        ]
        assert sum(counts) == 3


async def test_commit_failure_leaves_no_link_and_retry_succeeds(case, monkeypatch):
    state = await preview(case)
    async with AsyncSessionLocal() as db:
        user = await db.get(User, case.owner)

        async def fail_after_insert():
            await db.flush()
            assert (
                await db.scalar(
                    select(func.count())
                    .select_from(AnswerShare)
                    .where(AnswerShare.user_id == case.owner)
                )
                == 1
            )
            raise RuntimeError("injected failure after INSERT")

        monkeypatch.setattr(db, "commit", fail_after_insert)
        with pytest.raises(RuntimeError):
            await sharing.create_answer_share(
                case.session,
                case.answer,
                sharing.AnswerShareCreateRequest(
                    snapshot_digest=state["snapshot_digest"]
                ),
                user,
                db,
            )
        assert not db.in_transaction()
    assert (await preview(case))["active_count"] == 0
    assert (await public((await create(case)).share_token)).status_code == 200


@pytest.mark.parametrize("method", ["answer", "session", "token"])
async def test_revocation_makes_anonymous_url_unavailable_and_releases_slot(
    case, method
):
    answer = await create(case)
    full = await create(case, full=True)
    async with AsyncSessionLocal() as db:
        owner = await db.get(User, case.owner)
        if method == "answer":
            await sharing.revoke_answer_shares(case.session, case.answer, owner, db)
        elif method == "session":
            await sharing.revoke_share(case.session, owner, db)
        else:
            # Someone else cannot revoke the owner's public link.
            stranger = await db.get(User, case.stranger)
            await sharing.revoke_share_token(
                uuid.UUID(answer.share_token), stranger, db
            )
            assert (await public(answer.share_token)).status_code == 200
            await sharing.revoke_share_token(uuid.UUID(answer.share_token), owner, db)
    assert (await public(answer.share_token)).status_code == 404
    assert (await public(full.share_token)).status_code == (
        404 if method == "session" else 200
    )
    assert (await preview(case))["active_count"] == 0
    assert (await create(case)).share_token != answer.share_token


@pytest.mark.parametrize("parent", ["message", "session", "document", "user"])
async def test_parent_delete_cascades_snapshot(case, parent):
    share = await create(case)
    model, key = {
        "message": (Message, case.answer),
        "session": (ChatSession, case.session),
        "document": (Document, case.doc),
        "user": (User, case.owner),
    }[parent]
    async with AsyncSessionLocal() as db:
        await db.execute(delete(model).where(model.id == key))
        await db.commit()
    assert (await public(share.share_token)).status_code == 404


async def test_expired_snapshot_rotates_token_instead_of_reviving_old_url(case):
    first = await create(case)
    async with AsyncSessionLocal() as db:
        row = await db.scalar(
            select(AnswerShare).where(
                AnswerShare.share_token == uuid.UUID(first.share_token)
            )
        )
        row.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        await db.commit()
    assert (await public(first.share_token)).status_code == 410
    assert (await preview(case))["active_count"] == 0
    second = await create(case)
    assert second.share_token != first.share_token
    assert (await public(first.share_token)).status_code == 404
    assert (await public(second.share_token)).status_code == 200


async def test_public_read_revalidates_snapshot_and_rejects_scope_collision(case):
    share = await create(case)
    async with AsyncSessionLocal() as db:
        row = await db.scalar(
            select(AnswerShare).where(
                AnswerShare.share_token == uuid.UUID(share.share_token)
            )
        )
        original = copy.deepcopy(row.snapshot)
        snapshot = copy.deepcopy(original)
        snapshot["private"] = "PRIVATE extra data"
        snapshot["messages"][0]["metadata"] = "PRIVATE extra data"
        row.snapshot = snapshot
        await db.commit()
        response = await public(share.share_token)
        assert response.status_code == 200
        assert response.json() == original
        assert "PRIVATE" not in response.text
        row.snapshot = {**original, "messages": original["messages"] * 2}
        await db.commit()
        assert (await public(share.share_token)).status_code == 404
        row.snapshot = original
        db.add(
            SharedSession(
                user_id=case.owner,
                session_id=case.session,
                share_token=uuid.UUID(share.share_token),
            )
        )
        await db.commit()
    assert (await public(share.share_token)).status_code == 404


async def test_legacy_full_share_keeps_existing_scope(case):
    first = await create(case, full=True)
    assert (await create(case, full=True)).share_token == first.share_token
    response = await public(first.share_token)
    assert response.status_code == 200
    assert response.json()["scope"] == "conversation"
    assert len(response.json()["messages"]) == 3
    assert response.json()["session_title"] == "PRIVATE initial question"


@pytest.mark.parametrize("method", ["get", "post", "delete"])
async def test_answer_routes_require_auth_without_database_access(case, method):
    app = FastAPI()
    app.include_router(sharing.router)

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.request(
            method,
            f"/api/sessions/{case.session}/answers/{case.answer}/share",
            json={"snapshot_digest": "0" * 64},
        )
    assert response.status_code == 401


async def test_create_racing_message_then_session_delete_fails_without_deadlock(
    case, monkeypatch
):
    # Match ORM's child-before-parent delete order, while creation holds the
    # user mutex. Only the message FK should block; no session FK may deadlock.
    locked = asyncio.Event()
    insert_allowed = asyncio.Event()
    original = sharing._lock_share_user
    creating_pid = None

    async def pause_before_insert(*args):
        nonlocal creating_pid
        user = await original(*args)
        creating_pid = await args[1].scalar(select(func.pg_backend_pid()))
        locked.set()
        await asyncio.wait_for(insert_allowed.wait(), timeout=5)
        return user

    monkeypatch.setattr(sharing, "_lock_share_user", pause_before_insert)
    task = asyncio.create_task(create(case))
    await asyncio.wait_for(locked.wait(), timeout=5)
    try:
        async with AsyncSessionLocal() as deleting:
            await deleting.execute(delete(Message).where(Message.id == case.answer))
            deleting_pid = await deleting.scalar(select(func.pg_backend_pid()))
            insert_allowed.set()
            async with AsyncSessionLocal() as observer:
                for _ in range(100):
                    blockers = await observer.scalar(
                        select(func.pg_blocking_pids(creating_pid))
                    )
                    if deleting_pid in blockers:
                        break
                    await asyncio.sleep(0.01)
                else:
                    pytest.fail("Did not reach the intended FK lock conflict")
            await asyncio.wait_for(
                deleting.execute(
                    delete(ChatSession).where(ChatSession.id == case.session)
                ),
                timeout=5,
            )
            await deleting.commit()
        with pytest.raises(HTTPException) as exc:
            await asyncio.wait_for(task, timeout=5)
        assert exc.value.status_code == 409
        async with AsyncSessionLocal() as db:
            assert (
                await db.scalar(
                    select(func.count())
                    .select_from(AnswerShare)
                    .where(AnswerShare.user_id == case.owner)
                )
                == 0
            )
    finally:
        if not task.done():
            task.cancel()
        await asyncio.gather(task, return_exceptions=True)


async def test_collection_delete_cascades_snapshot(case):
    from app.models.tables import Collection

    async with AsyncSessionLocal() as db:
        collection = Collection(user_id=case.owner, name="QA answer-share collection")
        db.add(collection)
        await db.flush()
        session = await db.get(ChatSession, case.session)
        session.document_id = None
        session.collection_id = collection.id
        await db.commit()
        collection_id = collection.id
    try:
        share = await create(case)
    finally:
        async with AsyncSessionLocal() as db:
            await db.execute(delete(Collection).where(Collection.id == collection_id))
            await db.commit()
    assert (await public(share.share_token)).status_code == 404


async def test_idempotent_create_still_succeeds_at_combined_cap(case):
    first = await create(case)
    await create(case, message=case.later)
    full = await create(case, full=True)
    assert (await create(case)).share_token == first.share_token
    assert (await create(case, full=True)).share_token == full.share_token
