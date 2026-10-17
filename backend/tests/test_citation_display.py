"""Evidence text and page labels must refer to the same supporting passage."""
import uuid
from copy import deepcopy
from datetime import datetime, timezone
from types import SimpleNamespace

import fitz
import pytest
from docx import Document

from app.api.sharing import _answer_snapshot
from app.services.chat_service import _ChunkInfo, _citation_payload, _locate_citation
from app.services.citation_display import citation_display, display_citations
from app.services.export_service import render_docx, render_markdown, render_pdf

FIRST = "Revenue for 2026 was EUR 1,200,000. " * 5
LAST = "This document does not state the company founding year."


def source(**changes):
    values = dict(id=uuid.uuid4(), page_start=1, page_end=3, bboxes=[],
                  text=FIRST + LAST, section_title="Financial results",
                  page_texts={1: FIRST, 2: "The board meets every Friday.", 3: LAST})
    values.update(changes)
    return _ChunkInfo(**values)


def test_initial_payload_last_page_focus_and_heading():
    citation = _citation_payload(1, source(), 0, LAST)
    assert citation["page"] == citation["page_end"] == 3
    assert citation["text_snippet"] == citation["focus_snippet"] == LAST
    assert "Financial results" not in citation["text_snippet"]


def test_no_focus_invalid_focus_and_duplicate_pages_keep_broad_range():
    chunk = source()
    citation = _citation_payload(1, chunk, 0)
    assert citation["text_snippet"] == FIRST[:100]
    citation["focus_snippet"] = "An invented claim."
    _locate_citation(citation, chunk)
    assert "focus_snippet" not in citation
    assert citation["page"] == 1 and citation["page_end"] == 3
    chunk.page_texts[2] = LAST
    citation["focus_snippet"] = LAST
    _locate_citation(citation, chunk)
    assert citation["page"] == 1 and citation["page_end"] == 3
    assert citation["text_snippet"] == LAST


def test_cross_page_focus_is_not_narrowed_and_truncates_after_projection():
    chunk = source(text="A" * 110 + " " + LAST,
                   page_texts={1: "A" * 110, 2: "Some context", 3: LAST})
    citation = {"focus_snippet": chunk.text}
    _locate_citation(citation, chunk)
    assert citation["page"] == 1 and citation["page_end"] == 3
    assert citation["text_snippet"] == chunk.text[:100]
    assert citation["focus_snippet"] == chunk.text


def test_legacy_projection_updates_read_export_and_share_without_mutation():
    citation = dict(ref_index=1, offset=6, page=3, page_end=3,
                    text_snippet=FIRST[:100], focus_snippet=LAST,
                    context_text="[page 1–3] " + FIRST[:80], document_filename="source.pdf")
    original = deepcopy(citation)
    assert display_citations([citation])[0]["text_snippet"] == LAST
    assert citation_display(citation)["text_snippet"] == LAST
    msg = SimpleNamespace(id=uuid.uuid4(), role="assistant", content="Answer", citations=[citation],
                          created_at=datetime.now(timezone.utc))
    session = SimpleNamespace(document=SimpleNamespace(filename="source.pdf"))
    snapshot, digest = _answer_snapshot(session, msg)
    assert snapshot["messages"][0]["citations"][0]["text_snippet"] == LAST
    assert len(digest) == 64
    # Digest binds the actual preview text, including a new focus projection.
    changed = deepcopy(msg)
    changed.citations[0]["focus_snippet"] = "Another verified sentence."
    assert _answer_snapshot(session, changed)[1] != digest
    md = render_markdown("QA", "source.pdf", [msg])
    doc = Document(render_docx("QA", "source.pdf", [msg]))
    pdf = fitz.open(stream=render_pdf("QA", "source.pdf", [msg]).getvalue(), filetype="pdf")
    for text in (md, "\n".join(p.text for p in doc.paragraphs), "\n".join(p.get_text() for p in pdf)):
        assert LAST in text
        assert "Revenue for 2026" not in text
    assert citation == original


async def _restored_messages(monkeypatch, msg):
    from unittest.mock import AsyncMock

    from app.api import chat
    session = SimpleNamespace(user_id=uuid.uuid4())
    monkeypatch.setattr(chat, "verify_session_access", AsyncMock(return_value=session))
    db = SimpleNamespace(execute=AsyncMock(return_value=SimpleNamespace(scalars=lambda: [msg])))
    return await chat.get_session_messages(uuid.uuid4(), None, None, db)




@pytest.mark.asyncio
async def test_persisted_message_read_projects_without_updating_record(monkeypatch):
    msg = SimpleNamespace(id=uuid.uuid4(), role="assistant", content="Answer",
                          citations=[dict(text_snippet=FIRST[:100], focus_snippet=LAST, page=3)],
                          created_at=datetime.now(timezone.utc))
    result = await _restored_messages(monkeypatch, msg)
    assert result.messages[0].citations[0]["text_snippet"] == LAST
    assert msg.citations[0]["text_snippet"] == FIRST[:100]


@pytest.mark.asyncio
async def test_existing_public_answer_snapshot_is_not_reprojected(monkeypatch):
    from unittest.mock import AsyncMock

    from starlette.requests import Request
    from starlette.responses import Response

    from app.api import sharing
    snapshot = dict(document_name="source.pdf", created_at=datetime.now(timezone.utc).isoformat(),
                    messages=[dict(id="msg-1234567890abcdef", role="assistant", content="Answer",
                                   citations=[dict(ref_index=1, page=3, text_snippet=FIRST[:100])])])
    original = deepcopy(snapshot)
    db = SimpleNamespace(
        execute=AsyncMock(return_value=SimpleNamespace(scalar_one_or_none=lambda: None)),
        scalar=AsyncMock(return_value=SimpleNamespace(expires_at=None, snapshot=snapshot)))
    monkeypatch.setattr(sharing.shared_view_limiter, "is_allowed", AsyncMock(return_value=True))
    request = Request({"type": "http", "headers": [], "client": ("127.0.0.1", 123)})
    result = await sharing.view_shared(uuid.uuid4(), request, Response(), db)
    assert result.messages[0]["citations"][0]["text_snippet"] == FIRST[:100]
    assert snapshot == original


def test_legacy_unfocused_heading_is_not_quoted_as_source_text():
    citation = dict(text_snippet="Invented section label: " + FIRST[:70],
                    context_text="[page 1–3] " + FIRST, page=1, page_end=3)
    projected = citation_display(citation)
    assert projected["text_snippet"] == FIRST[:100]
    assert projected["page"] == 1 and projected["page_end"] == 3
