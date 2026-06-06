"""Layout-preserving PDF translation orchestration."""
from __future__ import annotations

import logging
import os
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import fitz
import httpx

from app.core.config import settings
from app.models.tables import Document, DocumentJob, User
from app.services.doc_service import sanitize_filename
from app.services.storage_service import storage_service

LAYOUT_TRANSLATION_JOB_TYPE = "layout_translation"
LAYOUT_TRANSLATION_REQUIRED_PLAN = "plus"
LAYOUT_TRANSLATION_ACTIVE_STATUSES = ("queued", "running", "succeeded")
DEFAULT_LAYOUT_TRANSLATION_TARGET = "zh-CN"
logger = logging.getLogger(__name__)

GENERIC_LAYOUT_TRANSLATION_FAILURE_MESSAGE = (
    "Layout-preserving translation failed. Please try again, or contact support if it keeps failing."
)
STRUCTURE_LAYOUT_TRANSLATION_FAILURE_MESSAGE = (
    "Layout-preserving translation failed while preparing the document structure. Please try again."
)
TIMEOUT_LAYOUT_TRANSLATION_FAILURE_MESSAGE = (
    "Layout-preserving translation timed out. Try a smaller PDF or try again later."
)

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


class LayoutTranslationLimitError(RetainPdfError):
    def __init__(self, *, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class RetainPdfArtifact:
    storage_key: str
    filename: str
    content_type: str
    size_bytes: int


@dataclass(frozen=True)
class LayoutTranslationConfigStatus:
    ready: bool
    missing: tuple[str, ...]
    engine: str
    ocr_provider: str
    translation_model: str
    translation_base_url: str
    uses_deepseek_fallback_key: bool


def layout_translation_public_error_message(message: str | None) -> str | None:
    if not message:
        return None
    raw = str(message)
    lowered = raw.lower()
    if (
        "traceback" in lowered
        or "/app/backend/" in raw
        or "documentschemavalidationerror" in raw
        or "document_schema_validation_failed" in lowered
        or "normalized document schema validation failed" in lowered
    ):
        return STRUCTURE_LAYOUT_TRANSLATION_FAILURE_MESSAGE
    return raw


def _safe_layout_translation_failure_message(exc: BaseException) -> str:
    raw = str(exc)
    lowered = raw.lower()
    public = layout_translation_public_error_message(raw)
    if public and public != raw:
        return public
    if "timed out" in lowered or "timeout" in lowered:
        return TIMEOUT_LAYOUT_TRANSLATION_FAILURE_MESSAGE
    if isinstance(exc, RetainPdfError):
        return GENERIC_LAYOUT_TRANSLATION_FAILURE_MESSAGE
    return GENERIC_LAYOUT_TRANSLATION_FAILURE_MESSAGE


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


def layout_translation_max_pages_for_plan(plan: str | None) -> int:
    normalized = (plan or "free").lower()
    if normalized == "pro":
        return max(0, int(settings.PRO_LAYOUT_TRANSLATION_MAX_PAGES or 0))
    if normalized == "plus":
        return max(0, int(settings.PLUS_LAYOUT_TRANSLATION_MAX_PAGES or 0))
    return max(0, int(settings.FREE_LAYOUT_TRANSLATION_MAX_PAGES or 0))


def layout_translation_next_plan_for_page_limit(plan: str | None) -> str | None:
    normalized = (plan or "free").lower()
    if normalized == "free":
        return "plus"
    if normalized == "plus":
        return "pro"
    return None


def layout_translation_file_size_limit_mb() -> int:
    return max(0, int(settings.LAYOUT_TRANSLATION_MAX_FILE_SIZE_MB or 0))


def layout_translation_file_size_limit_bytes() -> int:
    limit_mb = layout_translation_file_size_limit_mb()
    return limit_mb * 1024 * 1024 if limit_mb > 0 else 0


def validate_layout_translation_size_limits(
    *,
    plan: str | None,
    file_size: int | None,
    page_count: int | None,
) -> None:
    max_bytes = layout_translation_file_size_limit_bytes()
    if max_bytes > 0 and file_size and int(file_size) > max_bytes:
        max_mb = layout_translation_file_size_limit_mb()
        raise LayoutTranslationLimitError(
            code="LAYOUT_TRANSLATION_FILE_TOO_LARGE",
            message=f"Layout-preserving PDF translation supports files up to {max_mb} MB.",
        )

    max_pages = layout_translation_max_pages_for_plan(plan)
    if max_pages > 0 and page_count and int(page_count) > max_pages:
        raise LayoutTranslationLimitError(
            code="LAYOUT_TRANSLATION_PAGE_LIMIT_EXCEEDED",
            message=(
                "This PDF has "
                f"{int(page_count)} pages, above the {max_pages}-page layout translation limit "
                f"for the {(plan or 'free').lower()} plan."
            ),
        )


def _translation_api_key() -> str | None:
    return settings.RETAINPDF_TRANSLATION_API_KEY or settings.DEEPSEEK_API_KEY


def _datalab_token() -> str | None:
    return settings.RETAINPDF_DATALAB_TOKEN or settings.DATALAB_API_KEY


def layout_translation_engine() -> str:
    engine = (settings.LAYOUT_TRANSLATION_ENGINE or "").strip().lower()
    if engine:
        return engine
    return "retainpdf"


def layout_translation_config_status() -> LayoutTranslationConfigStatus:
    missing: list[str] = []
    if not _translation_api_key():
        missing.append("DEEPSEEK_API_KEY")

    engine = layout_translation_engine()
    provider = (settings.RETAINPDF_OCR_PROVIDER or "paddle").strip().lower()
    if engine == "retainpdf":
        if not settings.RETAINPDF_API_BASE_URL:
            missing.append("RETAINPDF_API_BASE_URL")
        if provider == "mineru":
            if not settings.RETAINPDF_MINERU_TOKEN:
                missing.append("RETAINPDF_MINERU_TOKEN")
        elif provider == "paddle":
            if not settings.RETAINPDF_PADDLE_TOKEN:
                missing.append("RETAINPDF_PADDLE_TOKEN")
        elif provider == "datalab":
            if not _datalab_token():
                missing.append("RETAINPDF_DATALAB_TOKEN or DATALAB_API_KEY")
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
        provider = (settings.RETAINPDF_OCR_PROVIDER or "paddle").strip().lower()
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
        elif provider == "datalab":
            datalab_token = _datalab_token()
            if not datalab_token:
                raise LayoutTranslationConfigError("RetainPDF Datalab token is not configured")
            ocr["datalab_token"] = datalab_token
            ocr["datalab_api_url"] = settings.RETAINPDF_DATALAB_API_URL
            ocr["datalab_mode"] = settings.RETAINPDF_DATALAB_MODE
            ocr["datalab_output_format"] = settings.RETAINPDF_DATALAB_OUTPUT_FORMAT
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
                "workers": max(0, settings.RETAINPDF_WORKERS),
                "batch_size": max(1, settings.RETAINPDF_BATCH_SIZE),
                "classify_batch_size": max(1, settings.RETAINPDF_CLASSIFY_BATCH_SIZE),
            },
            "render": {
                "render_mode": "auto",
                "compile_workers": max(0, settings.RETAINPDF_COMPILE_WORKERS),
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


def _pdf_page_count(source_bytes: bytes) -> int | None:
    try:
        with fitz.open(stream=source_bytes, filetype="pdf") as pdf:
            return int(len(pdf))
    except Exception:
        logger.warning("Unable to read PDF page count before layout translation", exc_info=True)
        return None


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
        user = db.get(User, job.user_id) if getattr(job, "user_id", None) else None
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
            plan = (getattr(user, "plan", None) or "free").lower()
            page_count = getattr(doc, "page_count", None) or _pdf_page_count(source_bytes)
            validate_layout_translation_size_limits(
                plan=plan,
                file_size=getattr(doc, "file_size", None),
                page_count=page_count,
            )
            filename = sanitize_filename(doc.filename or "document.pdf")
            engine = layout_translation_engine()
            if engine == "retainpdf":
                _run_retainpdf_layout_translation(
                    job=job,
                    doc=doc,
                    source_bytes=source_bytes,
                    filename=filename,
                    db=db,
                )
            else:
                raise LayoutTranslationConfigError(
                    f"Unsupported layout translation engine: {engine}. The Datalab overlay renderer has been retired."
                )
        except LayoutTranslationConfigError as exc:
            logger.error("Layout translation job %s is not configured: %s", job.id, exc)
            _mark_failed(
                job,
                code="LAYOUT_TRANSLATION_NOT_CONFIGURED",
                message="Layout-preserving translation is temporarily unavailable.",
            )
            _set_metadata(job, service_status="not_configured")
            db.commit()
        except LayoutTranslationLimitError as exc:
            _mark_failed(job, code=exc.code, message=str(exc))
            _set_metadata(job, service_status="limit_rejected")
            db.commit()
        except Exception as exc:
            logger.exception("Layout translation job %s failed", job.id)
            _mark_failed(
                job,
                code="LAYOUT_TRANSLATION_FAILED",
                message=_safe_layout_translation_failure_message(exc),
            )
            _set_metadata(job, service_status="failed")
            db.commit()
