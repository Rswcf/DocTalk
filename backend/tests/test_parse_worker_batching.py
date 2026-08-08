"""Tests for batched parse persistence + soft-limit-aware error handling.

Background (2026-08-08 incident): the parse worker flushed one INSERT round
trip per ORM row. A dense 10-page PDF produces >1k document_elements rows, so
wall time scaled with rows x DB RTT — 190s at cross-region latency, and
220+-page documents died at the 540s soft limit inside element persistence.
Worse, the soft-limit signal landing inside a DB call surfaced as an
OperationalError: the persist handler mislabeled it PERSIST_*_FAILED, wrote
the status through a corrupted connection, and Celery recorded the task as
succeeded so autoretry never fired.

Covered here:
1. `_insert_rows_batched` splits rows into executemany batches (no per-row
   statements).
2. `_chain_has_soft_limit` finds SoftTimeLimitExceeded anywhere in the
   exception chain (direct, __cause__, __context__, absent, cyclic).
3. Persist failures write the error status through a FRESH session, not the
   possibly-corrupted task session.
4. A soft-limit surfacing as a DB error during persist re-raises as
   SoftTimeLimitExceeded -> outer handler marks PARSE_TIMEOUT (not
   PERSIST_*_FAILED) and the task raises so Celery does not record success.
"""
from __future__ import annotations

import uuid
from types import SimpleNamespace

import pytest
from celery.exceptions import SoftTimeLimitExceeded

from app.models.tables import DocumentElement, Page
from app.workers import parse_worker


@pytest.mark.integration
class TestBatchedInsertsAgainstRealPostgres:
    """The stub tests prove call shape; this proves the semantics psycopg
    actually executes: executemany INSERT with JSONB dict params, server
    defaults firing for omitted columns (id/created_at/parent_id), and the
    single-statement vector_id backfill. Requires docker Postgres
    (SKIP_INTEGRATION=0)."""

    def test_batched_rows_round_trip_with_jsonb_and_server_defaults(self):
        from sqlalchemy import String as SaString
        from sqlalchemy import cast as sa_cast
        from sqlalchemy import func, select, update

        from app.models.sync_database import SyncSessionLocal
        from app.models.tables import Chunk, Document

        with SyncSessionLocal() as db:
            doc = Document(
                filename="batching-integration.pdf",
                file_size=1,
                storage_key=f"documents/{uuid.uuid4()}/batching-integration.pdf",
                status="parsing",
            )
            db.add(doc)
            db.commit()
            db.refresh(doc)

            n_elements = parse_worker._PERSIST_BATCH_SIZE + 1  # cross one batch boundary
            element_rows = [
                {
                    "document_id": doc.id,
                    "element_type": "paragraph",
                    "page_start": 1,
                    "page_end": 1,
                    "bbox": {"page": 1, "x0": 0.1, "y0": 0.2, "x1": 0.9, "y1": 0.3},
                    "text": f"element {i}",
                    "reading_order": i,
                    "metadata_json": {"font_size": 12.0, "i": i},
                }
                for i in range(n_elements)
            ]
            parse_worker._insert_rows_batched(db, DocumentElement, element_rows)

            page_rows = [
                {
                    "document_id": doc.id,
                    "page_number": pn,
                    "width_pt": 612.0,
                    "height_pt": 792.0,
                    "rotation": 0,
                    "content": None if pn == 2 else f"page {pn} text",
                }
                for pn in (1, 2)
            ]
            parse_worker._insert_rows_batched(db, Page, page_rows)

            chunk_rows = [
                {
                    "document_id": doc.id,
                    "chunk_index": ci,
                    "text": f"chunk {ci}",
                    "token_count": 3,
                    "page_start": 1,
                    "page_end": 1,
                    "bboxes": [{"page": 1, "x0": 0.0, "y0": 0.0, "x1": 1.0, "y1": 1.0}],
                    "section_title": None,
                }
                for ci in range(2)
            ]
            parse_worker._insert_rows_batched(db, Chunk, chunk_rows)
            db.commit()

            count = db.execute(
                select(func.count()).select_from(DocumentElement).where(DocumentElement.document_id == doc.id)
            ).scalar_one()
            assert count == n_elements

            sample = db.execute(
                select(DocumentElement)
                .where(DocumentElement.document_id == doc.id, DocumentElement.reading_order == 500)
            ).scalar_one()
            assert sample.id is not None and sample.created_at is not None  # server defaults fired
            assert sample.parent_id is None
            assert sample.bbox == {"page": 1, "x0": 0.1, "y0": 0.2, "x1": 0.9, "y1": 0.3}
            assert sample.metadata_json == {"font_size": 12.0, "i": 500}

            pages = db.execute(select(Page).where(Page.document_id == doc.id).order_by(Page.page_number)).scalars().all()
            assert [(p.page_number, p.content) for p in pages] == [(1, "page 1 text"), (2, None)]

            # vector_id backfill: one statement, value equals the row's own id in text form
            db.execute(
                update(Chunk)
                .where(Chunk.id.in_([c.id for c in db.execute(select(Chunk).where(Chunk.document_id == doc.id)).scalars()]))
                .values(vector_id=sa_cast(Chunk.id, SaString))
            )
            db.commit()
            for c in db.execute(select(Chunk).where(Chunk.document_id == doc.id)).scalars():
                assert c.vector_id == str(c.id)

            # cleanup (FK cascade removes pages/elements/chunks)
            db.delete(doc)
            db.commit()


class _RecordingSession:
    def __init__(self, doc: SimpleNamespace | None) -> None:
        self._doc = doc
        self.added: list[object] = []
        self.executed: list[tuple[object, object]] = []
        self.commits = 0

    def __enter__(self) -> "_RecordingSession":
        return self

    def __exit__(self, exc_type, exc, tb) -> bool:
        return False

    def get(self, _model, _doc_id):
        return self._doc

    def add(self, obj) -> None:
        self.added.append(obj)

    def commit(self) -> None:
        self.commits += 1

    def execute(self, stmt, params=None):
        self.executed.append((stmt, params))
        return None

    def rollback(self) -> None:
        return None


class TestInsertRowsBatched:
    def test_splits_into_batches_of_batch_size(self):
        db = _RecordingSession(None)
        rows = [{"n": i} for i in range(parse_worker._PERSIST_BATCH_SIZE * 2 + 1)]

        parse_worker._insert_rows_batched(db, DocumentElement, rows)

        assert len(db.executed) == 3
        sizes = [len(params) for _stmt, params in db.executed]
        assert sizes == [parse_worker._PERSIST_BATCH_SIZE, parse_worker._PERSIST_BATCH_SIZE, 1]
        # Round-trips carry the original rows in order
        flattened = [r for _stmt, params in db.executed for r in params]
        assert flattened == rows

    def test_empty_rows_execute_nothing(self):
        db = _RecordingSession(None)
        parse_worker._insert_rows_batched(db, Page, [])
        assert db.executed == []


class TestChainHasSoftLimit:
    def test_direct_instance(self):
        assert parse_worker._chain_has_soft_limit(SoftTimeLimitExceeded())

    def test_found_via_context(self):
        try:
            try:
                raise SoftTimeLimitExceeded()
            except SoftTimeLimitExceeded:
                raise ValueError("driver error surface")
        except ValueError as e:
            assert parse_worker._chain_has_soft_limit(e)

    def test_found_via_cause(self):
        err = ValueError("wrapped")
        err.__cause__ = SoftTimeLimitExceeded()
        assert parse_worker._chain_has_soft_limit(err)

    def test_found_via_context_hidden_behind_explicit_cause(self):
        """Codex r1 #4: a node carrying BOTH edges must have both walked —
        `__cause__ or __context__` would miss the soft limit here."""
        err = ValueError("wrapped")
        err.__cause__ = KeyError("explicit cause, no soft limit")
        err.__context__ = SoftTimeLimitExceeded()
        assert parse_worker._chain_has_soft_limit(err)

    def test_absent(self):
        try:
            try:
                raise KeyError("inner")
            except KeyError:
                raise ValueError("outer")
        except ValueError as e:
            assert not parse_worker._chain_has_soft_limit(e)

    def test_cyclic_chain_terminates(self):
        a = ValueError("a")
        b = ValueError("b")
        a.__context__ = b
        b.__context__ = a
        assert not parse_worker._chain_has_soft_limit(a)


class TestFailDocFreshSession:
    def test_writes_error_on_new_session_and_reports_success(self, monkeypatch):
        doc = SimpleNamespace(status="parsing", error_msg=None)
        fresh = _RecordingSession(doc)
        made: list[object] = []

        def _factory():
            made.append(fresh)
            return fresh

        monkeypatch.setattr(parse_worker, "SyncSessionLocal", _factory)

        assert parse_worker._fail_doc_fresh_session(str(uuid.uuid4()), "PERSIST_ELEMENTS_FAILED") is True

        assert made, "must open a fresh session"
        assert doc.status == "error"
        assert doc.error_msg.startswith("ERR_CODE:PERSIST_ELEMENTS_FAILED:")
        assert fresh.commits == 1

    def test_missing_document_counts_as_recorded(self, monkeypatch):
        """Doc row already deleted -> nothing to record; retrying the parse
        would be pointless, so this must NOT read as a failed write."""
        monkeypatch.setattr(parse_worker, "SyncSessionLocal", lambda: _RecordingSession(None))
        assert parse_worker._fail_doc_fresh_session(str(uuid.uuid4()), "PERSIST_PAGES_FAILED") is True

    def test_returns_false_when_write_fails(self, monkeypatch):
        """Codex r1 #3: the caller must learn the status write failed so it can
        re-raise the original error instead of returning task success with the
        document stuck in 'parsing'."""

        class _BrokenSession(_RecordingSession):
            def get(self, _model, _doc_id):
                raise RuntimeError("db down")

        monkeypatch.setattr(parse_worker, "SyncSessionLocal", lambda: _BrokenSession(None))
        assert parse_worker._fail_doc_fresh_session(str(uuid.uuid4()), "PERSIST_PAGES_FAILED") is False


def _make_doc(doc_id: uuid.UUID) -> SimpleNamespace:
    return SimpleNamespace(
        id=doc_id,
        storage_key="documents/example.pdf",
        file_type="pdf",
        converted_storage_key=None,
        status="parsing",
        page_count=None,
        pages_parsed=0,
        chunks_total=0,
        chunks_indexed=0,
        summary=None,
        suggested_questions=None,
        error_msg=None,
    )


def _wire_minimal_pdf_parse(monkeypatch, session_factory):
    """Common stubs: download, no OCR, stub Qdrant, one fake extracted page."""
    monkeypatch.setattr(parse_worker, "SyncSessionLocal", session_factory)
    monkeypatch.setattr(parse_worker, "_download_file_bytes", lambda *_a, **_k: b"%PDF-1.4\nfake")
    monkeypatch.setattr(parse_worker.settings, "OCR_ENABLED", False)
    monkeypatch.setattr(parse_worker.embedding_service, "ensure_collection", lambda *_a, **_k: None)

    class _StubQdrant:
        def delete(self, *_a, **_k):
            return None

    monkeypatch.setattr(parse_worker.embedding_service, "get_qdrant_client", lambda *_a, **_k: _StubQdrant())
    monkeypatch.setattr(parse_worker, "detect_low_quality_text", lambda _p, file_type=None: (False, 0.95))

    class _FakeParseService:
        def extract_pages(self, _pdf_bytes: bytes):
            return [
                SimpleNamespace(
                    page_number=1,
                    width_pt=612.0,
                    height_pt=792.0,
                    rotation=0,
                    blocks=[SimpleNamespace(text="x", bbox=(0, 0, 1, 1), font_size=12.0, page=1)],
                    raw_text="x",
                )
            ]

        def detect_scanned(self, _pages) -> bool:
            return False

        def extract_elements(self, _pages):
            return []

        def chunk_document(self, _pages):
            return [
                SimpleNamespace(
                    chunk_index=0,
                    text="chunk text",
                    token_count=2,
                    page_start=1,
                    page_end=1,
                    bboxes=[],
                    section_title=None,
                )
            ]

    monkeypatch.setattr(parse_worker, "ParseService", _FakeParseService)


class TestPersistFailurePaths:
    def test_plain_persist_failure_marks_error_via_fresh_session(self, monkeypatch):
        """An ordinary DB failure during page persist -> PERSIST_PAGES_FAILED,
        written on a session opened AFTER the failure, and the task returns
        (no raise) so autoretry semantics stay unchanged for real DB errors."""
        doc_id = uuid.uuid4()
        doc = _make_doc(doc_id)

        class _FailingParseSession(_RecordingSession):
            def execute(self, stmt, params=None):
                if params is not None:  # the batched page INSERT
                    raise RuntimeError("constraint violation")
                return super().execute(stmt, params)

        task_session = _FailingParseSession(doc)
        fresh_sessions: list[_RecordingSession] = []
        calls = {"n": 0}

        def _factory():
            calls["n"] += 1
            if calls["n"] == 1:
                return task_session
            fresh = _RecordingSession(doc)
            fresh_sessions.append(fresh)
            return fresh

        _wire_minimal_pdf_parse(monkeypatch, _factory)

        parse_worker.parse_document.run(str(doc_id))

        assert doc.status == "error"
        assert doc.error_msg.startswith("ERR_CODE:PERSIST_PAGES_FAILED:")
        assert fresh_sessions, "error status must be written on a fresh session"
        assert fresh_sessions[-1].commits == 1

    def test_persist_failure_with_broken_fresh_session_reraises(self, monkeypatch):
        """Codex r1 #3: if the fresh-session status write ALSO fails (DB outage),
        the task must re-raise the original error — returning would record
        success with the document stuck in 'parsing' forever."""
        doc_id = uuid.uuid4()
        doc = _make_doc(doc_id)

        class _FailingParseSession(_RecordingSession):
            def execute(self, stmt, params=None):
                if params is not None:  # the batched page INSERT
                    raise RuntimeError("constraint violation")
                return super().execute(stmt, params)

        class _BrokenFreshSession(_RecordingSession):
            def get(self, _model, _doc_id):
                raise RuntimeError("db down")

        calls = {"n": 0}

        def _factory():
            calls["n"] += 1
            return _FailingParseSession(doc) if calls["n"] == 1 else _BrokenFreshSession(None)

        _wire_minimal_pdf_parse(monkeypatch, _factory)

        with pytest.raises(RuntimeError, match="constraint violation"):
            parse_worker.parse_document.run(str(doc_id))

        assert doc.status == "parsing"  # non-terminal: autoretry will re-run

    def _run_with_soft_limit_in_db_call(self, monkeypatch, *, retries: int):
        """Drive parse_document into a chained soft-limit DB failure during the
        pages INSERT, at a given Celery retry count."""
        doc_id = uuid.uuid4()
        doc = _make_doc(doc_id)

        class _SoftLimitParseSession(_RecordingSession):
            def execute(self, stmt, params=None):
                if params is not None:  # first batched INSERT (pages)
                    try:
                        raise SoftTimeLimitExceeded()
                    except SoftTimeLimitExceeded:
                        raise RuntimeError("sending query failed: another command is already in progress")
                return super().execute(stmt, params)

        task_session = _SoftLimitParseSession(doc)
        fresh_sessions: list[_RecordingSession] = []
        calls = {"n": 0}

        def _factory():
            calls["n"] += 1
            if calls["n"] == 1:
                return task_session
            fresh = _RecordingSession(doc)
            fresh_sessions.append(fresh)
            return fresh

        _wire_minimal_pdf_parse(monkeypatch, _factory)

        parse_worker.parse_document.push_request(retries=retries)
        try:
            with pytest.raises(SoftTimeLimitExceeded):
                parse_worker.parse_document.run(str(doc_id))
        finally:
            parse_worker.parse_document.pop_request()
        return doc, fresh_sessions

    def test_soft_limit_inside_db_error_final_attempt_becomes_parse_timeout(self, monkeypatch):
        """SoftTimeLimitExceeded surfacing as a chained DB error during persist
        must NOT be mislabeled PERSIST_*_FAILED: on the FINAL attempt the doc
        gets PARSE_TIMEOUT (fresh session) and the task re-raises so Celery
        records the failure."""
        doc, fresh_sessions = self._run_with_soft_limit_in_db_call(
            monkeypatch, retries=parse_worker._PARSE_MAX_RETRIES
        )

        assert doc.status == "error"
        assert doc.error_msg.startswith("ERR_CODE:PARSE_TIMEOUT:")
        assert fresh_sessions, "timeout status must be written on a fresh session"

    def test_soft_limit_with_retries_remaining_stays_non_terminal(self, monkeypatch):
        """Codex r1 #2: while an autoretry is still pending, the doc must NOT
        be flipped to terminal 'error' — that stops the frontend pollers and
        re-opens the reparse endpoint mid-backoff, letting a user-triggered
        parse race the retry. Non-final attempts leave status='parsing'
        (reparse endpoint 409s) and still re-raise for Celery."""
        doc, _fresh = self._run_with_soft_limit_in_db_call(monkeypatch, retries=0)

        assert doc.status == "parsing"
        assert doc.error_msg is None

    def test_soft_limit_inside_embedding_db_error_is_not_vectorize_failed(self, monkeypatch):
        """Codex r1 #1 (BLOCKER): the embedding handler must unwrap chained
        soft limits too — otherwise the production failure mode recurs there:
        VECTORIZE_FAILED written through a corrupted session + task success."""
        doc_id = uuid.uuid4()
        doc = _make_doc(doc_id)

        from sqlalchemy.sql import Select

        class _EmbedSoftLimitSession(_RecordingSession):
            def execute(self, stmt, params=None):
                if isinstance(stmt, Select):  # the chunk reload before embedding
                    try:
                        raise SoftTimeLimitExceeded()
                    except SoftTimeLimitExceeded:
                        raise RuntimeError("sending query failed: another command is already in progress")
                return super().execute(stmt, params)

        _wire_minimal_pdf_parse(monkeypatch, lambda: _EmbedSoftLimitSession(doc))

        with pytest.raises(SoftTimeLimitExceeded):
            parse_worker.parse_document.run(str(doc_id))

        # Non-final attempt (retries=0): status stays non-terminal for the retry
        assert doc.status == "parsing"
        assert doc.error_msg is None

    def test_plain_embedding_failure_marks_vectorize_failed_via_fresh_session(self, monkeypatch):
        doc_id = uuid.uuid4()
        doc = _make_doc(doc_id)

        from sqlalchemy.sql import Select

        class _EmbedFailSession(_RecordingSession):
            def execute(self, stmt, params=None):
                if isinstance(stmt, Select):
                    raise RuntimeError("relation vanished")
                return super().execute(stmt, params)

        task_session = _EmbedFailSession(doc)
        fresh_sessions: list[_RecordingSession] = []
        calls = {"n": 0}

        def _factory():
            calls["n"] += 1
            if calls["n"] == 1:
                return task_session
            fresh = _RecordingSession(doc)
            fresh_sessions.append(fresh)
            return fresh

        _wire_minimal_pdf_parse(monkeypatch, _factory)

        parse_worker.parse_document.run(str(doc_id))

        assert doc.status == "error"
        assert doc.error_msg.startswith("ERR_CODE:VECTORIZE_FAILED:")
        assert fresh_sessions, "error status must be written on a fresh session"
