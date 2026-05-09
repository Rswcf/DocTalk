from __future__ import annotations

import uuid
from types import SimpleNamespace

from app.services import table_service
from app.services.document_intelligence import (
    DocumentIntelligenceError,
    LayoutAnalysisResult,
    tables_from_azure_result,
)


def test_azure_result_maps_table_cells_and_metadata() -> None:
    result = {
        "pages": [{"pageNumber": 1}],
        "tables": [
            {
                "rowCount": 2,
                "columnCount": 2,
                "boundingRegions": [
                    {"pageNumber": 1, "polygon": [0, 0, 2, 0, 2, 1, 0, 1]},
                ],
                "cells": [
                    {
                        "rowIndex": 0,
                        "columnIndex": 0,
                        "content": "Company",
                        "kind": "columnHeader",
                        "boundingRegions": [
                            {"pageNumber": 1, "polygon": [0, 0, 1, 0, 1, 0.5, 0, 0.5]},
                        ],
                    },
                    {"rowIndex": 0, "columnIndex": 1, "content": "Rating", "kind": "columnHeader"},
                    {"rowIndex": 1, "columnIndex": 0, "content": "MetaX"},
                    {"rowIndex": 1, "columnIndex": 1, "content": "Equal-weight"},
                ],
            }
        ],
    }

    tables = tables_from_azure_result(result)

    assert len(tables) == 1
    table = tables[0]
    assert table["method"] == "azure"
    assert table["page"] == 1
    assert table["rows"] == [["Company", "Rating"], ["MetaX", "Equal-weight"]]
    assert table["headers"]["rows"] == [0]
    assert table["cells"][0]["region"]["bbox"]["x1"] == 1.0
    assert table["metadata"]["model"] == "prebuilt-layout"


def test_azure_failure_uses_pymupdf_fallback(monkeypatch) -> None:
    class FakeDb:
        def __init__(self) -> None:
            self.added = []

        def add(self, item) -> None:
            self.added.append(item)

        def flush(self) -> None:
            return None

    class FailingProvider:
        name = "azure"

        def analyze_tables(self, _document_bytes: bytes):
            raise DocumentIntelligenceError("AZURE_TIMEOUT", "timed out")

    doc = SimpleNamespace(id=uuid.uuid4(), storage_key="doc.pdf")
    db = FakeDb()
    monkeypatch.setattr(table_service, "get_document_intelligence_provider", lambda: FailingProvider())
    monkeypatch.setattr(
        table_service,
        "extract_pdf_tables",
        lambda _pdf_bytes: [
            {
                "page": 1,
                "table_index": 0,
                "rows": [["A", "B"], ["1", "2"]],
                "confidence": 0.82,
                "method": "pymupdf",
            }
        ],
    )

    tables, outcome = table_service._scan_pdf_tables_with_provider(db, doc, b"%PDF")

    assert tables[0]["method"] == "pymupdf"
    assert outcome.fallback_used is True
    assert outcome.warning and "AZURE_TIMEOUT" in outcome.warning
    assert db.added[0].status == "failed"
    assert db.added[0].error_code == "AZURE_TIMEOUT"


def test_azure_success_records_layout_run(monkeypatch) -> None:
    class FakeDb:
        def __init__(self) -> None:
            self.added = []

        def add(self, item) -> None:
            self.added.append(item)

        def flush(self) -> None:
            return None

    class SuccessProvider:
        name = "azure"

        def analyze_tables(self, _document_bytes: bytes):
            return LayoutAnalysisResult(
                provider="azure",
                pages_count=3,
                tables=[
                    {
                        "page": 2,
                        "table_index": 0,
                        "rows": [["公司", "评级"], ["MetaX", "持有"]],
                        "confidence": 0.91,
                        "method": "azure",
                        "metadata": {"provider": "azure"},
                    }
                ],
                raw_payload={"tables": []},
            )

    doc = SimpleNamespace(id=uuid.uuid4(), storage_key="doc.pdf")
    db = FakeDb()
    monkeypatch.setattr(table_service, "get_document_intelligence_provider", lambda: SuccessProvider())
    monkeypatch.setattr(table_service, "_store_layout_payload", lambda *_args, **_kwargs: "layout.json")

    tables, outcome = table_service._scan_pdf_tables_with_provider(db, doc, b"%PDF")

    assert tables[0]["rows"][1] == ["MetaX", "持有"]
    assert outcome.provider == "azure"
    assert outcome.pages_count == 3
    assert db.added[0].status == "succeeded"
    assert db.added[0].raw_storage_key == "layout.json"


def test_merge_continued_tables_drops_repeated_header() -> None:
    merged = table_service.merge_continued_tables(
        [
            {
                "page": 1,
                "table_index": 0,
                "rows": [["Company", "Rating"], ["A", "Buy"]],
                "confidence": 0.9,
                "metadata": {"table_region": {"bbox": {"y1": 10.5}}},
            },
            {
                "page": 2,
                "table_index": 0,
                "rows": [["Company", "Rating"], ["B", "Hold"]],
                "confidence": 0.88,
                "metadata": {"table_region": {"bbox": {"y0": 0.5}}},
            },
        ]
    )

    assert len(merged) == 1
    assert merged[0]["rows"] == [["Company", "Rating"], ["A", "Buy"], ["B", "Hold"]]
    assert merged[0]["page_end"] == 2


def test_merge_continued_tables_does_not_merge_same_header_without_layout_signal() -> None:
    merged = table_service.merge_continued_tables(
        [
            {
                "page": 1,
                "table_index": 0,
                "rows": [["Company", "Rating"], ["A", "Buy"]],
                "confidence": 0.9,
            },
            {
                "page": 2,
                "table_index": 0,
                "rows": [["Company", "Rating"], ["B", "Hold"]],
                "confidence": 0.88,
            },
        ]
    )

    assert len(merged) == 2
