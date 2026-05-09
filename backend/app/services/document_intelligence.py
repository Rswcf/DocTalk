from __future__ import annotations

import io
import logging
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, Protocol

from app.core.config import settings

logger = logging.getLogger(__name__)

MAX_TABLE_ROWS = 200
MAX_TABLE_COLS = 30
MAX_CELL_CHARS = 1000


@dataclass
class LayoutAnalysisResult:
    provider: str
    pages_count: int
    tables: list[dict[str, Any]]
    raw_payload: dict[str, Any] | None = None
    warning: str | None = None


class DocumentIntelligenceError(RuntimeError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


class DocumentIntelligenceProvider(Protocol):
    name: str

    def analyze_tables(self, document_bytes: bytes) -> LayoutAnalysisResult:
        ...


def get_field(obj: Any, *names: str, default: Any = None) -> Any:
    for name in names:
        if isinstance(obj, Mapping) and name in obj:
            return obj[name]
        if hasattr(obj, name):
            return getattr(obj, name)
    return default


def json_safe(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, Mapping):
        return {str(key): json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [json_safe(item) for item in value]
    if hasattr(value, "as_dict"):
        try:
            return json_safe(value.as_dict())
        except Exception:
            pass
    if hasattr(value, "to_dict"):
        try:
            return json_safe(value.to_dict())
        except Exception:
            pass
    return str(value)


def _int_field(obj: Any, *names: str, default: int = 0) -> int:
    value = get_field(obj, *names, default=default)
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _float_field(obj: Any, *names: str) -> float | None:
    value = get_field(obj, *names)
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _iter_regions(value: Any) -> list[Any]:
    regions = get_field(value, "bounding_regions", "boundingRegions", default=[])
    if not regions:
        return []
    return list(regions)


def _point_xy(point: Any) -> tuple[float, float] | None:
    if isinstance(point, Mapping):
        if "x" in point and "y" in point:
            return float(point["x"]), float(point["y"])
        return None
    if hasattr(point, "x") and hasattr(point, "y"):
        return float(point.x), float(point.y)
    return None


def _polygon_points(polygon: Any) -> list[tuple[float, float]]:
    if not polygon:
        return []
    if isinstance(polygon, list) and polygon and all(isinstance(item, (int, float)) for item in polygon):
        values = [float(item) for item in polygon]
        return list(zip(values[0::2], values[1::2]))
    points: list[tuple[float, float]] = []
    for item in polygon:
        point = _point_xy(item)
        if point:
            points.append(point)
    return points


def region_payload(region: Any) -> dict[str, Any] | None:
    page = _int_field(region, "page_number", "pageNumber", default=0)
    polygon = _polygon_points(get_field(region, "polygon", default=[]))
    payload: dict[str, Any] = {"page": page or None}
    if polygon:
        xs = [point[0] for point in polygon]
        ys = [point[1] for point in polygon]
        payload.update(
            {
                "bbox": {
                    "x0": min(xs),
                    "y0": min(ys),
                    "x1": max(xs),
                    "y1": max(ys),
                },
                "polygon": [[x, y] for x, y in polygon],
            }
        )
    return payload if payload.get("page") or payload.get("bbox") else None


def _first_region_payload(value: Any) -> dict[str, Any] | None:
    for region in _iter_regions(value):
        payload = region_payload(region)
        if payload:
            return payload
    return None


def _table_page(table: Any, cells: list[Any]) -> int:
    region = _first_region_payload(table)
    if region and region.get("page"):
        return int(region["page"])
    for cell in cells:
        cell_region = _first_region_payload(cell)
        if cell_region and cell_region.get("page"):
            return int(cell_region["page"])
    return 1


def _table_confidence(cells: list[Any]) -> float:
    confidences = [
        value for value in (_float_field(cell, "confidence") for cell in cells)
        if value is not None
    ]
    if not confidences:
        return 0.9
    return max(0.0, min(1.0, sum(confidences) / len(confidences)))


def normalize_layout_rows(raw_rows: list[list[Any]]) -> list[list[str]]:
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


def tables_from_azure_result(result: Any) -> list[dict[str, Any]]:
    tables = list(get_field(result, "tables", default=[]) or [])
    extracted: list[dict[str, Any]] = []
    per_page_index: dict[int, int] = {}

    for global_index, table in enumerate(tables):
        cells = list(get_field(table, "cells", default=[]) or [])
        row_count = _int_field(table, "row_count", "rowCount", default=0)
        column_count = _int_field(table, "column_count", "columnCount", default=0)
        for cell in cells:
            row_count = max(row_count, _int_field(cell, "row_index", "rowIndex", default=0) + 1)
            column_count = max(column_count, _int_field(cell, "column_index", "columnIndex", default=0) + 1)
        if row_count < 1 or column_count < 2:
            continue

        matrix = [["" for _ in range(column_count)] for _ in range(row_count)]
        cell_payloads: list[dict[str, Any]] = []
        header_rows: set[int] = set()
        header_columns: set[int] = set()
        merged_cells: list[dict[str, int]] = []

        for cell in cells:
            row_index = _int_field(cell, "row_index", "rowIndex", default=0)
            column_index = _int_field(cell, "column_index", "columnIndex", default=0)
            if row_index >= row_count or column_index >= column_count:
                continue
            content = str(get_field(cell, "content", default="") or "").replace("\x00", "").strip()
            matrix[row_index][column_index] = content
            kind = str(get_field(cell, "kind", default="content") or "content")
            row_span = max(1, _int_field(cell, "row_span", "rowSpan", default=1))
            column_span = max(1, _int_field(cell, "column_span", "columnSpan", default=1))
            if kind in {"columnHeader", "stubHead"}:
                header_rows.add(row_index)
            if kind == "rowHeader":
                header_columns.add(column_index)
            if row_span > 1 or column_span > 1:
                merged_cells.append(
                    {
                        "row": row_index,
                        "column": column_index,
                        "row_span": row_span,
                        "column_span": column_span,
                    }
                )
            region = _first_region_payload(cell)
            cell_payloads.append(
                {
                    "row": row_index,
                    "column": column_index,
                    "text": content,
                    "kind": kind,
                    "row_span": row_span,
                    "column_span": column_span,
                    "region": region,
                    "spans": json_safe(get_field(cell, "spans", default=[])),
                }
            )

        rows = normalize_layout_rows(matrix)
        if not rows:
            continue
        page = _table_page(table, cells)
        table_index = per_page_index.get(page, 0)
        per_page_index[page] = table_index + 1
        table_region = _first_region_payload(table)
        extracted.append(
            {
                "page": page,
                "table_index": table_index,
                "rows": rows,
                "confidence": _table_confidence(cells),
                "method": "azure",
                "cells": cell_payloads,
                "headers": {
                    "rows": sorted(header_rows),
                    "columns": sorted(header_columns),
                },
                "merged_cells": merged_cells,
                "metadata": {
                    "provider": "azure",
                    "model": "prebuilt-layout",
                    "global_index": global_index,
                    "row_count": row_count,
                    "column_count": column_count,
                    "table_region": table_region,
                },
            }
        )
    return extracted


class AzureDocumentIntelligenceProvider:
    name = "azure"

    def analyze_tables(self, document_bytes: bytes) -> LayoutAnalysisResult:
        endpoint = (settings.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT or "").strip()
        key = (settings.AZURE_DOCUMENT_INTELLIGENCE_KEY or "").strip()
        if not endpoint or not key:
            raise DocumentIntelligenceError(
                "AZURE_NOT_CONFIGURED",
                "Azure Document Intelligence is not configured.",
            )
        try:
            from azure.ai.documentintelligence import DocumentIntelligenceClient
            from azure.core.credentials import AzureKeyCredential
            from azure.core.exceptions import AzureError
        except Exception as exc:
            raise DocumentIntelligenceError(
                "AZURE_SDK_UNAVAILABLE",
                "Azure Document Intelligence SDK is not installed.",
            ) from exc

        try:
            client = DocumentIntelligenceClient(
                endpoint=endpoint,
                credential=AzureKeyCredential(key),
                polling_interval=2,
            )
            poller = client.begin_analyze_document("prebuilt-layout", body=io.BytesIO(document_bytes))
            try:
                result = poller.result(timeout=settings.DOCUMENT_INTELLIGENCE_TIMEOUT_SECONDS)
            except TypeError:
                result = poller.result()
        except AzureError as exc:
            status_code = getattr(getattr(exc, "response", None), "status_code", None)
            code = "AZURE_AUTH_FAILED" if status_code in {401, 403} else "AZURE_ANALYZE_FAILED"
            raise DocumentIntelligenceError(code, str(exc) or "Azure analysis failed.") from exc
        except TimeoutError as exc:
            raise DocumentIntelligenceError("AZURE_TIMEOUT", "Azure analysis timed out.") from exc
        except Exception as exc:
            raise DocumentIntelligenceError("AZURE_ANALYZE_FAILED", str(exc) or "Azure analysis failed.") from exc

        raw_payload = json_safe(result)
        pages_count = len(list(get_field(result, "pages", default=[]) or []))
        return LayoutAnalysisResult(
            provider=self.name,
            pages_count=pages_count,
            tables=tables_from_azure_result(result),
            raw_payload=raw_payload if isinstance(raw_payload, dict) else {"result": raw_payload},
        )


def get_document_intelligence_provider(name: str | None = None) -> DocumentIntelligenceProvider | None:
    provider = (name or settings.DOCUMENT_INTELLIGENCE_PROVIDER or "").strip().lower()
    if provider == "azure":
        return AzureDocumentIntelligenceProvider()
    if provider in {"", "none", "pymupdf", "markdown"}:
        return None
    logger.warning("Unsupported document intelligence provider configured: %s", provider)
    return None
