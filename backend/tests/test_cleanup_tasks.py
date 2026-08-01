from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
import sqlalchemy as sa

from app.models.sync_database import SyncSessionLocal
from app.models.tables import ChatSession, Document, Message, User
from app.workers import cleanup_tasks


def test_cleanup_uses_psycopg_driver(monkeypatch) -> None:
    captured: dict[str, object] = {}

    class DummyTransaction:
        def __enter__(self):
            return SimpleNamespace(execute=lambda *_args, **_kwargs: SimpleNamespace(rowcount=0))

        def __exit__(self, exc_type, exc, tb):
            return False

    class DummyEngine:
        def begin(self):
            return DummyTransaction()

        def dispose(self):
            captured["disposed"] = True

    def fake_create_engine(url: str):
        captured["url"] = url
        return DummyEngine()

    monkeypatch.setattr(
        cleanup_tasks.settings,
        "DATABASE_URL",
        "postgresql+asyncpg://postgres:postgres@localhost:5432/postgres",
    )
    monkeypatch.setattr(cleanup_tasks.sa, "create_engine", fake_create_engine)

    cleanup_tasks.cleanup_expired_verification_tokens()

    assert captured["url"] == "postgresql+psycopg://postgres:postgres@localhost:5432/postgres"
    assert captured["disposed"] is True


def _make_document(db, *, demo_slug: str | None) -> Document:
    doc = Document(
        filename="demo.pdf",
        file_size=1024,
        storage_key=f"test/{uuid.uuid4()}.pdf",
        demo_slug=demo_slug,
    )
    db.add(doc)
    db.flush()
    return doc


def _make_session(db, *, document_id, user_id, created_at) -> ChatSession:
    sess = ChatSession(document_id=document_id, user_id=user_id, created_at=created_at)
    db.add(sess)
    db.flush()
    return sess


@pytest.mark.integration
def test_cleanup_empty_demo_sessions_deletes_only_stale_empty_anonymous_demo_sessions() -> None:
    now = datetime.now(timezone.utc)
    old = now - timedelta(days=8)
    recent = now - timedelta(days=1)

    with SyncSessionLocal() as db:
        demo_doc = _make_document(db, demo_slug=f"cleanup-test-{uuid.uuid4().hex[:8]}")
        user = User(email=f"cleanup-{uuid.uuid4().hex}@example.com")
        db.add(user)
        db.flush()

        # (a) anonymous, demo doc, 8 days old, 0 messages -> deleted
        stale_empty = _make_session(db, document_id=demo_doc.id, user_id=None, created_at=old)

        # (b) same but with 1 message -> kept
        stale_with_message = _make_session(db, document_id=demo_doc.id, user_id=None, created_at=old)
        db.add(Message(session_id=stale_with_message.id, role="user", content="hi"))

        # (c) anonymous, demo doc, 1 day old, 0 messages -> kept
        recent_empty = _make_session(db, document_id=demo_doc.id, user_id=None, created_at=recent)

        # (d) authed session, 8 days old, 0 messages -> kept
        authed_empty = _make_session(db, document_id=demo_doc.id, user_id=user.id, created_at=old)

        db.commit()

        session_ids = {
            "stale_empty": stale_empty.id,
            "stale_with_message": stale_with_message.id,
            "recent_empty": recent_empty.id,
            "authed_empty": authed_empty.id,
        }
        document_id = demo_doc.id
        user_id = user.id

    try:
        deleted = cleanup_tasks.cleanup_empty_demo_sessions()
        assert deleted == 1

        with SyncSessionLocal() as db:
            remaining_ids = {
                row[0]
                for row in db.execute(
                    sa.select(ChatSession.id).where(ChatSession.id.in_(session_ids.values()))
                )
            }
        assert session_ids["stale_empty"] not in remaining_ids
        assert session_ids["stale_with_message"] in remaining_ids
        assert session_ids["recent_empty"] in remaining_ids
        assert session_ids["authed_empty"] in remaining_ids
    finally:
        with SyncSessionLocal() as db:
            db.execute(sa.delete(Message).where(Message.session_id.in_(session_ids.values())))
            db.execute(sa.delete(ChatSession).where(ChatSession.id.in_(session_ids.values())))
            db.execute(sa.delete(Document).where(Document.id == document_id))
            db.execute(sa.delete(User).where(User.id == user_id))
            db.commit()
