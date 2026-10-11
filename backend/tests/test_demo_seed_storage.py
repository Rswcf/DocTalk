"""Tests for demo self-heal MinIO object verification (B0).

2026-08-02 incident: a MinIO v2 migration lost ~106/108 stored files. The
existing self-heal only checked Qdrant vector counts, so it never noticed the
underlying PDF bytes were gone. `_ensure_demo_files` stats each demo doc's
storage object and re-uploads from `backend/seed_data/` (id- and
key-preserving — the DB row is untouched) when the object is missing.
"""
from __future__ import annotations

import sys
import uuid
from pathlib import Path
from types import SimpleNamespace

import pytest
from minio.error import S3Error
from sqlalchemy import select

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services import demo_seed  # noqa: E402
from app.services.parse_service import PARSE_PIPELINE_VERSION  # noqa: E402


def _seed_pdf_bytes(slug: str) -> bytes:
    spec = next(s for s in demo_seed.DEMO_DOCS if s["slug"] == slug)
    path = Path(demo_seed.__file__).resolve().parents[2] / spec["local_path"]
    return path.read_bytes()


def _s3_error(code: str) -> S3Error:
    # Real minio.error.S3Error — the implementation catches this exact type
    # and inspects .code, so the test double must raise the real class, not
    # a lookalike Exception subclass.
    return S3Error(
        response=None, code=code, message=code, resource=None,
        request_id=None, host_id=None,
    )


class _FakeMinioClient:
    """Minimal MinIO client double: records stat/put calls, no network."""

    def __init__(self, missing_keys: set[str]) -> None:
        self.missing_keys = missing_keys
        self.put_calls: list[tuple[str, str, int, str]] = []

    def stat_object(self, bucket: str, key: str):
        if key in self.missing_keys:
            raise _s3_error("NoSuchKey")
        return SimpleNamespace(size=123)

    def put_object(self, bucket, key, data, length, content_type):
        self.put_calls.append((bucket, key, length, content_type))
        # Drain the stream like the real client would.
        data.read()


def _doc(slug: str, storage_key: str) -> SimpleNamespace:
    return SimpleNamespace(id=uuid.uuid4(), demo_slug=slug, storage_key=storage_key)


class TestEnsureDemoFiles:
    def test_missing_object_is_restored_to_exact_storage_key(self, monkeypatch):
        doc = _doc("alphabet-earnings", "documents/abc/Alphabet Q4 2025 Earnings Release.pdf")
        client = _FakeMinioClient(missing_keys={doc.storage_key})
        monkeypatch.setattr(demo_seed, "_get_minio_client", lambda: client)
        monkeypatch.setattr(demo_seed.settings, "MINIO_BUCKET", "test-bucket")

        restored = demo_seed._ensure_demo_files([doc])

        assert restored == 1
        assert len(client.put_calls) == 1
        bucket, key, length, content_type = client.put_calls[0]
        assert bucket == "test-bucket"
        assert key == doc.storage_key  # id- and key-preserving
        assert content_type == "application/pdf"
        assert length == len(_seed_pdf_bytes("alphabet-earnings"))

    def test_existing_object_is_not_reuploaded(self, monkeypatch):
        doc = _doc("attention-paper", "documents/def/Attention Is All You Need.pdf")
        client = _FakeMinioClient(missing_keys=set())  # stat succeeds
        monkeypatch.setattr(demo_seed, "_get_minio_client", lambda: client)
        monkeypatch.setattr(demo_seed.settings, "MINIO_BUCKET", "test-bucket")

        restored = demo_seed._ensure_demo_files([doc])

        assert restored == 0
        assert client.put_calls == []

    def test_unknown_slug_is_skipped_without_crash(self, monkeypatch):
        doc = _doc("not-a-real-demo-slug", "documents/xyz/whatever.pdf")
        client = _FakeMinioClient(missing_keys={doc.storage_key})
        monkeypatch.setattr(demo_seed, "_get_minio_client", lambda: client)
        monkeypatch.setattr(demo_seed.settings, "MINIO_BUCKET", "test-bucket")

        restored = demo_seed._ensure_demo_files([doc])

        assert restored == 0
        assert client.put_calls == []

    def test_mixed_batch_only_restores_missing_ones(self, monkeypatch):
        missing_doc = _doc("court-filing", "documents/aaa/US District Court Filing.pdf")
        present_doc = _doc("alphabet-earnings", "documents/bbb/Alphabet Q4 2025 Earnings Release.pdf")
        unknown_doc = _doc("ghost-slug", "documents/ccc/ghost.pdf")
        client = _FakeMinioClient(missing_keys={missing_doc.storage_key, unknown_doc.storage_key})
        monkeypatch.setattr(demo_seed, "_get_minio_client", lambda: client)
        monkeypatch.setattr(demo_seed.settings, "MINIO_BUCKET", "test-bucket")

        restored = demo_seed._ensure_demo_files([missing_doc, present_doc, unknown_doc])

        assert restored == 1
        assert [c[1] for c in client.put_calls] == [missing_doc.storage_key]

    def test_other_s3_error_codes_do_not_trigger_upload(self, monkeypatch):
        """A non-NoSuchKey S3Error (e.g. transient AccessDenied) must not be
        treated as 'missing' — re-uploading on every transient error would
        thrash MinIO. It should be logged and skipped, not crash startup."""
        doc = _doc("alphabet-earnings", "documents/abc/Alphabet Q4 2025 Earnings Release.pdf")

        class _DeniedClient(_FakeMinioClient):
            def stat_object(self, bucket, key):
                raise _s3_error("AccessDenied")

        client = _DeniedClient(missing_keys=set())
        monkeypatch.setattr(demo_seed, "_get_minio_client", lambda: client)
        monkeypatch.setattr(demo_seed.settings, "MINIO_BUCKET", "test-bucket")

        restored = demo_seed._ensure_demo_files([doc])

        assert restored == 0
        assert client.put_calls == []

    def test_one_doc_failure_does_not_block_the_rest(self, monkeypatch):
        """Wrap per-doc in try/except so one failure never blocks startup."""
        exploding_doc = _doc("alphabet-earnings", "documents/explode/x.pdf")
        healthy_doc = _doc("court-filing", "documents/ok/US District Court Filing.pdf")

        class _ExplodingClient(_FakeMinioClient):
            def stat_object(self, bucket, key):
                if "explode" in key:
                    raise RuntimeError("network blip")
                return super().stat_object(bucket, key)

        client = _ExplodingClient(missing_keys={healthy_doc.storage_key})
        monkeypatch.setattr(demo_seed, "_get_minio_client", lambda: client)
        monkeypatch.setattr(demo_seed.settings, "MINIO_BUCKET", "test-bucket")

        restored = demo_seed._ensure_demo_files([exploding_doc, healthy_doc])

        assert restored == 1
        assert [c[1] for c in client.put_calls] == [healthy_doc.storage_key]


@pytest.mark.asyncio
async def test_public_demo_list_only_advertises_seeded_slugs(monkeypatch) -> None:
    """Retired demo rows (nvidia-10k, nda-contract) lost their files in
    2026-06 and nothing reseeds them; the public list must not offer them."""
    from unittest.mock import AsyncMock

    from sqlalchemy.dialects import postgresql

    from app.api import documents as documents_api

    seeded = SimpleNamespace(
        demo_slug="alphabet-earnings", id=uuid.uuid4(), filename="a.pdf", status="ready"
    )
    result = SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [seeded]))
    db = SimpleNamespace(execute=AsyncMock(return_value=result))
    monkeypatch.setattr(documents_api, "cache_get", AsyncMock(return_value=None))
    monkeypatch.setattr(documents_api, "cache_set", AsyncMock())

    payload = await documents_api.get_demo_documents(db)

    assert [item["slug"] for item in payload] == ["alphabet-earnings"]
    sql = str(
        db.execute.await_args.args[0].compile(
            dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}
        )
    )
    for spec in demo_seed.DEMO_DOCS:
        assert f"'{spec['slug']}'" in sql
    assert "documents.demo_slug IN (" in sql
    assert "nvidia-10k" not in sql


def _sql(stmt) -> str:
    from sqlalchemy.dialects import postgresql

    return str(stmt.compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}))


class _FakeRefreshSession:
    """Sync session double for refresh_stale_demo_parses: the first execute is
    the stale-row SELECT, every later one is a claim UPDATE."""

    def __init__(self, stale_docs: list, claim_rowcounts: list[int], events: list) -> None:
        self.stale_docs = stale_docs
        self.claim_rowcounts = list(claim_rowcounts)
        self.events = events
        self.statements: list = []

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def execute(self, stmt):
        self.statements.append(stmt)
        if len(self.statements) == 1:
            docs = self.stale_docs
            return SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: docs))
        self.events.append("claim")
        return SimpleNamespace(rowcount=self.claim_rowcounts.pop(0))

    def commit(self):
        self.events.append("commit")


class TestRefreshStaleDemoParses:
    """A parser fix must reach the demo docs. The vector/error self-heal never
    looks at parse_version, the backfill script skips demo rows and /reparse
    is owner-only, so the production attention-paper demo doc kept its
    February parse (arXiv stamp as every chunk's section title)."""

    def _setup(self, monkeypatch, stale_docs, claim_rowcounts=(1,), exists=True):
        from app.services.storage_service import storage_service
        from app.workers import parse_worker

        events: list = []
        session = _FakeRefreshSession(stale_docs, list(claim_rowcounts), events)
        ensured: list = []
        dispatched: list = []

        def _exists(key):
            if isinstance(exists, Exception):
                raise exists
            return exists

        def _delay(doc_id):
            events.append("delay")
            dispatched.append(doc_id)

        monkeypatch.setattr(demo_seed, "SyncSessionLocal", lambda: session)
        monkeypatch.setattr(demo_seed, "_ensure_demo_files", lambda docs: ensured.append(list(docs)) or 0)
        monkeypatch.setattr(storage_service, "object_exists", _exists)
        monkeypatch.setattr(parse_worker.parse_document, "delay", _delay)
        return session, ensured, dispatched, events

    def test_stale_ready_demo_doc_is_claimed_then_dispatched(self, monkeypatch):
        doc = _doc("attention-paper", "documents/def/Attention Is All You Need.pdf")
        session, ensured, dispatched, events = self._setup(monkeypatch, [doc])

        assert demo_seed.refresh_stale_demo_parses() == 1

        assert ensured == [[doc]]
        assert dispatched == [str(doc.id)]
        # Dispatch contract: the claim is committed before the task is published.
        assert events == ["claim", "commit", "delay"]
        claim = _sql(session.statements[1])
        assert claim.startswith("UPDATE documents SET status='parsing', parse_requested_locale=NULL, updated_at=now()")
        assert f"documents.id = '{doc.id}'" in claim
        assert "documents.status = 'ready'" in claim
        assert f"documents.parse_version IS NULL OR documents.parse_version < {PARSE_PIPELINE_VERSION}" in claim

    def test_select_targets_ready_seeded_demo_docs_below_current_version(self, monkeypatch):
        session, ensured, dispatched, _events = self._setup(monkeypatch, [])

        assert demo_seed.refresh_stale_demo_parses() == 0

        select_sql = _sql(session.statements[0])
        for spec in demo_seed.DEMO_DOCS:
            assert f"'{spec['slug']}'" in select_sql
        assert "documents.status = 'ready'" in select_sql
        assert f"documents.parse_version IS NULL OR documents.parse_version < {PARSE_PIPELINE_VERSION}" in select_sql
        assert ensured == [] and dispatched == []

    def test_lost_claim_is_not_dispatched(self, monkeypatch):
        doc = _doc("attention-paper", "documents/def/Attention Is All You Need.pdf")
        _session, _ensured, dispatched, _events = self._setup(monkeypatch, [doc], claim_rowcounts=(0,))

        assert demo_seed.refresh_stale_demo_parses() == 0
        assert dispatched == []

    def test_missing_original_is_never_claimed(self, monkeypatch):
        # The worker would return the doc to 'ready' at the old version and
        # every beat tick would claim it again.
        doc = _doc("attention-paper", "documents/def/Attention Is All You Need.pdf")
        session, _ensured, dispatched, _events = self._setup(monkeypatch, [doc], exists=False)

        assert demo_seed.refresh_stale_demo_parses() == 0
        assert len(session.statements) == 1  # no claim UPDATE
        assert dispatched == []

    def test_storage_outage_is_never_claimed(self, monkeypatch):
        doc = _doc("attention-paper", "documents/def/Attention Is All You Need.pdf")
        session, _ensured, dispatched, _events = self._setup(
            monkeypatch, [doc], exists=RuntimeError("bucket unreachable")
        )

        assert demo_seed.refresh_stale_demo_parses() == 0
        assert len(session.statements) == 1
        assert dispatched == []

    def test_dispatch_failure_is_logged_not_raised(self, monkeypatch):
        doc = _doc("attention-paper", "documents/def/Attention Is All You Need.pdf")
        self._setup(monkeypatch, [doc])
        from app.workers import parse_worker

        def _boom(_doc_id):
            raise RuntimeError("broker down")

        monkeypatch.setattr(parse_worker.parse_document, "delay", _boom)

        assert demo_seed.refresh_stale_demo_parses() == 0

    def test_startup_seeding_runs_the_refresh_and_survives_its_failure(self, monkeypatch):
        calls: list = []

        def _refresh():
            calls.append("refresh")
            raise RuntimeError("db blip")

        monkeypatch.setattr(demo_seed, "DEMO_DOCS", [])
        monkeypatch.setattr(demo_seed, "SyncSessionLocal", lambda: _FakeRefreshSession([], [], []))
        monkeypatch.setattr(demo_seed, "_ensure_demo_files", lambda docs: 0)
        monkeypatch.setattr(demo_seed, "refresh_stale_demo_parses", _refresh)

        demo_seed.seed_demo_documents()

        assert calls == ["refresh"]

    def test_beat_runs_the_refresh(self):
        from app.workers import cleanup_tasks  # noqa: F401  (registers the task)
        from app.workers.celery_app import celery_app

        entry = celery_app.conf.beat_schedule["refresh-stale-demo-parses"]
        assert entry["task"] == "refresh_stale_demo_parses"
        assert "refresh_stale_demo_parses" in celery_app.tasks


class _FakeSeedSession:
    """Sync session double for seed_demo_documents with one existing row: the
    first execute is the by-slug lookup, every later one is a claim UPDATE."""

    def __init__(self, existing, events: list) -> None:
        self.existing = existing
        self.events = events
        self.statements: list = []
        self.deleted: list = []

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def execute(self, stmt):
        self.statements.append(stmt)
        if len(self.statements) == 1:
            existing = self.existing
            return SimpleNamespace(scalar_one_or_none=lambda: existing)
        self.events.append("claim")
        return SimpleNamespace(rowcount=1)

    def commit(self):
        self.events.append("commit")

    def rollback(self):
        self.events.append("rollback")

    def delete(self, obj):
        self.deleted.append(obj)


class TestErroredDemoDocIsReparsedInPlace:
    """Codex r1: the version refresh adds a new way for a healthy demo doc to
    reach 'error' (a transient Qdrant/embedding failure on the re-parse).
    Startup used to delete such a row and re-create it under a new uuid,
    breaking the public /d/<id> link and dropping its sessions."""

    def test_errored_demo_row_is_claimed_and_reparsed_under_the_same_id(self, monkeypatch):
        from app.services.storage_service import storage_service
        from app.workers import parse_worker

        doc = _doc("attention-paper", "documents/def/Attention Is All You Need.pdf")
        doc.status = "error"
        events: list = []
        session = _FakeSeedSession(doc, events)
        ensured: list = []
        dispatched: list = []
        uploads: list = []

        monkeypatch.setattr(demo_seed, "DEMO_DOCS", [s for s in demo_seed.DEMO_DOCS if s["slug"] == "attention-paper"])
        monkeypatch.setattr(demo_seed, "SyncSessionLocal", lambda: session)
        monkeypatch.setattr(demo_seed, "_ensure_demo_files", lambda docs: ensured.append(list(docs)) or 0)
        monkeypatch.setattr(demo_seed, "_get_minio_client", lambda: SimpleNamespace(put_object=lambda *a, **k: uploads.append(a)))
        monkeypatch.setattr(demo_seed, "refresh_stale_demo_parses", lambda: 0)
        monkeypatch.setattr(storage_service, "object_exists", lambda key: True)

        def _delay(doc_id):
            events.append("delay")
            dispatched.append(doc_id)

        monkeypatch.setattr(parse_worker.parse_document, "delay", _delay)

        demo_seed.seed_demo_documents()

        assert session.deleted == []
        assert uploads == []  # no new object, so no new document row either
        assert [doc] in ensured
        assert dispatched == [str(doc.id)]
        assert events == ["claim", "commit", "delay"]
        claim = _sql(session.statements[1])
        assert claim.startswith("UPDATE documents SET status='parsing', parse_requested_locale=NULL, updated_at=now()")
        assert f"documents.id = '{doc.id}'" in claim
        assert "documents.status = 'error'" in claim


@pytest.mark.integration
class TestRefreshStaleDemoParsesPostgres:
    """Real-Postgres proof of the claim: only ready demo rows below the current
    PARSE_PIPELINE_VERSION are claimed, the claim resets the stored locale and
    refreshes updated_at (the stale watchdog keys on it), and a second sweep
    is a no-op."""

    def test_claims_only_stale_ready_demo_rows_once(self, monkeypatch):
        from sqlalchemy import func as sa_func
        from sqlalchemy import select as sa_select
        from sqlalchemy import text as sa_text
        from sqlalchemy import update as sa_update

        from app.models.sync_database import SyncSessionLocal
        from app.models.tables import Document
        from app.services.parse_service import PARSE_PIPELINE_VERSION
        from app.services.storage_service import storage_service
        from app.workers import parse_worker

        tag = uuid.uuid4().hex[:8]
        slugs = {name: f"refresh-{name}-{tag}" for name in ("stale", "current", "errored", "legacy")}
        # Only stale/current/errored are seeded demo slugs; 'legacy' is a
        # retired demo row (nvidia-10k style) that must never be re-parsed.
        monkeypatch.setattr(
            demo_seed, "DEMO_DOCS", [{"slug": slugs[n]} for n in ("stale", "current", "errored")]
        )
        monkeypatch.setattr(demo_seed, "_ensure_demo_files", lambda docs: 0)
        monkeypatch.setattr(storage_service, "object_exists", lambda key: True)
        dispatched: list[str] = []
        monkeypatch.setattr(parse_worker.parse_document, "delay", lambda doc_id: dispatched.append(doc_id))

        def _row(name: str, status: str, version) -> Document:
            return Document(
                filename=f"{name}.pdf",
                file_size=1,
                storage_key=f"documents/{uuid.uuid4()}/{name}.pdf",
                status=status,
                demo_slug=slugs[name],
                parse_version=version,
                parse_requested_locale="ja",
            )

        with SyncSessionLocal() as db:
            rows = {
                "stale": _row("stale", "ready", None),
                "current": _row("current", "ready", PARSE_PIPELINE_VERSION),
                "errored": _row("errored", "error", None),
                "legacy": _row("legacy", "ready", None),
            }
            db.add_all(rows.values())
            db.commit()
            ids = {name: row.id for name, row in rows.items()}
            db.execute(
                sa_update(Document)
                .where(Document.id.in_(ids.values()))
                .values(updated_at=sa_func.now() - sa_text("interval '2 hours'"))
            )
            db.commit()

        try:
            assert demo_seed.refresh_stale_demo_parses() == 1
            assert dispatched == [str(ids["stale"])]
            assert demo_seed.refresh_stale_demo_parses() == 0
            assert dispatched == [str(ids["stale"])]

            with SyncSessionLocal() as db:
                got = {
                    r.id: r
                    for r in db.execute(
                        sa_select(
                            Document.id,
                            Document.status,
                            Document.parse_requested_locale,
                            (Document.updated_at > sa_func.now() - sa_text("interval '1 minute'")).label("fresh"),
                        ).where(Document.id.in_(ids.values()))
                    ).all()
                }
            assert (got[ids["stale"]].status, got[ids["stale"]].parse_requested_locale, got[ids["stale"]].fresh) == (
                "parsing", None, True,
            )
            for name in ("current", "errored", "legacy"):
                assert got[ids[name]].parse_requested_locale == "ja"
                assert got[ids[name]].fresh is False
            assert got[ids["current"]].status == "ready"
            assert got[ids["errored"]].status == "error"
            assert got[ids["legacy"]].status == "ready"
        finally:
            with SyncSessionLocal() as db:
                for did in ids.values():
                    row = db.get(Document, did)
                    if row:
                        db.delete(row)
                db.commit()

    def test_startup_reparses_an_errored_demo_row_under_the_same_id(self, monkeypatch):
        from app.models.sync_database import SyncSessionLocal
        from app.models.tables import Document
        from app.services.storage_service import storage_service
        from app.workers import parse_worker

        slug = f"refresh-errored-{uuid.uuid4().hex[:8]}"
        monkeypatch.setattr(demo_seed, "DEMO_DOCS", [{"slug": slug, "local_path": "seed_data/none.pdf"}])
        monkeypatch.setattr(demo_seed, "_ensure_demo_files", lambda docs: 0)
        monkeypatch.setattr(storage_service, "object_exists", lambda key: True)
        dispatched: list[str] = []
        monkeypatch.setattr(parse_worker.parse_document, "delay", lambda doc_id: dispatched.append(doc_id))

        with SyncSessionLocal() as db:
            row = Document(
                filename="errored.pdf",
                file_size=1,
                storage_key=f"documents/{uuid.uuid4()}/errored.pdf",
                status="error",
                demo_slug=slug,
                parse_requested_locale="ja",
            )
            db.add(row)
            db.commit()
            doc_id = row.id

        try:
            demo_seed.seed_demo_documents()

            assert dispatched == [str(doc_id)]
            with SyncSessionLocal() as db:
                rows = db.execute(
                    select(Document.id, Document.status, Document.parse_requested_locale).where(
                        Document.demo_slug == slug
                    )
                ).all()
            assert [tuple(r) for r in rows] == [(doc_id, "parsing", None)]
        finally:
            with SyncSessionLocal() as db:
                for r in db.execute(select(Document).where(Document.demo_slug == slug)).scalars():
                    db.delete(r)
                db.commit()
