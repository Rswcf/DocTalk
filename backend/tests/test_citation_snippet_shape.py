"""Citation ``text_snippet`` is the cited chunk's own text, never "{section_title}: " + text.

Owner decision 2026-10-11: the shared-answer page and exports print the snippet
inside quotation marks, and the reader's text matcher searches the page for it,
so a section-title prefix both misquotes the source and stops the highlight.
"""
from __future__ import annotations

import uuid
from types import SimpleNamespace

from app.api.documents import _brief_ref_payload
from app.models.tables import Chunk
from app.services.chat_service import _ChunkInfo, _citation_payload
from app.services.claim_verifier_service import claim_verifier_service
from app.services.extraction_service import _citation_from_chunk

TEXT = (
    "The turbines produce about 900 kilowatts at peak flow in May. A diesel backup "
    "generator behind the school covers the clinic for up to six days. Power lines run "
    "on wooden poles along the valley road."
)
SECTION = "4.2 Power Grid"


def _chat_chunk(**kwargs) -> _ChunkInfo:
    defaults = dict(id=uuid.uuid4(), page_start=3, page_end=3, bboxes=[], text=TEXT,
                    section_title=SECTION)
    defaults.update(kwargs)
    return _ChunkInfo(**defaults)


def test_chat_citation_snippet_is_chunk_text_without_section_prefix() -> None:
    payload = _citation_payload(1, _chat_chunk(), 0)

    assert payload["text_snippet"] == TEXT[:100]
    assert not payload["text_snippet"].startswith(SECTION)
    assert payload["section_title"] == SECTION


def test_chat_citation_omits_empty_section_title() -> None:
    payload = _citation_payload(1, _chat_chunk(section_title=""), 0)

    assert payload["text_snippet"] == TEXT[:100]
    assert "section_title" not in payload


def test_summary_citation_does_not_present_its_internal_label_as_a_section() -> None:
    payload = _citation_payload(
        1, _chat_chunk(section_title="Map-reduce section summary", retrieval_modality="summary"), 0
    )

    assert payload["text_snippet"] == TEXT[:100]
    assert "section_title" not in payload


def test_table_citation_does_not_present_its_table_label_as_a_section() -> None:
    # retrieval_service labels table hits "Table p.N #k" in section_title; that is
    # an internal label, and the verifier reads the table through table_context.
    table_text = "Table p.3 #1 (camelot, confidence 0.90)\n| Site | Output |\n| Selka weir | 900 kW |"
    payload = _citation_payload(
        1,
        _chat_chunk(text=table_text, section_title="Table p.3 #1", table_id=str(uuid.uuid4()),
                    retrieval_modality="table"),
        0,
    )

    assert payload["text_snippet"] == table_text[:100]
    assert "section_title" not in payload
    assert payload["table_context"] == table_text

    answer = "The Selka weir site produces 900 kW."
    payload["offset"] = len(answer)
    report = claim_verifier_service.verify(answer, [payload], {1}, retrieved_count=1)

    assert report.numeric_mismatch_citation_count == 0
    assert report.low_overlap_citation_count == 0


def test_extraction_diff_and_template_citations_have_no_section_prefix() -> None:
    chunk = Chunk(id=uuid.uuid4(), document_id=uuid.uuid4(), page_start=3, page_end=3,
                  section_title=SECTION, text=TEXT, bboxes=[])

    assert _citation_from_chunk(1, chunk)["text_snippet"] == TEXT[:140]


def test_brief_source_ref_snippet_has_no_section_prefix() -> None:
    chunk = SimpleNamespace(id=uuid.uuid4(), chunk_index=0, page_start=3, page_end=3,
                            bboxes=[], section_title=SECTION, text=TEXT)

    assert _brief_ref_payload(chunk)["text_snippet"] == TEXT[:180]


def test_claim_verifier_still_counts_the_section_title_as_evidence() -> None:
    # The prefix used to put the heading's words and numbers into the verifier's
    # context. They now arrive as their own field and must still count.
    # Markers are already stripped from the answer; the citation sits at an offset.
    answer = "Section 4.2 covers the power grid of the valley."
    citation = _citation_payload(1, _chat_chunk(), len(answer))
    citation.pop("context_text")
    # Shares no words or numbers with the answer: only the heading can support it.
    citation["text_snippet"] = "Turbines spin beside the Selka weir."

    report = claim_verifier_service.verify(
        answer,
        [citation],
        {1},
        retrieved_count=1,
    )

    assert report.numeric_mismatch_citation_count == 0
    assert report.low_overlap_citation_count == 0
