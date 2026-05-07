from __future__ import annotations

import datetime

import pytest

from app.services import storage_service as storage_module


def test_parse_minio_endpoint_supports_scheme_and_internal_host() -> None:
    assert storage_module._parse_minio_endpoint("https://minio.example.com") == ("minio.example.com", True)
    assert storage_module._parse_minio_endpoint("minio-v2.railway.internal:9000") == (
        "minio-v2.railway.internal:9000",
        False,
    )


def test_storage_service_uses_public_endpoint_for_presigned_urls(monkeypatch: pytest.MonkeyPatch) -> None:
    created: list[tuple[str, bool]] = []

    class FakeMinio:
        def __init__(self, host, access_key, secret_key, secure, http_client):
            self.host = host
            self.secure = secure
            created.append((host, secure))

        def presigned_get_object(self, bucket, storage_key, expires):
            assert bucket == "bucket"
            assert storage_key == "documents/report.pdf"
            assert isinstance(expires, datetime.timedelta)
            scheme = "https" if self.secure else "http"
            return f"{scheme}://{self.host}/{bucket}/{storage_key}"

    monkeypatch.setattr(storage_module, "Minio", FakeMinio)

    service = storage_module.StorageService(
        endpoint="minio-v2.railway.internal:9000",
        public_endpoint="https://minio-v2-production.up.railway.app",
        access_key="access",
        secret_key="secret",
        bucket="bucket",
        default_ttl=300,
    )

    assert created == [
        ("minio-v2.railway.internal:9000", False),
        ("minio-v2-production.up.railway.app", True),
    ]
    assert service.get_presigned_url("documents/report.pdf").startswith(
        "https://minio-v2-production.up.railway.app/"
    )


def test_upload_file_wraps_storage_transport_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeMinio:
        def __init__(self, *_args, **_kwargs):
            pass

        def put_object(self, *_args, **_kwargs):
            raise RuntimeError("connection dropped")

    monkeypatch.setattr(storage_module, "Minio", FakeMinio)
    service = storage_module.StorageService(
        endpoint="minio-v2.railway.internal:9000",
        access_key="access",
        secret_key="secret",
        bucket="bucket",
        default_ttl=300,
    )

    with pytest.raises(storage_module.StorageUnavailableError):
        service.upload_file(b"hello", "documents/report.pdf", "application/pdf")
