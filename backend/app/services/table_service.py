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
from openai import OpenAI
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.tables import (
    Document,
    DocumentElement,
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
TABLE_RECONSTRUCT_JOB_TYPE = "table_reconstruct"
TABLE_JOB_TYPES = {TABLE_SCAN_JOB_TYPE, TABLE_RECONSTRUCT_JOB_TYPE}
MAX_TABLE_ROWS = 200
MAX_TABLE_COLS = 30
MAX_CELL_CHARS = 1000
MAX_TABLE_CONTEXT_CHARS = 24000
MAX_TABLE_DRAFT_CHARS = 12000
TABLE_RECONSTRUCTION_MODE = "balanced"
TABLE_RECONSTRUCTION_MODEL = settings.MODE_MODELS.get(TABLE_RECONSTRUCTION_MODE, settings.LLM_MODEL)
TABLE_RECONSTRUCTION_METHOD = "llm_reconstructed"


@dataclass
class TableScanOutcome:
    count: int
    provider: str
    warning: str | None = None
    layout_run_id: uuid.UUID | None = None
    fallback_used: bool = False
    pages_count: int = 0


@dataclass
class TableReconstructionOutcome:
    rows: list[list[str]]
    title: str | None
    confidence: float
    warnings: list[str]
    model: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    missing_numeric_tokens: list[str] | None = None


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


def _is_deepseek_official_model(model: str) -> bool:
    return model in settings.DEEPSEEK_OFFICIAL_MODELS


def _get_llm_client(model: str) -> OpenAI:
    if _is_deepseek_official_model(model):
        if not settings.DEEPSEEK_API_KEY:
            raise RuntimeError("DEEPSEEK_API_KEY is not configured")
        return OpenAI(api_key=settings.DEEPSEEK_API_KEY, base_url=settings.DEEPSEEK_BASE_URL)
    if not settings.OPENROUTER_API_KEY:
        raise RuntimeError("OPENROUTER_API_KEY is not configured")
    return OpenAI(api_key=settings.OPENROUTER_API_KEY, base_url=settings.OPENROUTER_BASE_URL)


def _apply_table_llm_options(kwargs: dict[str, Any], model: str) -> None:
    if _is_deepseek_official_model(model):
        kwargs["extra_body"] = {"thinking": {"type": "disabled"}}
        kwargs["response_format"] = {"type": "json_object"}


def _json_from_text(text: str) -> dict[str, Any]:
    content = (text or "").strip()
    if content.startswith("```"):
        content = re.sub(r"^```(?:json)?\s*", "", content)
        content = re.sub(r"\s*```$", "", content)
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", content, flags=re.DOTALL)
        if not match:
            raise
        data = json.loads(match.group(0))
    if not isinstance(data, dict):
        raise ValueError("Table reconstruction response must be a JSON object")
    return data


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
                    metadata: dict[str, Any] = {"provider": "pymupdf"}
                    try:
                        rect = fitz.Rect(getattr(table, "bbox", None))
                        metadata["table_region"] = {
                            "page": page_num,
                            "bbox": {"x0": rect.x0, "y0": rect.y0, "x1": rect.x1, "y1": rect.y1},
                            "bbox_units": "points",
                        }
                    except Exception:
                        pass
                    results.append({
                        "page": page_num,
                        "table_index": table_index,
                        "rows": rows,
                        "confidence": 0.82,
                        "method": "pymupdf",
                        "metadata": metadata,
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


def _table_element_text(page: int, table_index: int, rows: list[list[str]], *, max_chars: int = 12000) -> tuple[str, bool]:
    lines = [f"Table page {page} #{table_index + 1}"]
    for row in rows:
        lines.append(" | ".join(str(cell or "").strip() for cell in row))
    text = "\n".join(lines).replace("\x00", "")
    if len(text) <= max_chars:
        return text, False
    return text[:max_chars].rstrip() + "\n...", True


def _clip_text(text: str, max_chars: int) -> str:
    clean = (text or "").replace("\x00", "").strip()
    if len(clean) <= max_chars:
        return clean
    return clean[:max_chars].rstrip() + "\n..."


def _table_rows_as_prompt(rows: list[list[str]], *, max_chars: int = MAX_TABLE_DRAFT_CHARS) -> str:
    if not rows:
        return "(no parser draft rows)"
    lines = []
    for row in rows[:80]:
        lines.append(" | ".join(str(cell or "").strip() for cell in row[:MAX_TABLE_COLS]))
    return _clip_text("\n".join(lines), max_chars)


def _page_range_from_table(table: DocumentTable) -> tuple[int, int]:
    cells = table.cells if isinstance(table.cells, dict) else {}
    page = int(table.page or 1)
    page_end = page
    try:
        page_end = int(cells.get("page_end") or page)
    except (TypeError, ValueError):
        page_end = page
    source_pages = cells.get("source_pages")
    if isinstance(source_pages, list):
        parsed_pages = []
        for item in source_pages:
            try:
                parsed_pages.append(int(item))
            except (TypeError, ValueError):
                continue
        if parsed_pages:
            page = min(page, min(parsed_pages))
            page_end = max(page_end, max(parsed_pages))
    return page, max(page, page_end)


def _pdf_words_context(document: Document, page_start: int, page_end: int) -> str:
    if (document.file_type or "").lower() != "pdf" or not document.storage_key:
        return ""
    pdf_bytes = storage_service.download_file(document.storage_key)
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        parts: list[str] = []
        for page_number in range(page_start, page_end + 1):
            if page_number < 1 or page_number > len(doc):
                continue
            page = doc[page_number - 1]
            words = page.get_text("words") or []
            lines = [f"Page {page_number} word boxes as x0,y0,x1,y1,text:"]
            for word in words[:1800]:
                try:
                    x0, y0, x1, y1, text = word[:5]
                except Exception:
                    continue
                clean = str(text or "").replace("\x00", "").strip()
                if clean:
                    lines.append(f"{float(x0):.1f},{float(y0):.1f},{float(x1):.1f},{float(y1):.1f},{clean}")
            parts.append("\n".join(lines))
        return _clip_text("\n\n".join(parts), MAX_TABLE_CONTEXT_CHARS // 2)
    finally:
        doc.close()


def build_table_reconstruction_context(db: Session, document: Document, table: DocumentTable) -> str:
    page_start, page_end = _page_range_from_table(table)
    cells = table.cells if isinstance(table.cells, dict) else {}
    draft_rows = cells.get("rows") if isinstance(cells.get("rows"), list) else []
    parts = [
        f"Document: {document.filename}",
        f"Target table: page {page_start}" + (f"-{page_end}" if page_end != page_start else ""),
        f"Parser method: {table.method}",
        f"Parser confidence: {float(table.confidence or 0):.2f}",
        "Parser draft rows, may be misaligned:",
        _table_rows_as_prompt(draft_rows),
    ]
    page_rows = db.execute(
        select(Page)
        .where(Page.document_id == document.id)
        .where(Page.page_number >= page_start)
        .where(Page.page_number <= page_end)
        .order_by(Page.page_number)
    ).scalars()
    page_text_parts: list[str] = []
    for page in page_rows:
        page_text_parts.append(f"Page {page.page_number} extracted text:\n{_clip_text(page.content or '', 8000)}")
    if page_text_parts:
        parts.extend(["Source page text:", _clip_text("\n\n".join(page_text_parts), MAX_TABLE_CONTEXT_CHARS // 2)])
    try:
        words_context = _pdf_words_context(document, page_start, page_end)
    except Exception as exc:
        logger.info("Could not build PDF word-box context for table %s: %s", table.id, exc)
        words_context = ""
    if words_context:
        parts.extend(["Source word-box context:", words_context])
    return _clip_text("\n\n".join(parts), MAX_TABLE_CONTEXT_CHARS)


def _table_reconstruction_contract() -> str:
    return json.dumps(
        {
            "tables": [
                {
                    "title": "short source table title or empty string",
                    "rows": [["header 1", "header 2"], ["row label", "source value"]],
                    "confidence": 0.0,
                    "warnings": ["brief uncertainty notes"],
                }
            ]
        },
        ensure_ascii=False,
        indent=2,
    )


def _call_table_reconstruction_llm(context: str) -> tuple[dict[str, Any], int, int, str]:
    model = TABLE_RECONSTRUCTION_MODEL
    client = _get_llm_client(model)
    contract = _table_reconstruction_contract()
    messages = [
        {
            "role": "system",
            "content": (
                "You are DocTalk's source-table reconstruction engine. Rebuild exactly one source table from the provided parser draft and page text. "
                "This is extraction, not analysis: preserve source numbers, dates, labels, units, and column order. Do not infer missing values. "
                "Use empty strings for unreadable cells. Return JSON only matching this contract:\n"
                f"{contract}"
            ),
        },
        {
            "role": "user",
            "content": (
                "Reconstruct the target table as JSON. If the draft is wrong, rely on the source page text and word-box order. "
                "Do not invent rows, columns, companies, years, percentages, or monetary values.\n\n"
                f"{context}"
            ),
        },
    ]
    kwargs: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": 0,
        "max_tokens": 6000,
    }
    _apply_table_llm_options(kwargs, model)
    response = client.chat.completions.create(**kwargs)
    content = response.choices[0].message.content or ""
    usage = getattr(response, "usage", None)
    prompt_tokens = int(getattr(usage, "prompt_tokens", 0) or 0)
    completion_tokens = int(getattr(usage, "completion_tokens", 0) or 0)
    try:
        return _json_from_text(content), prompt_tokens, completion_tokens, model
    except Exception:
        repair_messages = [
            {"role": "system", "content": "Repair the following output into valid JSON only. Do not add commentary."},
            {"role": "user", "content": f"Required JSON contract:\n{contract}\n\nOutput:\n{content}"},
        ]
        repair_kwargs: dict[str, Any] = {
            "model": model,
            "messages": repair_messages,
            "temperature": 0,
            "max_tokens": 6000,
        }
        _apply_table_llm_options(repair_kwargs, model)
        repaired = client.chat.completions.create(**repair_kwargs)
        repaired_content = repaired.choices[0].message.content or ""
        repair_usage = getattr(repaired, "usage", None)
        prompt_tokens += int(getattr(repair_usage, "prompt_tokens", 0) or 0)
        completion_tokens += int(getattr(repair_usage, "completion_tokens", 0) or 0)
        return _json_from_text(repaired_content), prompt_tokens, completion_tokens, model


def _float_0_1(value: Any, default: float = 0.65) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        number = default
    return max(0.0, min(1.0, number))


def _normalize_warnings(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    warnings: list[str] = []
    for item in value[:12]:
        text = str(item or "").strip()
        if text:
            warnings.append(text[:240])
    return warnings


_NUMERIC_TOKEN_RE = re.compile(r"[$€£¥₹]?\s*(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?%?(?:[A-Za-z])?")


def _canonical_numeric_token(token: str) -> str:
    return re.sub(r"[^0-9A-Za-z.\-]", "", token or "").lower()


def _numeric_tokens(rows: list[list[str]]) -> list[str]:
    tokens: list[str] = []
    for row in rows:
        for cell in row:
            for match in _NUMERIC_TOKEN_RE.finditer(str(cell or "")):
                token = match.group(0).strip()
                canonical = _canonical_numeric_token(token)
                digits = re.sub(r"\D", "", canonical)
                if len(digits) >= 2 and canonical not in tokens:
                    tokens.append(canonical)
    return tokens


def _missing_numeric_tokens(rows: list[list[str]], source_text: str) -> list[str]:
    source_canonical = _canonical_numeric_token(source_text)
    missing: list[str] = []
    for token in _numeric_tokens(rows):
        if token and token not in source_canonical:
            missing.append(token)
    return missing


def normalize_reconstructed_table_payload(raw: dict[str, Any], source_text: str, *, model: str) -> TableReconstructionOutcome:
    tables = raw.get("tables")
    item: Any
    if isinstance(tables, list) and tables:
        item = tables[0]
    else:
        item = raw.get("table", raw)
    if not isinstance(item, dict):
        raise ValueError("TABLE_RECONSTRUCTION_EMPTY")
    rows = normalize_table_rows(item.get("rows") if isinstance(item.get("rows"), list) else [])
    if not rows:
        raise ValueError("TABLE_RECONSTRUCTION_EMPTY")
    warnings = _normalize_warnings(item.get("warnings"))
    missing = _missing_numeric_tokens(rows, source_text)
    confidence = _float_0_1(item.get("confidence"), 0.65)
    if missing:
        warnings.append(f"{len(missing)} reconstructed numeric token(s) were not found in the source page text.")
        confidence = min(confidence, max(0.35, 1.0 - (len(missing) / max(len(_numeric_tokens(rows)), 1))))
    if len(missing) > max(8, len(_numeric_tokens(rows)) // 4):
        raise ValueError("TABLE_RECONSTRUCTION_UNGROUNDED")
    title = str(item.get("title") or "").strip()[:240] or None
    return TableReconstructionOutcome(
        rows=rows,
        title=title,
        confidence=confidence,
        warnings=warnings,
        model=model,
        missing_numeric_tokens=missing[:20],
    )


def _table_element_bbox(item: dict[str, Any]) -> dict[str, Any]:
    region_bbox = _table_region_bbox(item)
    if not region_bbox:
        return {}
    return {
        "provider_bbox": region_bbox,
        "bbox_format": "provider_layout_units",
    }


def _sync_reconstructed_table_element(db: Session, table: DocumentTable, outcome: TableReconstructionOutcome) -> None:
    element_text, truncated = _table_element_text(table.page, table.table_index, outcome.rows)
    metadata = {
        "table_id": str(table.id),
        "method": TABLE_RECONSTRUCTION_METHOD,
        "confidence": outcome.confidence,
        "model": outcome.model,
        "ai_reconstructed": True,
    }
    if outcome.warnings:
        metadata["warnings"] = outcome.warnings
    if truncated:
        metadata["text_truncated"] = True
    element = db.execute(
        select(DocumentElement)
        .where(DocumentElement.document_id == table.document_id)
        .where(DocumentElement.element_type == "table")
        .where(DocumentElement.metadata_json["table_id"].astext == str(table.id))
    ).scalar_one_or_none()
    page_end = int((table.cells or {}).get("page_end") or table.page)
    if element:
        element.text = element_text
        element.page_start = table.page
        element.page_end = page_end
        element.metadata_json = {**(element.metadata_json or {}), **metadata}
        element.updated_at = datetime.now(timezone.utc)
        db.add(element)
        return
    db.add(
        DocumentElement(
            document_id=table.document_id,
            element_type="table",
            page_start=table.page,
            page_end=page_end,
            bbox={},
            text=element_text,
            reading_order=table.page * 10000 + 8500 + table.table_index,
            metadata_json=metadata,
        )
    )


def scan_document_tables_with_outcome(db: Session, document: Document) -> TableScanOutcome:
    if (document.file_type or "pdf").lower() == "pdf":
        pdf_bytes = storage_service.download_file(document.storage_key)
        detected, outcome = _scan_pdf_tables_with_provider(db, document, pdf_bytes)
    else:
        detected = extract_markdown_tables(db, document.id)
        outcome = TableScanOutcome(count=len(detected), provider="markdown")

    detected = merge_continued_tables(detected)
    db.execute(sa.delete(DocumentTable).where(DocumentTable.document_id == document.id))
    db.execute(
        sa.delete(DocumentElement)
        .where(DocumentElement.document_id == document.id)
        .where(DocumentElement.element_type == "table")
    )
    page_indexes: dict[int, int] = {}
    for item in detected:
        page = int(item["page"])
        page_end = int(item.get("page_end") or page)
        table_index = page_indexes.get(page, 0)
        page_indexes[page] = table_index + 1
        table_id = uuid.uuid4()
        rows = item.get("rows") if isinstance(item.get("rows"), list) else []
        element_text, truncated = _table_element_text(page, table_index, rows)
        metadata = dict(item.get("metadata") or {})
        metadata.update({
            "table_id": str(table_id),
            "method": str(item["method"])[:32],
            "confidence": float(item["confidence"] or 0),
        })
        if truncated:
            metadata["text_truncated"] = True
        if outcome.layout_run_id:
            metadata["layout_run_id"] = str(outcome.layout_run_id)
        db.add(
            DocumentTable(
                id=table_id,
                document_id=document.id,
                page=page,
                table_index=table_index,
                cells=_table_cells_payload(item, layout_run_id=outcome.layout_run_id),
                confidence=item["confidence"],
                method=str(item["method"])[:32],
            )
        )
        db.add(
            DocumentElement(
                document_id=document.id,
                element_type="table",
                page_start=page,
                page_end=page_end,
                bbox=_table_element_bbox(item),
                text=element_text,
                reading_order=page * 10000 + 8000 + table_index,
                metadata_json=metadata,
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


def reconstruct_document_table_with_outcome(db: Session, document: Document, table: DocumentTable) -> TableReconstructionOutcome:
    context = build_table_reconstruction_context(db, document, table)
    raw, prompt_tokens, completion_tokens, model = _call_table_reconstruction_llm(context)
    outcome = normalize_reconstructed_table_payload(raw, context, model=model)
    outcome.prompt_tokens = prompt_tokens
    outcome.completion_tokens = completion_tokens

    previous_cells = table.cells if isinstance(table.cells, dict) else {}
    previous_metadata = previous_cells.get("metadata") if isinstance(previous_cells.get("metadata"), dict) else {}
    metadata = {
        **previous_metadata,
        "provider": "llm",
        "model": model,
        "ai_reconstructed": True,
        "reconstructed_at": datetime.now(timezone.utc).isoformat(),
        "previous_method": table.method,
        "previous_confidence": float(table.confidence or 0),
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
    }
    if outcome.missing_numeric_tokens:
        metadata["missing_numeric_tokens"] = outcome.missing_numeric_tokens
    table.cells = {
        **previous_cells,
        "rows": outcome.rows,
        "title": outcome.title,
        "warnings": outcome.warnings,
        "reconstructed_from": {
            "method": table.method,
            "confidence": float(table.confidence or 0),
            "rows_preview": previous_cells.get("rows", [])[:20] if isinstance(previous_cells.get("rows"), list) else [],
        },
        "metadata": metadata,
    }
    table.confidence = outcome.confidence
    table.method = TABLE_RECONSTRUCTION_METHOD
    table.updated_at = datetime.now(timezone.utc)
    db.add(table)
    _sync_reconstructed_table_element(db, table, outcome)
    return outcome


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


def run_table_reconstruction_job_sync(job_id: str) -> None:
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
            table_id = (job.input_scope or {}).get("table_id")
            if not table_id:
                raise ValueError("TABLE_NOT_FOUND")
            table = db.get(DocumentTable, uuid.UUID(str(table_id)))
            if not table or table.document_id != doc.id:
                raise ValueError("TABLE_NOT_FOUND")
            outcome = reconstruct_document_table_with_outcome(db, doc, table)
            job.status = "succeeded"
            job.cost_credits = 0
            job.metadata_json = {
                **(job.metadata_json or {}),
                "table_id": str(table.id),
                "method": TABLE_RECONSTRUCTION_METHOD,
                "model": outcome.model,
                "rows": len(outcome.rows),
                "columns": len(outcome.rows[0]) if outcome.rows else 0,
                "warnings": outcome.warnings,
                "missing_numeric_tokens": outcome.missing_numeric_tokens or [],
                "prompt_tokens": outcome.prompt_tokens,
                "completion_tokens": outcome.completion_tokens,
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
            code = str(exc) if str(exc).isupper() else "TABLE_RECONSTRUCTION_FAILED"
            job.status = "failed"
            job.error_code = code[:64]
            job.error_message = "AI table reconstruction failed"
            job.completed_at = datetime.now(timezone.utc)
            job.updated_at = job.completed_at
            db.add(job)
            db.commit()
            logger.exception("Table reconstruction job %s failed: %s", job_id, exc)
