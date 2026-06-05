"""Layout-preserving PDF translation orchestration."""
from __future__ import annotations

import io
import json
import logging
import os
import re
import time
import uuid
import zipfile
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import fitz
import httpx
from openai import OpenAI

from app.core.config import settings
from app.models.tables import Document, DocumentJob
from app.services.doc_service import sanitize_filename
from app.services.storage_service import storage_service

LAYOUT_TRANSLATION_JOB_TYPE = "layout_translation"
LAYOUT_TRANSLATION_REQUIRED_PLAN = "plus"
LAYOUT_TRANSLATION_ACTIVE_STATUSES = ("queued", "running", "succeeded")
DEFAULT_LAYOUT_TRANSLATION_TARGET = "zh-CN"
logger = logging.getLogger(__name__)

SUPPORTED_LAYOUT_TRANSLATION_TARGETS: dict[str, str] = {
    "zh-CN": "Simplified Chinese",
}

_TARGET_ALIASES = {
    "zh": "zh-CN",
    "zh-cn": "zh-CN",
    "cn": "zh-CN",
    "chinese": "zh-CN",
    "simplified chinese": "zh-CN",
    "简体中文": "zh-CN",
    "中文": "zh-CN",
}


class LayoutTranslationConfigError(RuntimeError):
    """Raised when the RetainPDF sidecar is not configured."""


class RetainPdfError(RuntimeError):
    """Raised for RetainPDF transport or job failures."""


@dataclass(frozen=True)
class RetainPdfArtifact:
    storage_key: str
    filename: str
    content_type: str
    size_bytes: int


@dataclass(frozen=True)
class LayoutTextBlock:
    id: str
    page_index: int
    bbox: tuple[float, float, float, float]
    text: str
    page_width: float | None = None
    page_height: float | None = None
    kind: str = "text"


@dataclass(frozen=True)
class LayoutTranslationConfigStatus:
    ready: bool
    missing: tuple[str, ...]
    engine: str
    ocr_provider: str
    translation_model: str
    translation_base_url: str
    uses_deepseek_fallback_key: bool


def normalize_target_language(value: str | None) -> str:
    raw = (value or DEFAULT_LAYOUT_TRANSLATION_TARGET).strip()
    normalized = _TARGET_ALIASES.get(raw.lower(), raw)
    if normalized not in SUPPORTED_LAYOUT_TRANSLATION_TARGETS:
        raise ValueError(normalized)
    return normalized


def target_language_label(value: str | None) -> str:
    target = normalize_target_language(value)
    return SUPPORTED_LAYOUT_TRANSLATION_TARGETS[target]


def plan_allows_unlimited_layout_translation(plan: str | None) -> bool:
    return (plan or "free").lower() in {"plus", "pro"}


def layout_translation_trial_limit() -> int:
    return max(0, int(settings.FREE_LAYOUT_TRANSLATIONS_LIMIT or 0))


def _translation_api_key() -> str | None:
    return settings.RETAINPDF_TRANSLATION_API_KEY or settings.DEEPSEEK_API_KEY


def layout_translation_engine() -> str:
    engine = (settings.LAYOUT_TRANSLATION_ENGINE or "").strip().lower()
    if engine:
        return engine
    provider = (settings.RETAINPDF_OCR_PROVIDER or "").strip().lower()
    return "datalab" if provider == "datalab" else "retainpdf"


def layout_translation_config_status() -> LayoutTranslationConfigStatus:
    missing: list[str] = []
    if not _translation_api_key():
        missing.append("DEEPSEEK_API_KEY")

    engine = layout_translation_engine()
    provider = (settings.RETAINPDF_OCR_PROVIDER or "paddle").strip().lower()
    if engine == "datalab":
        provider = "datalab"
        if not settings.DATALAB_API_KEY:
            missing.append("DATALAB_API_KEY")
    elif engine == "retainpdf":
        if not settings.RETAINPDF_API_BASE_URL:
            missing.append("RETAINPDF_API_BASE_URL")
        if provider == "mineru":
            if not settings.RETAINPDF_MINERU_TOKEN:
                missing.append("RETAINPDF_MINERU_TOKEN")
        elif provider == "paddle":
            if not settings.RETAINPDF_PADDLE_TOKEN:
                missing.append("RETAINPDF_PADDLE_TOKEN")
        else:
            missing.append("RETAINPDF_OCR_PROVIDER")
    else:
        missing.append("LAYOUT_TRANSLATION_ENGINE")

    return LayoutTranslationConfigStatus(
        ready=not missing,
        missing=tuple(missing),
        engine=engine,
        ocr_provider=provider,
        translation_model=settings.RETAINPDF_TRANSLATION_MODEL,
        translation_base_url=settings.RETAINPDF_TRANSLATION_BASE_URL,
        uses_deepseek_fallback_key=not bool(settings.RETAINPDF_TRANSLATION_API_KEY),
    )


class RetainPdfClient:
    def __init__(self) -> None:
        base_url = (settings.RETAINPDF_API_BASE_URL or "").rstrip("/")
        if not base_url:
            raise LayoutTranslationConfigError("RetainPDF API is not configured")
        self.base_url = base_url
        self.headers = {}
        if settings.RETAINPDF_API_KEY:
            self.headers["X-API-Key"] = settings.RETAINPDF_API_KEY
        self.timeout = httpx.Timeout(
            connect=20.0,
            read=float(max(30, settings.RETAINPDF_TIMEOUT_SECONDS)),
            write=300.0,
            pool=20.0,
        )

    def _url(self, path: str) -> str:
        return f"{self.base_url}{path if path.startswith('/') else f'/{path}'}"

    @staticmethod
    def _data(response: httpx.Response) -> dict[str, Any]:
        try:
            payload = response.json()
        except ValueError as exc:
            raise RetainPdfError(f"RetainPDF returned non-JSON response ({response.status_code})") from exc
        if response.status_code >= 400:
            message = payload.get("message") if isinstance(payload, dict) else None
            raise RetainPdfError(message or f"RetainPDF request failed ({response.status_code})")
        if isinstance(payload, dict) and "code" in payload:
            if payload.get("code") != 0:
                raise RetainPdfError(str(payload.get("message") or "RetainPDF request failed"))
            data = payload.get("data")
            return data if isinstance(data, dict) else {}
        return payload if isinstance(payload, dict) else {}

    def upload_pdf(self, *, filename: str, content: bytes) -> str:
        with httpx.Client(timeout=self.timeout, headers=self.headers) as client:
            response = client.post(
                self._url("/api/v1/uploads"),
                data={"developer_mode": "false"},
                files={"file": (filename, content, "application/pdf")},
            )
        upload = self._data(response)
        upload_id = upload.get("upload_id")
        if not isinstance(upload_id, str) or not upload_id:
            raise RetainPdfError("RetainPDF upload response did not include upload_id")
        return upload_id

    def create_book_job(self, *, upload_id: str, source_filename: str) -> str:
        provider = (settings.RETAINPDF_OCR_PROVIDER or "mineru").strip().lower()
        translation_api_key = _translation_api_key()
        if not translation_api_key:
            raise LayoutTranslationConfigError("RetainPDF translation API key is not configured")
        ocr: dict[str, Any] = {
            "provider": provider,
            "model_version": "vlm",
            "is_ocr": False,
            "disable_formula": False,
            "disable_table": False,
            "language": "ch",
            "page_ranges": "",
            "data_id": "",
            "no_cache": False,
            "cache_tolerance": 900,
            "extra_formats": "",
            "poll_interval": max(1, settings.RETAINPDF_POLL_INTERVAL_SECONDS),
            "poll_timeout": max(60, settings.RETAINPDF_TIMEOUT_SECONDS),
        }
        if provider == "mineru":
            if not settings.RETAINPDF_MINERU_TOKEN:
                raise LayoutTranslationConfigError("RetainPDF MinerU token is not configured")
            ocr["mineru_token"] = settings.RETAINPDF_MINERU_TOKEN
        elif provider == "paddle":
            if not settings.RETAINPDF_PADDLE_TOKEN:
                raise LayoutTranslationConfigError("RetainPDF Paddle token is not configured")
            ocr["paddle_token"] = settings.RETAINPDF_PADDLE_TOKEN
        else:
            raise LayoutTranslationConfigError(f"Unsupported RetainPDF OCR provider: {provider}")

        payload = {
            "workflow": "book",
            "source": {"upload_id": upload_id, "source_url": "", "artifact_job_id": ""},
            "ocr": ocr,
            "translation": {
                "mode": "sci",
                "math_mode": "direct_typst",
                "skip_title_translation": False,
                "rule_profile_name": "general_sci",
                "custom_rules_text": "Translate all translatable prose into Simplified Chinese while preserving equations, symbols, citations, and code.",
                "glossary_id": "",
                "glossary_entries": [],
                "model": settings.RETAINPDF_TRANSLATION_MODEL,
                "base_url": settings.RETAINPDF_TRANSLATION_BASE_URL,
                "api_key": translation_api_key,
                "start_page": 0,
                "end_page": -1,
            },
            "render": {
                "render_mode": "auto",
                "typst_font_family": "Source Han Serif SC",
                "pdf_compress_dpi": 0,
                "translated_pdf_name": f"{os.path.splitext(source_filename)[0]}-translated.pdf",
                "body_font_size_factor": 0.95,
                "body_leading_factor": 1.08,
                "font_unify_mode": "role_min",
                "source_cleanup_strategy": "pikepdf_text_strip",
                "inner_bbox_shrink_x": 0.0,
                "inner_bbox_shrink_y": 0.0,
                "inner_bbox_dense_shrink_x": 0.0,
                "inner_bbox_dense_shrink_y": 0.0,
            },
            "runtime": {
                "job_id": "",
                "workers": max(0, settings.RETAINPDF_WORKERS),
                "batch_size": max(1, settings.RETAINPDF_BATCH_SIZE),
                "classify_batch_size": max(1, settings.RETAINPDF_CLASSIFY_BATCH_SIZE),
                "compile_workers": max(0, settings.RETAINPDF_COMPILE_WORKERS),
                "timeout_seconds": max(60, settings.RETAINPDF_TIMEOUT_SECONDS),
            },
        }
        with httpx.Client(timeout=self.timeout, headers={**self.headers, "Content-Type": "application/json"}) as client:
            response = client.post(self._url("/api/v1/jobs"), json=payload)
        data = self._data(response)
        job_id = data.get("job_id")
        if not isinstance(job_id, str) or not job_id:
            raise RetainPdfError("RetainPDF create job response did not include job_id")
        return job_id

    def get_job(self, job_id: str) -> dict[str, Any]:
        with httpx.Client(timeout=self.timeout, headers=self.headers) as client:
            response = client.get(self._url(f"/api/v1/jobs/{job_id}"))
        return self._data(response)

    def download(self, path: str) -> bytes:
        with httpx.Client(timeout=self.timeout, headers=self.headers, follow_redirects=True) as client:
            response = client.get(self._url(path))
        if response.status_code >= 400:
            raise RetainPdfError(f"RetainPDF artifact download failed ({response.status_code})")
        return response.content


class DatalabClient:
    def __init__(self) -> None:
        if not settings.DATALAB_API_KEY:
            raise LayoutTranslationConfigError("Datalab API key is not configured")
        base_url = (settings.DATALAB_API_BASE_URL or "https://www.datalab.to/api/v1").rstrip("/")
        self.base_url = base_url
        self.headers = {"X-API-Key": settings.DATALAB_API_KEY}
        self.timeout = httpx.Timeout(
            connect=20.0,
            read=float(max(30, settings.RETAINPDF_TIMEOUT_SECONDS)),
            write=300.0,
            pool=20.0,
        )

    def _url(self, path: str) -> str:
        return f"{self.base_url}{path if path.startswith('/') else f'/{path}'}"

    @staticmethod
    def _data(response: httpx.Response) -> dict[str, Any]:
        try:
            payload = response.json()
        except ValueError as exc:
            raise RetainPdfError(f"Datalab returned non-JSON response ({response.status_code})") from exc
        if response.status_code >= 400:
            message = payload.get("error") or payload.get("message") if isinstance(payload, dict) else None
            raise RetainPdfError(message or f"Datalab request failed ({response.status_code})")
        if not isinstance(payload, dict):
            raise RetainPdfError("Datalab returned an unexpected response")
        if payload.get("success") is False:
            raise RetainPdfError(str(payload.get("error") or "Datalab request failed"))
        return payload

    def submit_convert(self, *, filename: str, content: bytes) -> dict[str, Any]:
        data: dict[str, str] = {
            "output_format": settings.DATALAB_OUTPUT_FORMAT or "json,markdown",
            "mode": settings.DATALAB_CONVERT_MODE or "balanced",
            "paginate": "false",
            "include_markdown_in_chunks": "true",
            "disable_image_extraction": "false",
            "disable_image_captions": "true",
            "word_bboxes": str(bool(settings.DATALAB_WORD_BBOXES)).lower(),
        }
        extras = (settings.DATALAB_EXTRAS or "").strip()
        if extras:
            data["extras"] = extras
        with httpx.Client(timeout=self.timeout, headers=self.headers) as client:
            response = client.post(
                self._url("/convert"),
                data=data,
                files={"file": (filename, content, "application/pdf")},
            )
        payload = self._data(response)
        if not payload.get("request_id") or not payload.get("request_check_url"):
            raise RetainPdfError("Datalab convert response did not include request_id/request_check_url")
        return payload

    def get_result(self, request_check_url: str) -> dict[str, Any]:
        url = request_check_url if request_check_url.startswith("http") else self._url(request_check_url)
        with httpx.Client(timeout=self.timeout, headers=self.headers) as client:
            response = client.get(url)
        return self._data(response)

    def download_result_url(self, result_url: str) -> dict[str, Any]:
        with httpx.Client(timeout=self.timeout, headers=self.headers, follow_redirects=True) as client:
            response = client.get(result_url)
        return self._data(response)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _metadata(job: DocumentJob) -> dict[str, Any]:
    return dict(job.metadata_json or {})


def _set_metadata(job: DocumentJob, **updates: Any) -> None:
    metadata = _metadata(job)
    metadata.update(updates)
    job.metadata_json = metadata


def _mark_failed(job: DocumentJob, *, code: str, message: str) -> None:
    job.status = "failed"
    job.error_code = code
    job.error_message = message
    job.completed_at = _now()


def _artifact_storage_key(job_id: uuid.UUID, filename: str) -> str:
    return f"layout-translations/{job_id}/{sanitize_filename(filename)}"


def _upload_artifact(job: DocumentJob, *, content: bytes, filename: str, content_type: str) -> RetainPdfArtifact:
    storage_key = _artifact_storage_key(job.id, filename)
    storage_service.upload_file(content, storage_key, content_type)
    return RetainPdfArtifact(
        storage_key=storage_key,
        filename=filename,
        content_type=content_type,
        size_bytes=len(content),
    )


def _artifact_info(artifacts_info: dict[str, Any], key: str) -> dict[str, Any]:
    value = artifacts_info.get(key)
    return value if isinstance(value, dict) else {}


def _optional_artifact_allowed(artifacts_info: dict[str, Any], key: str) -> bool:
    ready = artifacts_info.get(f"{key}_ready")
    return ready is not False


def _download_and_store_artifact(
    client: RetainPdfClient,
    job: DocumentJob,
    *,
    path: str,
    filename: str,
    content_type: str,
    required: bool,
) -> RetainPdfArtifact | None:
    try:
        content = client.download(path)
    except RetainPdfError:
        if required:
            raise
        logger.info("Optional RetainPDF artifact was not available: %s", path)
        return None
    return _upload_artifact(job, content=content, filename=filename, content_type=content_type)


def _poll_to_terminal(client: RetainPdfClient, external_job_id: str, job: DocumentJob, db) -> dict[str, Any]:
    deadline = time.monotonic() + max(60, settings.RETAINPDF_TIMEOUT_SECONDS)
    interval = max(1, settings.RETAINPDF_POLL_INTERVAL_SECONDS)
    latest: dict[str, Any] = {}
    while time.monotonic() < deadline:
        latest = client.get_job(external_job_id)
        status = str(latest.get("status") or "").lower()
        _set_metadata(
            job,
            retainpdf={
                "job_id": external_job_id,
                "status": status,
                "stage": latest.get("stage"),
                "stage_detail": latest.get("stage_detail"),
                "progress": latest.get("progress"),
            },
        )
        db.commit()
        if status == "succeeded":
            return latest
        if status in {"failed", "canceled", "cancelled"}:
            raise RetainPdfError(str(latest.get("error") or latest.get("stage_detail") or f"RetainPDF job {status}"))
        time.sleep(interval)
    raise RetainPdfError("RetainPDF job timed out")


def _poll_datalab_to_terminal(client: DatalabClient, initial: dict[str, Any], job: DocumentJob, db) -> dict[str, Any]:
    deadline = time.monotonic() + max(60, settings.RETAINPDF_TIMEOUT_SECONDS)
    interval = max(1, settings.RETAINPDF_POLL_INTERVAL_SECONDS)
    request_id = str(initial.get("request_id") or "")
    check_url = str(initial.get("request_check_url") or "")
    latest: dict[str, Any] = {}
    while time.monotonic() < deadline:
        latest = client.get_result(check_url)
        status = str(latest.get("status") or "").lower()
        _set_metadata(
            job,
            datalab={
                "request_id": request_id,
                "status": status,
                "page_count": latest.get("page_count"),
                "parse_quality_score": latest.get("parse_quality_score"),
                "cost_breakdown": latest.get("cost_breakdown"),
            },
        )
        db.commit()
        if status == "complete":
            if latest.get("success") is False:
                raise RetainPdfError(str(latest.get("error") or "Datalab conversion failed"))
            if latest.get("result_url") and not latest.get("json") and not latest.get("markdown"):
                downloaded = client.download_result_url(str(latest["result_url"]))
                latest.update(downloaded)
            return latest
        if status in {"failed", "error", "canceled", "cancelled"}:
            raise RetainPdfError(str(latest.get("error") or f"Datalab conversion {status}"))
        time.sleep(interval)
    raise RetainPdfError("Datalab conversion timed out")


def _coerce_json_payload(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if isinstance(value, str) and value.strip():
        try:
            parsed = json.loads(value)
        except ValueError:
            return {}
        return parsed if isinstance(parsed, dict) else {}
    return {}


_TAG_RE = re.compile(r"<[^>]+>")


def _clean_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (dict, list)):
        return ""
    text = str(value)
    text = _TAG_RE.sub(" ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _bbox_from_any(value: Any) -> tuple[float, float, float, float] | None:
    if isinstance(value, dict):
        if all(k in value for k in ("x", "y", "w", "h")):
            x = float(value["x"])
            y = float(value["y"])
            return (x, y, x + float(value["w"]), y + float(value["h"]))
        keys = ("left", "top", "right", "bottom")
        if all(k in value for k in keys):
            return tuple(float(value[k]) for k in keys)  # type: ignore[return-value]
        keys = ("x0", "y0", "x1", "y1")
        if all(k in value for k in keys):
            return tuple(float(value[k]) for k in keys)  # type: ignore[return-value]
    if isinstance(value, (list, tuple)):
        if len(value) == 4 and all(isinstance(v, (int, float)) for v in value):
            return tuple(float(v) for v in value)  # type: ignore[return-value]
        points: list[tuple[float, float]] = []
        if len(value) == 8 and all(isinstance(v, (int, float)) for v in value):
            points = [(float(value[i]), float(value[i + 1])) for i in range(0, 8, 2)]
        else:
            for point in value:
                if isinstance(point, dict) and "x" in point and "y" in point:
                    points.append((float(point["x"]), float(point["y"])))
                elif (
                    isinstance(point, (list, tuple))
                    and len(point) >= 2
                    and isinstance(point[0], (int, float))
                    and isinstance(point[1], (int, float))
                ):
                    points.append((float(point[0]), float(point[1])))
        if points:
            xs = [p[0] for p in points]
            ys = [p[1] for p in points]
            return (min(xs), min(ys), max(xs), max(ys))
    return None


def _extract_bbox(obj: dict[str, Any]) -> tuple[float, float, float, float] | None:
    for key in ("bbox", "bounding_box", "box", "polygon", "poly", "rect"):
        bbox = _bbox_from_any(obj.get(key))
        if bbox:
            x0, y0, x1, y1 = bbox
            if x1 > x0 and y1 > y0:
                return bbox
    return None


def _page_index_from_obj(obj: dict[str, Any], fallback: int = 0) -> int:
    for key in ("page_index", "page_idx"):
        value = obj.get(key)
        if isinstance(value, int):
            return max(0, value)
    for key in ("page_number", "page_num", "page"):
        value = obj.get(key)
        if isinstance(value, int):
            return max(0, value - 1 if key != "page_index" and value > 0 else value)
    raw_id = str(obj.get("id") or obj.get("block_id") or "")
    match = re.search(r"(?:^|/)page[/_-]?(\d+)", raw_id, flags=re.IGNORECASE)
    if match:
        return max(0, int(match.group(1)))
    return max(0, fallback)


def _page_dimensions_from_payload(payload: dict[str, Any], page_index: int) -> tuple[float | None, float | None]:
    candidates: list[Any] = []
    metadata = payload.get("metadata")
    if isinstance(metadata, dict):
        candidates.extend([metadata.get("page_stats"), metadata.get("page_info"), metadata.get("pages")])
    candidates.extend([payload.get("page_info"), payload.get("pages")])
    for candidate in candidates:
        if isinstance(candidate, dict):
            value = candidate.get(str(page_index)) or candidate.get(str(page_index + 1)) or candidate.get(page_index)
            if isinstance(value, dict):
                width = value.get("width") or value.get("page_width")
                height = value.get("height") or value.get("page_height")
                if width and height:
                    return float(width), float(height)
        if isinstance(candidate, list) and 0 <= page_index < len(candidate):
            value = candidate[page_index]
            if isinstance(value, dict):
                bbox = _extract_bbox(value)
                if bbox:
                    return bbox[2] - bbox[0], bbox[3] - bbox[1]
                width = value.get("width") or value.get("page_width")
                height = value.get("height") or value.get("page_height")
                if width and height:
                    return float(width), float(height)

    def walk_page_blocks(items: Any) -> tuple[float | None, float | None]:
        if not isinstance(items, list):
            return None, None
        for item in items:
            if not isinstance(item, dict):
                continue
            kind = _block_kind(item)
            item_page = _page_index_from_obj(item, page_index)
            bbox = _extract_bbox(item)
            if item_page == page_index and kind == "page" and bbox:
                return bbox[2] - bbox[0], bbox[3] - bbox[1]
            width, height = walk_page_blocks(item.get("children"))
            if width and height:
                return width, height
        return None, None

    width, height = walk_page_blocks(payload.get("children"))
    if width and height:
        return width, height
    return None, None


def _block_text(obj: dict[str, Any]) -> str:
    for key in ("text", "markdown", "content", "value", "html"):
        text = _clean_text(obj.get(key))
        if text:
            return text
    return ""


def _block_kind(obj: dict[str, Any]) -> str:
    for key in ("block_type", "type", "category", "kind", "label"):
        value = str(obj.get(key) or "").strip().lower()
        if value:
            return value
    return "text"


def _should_translate_block(kind: str, text: str, bbox: tuple[float, float, float, float]) -> bool:
    if len(text) < 2 or len(text) > 1800:
        return False
    if any(token in kind for token in ("page", "image", "figure", "picture", "equation", "formula")):
        return False
    x0, y0, x1, y1 = bbox
    return (x1 - x0) >= 8 and (y1 - y0) >= 6


def _iter_datalab_candidate_blocks(payload: dict[str, Any]) -> list[tuple[int, dict[str, Any]]]:
    pages = payload.get("pages")
    if isinstance(pages, list):
        output: list[tuple[int, dict[str, Any]]] = []
        for page_index, page in enumerate(pages):
            if not isinstance(page, dict):
                continue
            blocks = page.get("blocks") or page.get("children") or page.get("items")
            if isinstance(blocks, list):
                for block in blocks:
                    if isinstance(block, dict):
                        output.append((page_index, block))
        if output:
            return output
    blocks = payload.get("blocks")
    if isinstance(blocks, list):
        return [(0, block) for block in blocks if isinstance(block, dict)]
    children = payload.get("children")
    if isinstance(children, list):
        flattened: list[tuple[int, dict[str, Any]]] = []

        def walk(items: list[Any], inherited_page: int) -> None:
            for item in items:
                if not isinstance(item, dict):
                    continue
                page_index = _page_index_from_obj(item, inherited_page)
                if _extract_bbox(item) and _block_text(item):
                    flattened.append((page_index, item))
                nested = item.get("children")
                if isinstance(nested, list):
                    walk(nested, page_index)

        walk(children, 0)
        return flattened
    return []


def _extract_datalab_text_blocks(payload: dict[str, Any]) -> list[LayoutTextBlock]:
    blocks: list[LayoutTextBlock] = []
    for order, (fallback_page_index, item) in enumerate(_iter_datalab_candidate_blocks(payload)):
        bbox = _extract_bbox(item)
        if not bbox:
            continue
        text = _block_text(item)
        kind = _block_kind(item)
        if not _should_translate_block(kind, text, bbox):
            continue
        page_index = _page_index_from_obj(item, fallback_page_index)
        page_width = item.get("page_width") or item.get("width")
        page_height = item.get("page_height") or item.get("height")
        if not (page_width and page_height):
            page_width, page_height = _page_dimensions_from_payload(payload, page_index)
        blocks.append(
            LayoutTextBlock(
                id=str(item.get("id") or item.get("block_id") or f"b{order}"),
                page_index=page_index,
                bbox=bbox,
                text=text,
                page_width=float(page_width) if page_width else None,
                page_height=float(page_height) if page_height else None,
                kind=kind,
            )
        )
    return blocks


def _extract_pymupdf_text_blocks(source_bytes: bytes) -> list[LayoutTextBlock]:
    blocks: list[LayoutTextBlock] = []
    with fitz.open(stream=source_bytes, filetype="pdf") as pdf:
        for page_index, page in enumerate(pdf):
            for order, raw in enumerate(page.get_text("blocks")):
                if len(raw) < 5:
                    continue
                x0, y0, x1, y1, text = raw[:5]
                bbox = (float(x0), float(y0), float(x1), float(y1))
                clean = _clean_text(text)
                if not _should_translate_block("text", clean, bbox):
                    continue
                blocks.append(
                    LayoutTextBlock(
                        id=f"fitz-p{page_index}-b{order}",
                        page_index=page_index,
                        bbox=bbox,
                        text=clean,
                        page_width=float(page.rect.width),
                        page_height=float(page.rect.height),
                    )
                )
    return blocks


def _json_from_model_text(text: str) -> dict[str, Any]:
    raw = text.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
    return json.loads(raw)


def _translate_blocks(blocks: list[LayoutTextBlock], *, target_language: str) -> dict[str, str]:
    translation_api_key = _translation_api_key()
    if not translation_api_key:
        raise LayoutTranslationConfigError("Translation API key is not configured")
    client = OpenAI(api_key=translation_api_key, base_url=settings.RETAINPDF_TRANSLATION_BASE_URL)
    translations: dict[str, str] = {}
    batch: list[LayoutTextBlock] = []
    batch_chars = 0

    def flush() -> None:
        nonlocal batch, batch_chars
        if not batch:
            return
        items = [{"id": block.id, "text": block.text} for block in batch]
        response = client.chat.completions.create(
            model=settings.RETAINPDF_TRANSLATION_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Translate each item into Simplified Chinese. Preserve numbers, equations, citations, "
                        "units, URLs, code-like text, and inline symbols. Return only valid JSON with this shape: "
                        "{\"items\":[{\"id\":\"...\",\"text\":\"...\"}]}."
                    ),
                },
                {"role": "user", "content": json.dumps({"target_language": target_language, "items": items}, ensure_ascii=False)},
            ],
            temperature=0,
            extra_body={"thinking": {"type": "disabled"}},
        )
        content = response.choices[0].message.content or ""
        parsed = _json_from_model_text(content)
        for item in parsed.get("items", []):
            if isinstance(item, dict) and item.get("id") and isinstance(item.get("text"), str):
                translations[str(item["id"])] = item["text"].strip()
        batch = []
        batch_chars = 0

    for block in blocks:
        text_len = len(block.text)
        if batch and (len(batch) >= 20 or batch_chars + text_len > 4500):
            flush()
        batch.append(block)
        batch_chars += text_len
    flush()
    return translations


def _map_bbox_to_page(block: LayoutTextBlock, page: fitz.Page) -> fitz.Rect:
    x0, y0, x1, y1 = block.bbox
    page_width = block.page_width or page.rect.width
    page_height = block.page_height or page.rect.height
    if max(abs(x0), abs(y0), abs(x1), abs(y1)) <= 1.5:
        x0 *= page.rect.width
        x1 *= page.rect.width
        y0 *= page.rect.height
        y1 *= page.rect.height
    elif page_width and page_height:
        x_scale = page.rect.width / page_width
        y_scale = page.rect.height / page_height
        x0 *= x_scale
        x1 *= x_scale
        y0 *= y_scale
        y1 *= y_scale
    rect = fitz.Rect(x0, y0, x1, y1).normalize()
    return rect & page.rect


def _font_size_for_rect(rect: fitz.Rect, text: str) -> float:
    line_count = max(1, min(5, len(text) // 22 + 1))
    return max(5.0, min(11.0, rect.height / (line_count * 1.35)))


def _render_translated_pdf(source_bytes: bytes, blocks: list[LayoutTextBlock], translations: dict[str, str]) -> bytes:
    with fitz.open(stream=source_bytes, filetype="pdf") as pdf:
        by_page: dict[int, list[LayoutTextBlock]] = {}
        for block in blocks:
            if block.id in translations:
                by_page.setdefault(block.page_index, []).append(block)

        for page_index, page_blocks in by_page.items():
            if page_index < 0 or page_index >= len(pdf):
                continue
            page = pdf[page_index]
            for block in page_blocks:
                translated = translations.get(block.id, "").strip()
                if not translated:
                    continue
                rect = _map_bbox_to_page(block, page)
                if rect.is_empty or rect.width < 8 or rect.height < 6:
                    continue
                if (rect.width * rect.height) > (page.rect.width * page.rect.height) * 0.35:
                    continue
                padded = fitz.Rect(rect.x0, rect.y0, rect.x1, rect.y1)
                padded.x0 = max(page.rect.x0, padded.x0 - 0.5)
                padded.y0 = max(page.rect.y0, padded.y0 - 0.5)
                padded.x1 = min(page.rect.x1, padded.x1 + 0.5)
                padded.y1 = min(page.rect.y1, padded.y1 + 0.5)
                page.draw_rect(padded, color=(1, 1, 1), fill=(1, 1, 1), overlay=True)
                font_size = _font_size_for_rect(padded, translated)
                for _ in range(6):
                    try:
                        remaining = page.insert_textbox(
                            padded,
                            translated,
                            fontname="china-s",
                            fontsize=font_size,
                            color=(0.05, 0.05, 0.05),
                            align=fitz.TEXT_ALIGN_LEFT,
                        )
                    except Exception:
                        remaining = page.insert_textbox(
                            padded,
                            translated,
                            fontname="helv",
                            fontsize=font_size,
                            color=(0.05, 0.05, 0.05),
                            align=fitz.TEXT_ALIGN_LEFT,
                        )
                    if remaining >= 0 or font_size <= 5.0:
                        break
                    font_size -= 1.0
        return pdf.tobytes(garbage=4, deflate=True)


def _translated_markdown(blocks: list[LayoutTextBlock], translations: dict[str, str]) -> bytes:
    lines: list[str] = ["# Layout-preserving PDF translation", ""]
    current_page = -1
    for block in blocks:
        translated = translations.get(block.id, "").strip()
        if not translated:
            continue
        if block.page_index != current_page:
            current_page = block.page_index
            lines.extend(["", f"## Page {current_page + 1}", ""])
        lines.append(translated)
        lines.append("")
    return "\n".join(lines).encode("utf-8")


def _bundle_bytes(*, datalab_result: dict[str, Any], blocks: list[LayoutTextBlock], translations: dict[str, str]) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("datalab-result.json", json.dumps(datalab_result, ensure_ascii=False, indent=2))
        zf.writestr(
            "translated-blocks.json",
            json.dumps(
                [
                    {
                        "id": block.id,
                        "page_index": block.page_index,
                        "bbox": block.bbox,
                        "kind": block.kind,
                        "source_text": block.text,
                        "translated_text": translations.get(block.id, ""),
                    }
                    for block in blocks
                ],
                ensure_ascii=False,
                indent=2,
            ),
        )
    return buffer.getvalue()


def _run_datalab_layout_translation(
    *,
    job: DocumentJob,
    doc: Document,
    source_bytes: bytes,
    filename: str,
    target_language: str,
    db,
) -> None:
    client = DatalabClient()
    _set_metadata(job, service_status="submitting_to_datalab", engine="datalab")
    db.commit()
    initial = client.submit_convert(filename=filename, content=source_bytes)

    _set_metadata(
        job,
        service_status="running_in_datalab",
        engine="datalab",
        datalab={"request_id": initial.get("request_id"), "status": "submitted"},
    )
    db.commit()
    result = _poll_datalab_to_terminal(client, initial, job, db)
    datalab_json = _coerce_json_payload(result.get("json"))
    blocks = _extract_datalab_text_blocks(datalab_json) if datalab_json else []
    if not blocks:
        logger.warning("Datalab result did not contain usable layout blocks for job %s; falling back to PyMuPDF blocks", job.id)
        blocks = _extract_pymupdf_text_blocks(source_bytes)
    if not blocks:
        raise RetainPdfError("No translatable text blocks found in PDF")

    _set_metadata(job, service_status="translating_blocks", engine="datalab", block_count=len(blocks))
    db.commit()
    translations = _translate_blocks(blocks, target_language=target_language)
    if not translations:
        raise RetainPdfError("Translation provider returned no translated blocks")

    _set_metadata(job, service_status="rendering_pdf", engine="datalab", translated_block_count=len(translations))
    db.commit()
    translated_pdf = _render_translated_pdf(source_bytes, blocks, translations)
    stem = os.path.splitext(filename)[0] or "document"
    artifacts: dict[str, dict[str, Any]] = {}
    pdf_artifact = _upload_artifact(
        job,
        content=translated_pdf,
        filename=sanitize_filename(f"{stem}-translated.pdf"),
        content_type="application/pdf",
    )
    artifacts["pdf"] = pdf_artifact.__dict__
    markdown_artifact = _upload_artifact(
        job,
        content=_translated_markdown(blocks, translations),
        filename=sanitize_filename(f"{stem}-translated.md"),
        content_type="text/markdown; charset=utf-8",
    )
    artifacts["markdown"] = markdown_artifact.__dict__
    bundle_artifact = _upload_artifact(
        job,
        content=_bundle_bytes(datalab_result=result, blocks=blocks, translations=translations),
        filename=sanitize_filename(f"{stem}-translation-data.zip"),
        content_type="application/zip",
    )
    artifacts["bundle"] = bundle_artifact.__dict__

    job.status = "succeeded"
    job.error_code = None
    job.error_message = None
    job.completed_at = _now()
    _set_metadata(
        job,
        service_status="succeeded",
        engine="datalab",
        artifacts=artifacts,
        datalab={
            "request_id": initial.get("request_id"),
            "status": "complete",
            "page_count": result.get("page_count"),
            "parse_quality_score": result.get("parse_quality_score"),
            "cost_breakdown": result.get("cost_breakdown"),
            "runtime": result.get("runtime"),
        },
        block_count=len(blocks),
        translated_block_count=len(translations),
    )
    db.commit()


def _run_retainpdf_layout_translation(
    *,
    job: DocumentJob,
    doc: Document,
    source_bytes: bytes,
    filename: str,
    db,
) -> None:
    client = RetainPdfClient()

    _set_metadata(job, service_status="uploading_to_retainpdf", engine="retainpdf")
    db.commit()
    upload_id = client.upload_pdf(filename=filename, content=source_bytes)

    _set_metadata(job, service_status="queued_in_retainpdf", engine="retainpdf", retainpdf={"upload_id": upload_id})
    db.commit()
    external_job_id = client.create_book_job(upload_id=upload_id, source_filename=filename)

    _set_metadata(job, service_status="running_in_retainpdf", engine="retainpdf", retainpdf={"upload_id": upload_id, "job_id": external_job_id})
    db.commit()
    detail = _poll_to_terminal(client, external_job_id, job, db)
    artifacts_info = detail.get("artifacts") if isinstance(detail.get("artifacts"), dict) else {}

    artifacts: dict[str, dict[str, Any]] = {}
    stem = os.path.splitext(filename)[0] or "document"
    pdf_info = _artifact_info(artifacts_info, "pdf")
    pdf_path = str(pdf_info.get("path") or f"/api/v1/jobs/{external_job_id}/pdf")
    pdf_filename = sanitize_filename(str(pdf_info.get("file_name") or f"{stem}-translated.pdf"))
    pdf = _download_and_store_artifact(
        client,
        job,
        path=pdf_path,
        filename=pdf_filename,
        content_type="application/pdf",
        required=True,
    )
    if pdf:
        artifacts["pdf"] = pdf.__dict__

    markdown_info = _artifact_info(artifacts_info, "markdown")
    if _optional_artifact_allowed(artifacts_info, "markdown"):
        markdown_path = str(markdown_info.get("raw_path") or f"/api/v1/jobs/{external_job_id}/markdown?raw=true")
        markdown_filename = sanitize_filename(str(markdown_info.get("file_name") or f"{stem}-translated.md"))
        markdown = _download_and_store_artifact(
            client,
            job,
            path=markdown_path,
            filename=markdown_filename,
            content_type="text/markdown; charset=utf-8",
            required=False,
        )
    else:
        markdown = None
    if markdown:
        artifacts["markdown"] = markdown.__dict__

    bundle_info = _artifact_info(artifacts_info, "bundle")
    if _optional_artifact_allowed(artifacts_info, "bundle"):
        bundle_path = str(bundle_info.get("path") or f"/api/v1/jobs/{external_job_id}/download")
        bundle_filename = sanitize_filename(str(bundle_info.get("file_name") or f"{stem}-translated.zip"))
        bundle = _download_and_store_artifact(
            client,
            job,
            path=bundle_path,
            filename=bundle_filename,
            content_type="application/zip",
            required=False,
        )
    else:
        bundle = None
    if bundle:
        artifacts["bundle"] = bundle.__dict__

    if "pdf" not in artifacts:
        raise RetainPdfError("RetainPDF completed without a translated PDF artifact")

    job.status = "succeeded"
    job.error_code = None
    job.error_message = None
    job.completed_at = _now()
    _set_metadata(
        job,
        service_status="succeeded",
        engine="retainpdf",
        artifacts=artifacts,
        retainpdf={
            "job_id": external_job_id,
            "status": "succeeded",
            "stage": detail.get("stage"),
            "progress": detail.get("progress"),
        },
    )
    db.commit()


def run_layout_translation_job_sync(job_id: str) -> None:
    from app.models.sync_database import SyncSessionLocal

    with SyncSessionLocal() as db:
        try:
            parsed_job_id = uuid.UUID(job_id)
        except ValueError:
            return
        job = db.get(DocumentJob, parsed_job_id)
        if not job or job.job_type != LAYOUT_TRANSLATION_JOB_TYPE:
            return
        doc = db.get(Document, job.document_id) if job.document_id else None
        if not doc:
            _mark_failed(job, code="LAYOUT_TRANSLATION_DOCUMENT_NOT_FOUND", message="Document not found")
            db.commit()
            return

        job.status = "running"
        job.error_code = None
        job.error_message = None
        _set_metadata(job, service_status="downloading_source")
        db.commit()

        try:
            if doc.file_type != "pdf":
                raise RetainPdfError("Layout-preserving translation currently supports PDF files only")

            source_bytes = storage_service.download_file(doc.storage_key)
            filename = sanitize_filename(doc.filename or "document.pdf")
            input_scope = getattr(job, "input_scope", None) or {}
            target_language = str(input_scope.get("target_language") or DEFAULT_LAYOUT_TRANSLATION_TARGET)
            engine = layout_translation_engine()
            if engine == "datalab":
                _run_datalab_layout_translation(
                    job=job,
                    doc=doc,
                    source_bytes=source_bytes,
                    filename=filename,
                    target_language=target_language,
                    db=db,
                )
            elif engine == "retainpdf":
                _run_retainpdf_layout_translation(
                    job=job,
                    doc=doc,
                    source_bytes=source_bytes,
                    filename=filename,
                    db=db,
                )
            else:
                raise LayoutTranslationConfigError(f"Unsupported layout translation engine: {engine}")
        except LayoutTranslationConfigError as exc:
            logger.error("Layout translation job %s is not configured: %s", job.id, exc)
            _mark_failed(
                job,
                code="LAYOUT_TRANSLATION_NOT_CONFIGURED",
                message="Layout-preserving translation is temporarily unavailable.",
            )
            _set_metadata(job, service_status="not_configured")
            db.commit()
        except Exception as exc:
            _mark_failed(job, code="LAYOUT_TRANSLATION_FAILED", message=str(exc))
            _set_metadata(job, service_status="failed")
            db.commit()
