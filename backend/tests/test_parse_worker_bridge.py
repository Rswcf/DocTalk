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
