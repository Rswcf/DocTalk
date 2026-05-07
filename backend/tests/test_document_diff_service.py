from __future__ import annotations

import uuid
from types import SimpleNamespace

from app.services.document_diff_service import (
    DOCUMENT_DIFF_PREDEBIT_CREDITS,
    normalize_diff_result,
    render_document_diff_csv,
    render_document_diff_markdown,
)


def _doc(filename: str) -> SimpleNamespace:
    return SimpleNamespace(id=uuid.uuid4(), filename=filename)


def test_normalize_diff_result_groups_refs_and_caps_invalid_values() -> None:
    old_doc = _doc("contract-v1.pdf")
    new_doc = _doc("contract-v2.pdf")
    data = normalize_diff_result(
        {
            "summary": "Payment terms changed.",
            "changes": [
                {
                    "kind": "modified",
                    "title": "Payment term",
                    "detail": "Net 30 became Net 60.",
                    "old_refs": [1, "bad", 99],
                    "new_refs": [2],
                },
                {
                    "kind": "surprising",
                    "title": "Unknown",
                    "detail": "Falls back to modified.",
                    "old_refs": [],
                    "new_refs": [],
                },
            ],
        },
        old_doc=old_doc,
        new_doc=new_doc,
        old_ref_count=3,
        new_ref_count=4,
    )

    assert data["old_document"]["filename"] == "contract-v1.pdf"
    assert data["new_document"]["filename"] == "contract-v2.pdf"
    assert data["changes"][0]["old_refs"] == [1]
    assert data["changes"][0]["new_refs"] == [2]
    assert data["changes"][1]["kind"] == "modified"
    assert data["changes"][1]["old_refs"] == [1]
    assert data["changes"][1]["new_refs"] == [1]
    assert DOCUMENT_DIFF_PREDEBIT_CREDITS == 60


def test_render_document_diff_markdown_uses_side_specific_ref_labels() -> None:
    markdown = render_document_diff_markdown(
        {
            "old_document": {"filename": "old.pdf"},
            "new_document": {"filename": "new.pdf"},
            "summary": "Two changes.",
            "changes": [
                {
                    "kind": "added",
                    "title": "New non-compete",
                    "detail": "A restrictive clause was added.",
                    "old_refs": [],
                    "new_refs": [1, 2],
                },
                {
                    "kind": "removed",
                    "title": "Force majeure removed",
                    "detail": "The exception no longer appears.",
                    "old_refs": [3],
                    "new_refs": [],
                },
            ],
        }
    )

    assert "## Added" in markdown
    assert "[N1] [N2]" in markdown
    assert "## Removed" in markdown
    assert "[O3]" in markdown


def test_render_document_diff_csv_escapes_commas_and_chinese_text() -> None:
    csv_text = render_document_diff_csv(
        {
            "changes": [
                {
                    "kind": "modified",
                    "title": "付款, 条款",
                    "detail": "从 Net 30 改为 Net 60",
                    "old_refs": [1],
                    "new_refs": [2],
                }
            ]
        }
    )

    assert '"付款, 条款"' in csv_text
    assert "O1" in csv_text
    assert "N2" in csv_text
