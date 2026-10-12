"""Shapes the non-PDF citation highlighter (frontend/src/lib/textEvidence.ts)
depends on: what the extractors store as page text, and how the shared
chunker turns it into chunk text and boxes.

The DOCX / PPTX / XLSX files are generated in memory by
``scripts/make_highlight_fixtures.py``; no binary fixture is committed.
"""
from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest

pytest.importorskip("docx")
pytest.importorskip("pptx")
pytest.importorskip("openpyxl")

from app.services.extractors import extract_document  # noqa: E402
from app.services.parse_service import ParseService  # noqa: E402


def _load_fixtures():
    path = Path(__file__).resolve().parents[1] / "scripts" / "make_highlight_fixtures.py"
    spec = importlib.util.spec_from_file_location("make_highlight_fixtures_under_test", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


fx = _load_fixtures()


def _chunks(file_type: str, data: bytes):
    pages = extract_document(data, file_type)
    return pages, ParseService().chunk_document(fx.page_infos(pages))


# ---------------------------------------------------------------- extractors


def test_docx_headings_become_titles_and_table_is_markdown():
    pages = extract_document(fx.build_docx(), "docx")
    assert [p.section_title for p in pages] == ["Study design", "Outcomes"]
    first = pages[0].text
    # Heading text is metadata, not page text.
    assert "Study design" not in first
    assert first.startswith("The trial enrolled 412 adults")
    assert "| Site | Enrolled | Completed |\n| --- | --- | --- |\n| Northfield | 88 | 81 |" in first
    # The same sentence closes both sections: a citation of it is ambiguous.
    assert all(fx.REPEATED_SENTENCE in p.text for p in pages)


def test_pptx_title_stays_in_text_with_notes_and_table():
    pages = extract_document(fx.build_pptx(), "pptx")
    assert [p.page_number for p in pages] == [1, 2, 3]
    assert [p.section_title for p in pages] == ["Quarterly review", "Regional results", "Quarterly review"]
    # Unlike DOCX/XLSX/MD, the title shape is part of the slide text.
    assert all(p.text.startswith(p.section_title + "\n") for p in pages)
    assert "\n\n**Speaker Notes:**\nMention the two delayed contracts" in pages[0].text
    assert "| Region | Revenue | Growth |\n| --- | --- | --- |\n| North | 4.2M | 12% |" in pages[1].text


def test_xlsx_one_page_per_sheet_named_by_title_only():
    pages = extract_document(fx.build_xlsx(), "xlsx")
    assert [(p.page_number, p.section_title) for p in pages] == [(1, "Budget"), (2, "Headcount")]
    assert pages[0].text.startswith("| Item | Q1 | Q2 |\n| --- | --- | --- |\n")
    assert "Budget" not in pages[0].text
    # Numbers become strings; the empty row is skipped.
    assert pages[1].text == "| Team | People |\n| --- | --- |\n| Research | 12 |\n| Support | 7 |"


def test_md_headings_split_pages_and_leave_the_text():
    pages = extract_document(fx.build_md(), "md")
    assert [p.section_title for p in pages] == ["Field notes", "中文摘要", "ملخص"]
    assert not any(line.lstrip().startswith("#") for p in pages for line in p.text.split("\n"))
    # Escapes, entities and inline code stay raw in the stored text.
    assert "`--strict` mode \\*only\\* when the probe is calibrated &amp; dry." in pages[0].text


def test_url_documents_strip_headings_like_md():
    article = b"# Article title\n\nFirst paragraph of the article.\n\n## Part two\n\nSecond part."
    pages = extract_document(article, "url")
    assert [p.section_title for p in pages] == ["Article title", "Part two"]
    assert pages[0].text.strip() == "First paragraph of the article."


# ------------------------------------------------------------------- chunker


def test_titles_are_glued_into_chunk_text_when_every_page_has_one():
    # Every DOCX page has an 18pt title block, so the median font size is 15
    # and 18 is not a heading: the title joins the first body sentence.
    _, chunks = _chunks("docx", fx.build_docx())
    assert chunks[0].text.startswith("Study design The trial enrolled 412 adults")
    assert chunks[0].section_title is None
    assert any("Outcomes The primary outcome" in c.text for c in chunks)


def test_sheet_names_are_glued_onto_the_first_table_row():
    _, chunks = _chunks("xlsx", fx.build_xlsx())
    assert chunks[0].text.startswith("Budget | Item | Q1 | Q2 |\n| --- | --- | --- |\n")
    assert any(c.text.startswith("Headcount | Team | People |") for c in chunks)


def test_table_rows_keep_their_newlines_in_chunk_text():
    _, chunks = _chunks("docx", fx.build_docx())
    table = "| Site | Enrolled | Completed |\n| --- | --- | --- |\n| Northfield | 88 | 81 |\n| Eastbrook | 74 | 70 |"
    assert any(table in c.text for c in chunks)


def test_small_documents_chunk_across_pages():
    pages, chunks = _chunks("pptx", fx.build_pptx())
    assert len(pages) == 3
    assert (chunks[0].page_start, chunks[0].page_end) == (1, 3)


# --------------------------------------------------------------------- boxes


def test_synthetic_body_box_normalizes_to_a_sliver():
    # The worker's body bbox (0, 0.1, 1, 1) is in points, not page fractions.
    box = ParseService()._normalize_bbox(1, (0.0, 0.1, 1.0, 1.0), 612.0, 792.0)
    assert box["x"] == 0.0
    assert box["w"] == pytest.approx(1 / 612)
    assert box["h"] == pytest.approx(0.9 / 792)


@pytest.mark.parametrize("file_type", ["docx", "pptx", "xlsx", "md"])
def test_every_non_pdf_chunk_box_is_a_sliver(file_type):
    _, chunks = _chunks(file_type, fx.BUILDERS[file_type]())
    boxes = [b for c in chunks for b in c.bboxes]
    assert boxes
    assert all(b["w"] < 0.01 and b["h"] < 0.01 for b in boxes)


# ------------------------------------------------------------------ payloads


def test_citation_payload_formulas():
    data = fx.pipeline("docx", fx.build_docx())
    first = data["chunks"][0]
    citation = first["citation"]
    assert citation["context_text"] == ("[page 1–2] " + first["text"])[:900]
    assert len(citation["text_snippet"]) == 100
    assert citation["text_snippet"].startswith("Study design The trial enrolled")
    single = next(c for c in data["chunks"] if c["page_start"] == c["page_end"])
    assert single["citation"]["context_text"].startswith(f"[page {single['page_start']}] ")


def test_main_writes_every_fixture(tmp_path):
    assert fx.main([str(tmp_path), "--json"]) == 0
    for file_type in fx.BUILDERS:
        assert (tmp_path / f"highlight-fixture.{file_type}").stat().st_size > 0
        assert (tmp_path / f"highlight-fixture.{file_type}.pipeline.json").stat().st_size > 0
