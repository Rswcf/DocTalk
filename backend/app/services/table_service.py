from __future__ import annotations

import csv
import io
import json
import logging
import re
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Iterable

import fitz
import sqlalchemy as sa
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.tables import (
    Document,
    DocumentJob,
    DocumentLayoutRun,
    DocumentTable,
    Page,
)
from app.services.document_intelligence import (
    DocumentIntelligenceError,
    get_document_intelligence_provider,
)
from app.services.storage_service import storage_service

logger = logging.getLogger(__name__)

TABLE_SCAN_JOB_TYPE = "table_scan"
MAX_TABLE_ROWS = 200
MAX_TABLE_COLS = 30
MAX_CELL_CHARS = 1000


@dataclass
class TableScanOutcome:
    count: int
    provider: str
    warning: str | None = None
    layout_run_id: uuid.UUID | None = None
    fallback_used: bool = False
    pages_count: int = 0


def normalize_table_rows(raw_rows: Iterable[Iterable[Any]]) -> list[list[str]]:
    rows: list[list[str]] = []
    width = 0
    for raw_row in raw_rows:
        row = [str(cell or "").replace("\x00", "").strip()[:MAX_CELL_CHARS] for cell in raw_row]
        if not any(row):
            continue
        rows.append(row[:MAX_TABLE_COLS])
        width = max(width, len(rows[-1]))
        if len(rows) >= MAX_TABLE_ROWS:
            break
    if len(rows) < 2 or width < 2:
        return []
    width = min(width, MAX_TABLE_COLS)
    return [row + [""] * (width - len(row)) for row in rows]


def render_table_csv(rows: list[list[str]]) -> str:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerows(rows)
    return buf.getvalue()


def parse_markdown_tables(text: str) -> list[list[list[str]]]:
    lines = [line.rstrip() for line in (text or "").splitlines()]
    tables: list[list[list[str]]] = []
    i = 0
    while i < len(lines) - 1:
        header = lines[i].strip()
        separator = lines[i + 1].strip()
        if not _looks_like_markdown_table_header(header, separator):
            i += 1
            continue
        table_lines = [header]
        i += 2
        while i < len(lines) and "|" in lines[i]:
            line = lines[i].strip()
            if not line:
                break
            table_lines.append(line)
            i += 1
        rows = normalize_table_rows(_split_markdown_row(line) for line in table_lines)
        if rows:
            tables.append(rows)
    return tables


def _looks_like_markdown_table_header(header: str, separator: str) -> bool:
    if "|" not in header or "|" not in separator:
        return False
    separator_cells = _split_markdown_row(separator)
    return len(separator_cells) >= 2 and all(re.fullmatch(r":?-{3,}:?", cell.strip() or "") for cell in separator_cells)


def _split_markdown_row(line: str) -> list[str]:
    clean = line.strip().strip("|")
    return [cell.strip() for cell in clean.split("|")]


def extract_pdf_tables(pdf_bytes: bytes) -> list[dict[str, Any]]:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        results: list[dict[str, Any]] = []
        for page_num, page in enumerate(doc, start=1):
            if not hasattr(page, "find_tables"):
                continue
            try:
                found = page.find_tables()
            except Exception as exc:
                logger.info("PDF table detection failed on page %s: %s", page_num, exc)
                continue
            tables = getattr(found, "tables", found)
            for table_index, table in enumerate(tables):
                try:
                    raw_rows = table.extract()
                except Exception:
                    continue
                rows = normalize_table_rows(raw_rows or [])
                if rows:
                    results.append({
                        "page": page_num,
                        "table_index": table_index,
                        "rows": rows,
                        "confidence": 0.82,
                        "method": "pymupdf",
                        "metadata": {"provider": "pymupdf"},
                    })
        return results
    finally:
        doc.close()


def extract_markdown_tables(db: Session, document_id: uuid.UUID) -> list[dict[str, Any]]:
    pages = db.execute(
        select(Page).where(Page.document_id == document_id).order_by(Page.page_number)
    ).scalars()
    results: list[dict[str, Any]] = []
    for page in pages:
        for table_index, rows in enumerate(parse_markdown_tables(page.content or "")):
            results.append({
                "page": int(page.page_number or 1),
                "table_index": table_index,
                "rows": rows,
                "confidence": 0.65,
                "method": "markdown",
                "metadata": {"provider": "markdown"},
            })
    return results


def _create_layout_run(db: Session, document: Document, provider: str) -> DocumentLayoutRun:
    run = DocumentLayoutRun(
        id=uuid.uuid4(),
        document_id=document.id,
        provider=provider,
        status="running",
        pages_count=0,
        tables_count=0,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(run)
    db.flush()
    return run


def _store_layout_payload(document: Document, run: DocumentLayoutRun, payload: dict[str, Any] | None) -> str | None:
    if not payload:
        return None
    storage_key = f"layout-runs/{document.id}/{run.id}.json"
    try:
        storage_service.upload_file(
            json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            storage_key,
            content_type="application/json",
        )
        return storage_key
    except Exception as exc:
        logger.warning("Could not store layout payload for document %s: %s", document.id, exc)
        return None


def _finish_layout_run(
    run: DocumentLayoutRun,
    *,
    status: str,
    pages_count: int = 0,
    tables_count: int = 0,
    raw_storage_key: str | None = None,
    error_code: str | None = None,
    error_message: str | None = None,
) -> None:
    run.status = status
    run.pages_count = pages_count
    run.tables_count = tables_count
    run.raw_storage_key = raw_storage_key
    run.error_code = error_code
    run.error_message = error_message
    run.completed_at = datetime.now(timezone.utc)
    run.updated_at = run.completed_at


def _scan_pdf_tables_with_provider(db: Session, document: Document, pdf_bytes: bytes) -> tuple[list[dict[str, Any]], TableScanOutcome]:
    provider = get_document_intelligence_provider()
    if provider is None:
        detected = extract_pdf_tables(pdf_bytes)
        return detected, TableScanOutcome(count=len(detected), provider="pymupdf")

    run = _create_layout_run(db, document, provider.name)
    try:
        result = provider.analyze_tables(pdf_bytes)
        raw_storage_key = _store_layout_payload(document, run, result.raw_payload)
        _finish_layout_run(
            run,
            status="succeeded",
            pages_count=result.pages_count,
            tables_count=len(result.tables),
            raw_storage_key=raw_storage_key,
        )
        warning = result.warning
        return result.tables, TableScanOutcome(
            count=len(result.tables),
            provider=result.provider,
            warning=warning,
            layout_run_id=run.id,
            pages_count=result.pages_count,
        )
    except DocumentIntelligenceError as exc:
        _finish_layout_run(
            run,
            status="failed",
            error_code=exc.code[:64],
            error_message=exc.message,
        )
        fallback_provider = (settings.DOCUMENT_INTELLIGENCE_FALLBACK_PROVIDER or "pymupdf").strip().lower()
        if fallback_provider != "pymupdf":
            raise
        detected = extract_pdf_tables(pdf_bytes)
        warning = f"Azure layout unavailable ({exc.code}); used PyMuPDF fallback."
        return detected, TableScanOutcome(
            count=len(detected),
            provider="pymupdf",
            warning=warning,
            layout_run_id=run.id,
            fallback_used=True,
        )


def _normalized_header(rows: list[list[str]]) -> set[str]:
    if not rows:
        return set()
    return {cell.strip().lower() for cell in rows[0] if cell and cell.strip()}


def _header_similarity(left: list[list[str]], right: list[list[str]]) -> float:
    left_header = _normalized_header(left)
    right_header = _normalized_header(right)
    if not left_header or not right_header:
        return 0.0
    return len(left_header & right_header) / max(len(left_header), len(right_header))


def _table_region_bbox(item: dict[str, Any]) -> dict[str, Any] | None:
    metadata = item.get("metadata") if isinstance(item.get("metadata"), dict) else {}
    region = metadata.get("table_region") if isinstance(metadata, dict) else None
    if isinstance(region, dict) and isinstance(region.get("bbox"), dict):
        return region["bbox"]
    return None


def _looks_like_page_continuation(previous: dict[str, Any], current: dict[str, Any]) -> bool:
    previous_bbox = _table_region_bbox(previous)
    current_bbox = _table_region_bbox(current)
    if not previous_bbox or not current_bbox:
        return False
    try:
        previous_bottom = float(previous_bbox.get("y1", 0))
        current_top = float(current_bbox.get("y0", 99))
    except (TypeError, ValueError):
        return False
    return previous_bottom >= 8.0 and current_top <= 2.0


def merge_continued_tables(tables: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if len(tables) < 2:
        return tables
    ordered = sorted(tables, key=lambda item: (int(item.get("page") or 1), int(item.get("table_index") or 0)))
    merged: list[dict[str, Any]] = []
    for item in ordered:
        rows = item.get("rows") if isinstance(item.get("rows"), list) else []
        if not merged or len(rows) < 2:
            merged.append(item)
            continue
        previous = merged[-1]
        previous_rows = previous.get("rows") if isinstance(previous.get("rows"), list) else []
        previous_page_end = int(previous.get("page_end") or previous.get("page") or 1)
        current_page = int(item.get("page") or 1)
        same_width = bool(previous_rows and rows and len(previous_rows[0]) == len(rows[0]))
        adjacent_page = current_page == previous_page_end + 1
        similar_header = _header_similarity(previous_rows, rows) >= 0.8
        page_continuation = _looks_like_page_continuation(previous, item)
        if same_width and adjacent_page and similar_header and page_continuation:
            previous["rows"] = previous_rows + rows[1:]
            previous["page_end"] = current_page
            previous["confidence"] = min(float(previous.get("confidence") or 0), float(item.get("confidence") or 0))
            previous.setdefault("source_pages", [int(previous.get("page") or 1)]).append(current_page)
            previous.setdefault("merged_from", []).append(
                {"page": current_page, "table_index": int(item.get("table_index") or 0)}
            )
            if item.get("cells"):
                previous.setdefault("cells", []).extend(item.get("cells") or [])
        else:
            merged.append(item)
    return merged


def _table_cells_payload(item: dict[str, Any], *, layout_run_id: uuid.UUID | None) -> dict[str, Any]:
    payload: dict[str, Any] = {"rows": item["rows"]}
    for key in ("cells", "headers", "merged_cells", "metadata", "source_pages", "merged_from"):
        value = item.get(key)
        if value:
            payload[key] = value
    if item.get("page_end"):
        payload["page_end"] = int(item["page_end"])
    metadata = dict(payload.get("metadata") or {})
    if layout_run_id:
        metadata["layout_run_id"] = str(layout_run_id)
    if metadata:
        payload["metadata"] = metadata
    return payload


def scan_document_tables_with_outcome(db: Session, document: Document) -> TableScanOutcome:
    if (document.file_type or "pdf").lower() == "pdf":
        pdf_bytes = storage_service.download_file(document.storage_key)
        detected, outcome = _scan_pdf_tables_with_provider(db, document, pdf_bytes)
    else:
        detected = extract_markdown_tables(db, document.id)
        outcome = TableScanOutcome(count=len(detected), provider="markdown")

    detected = merge_continued_tables(detected)
    db.execute(sa.delete(DocumentTable).where(DocumentTable.document_id == document.id))
    page_indexes: dict[int, int] = {}
    for item in detected:
        page = int(item["page"])
        table_index = page_indexes.get(page, 0)
        page_indexes[page] = table_index + 1
        db.add(
            DocumentTable(
                document_id=document.id,
                page=page,
                table_index=table_index,
                cells=_table_cells_payload(item, layout_run_id=outcome.layout_run_id),
                confidence=item["confidence"],
                method=str(item["method"])[:32],
            )
        )
    return TableScanOutcome(
        count=len(detected),
        provider=outcome.provider,
        warning=outcome.warning,
        layout_run_id=outcome.layout_run_id,
        fallback_used=outcome.fallback_used,
        pages_count=outcome.pages_count,
    )


def scan_document_tables(db: Session, document: Document) -> int:
    return scan_document_tables_with_outcome(db, document).count


def run_table_scan_job_sync(job_id: str) -> None:
    from app.models.sync_database import SyncSessionLocal

    job_uuid = uuid.UUID(job_id)
    with SyncSessionLocal() as db:
        job = db.get(DocumentJob, job_uuid)
        if not job or job.status not in ("queued", "running"):
            return
        job.status = "running"
        job.updated_at = datetime.now(timezone.utc)
        db.add(job)
        db.commit()
        try:
            doc = db.get(Document, job.document_id) if job.document_id else None
            if not doc or doc.status != "ready":
                raise ValueError("DOCUMENT_NOT_READY")
            outcome = scan_document_tables_with_outcome(db, doc)
            job.status = "succeeded"
            job.cost_credits = 0
            job.metadata_json = {
                **(job.metadata_json or {}),
                "tables_detected": outcome.count,
                "provider": outcome.provider,
                "fallback_used": outcome.fallback_used,
                "fallback_warning": outcome.warning,
                "layout_run_id": str(outcome.layout_run_id) if outcome.layout_run_id else None,
                "pages_count": outcome.pages_count,
            }
            job.completed_at = datetime.now(timezone.utc)
            job.updated_at = job.completed_at
            db.add(job)
            db.commit()
        except Exception as exc:
            db.rollback()
            job = db.get(DocumentJob, job_uuid)
            if not job:
                return
            code = str(exc) if str(exc).isupper() else "TABLE_SCAN_FAILED"
            job.status = "failed"
            job.error_code = code[:64]
            job.error_message = "Table scan failed"
            job.completed_at = datetime.now(timezone.utc)
            job.updated_at = job.completed_at
            db.add(job)
            db.commit()
            logger.exception("Table scan job %s failed: %s", job_id, exc)
