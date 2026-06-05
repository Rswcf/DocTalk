from __future__ import annotations

import uuid
import sys
from types import SimpleNamespace

import fitz

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


def _sample_pdf_bytes() -> bytes:
    doc = fitz.open()
    page = doc.new_page(width=240, height=160)
    page.insert_text((24, 48), "Hello world", fontsize=12)
    return doc.tobytes()


def test_layout_translation_worker_uses_datalab_direct_renderer(monkeypatch) -> None:
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
        input_scope={"target_language": "zh-CN"},
        metadata_json={},
    )
    doc = SimpleNamespace(
        id=doc_id,
        file_type="pdf",
        filename="Datalab Paper.pdf",
        storage_key="documents/datalab-paper.pdf",
    )
    fake_session = _FakeSession(job, doc)
    uploaded: dict[str, tuple[bytes, str]] = {}
    source_pdf = _sample_pdf_bytes()

    class FakeDatalabClient:
        def submit_convert(self, *, filename: str, content: bytes) -> dict:
            assert filename == "Datalab Paper.pdf"
            assert content == source_pdf
            return {"request_id": "dl_1", "request_check_url": "https://datalab.test/convert/dl_1"}

        def get_result(self, request_check_url: str) -> dict:
            assert request_check_url.endswith("/dl_1")
            return {
                "status": "complete",
                "success": True,
                "json": {
                    "pages": [
                        {
                            "width": 240,
                            "height": 160,
                            "blocks": [
                                {
                                    "id": "block-1",
                                    "bbox": [20, 34, 120, 58],
                                    "text": "Hello world",
                                    "type": "text",
                                }
                            ],
                        }
                    ]
                },
                "markdown": "Hello world",
                "page_count": 1,
                "parse_quality_score": 4.8,
                "cost_breakdown": {"final_cost_cents": 1},
            }

    monkeypatch.setattr(service, "DatalabClient", FakeDatalabClient)
    monkeypatch.setattr(service, "_translate_blocks", lambda blocks, target_language: {blocks[0].id: "你好，世界"})
    monkeypatch.setattr(service.storage_service, "download_file", lambda key: source_pdf)
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
    assert job.metadata_json["engine"] == "datalab"
    assert job.metadata_json["datalab"]["request_id"] == "dl_1"
    assert job.metadata_json["translated_block_count"] == 1
    artifacts = job.metadata_json["artifacts"]
    assert set(artifacts) == {"pdf", "markdown", "bundle"}
    assert uploaded[artifacts["pdf"]["storage_key"]][0].startswith(b"%PDF")
    assert uploaded[artifacts["pdf"]["storage_key"]][1] == "application/pdf"
