from __future__ import annotations

import uuid
from types import SimpleNamespace

from app.workers import parse_worker


class _StubSyncSession:
    def __init__(self, doc: SimpleNamespace | None) -> None:
        self._doc = doc
        self.added: list[object] = []
        self.commits = 0

    def __enter__(self) -> "_StubSyncSession":
        return self

    def __exit__(self, exc_type, exc, tb) -> bool:
        return False

    def get(self, _model, _doc_id):
        return self._doc

    def add(self, obj) -> None:
        self.added.append(obj)

    def commit(self) -> None:
        self.commits += 1


class _StubParseSession(_StubSyncSession):
    def execute(self, _stmt):
        return None

    def rollback(self) -> None:
        return None


def test_set_doc_error_happy_path() -> None:
    doc = SimpleNamespace(status="parsing", error_msg=None)

    parse_worker._set_doc_error(doc, "DOWNLOAD_FAILED", "Failed to download document file")

    assert doc.status == "error"
    assert doc.error_msg == "ERR_CODE:DOWNLOAD_FAILED:Failed to download document file"


def test_set_doc_error_uses_default_human_text() -> None:
    doc = SimpleNamespace(status="parsing", error_msg=None)

    parse_worker._set_doc_error(doc, "DOWNLOAD_FAILED")

    assert doc.status == "error"
    assert doc.error_msg == "ERR_CODE:DOWNLOAD_FAILED:Failed to download document file"


def test_set_doc_error_unknown_code_falls_back() -> None:
    doc = SimpleNamespace(status="parsing", error_msg=None)

    parse_worker._set_doc_error(doc, "UNKNOWN_CODE")

    assert doc.status == "error"
    assert doc.error_msg == "ERR_CODE:UNKNOWN_CODE:Document processing failed"


def test_set_doc_error_is_idempotent_for_prefixed_input() -> None:
    doc = SimpleNamespace(status="parsing", error_msg=None)

    parse_worker._set_doc_error(doc, "A", "foo")
    parse_worker._set_doc_error(doc, "A", doc.error_msg)

    assert doc.status == "error"
    assert doc.error_msg == "ERR_CODE:A:foo"


def test_set_doc_error_preserves_empty_string_human() -> None:
    doc = SimpleNamespace(status="parsing", error_msg=None)

    parse_worker._set_doc_error(doc, "A", "")

    assert doc.status == "error"
    assert doc.error_msg == "ERR_CODE:A:"


def test_set_timeout_error_writes_prefixed_parse_timeout(
    monkeypatch,
) -> None:
    doc = SimpleNamespace(status="parsing", error_msg=None)
    stub_session = _StubSyncSession(doc)
    monkeypatch.setattr(parse_worker, "SyncSessionLocal", lambda: stub_session)

    parse_worker._set_timeout_error(str(uuid.uuid4()), "timed out at 9m")

    assert doc.status == "error"
    assert doc.error_msg == "ERR_CODE:PARSE_TIMEOUT:timed out at 9m"
    assert stub_session.commits == 1
    assert stub_session.added == [doc]


def test_queue_document_brief_dispatches_task(monkeypatch) -> None:
    queued: list[str] = []

    class _Task:
        @staticmethod
        def delay(document_id: str) -> None:
            queued.append(document_id)

    import app.workers.brief_worker as brief_worker

    monkeypatch.setattr(brief_worker, "generate_document_brief", _Task)

    parse_worker._queue_document_brief("doc-123")

    assert queued == ["doc-123"]


def test_parse_document_uses_forwarded_locale_for_ocr(monkeypatch) -> None:
    doc_id = uuid.uuid4()
    doc = SimpleNamespace(
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
    stub_session = _StubParseSession(doc)
    monkeypatch.setattr(parse_worker, "SyncSessionLocal", lambda: stub_session)
    monkeypatch.setattr(parse_worker, "_download_file_bytes", lambda *_args, **_kwargs: b"%PDF-1.4\nfake")
    monkeypatch.setattr(parse_worker.settings, "OCR_ENABLED", True)
    monkeypatch.setattr(parse_worker.settings, "OCR_DPI", 300)

    # The Qdrant pre-delete (R2b) runs before extraction — stub embedding_service so it
    # succeeds instead of timing out against a real Qdrant.
    class _StubQdrant:
        def delete(self, *_a, **_k) -> None:
            return None

    monkeypatch.setattr(parse_worker.embedding_service, "ensure_collection", lambda *_a, **_k: None)
    monkeypatch.setattr(parse_worker.embedding_service, "get_qdrant_client", lambda *_a, **_k: _StubQdrant())
    # OSD self-detection (R2b): keep rendering/subprocess out of the unit test.
    monkeypatch.setattr(parse_worker, "detect_script_osd", lambda *_a, **_k: "Japanese")

    resolver_calls: list[tuple] = []
    ocr_calls: list[tuple[str, int]] = []

    def fake_resolve_ocr_languages(locale: str | None = None, script: str | None = None) -> str:
        resolver_calls.append((locale, script))
        return "jpn"

    class _FakeParseService:
        def extract_pages(self, _pdf_bytes: bytes):
            return [SimpleNamespace(page_number=1, width_pt=612.0, height_pt=792.0, rotation=0, blocks=[])]

        def detect_scanned(self, _pages) -> bool:
            return True

        def extract_pages_ocr(self, _pdf_bytes: bytes, *, languages: str, dpi: int):
            ocr_calls.append((languages, dpi))
            return [
                SimpleNamespace(
                    page_number=1,
                    width_pt=612.0,
                    height_pt=792.0,
                    rotation=0,
                    blocks=[SimpleNamespace(text="x")],
                )
            ]

    monkeypatch.setattr(parse_worker, "resolve_ocr_languages", fake_resolve_ocr_languages)
    monkeypatch.setattr(parse_worker, "ParseService", _FakeParseService)

    parse_worker.parse_document.run(str(doc_id), locale="ja")

    # locale forwarded + OSD script passed to the resolver; resolved languages used for OCR
    assert resolver_calls == [("ja", "Japanese")]
    assert ocr_calls == [("jpn", 300)]
