"""Tests for demo self-heal MinIO object verification (B0).

2026-08-02 incident: a MinIO v2 migration lost ~106/108 stored files. The
existing self-heal only checked Qdrant vector counts, so it never noticed the
underlying PDF bytes were gone. `_ensure_demo_files` stats each demo doc's
storage object and re-uploads from `backend/seed_data/` (id- and
key-preserving — the DB row is untouched) when the object is missing.
"""
from __future__ import annotations

import sys
import uuid
from pathlib import Path
from types import SimpleNamespace

from minio.error import S3Error

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services import demo_seed  # noqa: E402


def _seed_pdf_bytes(slug: str) -> bytes:
    spec = next(s for s in demo_seed.DEMO_DOCS if s["slug"] == slug)
    path = Path(demo_seed.__file__).resolve().parents[2] / spec["local_path"]
    return path.read_bytes()


def _s3_error(code: str) -> S3Error:
    # Real minio.error.S3Error — the implementation catches this exact type
    # and inspects .code, so the test double must raise the real class, not
    # a lookalike Exception subclass.
    return S3Error(
        response=None, code=code, message=code, resource=None,
        request_id=None, host_id=None,
    )


class _FakeMinioClient:
    """Minimal MinIO client double: records stat/put calls, no network."""

    def __init__(self, missing_keys: set[str]) -> None:
        self.missing_keys = missing_keys
        self.put_calls: list[tuple[str, str, int, str]] = []

    def stat_object(self, bucket: str, key: str):
        if key in self.missing_keys:
            raise _s3_error("NoSuchKey")
        return SimpleNamespace(size=123)

    def put_object(self, bucket, key, data, length, content_type):
        self.put_calls.append((bucket, key, length, content_type))
        # Drain the stream like the real client would.
        data.read()


def _doc(slug: str, storage_key: str) -> SimpleNamespace:
    return SimpleNamespace(id=uuid.uuid4(), demo_slug=slug, storage_key=storage_key)


class TestEnsureDemoFiles:
    def test_missing_object_is_restored_to_exact_storage_key(self, monkeypatch):
        doc = _doc("alphabet-earnings", "documents/abc/Alphabet Q4 2025 Earnings Release.pdf")
        client = _FakeMinioClient(missing_keys={doc.storage_key})
        monkeypatch.setattr(demo_seed, "_get_minio_client", lambda: client)
        monkeypatch.setattr(demo_seed.settings, "MINIO_BUCKET", "test-bucket")

        restored = demo_seed._ensure_demo_files([doc])

        assert restored == 1
        assert len(client.put_calls) == 1
        bucket, key, length, content_type = client.put_calls[0]
        assert bucket == "test-bucket"
        assert key == doc.storage_key  # id- and key-preserving
        assert content_type == "application/pdf"
        assert length == len(_seed_pdf_bytes("alphabet-earnings"))

    def test_existing_object_is_not_reuploaded(self, monkeypatch):
        doc = _doc("attention-paper", "documents/def/Attention Is All You Need.pdf")
        client = _FakeMinioClient(missing_keys=set())  # stat succeeds
        monkeypatch.setattr(demo_seed, "_get_minio_client", lambda: client)
        monkeypatch.setattr(demo_seed.settings, "MINIO_BUCKET", "test-bucket")

        restored = demo_seed._ensure_demo_files([doc])

        assert restored == 0
        assert client.put_calls == []

    def test_unknown_slug_is_skipped_without_crash(self, monkeypatch):
        doc = _doc("not-a-real-demo-slug", "documents/xyz/whatever.pdf")
        client = _FakeMinioClient(missing_keys={doc.storage_key})
        monkeypatch.setattr(demo_seed, "_get_minio_client", lambda: client)
        monkeypatch.setattr(demo_seed.settings, "MINIO_BUCKET", "test-bucket")

        restored = demo_seed._ensure_demo_files([doc])

        assert restored == 0
        assert client.put_calls == []

    def test_mixed_batch_only_restores_missing_ones(self, monkeypatch):
        missing_doc = _doc("court-filing", "documents/aaa/US District Court Filing.pdf")
        present_doc = _doc("alphabet-earnings", "documents/bbb/Alphabet Q4 2025 Earnings Release.pdf")
        unknown_doc = _doc("ghost-slug", "documents/ccc/ghost.pdf")
        client = _FakeMinioClient(missing_keys={missing_doc.storage_key, unknown_doc.storage_key})
        monkeypatch.setattr(demo_seed, "_get_minio_client", lambda: client)
        monkeypatch.setattr(demo_seed.settings, "MINIO_BUCKET", "test-bucket")

        restored = demo_seed._ensure_demo_files([missing_doc, present_doc, unknown_doc])

        assert restored == 1
        assert [c[1] for c in client.put_calls] == [missing_doc.storage_key]

    def test_other_s3_error_codes_do_not_trigger_upload(self, monkeypatch):
        """A non-NoSuchKey S3Error (e.g. transient AccessDenied) must not be
        treated as 'missing' — re-uploading on every transient error would
        thrash MinIO. It should be logged and skipped, not crash startup."""
        doc = _doc("alphabet-earnings", "documents/abc/Alphabet Q4 2025 Earnings Release.pdf")

        class _DeniedClient(_FakeMinioClient):
            def stat_object(self, bucket, key):
                raise _s3_error("AccessDenied")

        client = _DeniedClient(missing_keys=set())
        monkeypatch.setattr(demo_seed, "_get_minio_client", lambda: client)
        monkeypatch.setattr(demo_seed.settings, "MINIO_BUCKET", "test-bucket")

        restored = demo_seed._ensure_demo_files([doc])

        assert restored == 0
        assert client.put_calls == []

    def test_one_doc_failure_does_not_block_the_rest(self, monkeypatch):
        """Wrap per-doc in try/except so one failure never blocks startup."""
        exploding_doc = _doc("alphabet-earnings", "documents/explode/x.pdf")
        healthy_doc = _doc("court-filing", "documents/ok/US District Court Filing.pdf")

        class _ExplodingClient(_FakeMinioClient):
            def stat_object(self, bucket, key):
                if "explode" in key:
                    raise RuntimeError("network blip")
                return super().stat_object(bucket, key)

        client = _ExplodingClient(missing_keys={healthy_doc.storage_key})
        monkeypatch.setattr(demo_seed, "_get_minio_client", lambda: client)
        monkeypatch.setattr(demo_seed.settings, "MINIO_BUCKET", "test-bucket")

        restored = demo_seed._ensure_demo_files([exploding_doc, healthy_doc])

        assert restored == 1
        assert [c[1] for c in client.put_calls] == [healthy_doc.storage_key]
