from __future__ import annotations

import csv
import io
import uuid
from types import SimpleNamespace

from app.services import table_service
from app.services.table_service import (
    normalize_reconstructed_table_payload,
    normalize_table_rows,
    parse_markdown_tables,
    render_table_csv,
)


class _ScalarRows:
    def __init__(self, rows):
        self.rows = rows

    def scalars(self):
        return iter(self.rows)


class _ScalarOne:
    def __init__(self, value=None):
        self.value = value

    def scalar_one_or_none(self):
        return self.value


class _FakeDb:
    def __init__(self):
        self.calls = 0
        self.added = []

    def execute(self, _stmt):
        self.calls += 1
        if self.calls == 1:
            return _ScalarRows([
                SimpleNamespace(
                    page_number=15,
                    content="Metric 2026E 2027E Total Equity 17,499 25,558 PV of Forecast Period 96,661",
                )
            ])
        return _ScalarOne()

    def add(self, obj):
        self.added.append(obj)


def test_normalize_table_rows_pads_and_drops_empty_rows() -> None:
    rows = normalize_table_rows([
        ["Header", "Value", ""],
        ["Revenue", "$1,000"],
        ["", "", ""],
    ])

    assert rows == [
        ["Header", "Value", ""],
        ["Revenue", "$1,000", ""],
    ]


def test_parse_markdown_tables_extracts_multiple_rows() -> None:
    tables = parse_markdown_tables(
        """
Intro

| Metric | Value |
| --- | ---: |
| Revenue | $1,000 |
| Growth | 12% |

Outro
"""
    )

    assert tables == [[
        ["Metric", "Value"],
        ["Revenue", "$1,000"],
        ["Growth", "12%"],
    ]]


def test_render_table_csv_round_trips_commas_and_unicode() -> None:
    content = render_table_csv([
        ["指标", "Value"],
        ["Revenue", "$1,000"],
        ["Growth", "同比增长, 12%"],
    ])

    rows = list(csv.reader(io.StringIO(content)))
    assert rows == [
        ["指标", "Value"],
        ["Revenue", "$1,000"],
        ["Growth", "同比增长, 12%"],
    ]


def test_normalize_reconstructed_table_payload_preserves_grounded_wide_financial_rows() -> None:
    raw = {
        "tables": [
            {
                "title": "Equity forecast",
                "rows": [
                    ["Metric", "2026E", "2027E", "2028E"],
                    ["Total Equity", "17,499", "25,558", "36,602"],
                    ["PV of Forecast Period", "", "96,661", ""],
                ],
                "confidence": 0.88,
                "warnings": [],
            }
        ]
    }
    source = "Metric 2026E 2027E 2028E Total Equity 17,499 25,558 36,602 PV of Forecast Period 96,661"

    outcome = normalize_reconstructed_table_payload(raw, source, model="test-model")

    assert outcome.title == "Equity forecast"
    assert outcome.rows == [
        ["Metric", "2026E", "2027E", "2028E"],
        ["Total Equity", "17,499", "25,558", "36,602"],
        ["PV of Forecast Period", "", "96,661", ""],
    ]
    assert outcome.confidence == 0.88
    assert outcome.warnings == []


def test_normalize_reconstructed_table_payload_flags_minor_ungrounded_numbers() -> None:
    raw = {
        "tables": [
            {
                "rows": [["Metric", "2026E"], ["Total Equity", "17,499"], ["Missing metric", "42,424"]],
                "confidence": 0.9,
            }
        ]
    }

    outcome = normalize_reconstructed_table_payload(raw, "Total Equity 17,499 2026E", model="test-model")

    assert outcome.missing_numeric_tokens == ["42424"]
    assert outcome.confidence < 0.9
    assert "not found in the source page text" in outcome.warnings[0]


def test_normalize_reconstructed_table_payload_rejects_mostly_ungrounded_numbers() -> None:
    raw = {
        "tables": [
            {
                "rows": [
                    ["Metric", "2026E", "2027E", "2028E", "2029E", "2030E", "2031E", "2032E", "2033E", "2034E"],
                    ["Made up", "10", "20", "30", "40", "50", "60", "70", "80", "90"],
                ],
            }
        ]
    }

    try:
        normalize_reconstructed_table_payload(raw, "Metric Made up", model="test-model")
    except ValueError as exc:
        assert str(exc) == "TABLE_RECONSTRUCTION_UNGROUNDED"
    else:
        raise AssertionError("Expected ungrounded reconstruction to be rejected")


def test_reconstruct_document_table_updates_table_and_element(monkeypatch) -> None:
    document = SimpleNamespace(
        id=uuid.uuid4(),
        filename="financial-report.pdf",
        file_type="pdf",
        storage_key="documents/report.pdf",
    )
    table = SimpleNamespace(
        id=uuid.uuid4(),
        document_id=document.id,
        page=15,
        table_index=1,
        method="pymupdf",
        confidence=0.82,
        cells={"rows": [["Metric 2026E 2027E"], ["Total Equity 17,499 25,558"]]},
    )
    db = _FakeDb()

    def fake_pdf_words_context(_document, _page_start, _page_end):
        return "Page 15 word boxes as x0,y0,x1,y1,text:\n10,10,20,20,Total\n30,10,40,20,Equity"

    def fake_call_llm(context):
        assert "Parser draft rows" in context
        assert "Source page text" in context
        return (
            {
                "tables": [
                    {
                        "title": "Equity forecast",
                        "rows": [
                            ["Metric", "2026E", "2027E"],
                            ["Total Equity", "17,499", "25,558"],
                            ["PV of Forecast Period", "96,661", ""],
                        ],
                        "confidence": 0.91,
                    }
                ]
            },
            123,
            45,
            "test-model",
        )

    monkeypatch.setattr(table_service, "_pdf_words_context", fake_pdf_words_context)
    monkeypatch.setattr(table_service, "_call_table_reconstruction_llm", fake_call_llm)

    outcome = table_service.reconstruct_document_table_with_outcome(db, document, table)

    assert outcome.rows[1] == ["Total Equity", "17,499", "25,558"]
    assert table.method == "llm_reconstructed"
    assert table.confidence == 0.91
    assert table.cells["title"] == "Equity forecast"
    assert table.cells["metadata"]["ai_reconstructed"] is True
    assert table.cells["metadata"]["prompt_tokens"] == 123
    assert any(obj.__class__.__name__ == "DocumentElement" for obj in db.added)
