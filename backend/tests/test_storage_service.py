from __future__ import annotations

import datetime

import certifi
import pytest
from minio.error import S3Error

from app.services import storage_service as storage_module

R2_ENDPOINT = "https://0a78c0c34d3e08a9297247ce98d44ad1.r2.cloudflarestorage.com"


def _s3_error(code: str) -> S3Error:
    return S3Error(response=None, code=code, message=code, resource=None, request_id=None, host_id=None)


class RecordingMinio:
    """Minio double: records construction and calls, no network."""

    instances: list["RecordingMinio"] = []

    def __init__(self, host, access_key=None, secret_key=None, secure=True, region=None, http_client=None):
        self.host = host
        self.secure = secure
        self.region = region
        self.http_client = http_client
        self.calls: list[tuple] = []
        self.bucket_exists_result: object = True
        self.stat_error: S3Error | None = None
        RecordingMinio.instances.append(self)

    def presigned_get_object(self, bucket, storage_key, expires):
        assert isinstance(expires, datetime.timedelta)
        scheme = "https" if self.secure else "http"
        return f"{scheme}://{self.host}/{bucket}/{storage_key}"

    def put_object(self, bucket, key, data, length, **kwargs):
        self.calls.append(("put_object", bucket, key, length, kwargs))

    def bucket_exists(self, bucket):
        self.calls.append(("bucket_exists", bucket))
        if isinstance(self.bucket_exists_result, Exception):
            raise self.bucket_exists_result
        return self.bucket_exists_result

    def list_objects(self, bucket, **kwargs):
        self.calls.append(("list_objects", bucket, kwargs))
        return iter([])

    def make_bucket(self, bucket):
        self.calls.append(("make_bucket", bucket))

    def stat_object(self, bucket, key):
        self.calls.append(("stat_object", bucket, key))
        if self.stat_error is not None:
            raise self.stat_error


@pytest.fixture
def recording_minio(monkeypatch: pytest.MonkeyPatch):
    RecordingMinio.instances = []
    monkeypatch.setattr(storage_module, "Minio", RecordingMinio)
    return RecordingMinio


def _service(**overrides) -> storage_module.StorageService:
    kwargs = dict(endpoint="minio-v2.railway.internal:9000", access_key="access",
                  secret_key="secret", bucket="bucket", default_ttl=300)
    kwargs.update(overrides)
    return storage_module.StorageService(**kwargs)


def test_parse_minio_endpoint_supports_scheme_and_internal_host() -> None:
    assert storage_module._parse_minio_endpoint("https://minio.example.com") == ("minio.example.com", True)
    assert storage_module._parse_minio_endpoint("minio-v2.railway.internal:9000") == (
        "minio-v2.railway.internal:9000",
        False,
    )


def test_scheme_less_endpoint_follows_minio_secure_and_scheme_wins() -> None:
    assert storage_module._parse_minio_endpoint("minio.local:9000", True) == ("minio.local:9000", True)
    assert storage_module._parse_minio_endpoint("http://minio.local:9000", True) == ("minio.local:9000", False)


def test_storage_service_uses_public_endpoint_for_presigned_urls(recording_minio) -> None:
    service = _service(public_endpoint="https://minio-v2-production.up.railway.app")

    assert [(m.host, m.secure) for m in recording_minio.instances] == [
        ("minio-v2.railway.internal:9000", False),
        ("minio-v2-production.up.railway.app", True),
    ]
    assert service.get_presigned_url("documents/report.pdf").startswith(
        "https://minio-v2-production.up.railway.app/"
    )


def test_r2_endpoint_signs_for_auto_region_over_verified_tls(recording_minio) -> None:
    service = _service(endpoint=R2_ENDPOINT, region="auto")

    [client] = recording_minio.instances  # one endpoint serves uploads and presigned URLs
    assert client.secure is True
    assert client.region == "auto"
    pool_kw = client.http_client.connection_pool_kw
    assert pool_kw["cert_reqs"] == "CERT_REQUIRED"
    assert pool_kw["ca_certs"] == certifi.where()
    assert service.get_presigned_url("documents/abc/report.pdf").startswith(
        "https://0a78c0c34d3e08a9297247ce98d44ad1.r2.cloudflarestorage.com/bucket/documents/abc/"
    )


def test_region_defaults_to_setting(recording_minio, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(storage_module.settings, "MINIO_REGION", "auto")
    _service(endpoint=R2_ENDPOINT)
    assert recording_minio.instances[0].region == "auto"


def test_upload_file_sends_no_server_side_encryption_header(recording_minio) -> None:
    service = _service(endpoint=R2_ENDPOINT, region="auto")
    service.upload_file(b"%PDF-1.4", "documents/abc/report.pdf", "application/pdf")

    [(name, bucket, key, length, kwargs)] = recording_minio.instances[0].calls
    assert (name, bucket, key, length) == ("put_object", "bucket", "documents/abc/report.pdf", 8)
    assert kwargs == {"content_type": "application/pdf"}


def test_upload_file_wraps_storage_transport_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeMinio:
        def __init__(self, *_args, **_kwargs):
            pass

        def put_object(self, *_args, **_kwargs):
            raise RuntimeError("connection dropped")

    monkeypatch.setattr(storage_module, "Minio", FakeMinio)
    service = _service()

    with pytest.raises(storage_module.StorageUnavailableError):
        service.upload_file(b"hello", "documents/report.pdf", "application/pdf")


def test_ensure_bucket_creates_a_missing_bucket_without_encryption_config(recording_minio) -> None:
    service = _service()
    recording_minio.instances[0].bucket_exists_result = False
    service.ensure_bucket()

    assert [c[0] for c in recording_minio.instances[0].calls] == ["bucket_exists", "make_bucket"]


def test_ensure_bucket_falls_back_to_listing_when_head_bucket_is_denied(recording_minio) -> None:
    service = _service(endpoint=R2_ENDPOINT, region="auto")
    recording_minio.instances[0].bucket_exists_result = _s3_error("AccessDenied")
    service.ensure_bucket()

    assert [c[0] for c in recording_minio.instances[0].calls] == ["bucket_exists", "list_objects"]


def test_health_check_falls_back_to_listing_and_reraises_other_errors(recording_minio) -> None:
    service = _service(endpoint=R2_ENDPOINT, region="auto")
    client = recording_minio.instances[0]

    client.bucket_exists_result = _s3_error("AccessDenied")
    assert service.health_check() is True

    client.bucket_exists_result = _s3_error("InvalidAccessKeyId")
    with pytest.raises(S3Error):
        service.health_check()


def test_object_exists_is_false_only_for_no_such_key(recording_minio) -> None:
    service = _service()
    client = recording_minio.instances[0]

    assert service.object_exists("documents/a.pdf") is True
    client.stat_error = _s3_error("NoSuchKey")
    assert service.object_exists("documents/a.pdf") is False
    client.stat_error = _s3_error("AccessDenied")
    with pytest.raises(S3Error):
        service.object_exists("documents/a.pdf")


def test_client_property_is_the_server_side_client(recording_minio) -> None:
    service = _service(public_endpoint="https://minio-v2-production.up.railway.app")
    assert service.client is recording_minio.instances[0]


def test_transfer_client_keeps_minio_default_http_policy(recording_minio) -> None:
    service = _service(endpoint=R2_ENDPOINT, region="auto")
    transfer = service.transfer_client

    assert transfer is service.transfer_client  # built once
    assert transfer is not service.client
    assert (transfer.host, transfer.secure, transfer.region) == (
        "0a78c0c34d3e08a9297247ce98d44ad1.r2.cloudflarestorage.com", True, "auto"
    )
    assert transfer.http_client is None  # minio-py builds its own: 5-min timeouts, 5 retries


def test_real_sdk_presigns_r2_urls_offline_with_auto_region_scope() -> None:
    from urllib.parse import parse_qs, urlsplit

    service = storage_module.StorageService(
        endpoint=R2_ENDPOINT, region="auto", access_key="AKIDEXAMPLE",
        secret_key="secret", bucket="doctalk-pdfs", default_ttl=300,
    )

    def no_network(*_args, **_kwargs):
        raise AssertionError("presigning must not make a request (no GetBucketLocation)")

    service._public_client._http.urlopen = no_network
    url = urlsplit(service.get_presigned_url("documents/abc/report.pdf"))
    query = parse_qs(url.query)

    assert (url.scheme, url.netloc, url.path) == (
        "https", "0a78c0c34d3e08a9297247ce98d44ad1.r2.cloudflarestorage.com", "/doctalk-pdfs/documents/abc/report.pdf"
    )
    assert query["X-Amz-Algorithm"] == ["AWS4-HMAC-SHA256"]
    assert query["X-Amz-Credential"][0].startswith("AKIDEXAMPLE/")
    assert query["X-Amz-Credential"][0].endswith("/auto/s3/aws4_request")
    assert query["X-Amz-Expires"] == ["300"]
    assert query["X-Amz-SignedHeaders"] == ["host"]
    assert len(query["X-Amz-Signature"][0]) == 64
