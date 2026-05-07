from __future__ import annotations

import uuid
from types import SimpleNamespace

from app.models.tables import Chunk
from app.services import summary_service
from app.services.summary_service import (
    _apply_payload_to_doc_and_brief,
    normalize_document_brief,
)


def _chunk(index: int, *, page: int = 1) -> Chunk:
    return Chunk(
        id=uuid.uuid4(),
        document_id=uuid.uuid4(),
        chunk_index=index,
        text=f"Chunk {index} contains material information.",
        token_count=12,
        page_start=page,
        page_end=page,
        bboxes=[{"page": page, "x": 0.1, "y": 0.2, "w": 0.3, "h": 0.1}],
        section_title=f"Section {index}",
    )


def test_normalize_document_brief_maps_model_refs_to_chunk_metadata() -> None:
    chunks = [_chunk(0, page=1), _chunk(5, page=7)]
    raw = {
        "summary": "Document summary.",
        "outline": [{"title": "Market", "level": 2, "summary": "Market overview.", "source_refs": [2]}],
        "key_points": [{"text": "Important point.", "source_refs": [1, 99]}],
        "facts": [{"label": "Revenue", "value": "$1M", "context": "Reported figure.", "source_refs": ["2"]}],
        "questions": ["What changed?"],
    }

    brief = normalize_document_brief(raw, chunks, chunks_total=20, pages_total=9)

    assert brief["outline"][0]["source_refs"] == [
        {
            "chunk_id": str(chunks[1].id),
            "chunk_index": 5,
            "page": 7,
            "page_end": 7,
        }
    ]
    assert brief["key_points"][0]["source_refs"][0]["chunk_id"] == str(chunks[0].id)
    assert brief["facts"][0]["source_refs"][0]["chunk_index"] == 5
    assert brief["coverage"]["selected_chunk_indices"] == [0, 5]


def test_normalize_document_brief_drops_items_without_valid_refs() -> None:
    chunks = [_chunk(0, page=1)]
    raw = {
        "summary": "Document summary.",
        "outline": [
            {"title": "Unsupported", "summary": "No refs.", "source_refs": []},
            {"title": "Out of range", "summary": "Bad refs.", "source_refs": [99]},
            {"title": "Supported", "summary": "Good refs.", "source_refs": [1]},
        ],
        "key_points": [
            {"text": "Unsupported point.", "source_refs": ["not-a-ref"]},
            {"text": "Supported point.", "source_refs": [1]},
        ],
        "facts": [
            {"label": "Unsupported", "value": "N/A", "source_refs": [42]},
            {"label": "Supported", "value": "Yes", "source_refs": [1]},
        ],
        "questions": ["What changed?"],
    }

    brief = normalize_document_brief(raw, chunks, chunks_total=1, pages_total=1)

    assert [item["title"] for item in brief["outline"]] == ["Supported"]
    assert [item["text"] for item in brief["key_points"]] == ["Supported point."]
    assert [item["label"] for item in brief["facts"]] == ["Supported"]


def test_apply_payload_mirrors_legacy_summary_and_questions() -> None:
    doc = SimpleNamespace(summary=None, suggested_questions=None)
    brief = SimpleNamespace()
    payload = {
        "summary": "A useful summary.",
        "outline": [{"title": "Intro"}],
        "key_points": [{"text": "Point"}],
        "facts": [{"label": "Date", "value": "2026"}],
        "questions": ["What is the core point?"],
        "coverage": {"status": "representative"},
    }

    _apply_payload_to_doc_and_brief(doc, brief, payload, model="deepseek-v4-flash")

    assert brief.summary == "A useful summary."
    assert brief.questions == ["What is the core point?"]
    assert doc.summary == "A useful summary."
    assert doc.suggested_questions == ["What is the core point?"]
    assert brief.error_code is None


class _ScalarResult:
    def __init__(self, value):
        self._value = value

    def scalar_one_or_none(self):
        return self._value


class _ScalarsResult:
    def __init__(self, values):
        self._values = values

    def scalars(self):
        return self._values


class _FakeSyncSession:
    def __init__(self, doc, chunks, existing_brief=None, execute_results=None) -> None:
        self.doc = doc
        self.chunks = chunks
        self.existing_brief = existing_brief
        self.execute_results = list(execute_results) if execute_results is not None else [
            _ScalarsResult(chunks),
            _ScalarResult(existing_brief),
        ]
        self.added: list[object] = []
        self.commits = 0

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def get(self, _model, _id):
        return self.doc

    def execute(self, _stmt):
        if not self.execute_results:
            raise AssertionError("Unexpected execute call")
        return self.execute_results.pop(0)

    def refresh(self, _obj):
        return None

    def add(self, obj):
        self.added.append(obj)

    def commit(self):
        self.commits += 1


class _FakeChoice:
    def __init__(self, content: str):
        self.message = SimpleNamespace(content=content)


class _FakeClient:
    def __init__(self, content: str):
        self.chat = SimpleNamespace(
            completions=SimpleNamespace(
                create=lambda **_kwargs: SimpleNamespace(choices=[_FakeChoice(content)])
            )
        )


def test_generate_document_brief_bad_json_records_error_without_status_change(monkeypatch) -> None:
    doc = SimpleNamespace(
        id=uuid.uuid4(),
        status="ready",
        page_count=1,
        summary=None,
        suggested_questions=None,
    )
    fake_db = _FakeSyncSession(doc, [_chunk(0)])
    monkeypatch.setattr(summary_service, "SyncSessionLocal", lambda: fake_db)
    monkeypatch.setattr(summary_service, "_get_llm_client", lambda _model: _FakeClient("{bad json"))

    summary_service.generate_document_brief_sync(str(doc.id))

    assert doc.status == "ready"
    assert fake_db.commits == 1
    assert fake_db.added[-1].error_code == "BRIEF_JSON_INVALID"


def test_generate_document_brief_records_error_when_llm_unavailable(monkeypatch) -> None:
    doc = SimpleNamespace(
        id=uuid.uuid4(),
        status="ready",
        page_count=1,
        summary=None,
        suggested_questions=None,
    )
    fake_db = _FakeSyncSession(doc, [], execute_results=[_ScalarResult(None)])
    monkeypatch.setattr(summary_service, "SyncSessionLocal", lambda: fake_db)
    monkeypatch.setattr(summary_service, "_get_llm_client", lambda _model: None)

    summary_service.generate_document_brief_sync(str(doc.id))

    assert doc.status == "ready"
    assert fake_db.commits == 1
    assert fake_db.added[-1].error_code == "BRIEF_LLM_UNAVAILABLE"


def test_generate_document_brief_discards_stale_chunks_after_reparse(monkeypatch) -> None:
    doc = SimpleNamespace(
        id=uuid.uuid4(),
        status="ready",
        page_count=1,
        summary=None,
        suggested_questions=None,
    )
    chunks = [_chunk(0)]
    raw = """{
      "summary": "A generated brief.",
      "outline": [{"title": "Only old chunk", "summary": "Old.", "source_refs": [1]}],
      "key_points": [{"text": "Old point.", "source_refs": [1]}],
      "facts": [],
      "questions": ["What changed?"]
    }"""
    fake_db = _FakeSyncSession(
        doc,
        chunks,
        execute_results=[
            _ScalarsResult(chunks),
            _ScalarsResult([]),
        ],
    )
    monkeypatch.setattr(summary_service, "SyncSessionLocal", lambda: fake_db)
    monkeypatch.setattr(summary_service, "_get_llm_client", lambda _model: _FakeClient(raw))

    summary_service.generate_document_brief_sync(str(doc.id))

    assert doc.summary is None
    assert fake_db.commits == 0
    assert fake_db.added == []
