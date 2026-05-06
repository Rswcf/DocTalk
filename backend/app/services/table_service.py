from __future__ import annotations

import csv
import io
import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Iterable

import fitz
import sqlalchemy as sa
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.tables import Document, DocumentJob, DocumentTable, Page
from app.services.storage_service import storage_service

logger = logging.getLogger(__name__)

TABLE_SCAN_JOB_TYPE = "table_scan"
MAX_TABLE_ROWS = 200
MAX_TABLE_COLS = 30
MAX_CELL_CHARS = 1000


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
            })
    return results


def scan_document_tables(db: Session, document: Document) -> int:
    if (document.file_type or "pdf").lower() == "pdf":
        pdf_bytes = storage_service.download_file(document.storage_key)
        detected = extract_pdf_tables(pdf_bytes)
    else:
        detected = extract_markdown_tables(db, document.id)

    db.execute(sa.delete(DocumentTable).where(DocumentTable.document_id == document.id))
    for item in detected:
        db.add(
            DocumentTable(
                document_id=document.id,
                page=item["page"],
                table_index=item["table_index"],
                cells={"rows": item["rows"]},
                confidence=item["confidence"],
                method=item["method"],
            )
        )
    return len(detected)


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
            count = scan_document_tables(db, doc)
            job.status = "succeeded"
            job.cost_credits = 0
            job.metadata_json = {**(job.metadata_json or {}), "tables_detected": count}
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
