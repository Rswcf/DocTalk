from __future__ import annotations

import datetime
import socket
import sys

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
    assert ("bucket_exists", "bucket") not in client.calls  # a hit needs no bucket probe
    client.stat_error = _s3_error("NoSuchKey")
    assert service.object_exists("documents/a.pdf") is False
    assert client.calls[-1] == ("bucket_exists", "bucket")  # the miss was confirmed
    client.stat_error = _s3_error("AccessDenied")
    with pytest.raises(S3Error):
        service.object_exists("documents/a.pdf")


def test_object_miss_in_an_unreachable_bucket_raises_instead_of_false(recording_minio) -> None:
    service = _service()
    client = recording_minio.instances[0]
    client.stat_error = _s3_error("NoSuchKey")

    client.bucket_exists_result = False
    with pytest.raises(storage_module.StorageUnavailableError):
        service.object_exists("documents/a.pdf")

    client.bucket_exists_result = _s3_error("InvalidAccessKeyId")
    with pytest.raises(S3Error):
        service.object_exists("documents/a.pdf")


def _real_sdk_service_with_http(statuses: dict[tuple[str, str], int]):
    """A real StorageService whose minio-py client answers from `statuses`
    with bodyless responses, the way R2 answers HEAD requests."""
    from urllib.parse import urlsplit

    from urllib3.response import HTTPResponse

    service = storage_module.StorageService(
        endpoint=R2_ENDPOINT, region="auto", access_key="AKIDEXAMPLE",
        secret_key="secret", bucket="doctalk-pdfs", default_ttl=300,
    )
    calls: list[tuple[str, str]] = []

    def urlopen(method, url, **_kwargs):
        path = urlsplit(url).path
        calls.append((method, path))
        return HTTPResponse(body=b"", status=statuses[(method, path)], headers={}, preload_content=True)

    service.client._http.urlopen = urlopen
    return service, calls


def test_real_sdk_bodyless_404_for_a_key_in_a_live_bucket_is_missing() -> None:
    service, calls = _real_sdk_service_with_http({
        ("HEAD", "/doctalk-pdfs/documents/gone.pdf"): 404,
        ("HEAD", "/doctalk-pdfs"): 200,
    })

    assert service.object_exists("documents/gone.pdf") is False
    assert calls == [("HEAD", "/doctalk-pdfs/documents/gone.pdf"), ("HEAD", "/doctalk-pdfs")]


def test_real_sdk_bodyless_404_with_the_bucket_gone_is_not_reported_missing() -> None:
    # minio-py synthesizes NoSuchKey for the object HEAD here too; only the
    # bucket probe tells the two apart.
    service, _calls = _real_sdk_service_with_http({
        ("HEAD", "/doctalk-pdfs/documents/gone.pdf"): 404,
        ("HEAD", "/doctalk-pdfs"): 404,
    })

    with pytest.raises(storage_module.StorageUnavailableError):
        service.object_exists("documents/gone.pdf")


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
    pool_kw = transfer.http_client.connection_pool_kw
    assert (pool_kw["timeout"].connect_timeout, pool_kw["timeout"].read_timeout) == (300, 300)
    assert pool_kw["retries"].total == 5
    assert pool_kw["socket_options"] == storage_module.pool_socket_options()


def test_transfer_pool_matches_minio_default_pool_except_socket_options() -> None:
    # The transfer client must keep minio-py's own HTTP policy; it only adds
    # keepalive. Compare against the pool minio-py builds when given none.
    from minio import Minio

    service = storage_module.StorageService(
        endpoint=R2_ENDPOINT, region="auto", access_key="AKIDEXAMPLE",
        secret_key="secret", bucket="doctalk-pdfs", default_ttl=300,
    )
    ours = service.transfer_client._http.connection_pool_kw
    reference = Minio("0a78c0c34d3e08a9297247ce98d44ad1.r2.cloudflarestorage.com", access_key="AKIDEXAMPLE",
                      secret_key="secret", secure=True, region="auto")._http.connection_pool_kw

    assert "socket_options" not in reference  # minio-py keeps urllib3's default, TCP_NODELAY
    assert set(ours) - {"socket_options"} == set(reference)
    for key, expected in reference.items():
        if hasattr(expected, "__dict__"):  # urllib3 Timeout / Retry have no __eq__
            assert type(ours[key]) is type(expected) and vars(ours[key]) == vars(expected), key
        else:
            assert ours[key] == expected, key
    assert (socket.IPPROTO_TCP, socket.TCP_NODELAY, 1) in ours["socket_options"]
    client = service.transfer_client
    assert (client._base_url.host, client._base_url.is_https, client._base_url.region) == (
        "0a78c0c34d3e08a9297247ce98d44ad1.r2.cloudflarestorage.com", True, "auto"
    )
    assert client._provider.retrieve().access_key == "AKIDEXAMPLE"


def _expected_keepalive_options() -> list[tuple[int, int, int]]:
    tcp = socket.IPPROTO_TCP
    expected = [(tcp, socket.TCP_NODELAY, 1), (socket.SOL_SOCKET, socket.SO_KEEPALIVE, 1)]
    idle = getattr(socket, "TCP_KEEPIDLE", None)
    if idle is None:
        idle = getattr(socket, "TCP_KEEPALIVE", None)  # macOS
    for name_or_value, value in ((idle, 60), (getattr(socket, "TCP_KEEPINTVL", None), 10),
                                 (getattr(socket, "TCP_KEEPCNT", None), 3),
                                 (getattr(socket, "TCP_USER_TIMEOUT", None), 90_000)):
        if name_or_value is not None:
            expected.append((tcp, name_or_value, value))
    return expected


def test_pool_socket_options_enable_keepalive_and_keep_nodelay() -> None:
    options = storage_module.pool_socket_options()
    assert options == _expected_keepalive_options()
    if sys.platform.startswith("linux"):  # production: every knob is present
        assert {opt for _level, opt, _value in options} >= {
            socket.TCP_NODELAY, socket.SO_KEEPALIVE, socket.TCP_KEEPIDLE, socket.TCP_KEEPINTVL,
            socket.TCP_KEEPCNT, socket.TCP_USER_TIMEOUT,
        }


def test_request_and_public_pools_carry_the_keepalive_options(recording_minio) -> None:
    _service(public_endpoint="https://minio-v2-production.up.railway.app")
    for client in recording_minio.instances:
        assert client.http_client.connection_pool_kw["socket_options"] == _expected_keepalive_options()
        timeout = client.http_client.connection_pool_kw["timeout"]
        assert (timeout.connect_timeout, timeout.read_timeout) == (5, 10)  # unchanged


def test_a_socket_option_the_kernel_rejects_is_left_out(monkeypatch: pytest.MonkeyPatch) -> None:
    bogus = (socket.SOL_SOCKET, 0x7FFF, 1)  # no such option: setsockopt raises OSError
    real = storage_module._candidate_socket_options
    monkeypatch.setattr(storage_module, "_candidate_socket_options", lambda *a: real(*a) + [bogus])
    storage_module._accepted_socket_options.cache_clear()
    try:
        options = storage_module.pool_socket_options(idle=61)
    finally:
        storage_module._accepted_socket_options.cache_clear()
    assert bogus not in options
    assert (socket.SOL_SOCKET, socket.SO_KEEPALIVE, 1) in options


def test_urllib3_sets_the_options_on_real_pooled_sockets() -> None:
    import http.server
    import threading

    import urllib3

    class Handler(http.server.BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"  # keep-alive, so the socket goes back to the pool

        def do_GET(self):
            self.send_response(200)
            self.send_header("Content-Length", "2")
            self.end_headers()
            self.wfile.write(b"ok")

        def log_message(self, *_args):
            pass

    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        pool = urllib3.PoolManager(socket_options=storage_module.pool_socket_options())
        response = pool.request("GET", f"http://127.0.0.1:{server.server_port}/")
        assert response.data == b"ok"
        conn_pool = pool.connection_from_host("127.0.0.1", server.server_port)
        conn = conn_pool.pool.get_nowait()
        conn_pool.pool.put(conn)
        sock = conn.sock
        assert sock is not None
        for level, option, value in storage_module.pool_socket_options():
            got = sock.getsockopt(level, option)
            assert (got != 0) if value == 1 else (got == value), (level, option, got)
        pool.clear()
    finally:
        server.shutdown()
        server.server_close()


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


def test_request_client_retries_ignore_retry_after(recording_minio) -> None:
    # A 503 asking to wait an hour must not hold the calling thread that long.
    _service()
    retries = recording_minio.instances[0].http_client.connection_pool_kw["retries"]
    assert retries.respect_retry_after_header is False
    assert retries.total == 2
    assert 429 in retries.status_forcelist  # throttling is still retried, just boundedly
