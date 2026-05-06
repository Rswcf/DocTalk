from __future__ import annotations

import csv
import io
import uuid

from app.models.tables import Chunk
from app.services.extraction_service import (
    TEMPLATES,
    _citation_from_chunk,
    _json_from_text,
    normalize_result,
    render_csv,
    render_markdown,
)


def test_json_from_text_accepts_fenced_json() -> None:
    assert _json_from_text('```json\n{"summary": "ok"}\n```') == {"summary": "ok"}


def test_normalize_result_clamps_and_repairs_refs() -> None:
    raw = {
        "title": "Deal memo",
        "summary": "Short summary",
        "key_points": [
            {"text": "Supported by two fragments", "source_refs": [2, "2", 99, "bad", 3]},
            {"text": "Missing refs uses a safe fallback", "source_refs": []},
        ],
        "risks_or_open_questions": [{"text": "Needs diligence", "source_refs": [0, 1]}],
    }

    result = normalize_result("executive_summary", raw, max_ref=3)

    assert result["key_points"][0]["source_refs"] == [2, 3]
    assert result["key_points"][1]["source_refs"] == [1]
    assert result["risks_or_open_questions"][0]["source_refs"] == [1]


def test_render_markdown_escapes_table_pipes() -> None:
    markdown = render_markdown(
        TEMPLATES["key_facts"],
        {
            "facts": [
                {
                    "label": "Revenue | ARR",
                    "value": "$1,000",
                    "context": "Reported in table",
                    "source_refs": [1, 2],
                }
            ]
        },
    )

    assert "Revenue \\| ARR" in markdown
    assert "[1] [2]" in markdown


def test_render_csv_round_trips_commas_and_chinese_text() -> None:
    content = render_csv(
        "key_facts",
        {
            "facts": [
                {
                    "label": "收入",
                    "value": "$1,000",
                    "context": "同比增长, 12%",
                    "source_refs": [1, 2],
                }
            ]
        },
    )

    rows = list(csv.DictReader(io.StringIO(content)))
    assert rows == [
        {
            "label": "收入",
            "value": "$1,000",
            "context": "同比增长, 12%",
            "sources": "1 2",
        }
    ]


def test_citation_from_chunk_uses_most_specific_page_and_bbox_order() -> None:
    chunk = Chunk(
        id=uuid.uuid4(),
        document_id=uuid.uuid4(),
        page_start=4,
        page_end=5,
        section_title="Risk Factors",
        text="This is the cited passage.",
        bboxes=[
            {"page": 5, "x": 0.5, "y": 0.2, "w": 0.1, "h": 0.1},
            {"page": 4, "x": 0.2, "y": 0.3, "w": 0.1, "h": 0.1},
            {"page": 4, "x": 0.1, "y": 0.1, "w": 0.1, "h": 0.1},
            {"page": 4, "x": "bad", "y": 0.1, "w": 0.1, "h": 0.1},
        ],
    )

    citation = _citation_from_chunk(7, chunk, score=0.91234)

    assert citation["ref_index"] == 7
    assert citation["page"] == 4
    assert citation["confidence_score"] == 0.912
    assert citation["text_snippet"].startswith("Risk Factors:")
    assert [bbox["page"] for bbox in citation["bboxes"]] == [4, 4, 5]
