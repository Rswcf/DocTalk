from __future__ import annotations

import sys
import uuid
from types import SimpleNamespace

from app.models.tables import Document, DocumentJob
from app.services import layout_translation_service as service


class _FakeSession:
    def __init__(self, job: SimpleNamespace, doc: SimpleNamespace) -> None:
        self.job = job
        self.doc = doc
        self.commits = 0

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb) -> bool:
        return False

    def get(self, model, _id):
        if model is DocumentJob:
            return self.job
        if model is Document:
            return self.doc
        return None

    def commit(self) -> None:
        self.commits += 1


def test_layout_translation_worker_downloads_pdf_without_ready_flags(monkeypatch) -> None:
    monkeypatch.setattr(service, "layout_translation_engine", lambda: "retainpdf")
    job_id = uuid.uuid4()
    doc_id = uuid.uuid4()
    job = SimpleNamespace(
        id=job_id,
        document_id=doc_id,
        job_type=service.LAYOUT_TRANSLATION_JOB_TYPE,
        status="queued",
        error_code=None,
        error_message=None,
        completed_at=None,
        metadata_json={},
    )
    doc = SimpleNamespace(
        id=doc_id,
        file_type="pdf",
        filename="Complex Paper.pdf",
        storage_key="documents/complex-paper.pdf",
    )
    fake_session = _FakeSession(job, doc)
    uploaded: dict[str, tuple[bytes, str]] = {}
    download_paths: list[str] = []

    class FakeRetainPdfClient:
        def upload_pdf(self, *, filename: str, content: bytes) -> str:
            assert filename == "Complex Paper.pdf"
            assert content == b"%PDF-source"
            return "upload_1"

        def create_book_job(self, *, upload_id: str, source_filename: str) -> str:
            assert upload_id == "upload_1"
            assert source_filename == "Complex Paper.pdf"
            return "retain_job_1"

        def get_job(self, job_id: str):
            assert job_id == "retain_job_1"
            return {"status": "succeeded", "stage": "done", "progress": 1, "artifacts": {}}

        def download(self, path: str) -> bytes:
            download_paths.append(path)
            if path.endswith("/pdf"):
                return b"%PDF-translated"
            raise service.RetainPdfError("optional artifact missing")

    monkeypatch.setattr(service, "RetainPdfClient", FakeRetainPdfClient)
    monkeypatch.setattr(service.storage_service, "download_file", lambda key: b"%PDF-source")
    monkeypatch.setattr(
        service.storage_service,
        "upload_file",
        lambda content, key, content_type: uploaded.setdefault(key, (content, content_type)),
    )

    monkeypatch.setitem(
        sys.modules,
        "app.models.sync_database",
        SimpleNamespace(SyncSessionLocal=lambda: fake_session),
    )

    service.run_layout_translation_job_sync(str(job_id))

    assert job.status == "succeeded"
    assert job.error_code is None
    assert job.metadata_json["service_status"] == "succeeded"
    assert "/api/v1/jobs/retain_job_1/pdf" in download_paths
    assert "pdf" in job.metadata_json["artifacts"]
    pdf = job.metadata_json["artifacts"]["pdf"]
    assert pdf["filename"] == "Complex Paper-translated.pdf"
    assert uploaded[pdf["storage_key"]] == (b"%PDF-translated", "application/pdf")


def test_layout_translation_worker_retires_datalab_renderer(monkeypatch) -> None:
    monkeypatch.setattr(service, "layout_translation_engine", lambda: "datalab")
    job_id = uuid.uuid4()
    doc_id = uuid.uuid4()
    job = SimpleNamespace(
        id=job_id,
        document_id=doc_id,
        job_type=service.LAYOUT_TRANSLATION_JOB_TYPE,
        status="queued",
        error_code=None,
        error_message=None,
        completed_at=None,
        metadata_json={},
    )
    doc = SimpleNamespace(
        id=doc_id,
        file_type="pdf",
        filename="Paper.pdf",
        storage_key="documents/paper.pdf",
        file_size=1024,
        page_count=1,
    )
    fake_session = _FakeSession(job, doc)

    class UnexpectedRetainPdfClient:
        def __init__(self) -> None:
            raise AssertionError("RetainPDF sidecar should not be called for unsupported engines")

    monkeypatch.setattr(service, "RetainPdfClient", UnexpectedRetainPdfClient)
    monkeypatch.setattr(service.storage_service, "download_file", lambda key: b"%PDF-source")
    monkeypatch.setitem(
        sys.modules,
        "app.models.sync_database",
        SimpleNamespace(SyncSessionLocal=lambda: fake_session),
    )

    service.run_layout_translation_job_sync(str(job_id))

    assert job.status == "failed"
    assert job.error_code == "LAYOUT_TRANSLATION_NOT_CONFIGURED"
    assert job.metadata_json["service_status"] == "not_configured"


def test_retainpdf_create_job_payload_matches_grouped_api(monkeypatch) -> None:
    captured: dict[str, object] = {}

    class FakeResponse:
        status_code = 200

        def json(self):
            return {"code": 0, "data": {"job_id": "retain_job_1"}}

    class FakeHttpClient:
        def __init__(self, *args, **kwargs) -> None:
            pass

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb) -> bool:
            return False

        def post(self, url: str, json: dict):
            captured["url"] = url
            captured["json"] = json
            return FakeResponse()

    monkeypatch.setattr(service.httpx, "Client", FakeHttpClient)
    monkeypatch.setattr(service.settings, "RETAINPDF_API_BASE_URL", "http://retainpdf.test")
    monkeypatch.setattr(service.settings, "RETAINPDF_API_KEY", "sidecar-key")
    monkeypatch.setattr(service.settings, "RETAINPDF_OCR_PROVIDER", "paddle")
    monkeypatch.setattr(service.settings, "RETAINPDF_PADDLE_TOKEN", "paddle-token")
    monkeypatch.setattr(service.settings, "RETAINPDF_MINERU_TOKEN", None)
    monkeypatch.setattr(service.settings, "RETAINPDF_TRANSLATION_API_KEY", "model-key")
    monkeypatch.setattr(service.settings, "RETAINPDF_TRANSLATION_BASE_URL", "https://api.deepseek.com/v1")
    monkeypatch.setattr(service.settings, "RETAINPDF_TRANSLATION_MODEL", "deepseek-v4-flash")
    monkeypatch.setattr(service.settings, "RETAINPDF_WORKERS", 2)
    monkeypatch.setattr(service.settings, "RETAINPDF_BATCH_SIZE", 1)
    monkeypatch.setattr(service.settings, "RETAINPDF_CLASSIFY_BATCH_SIZE", 12)
    monkeypatch.setattr(service.settings, "RETAINPDF_COMPILE_WORKERS", 1)
    monkeypatch.setattr(service.settings, "RETAINPDF_TIMEOUT_SECONDS", 1800)

    job_id = service.RetainPdfClient().create_book_job(upload_id="upload_1", source_filename="Paper.pdf")

    assert job_id == "retain_job_1"
    assert captured["url"] == "http://retainpdf.test/api/v1/jobs"
    payload = captured["json"]
    assert payload["workflow"] == "book"
    assert payload["source"] == {"upload_id": "upload_1", "source_url": "", "artifact_job_id": ""}
    assert payload["ocr"]["provider"] == "paddle"
    assert payload["ocr"]["paddle_token"] == "paddle-token"
    assert payload["translation"]["workers"] == 2
    assert payload["translation"]["batch_size"] == 1
    assert payload["translation"]["classify_batch_size"] == 12
    assert payload["render"]["compile_workers"] == 1
    assert payload["runtime"] == {"job_id": "", "timeout_seconds": 1800}


def test_retainpdf_create_job_payload_supports_datalab_provider(monkeypatch) -> None:
    captured: dict[str, object] = {}

    class FakeResponse:
        status_code = 200

        def json(self):
            return {"code": 0, "data": {"job_id": "retain_job_datalab"}}

    class FakeHttpClient:
        def __init__(self, *args, **kwargs) -> None:
            pass

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb) -> bool:
            return False

        def post(self, url: str, json: dict):
            captured["url"] = url
            captured["json"] = json
            return FakeResponse()

    monkeypatch.setattr(service.httpx, "Client", FakeHttpClient)
    monkeypatch.setattr(service.settings, "RETAINPDF_API_BASE_URL", "http://retainpdf.test")
    monkeypatch.setattr(service.settings, "RETAINPDF_API_KEY", "sidecar-key")
    monkeypatch.setattr(service.settings, "RETAINPDF_OCR_PROVIDER", "datalab")
    monkeypatch.setattr(service.settings, "RETAINPDF_DATALAB_TOKEN", None)
    monkeypatch.setattr(service.settings, "DATALAB_API_KEY", "datalab-token")
    monkeypatch.setattr(service.settings, "RETAINPDF_DATALAB_API_URL", "https://www.datalab.to")
    monkeypatch.setattr(service.settings, "RETAINPDF_DATALAB_MODE", "balanced")
    monkeypatch.setattr(service.settings, "RETAINPDF_DATALAB_OUTPUT_FORMAT", "json,markdown")
    monkeypatch.setattr(service.settings, "RETAINPDF_TRANSLATION_API_KEY", "model-key")
    monkeypatch.setattr(service.settings, "RETAINPDF_TRANSLATION_BASE_URL", "https://api.deepseek.com/v1")
    monkeypatch.setattr(service.settings, "RETAINPDF_TRANSLATION_MODEL", "deepseek-v4-flash")
    monkeypatch.setattr(service.settings, "RETAINPDF_WORKERS", 0)
    monkeypatch.setattr(service.settings, "RETAINPDF_BATCH_SIZE", 1)
    monkeypatch.setattr(service.settings, "RETAINPDF_CLASSIFY_BATCH_SIZE", 12)
    monkeypatch.setattr(service.settings, "RETAINPDF_COMPILE_WORKERS", 0)
    monkeypatch.setattr(service.settings, "RETAINPDF_TIMEOUT_SECONDS", 1800)

    job_id = service.RetainPdfClient().create_book_job(upload_id="upload_1", source_filename="Paper.pdf")

    assert job_id == "retain_job_datalab"
    payload = captured["json"]
    assert payload["ocr"]["provider"] == "datalab"
    assert payload["ocr"]["datalab_token"] == "datalab-token"
    assert payload["ocr"]["datalab_api_url"] == "https://www.datalab.to"
    assert payload["ocr"]["datalab_mode"] == "balanced"
    assert payload["ocr"]["datalab_output_format"] == "json,markdown"


def test_layout_translation_config_status_accepts_datalab_fallback_key(monkeypatch) -> None:
    monkeypatch.setattr(service.settings, "LAYOUT_TRANSLATION_ENGINE", "retainpdf")
    monkeypatch.setattr(service.settings, "RETAINPDF_API_BASE_URL", "http://retainpdf.test")
    monkeypatch.setattr(service.settings, "RETAINPDF_OCR_PROVIDER", "datalab")
    monkeypatch.setattr(service.settings, "RETAINPDF_DATALAB_TOKEN", None)
    monkeypatch.setattr(service.settings, "DATALAB_API_KEY", "datalab-token")
    monkeypatch.setattr(service.settings, "DEEPSEEK_API_KEY", "model-key")
    monkeypatch.setattr(service.settings, "RETAINPDF_TRANSLATION_API_KEY", None)

    status = service.layout_translation_config_status()

    assert status.ready is True
    assert status.missing == ()
    assert status.ocr_provider == "datalab"
