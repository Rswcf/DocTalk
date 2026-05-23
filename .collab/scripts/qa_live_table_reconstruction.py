#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import fitz


REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = REPO_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


class _ScalarRows:
    def __init__(self, rows: list[Any]) -> None:
        self.rows = rows

    def scalars(self):
        return iter(self.rows)


class _ScalarOne:
    def __init__(self, value: Any = None) -> None:
        self.value = value

    def scalar_one_or_none(self):
        return self.value


class _FakeDb:
    def __init__(self, page_number: int, page_text: str) -> None:
        self.calls = 0
        self.added: list[Any] = []
        self.page_number = page_number
        self.page_text = page_text

    def execute(self, _stmt):
        self.calls += 1
        if self.calls == 1:
            return _ScalarRows([SimpleNamespace(page_number=self.page_number, content=self.page_text)])
        return _ScalarOne()

    def add(self, obj: Any) -> None:
        self.added.append(obj)


def _page_text_and_words(pdf_path: Path, page_number: int) -> tuple[str, str]:
    doc = fitz.open(pdf_path)
    try:
        page = doc[page_number - 1]
        text = page.get_text("text") or ""
        words = page.get_text("words") or []
        word_lines = [f"Page {page_number} word boxes as x0,y0,x1,y1,text:"]
        for word in words[:1800]:
            try:
                x0, y0, x1, y1, content = word[:5]
            except Exception:
                continue
            clean = str(content or "").replace("\x00", "").strip()
            if clean:
                word_lines.append(f"{float(x0):.1f},{float(y0):.1f},{float(x1):.1f},{float(y1):.1f},{clean}")
        return text, "\n".join(word_lines)
    finally:
        doc.close()


def _draft_rows_from_text(text: str) -> list[list[str]]:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    tableish = []
    for line in lines:
        if any(token in line for token in ("TICKER TABLE", "2026E", "2027E", "AMEC", "NAURA", "Applied Materials")):
            tableish.append([line])
        if len(tableish) >= 10:
            break
    if len(tableish) < 2:
        tableish = [[line] for line in lines[:10]]
    return tableish


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", default=str(REPO_ROOT / "test_inputs" / "BERN_250901.pdf"))
    parser.add_argument("--page", type=int, default=3)
    parser.add_argument("--model", default="deepseek/deepseek-v3.2")
    parser.add_argument("--json-out", required=True)
    args = parser.parse_args()

    from app.core.config import settings
    from app.services import table_service

    if not settings.DEEPSEEK_API_KEY and settings.OPENROUTER_API_KEY:
        table_service.TABLE_RECONSTRUCTION_MODEL = args.model

    pdf_path = Path(args.pdf)
    page_text, words_context = _page_text_and_words(pdf_path, args.page)
    document = SimpleNamespace(
        id=uuid.uuid4(),
        filename=pdf_path.name,
        file_type="pdf",
        storage_key=str(pdf_path),
    )
    table = SimpleNamespace(
        id=uuid.uuid4(),
        document_id=document.id,
        page=args.page,
        table_index=0,
        method="pymupdf",
        confidence=0.82,
        cells={"rows": table_service.normalize_table_rows(_draft_rows_from_text(page_text)) or [["draft", "source"]]},
    )
    db = _FakeDb(args.page, page_text)
    original_pdf_words_context = table_service._pdf_words_context
    table_service._pdf_words_context = lambda _document, _page_start, _page_end: words_context
    started_at = datetime.now(timezone.utc)
    error: str | None = None
    try:
        outcome = table_service.reconstruct_document_table_with_outcome(db, document, table)
    except Exception as exc:
        outcome = None
        error = str(exc)
    finally:
        table_service._pdf_words_context = original_pdf_words_context

    rows = getattr(outcome, "rows", []) if outcome else []
    flat = "\n".join(" | ".join(row) for row in rows)
    expected_terms = ["AMEC", "NAURA", "2026E", "2027E"]
    missing_terms = [term for term in expected_terms if term not in flat]
    passed = bool(
        outcome
        and len(rows) >= 3
        and len(rows[0]) >= 3
        and not missing_terms
        and table.method == table_service.TABLE_RECONSTRUCTION_METHOD
    )
    artifact = {
        "status": "passed" if passed else "failed",
        "started_at": started_at.isoformat(),
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "pdf": str(pdf_path),
        "page": args.page,
        "model": getattr(outcome, "model", table_service.TABLE_RECONSTRUCTION_MODEL) if outcome else table_service.TABLE_RECONSTRUCTION_MODEL,
        "error": error,
        "method": getattr(table, "method", None),
        "confidence": getattr(table, "confidence", None),
        "row_count": len(rows),
        "column_count": len(rows[0]) if rows else 0,
        "warnings": getattr(outcome, "warnings", []) if outcome else [],
        "missing_numeric_tokens": getattr(outcome, "missing_numeric_tokens", []) if outcome else [],
        "missing_expected_terms": missing_terms,
        "tokens": {
            "prompt": getattr(outcome, "prompt_tokens", 0) if outcome else 0,
            "completion": getattr(outcome, "completion_tokens", 0) if outcome else 0,
        },
        "rows_preview": rows[:8],
        "element_synced": any(obj.__class__.__name__ == "DocumentElement" for obj in db.added),
    }
    out_path = Path(args.json_out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(artifact, ensure_ascii=False, indent=2), encoding="utf-8")
    print(
        "LIVE_TABLE_RECONSTRUCTION "
        f"status={artifact['status']} rows={artifact['row_count']} cols={artifact['column_count']} "
        f"model={artifact['model']}"
    )
    if error:
        print(f"error={error}")
    if missing_terms:
        print(f"missing_expected_terms={missing_terms}")
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
