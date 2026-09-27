"""The cutover smoke script must never print a presigned URL, even when a
request fails with an exception whose message embeds it."""
from __future__ import annotations

import importlib.util
import urllib.error
from email.message import Message
from pathlib import Path

import pytest

SECRET = "X-Amz-Signature=deadbeefsecret"
SIGNED_URL = f"https://acct.r2.cloudflarestorage.com/doctalk-pdfs/_smoke/x.txt?X-Amz-Credential=k&{SECRET}"


def _load_smoke():
    path = Path(__file__).resolve().parents[1] / "scripts" / "storage_smoke.py"
    spec = importlib.util.spec_from_file_location("storage_smoke_under_test", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class FakeStorage:
    bucket = "doctalk-pdfs"

    def __init__(self):
        self.objects: dict[str, bytes] = {}

    def health_check(self):
        return True

    def upload_file(self, data, key, content_type):
        self.objects[key] = data

    def object_exists(self, key):
        return key in self.objects

    def download_file(self, key):
        return self.objects[key]

    def get_presigned_url(self, key, ttl):
        return SIGNED_URL

    def delete_file(self, key):
        self.objects.pop(key, None)


@pytest.mark.parametrize("error", [
    urllib.error.HTTPError(SIGNED_URL, 302, f"redirect error - redirect to {SIGNED_URL}", Message(), None),
    RuntimeError(f"connection failed for {SIGNED_URL}"),
])
def test_smoke_failure_output_never_contains_the_signed_url(monkeypatch, capsys, error):
    smoke = _load_smoke()
    storage = FakeStorage()
    monkeypatch.setattr(smoke, "storage_service", storage)

    def failing_urlopen(*_args, **_kwargs):
        raise error

    monkeypatch.setattr(smoke.urllib.request, "urlopen", failing_urlopen)

    assert smoke.main() == 1
    out, err = capsys.readouterr()
    assert "deadbeefsecret" not in out + err
    assert "FAIL presigned GET" in out
    assert "PASS canary deleted" in out
    assert storage.objects == {}


def test_storage_error_text_never_reaches_output_or_logs(monkeypatch, capsys, caplog):
    """Real StorageService: upload_file wraps the S3 error and logs it; the
    smoke run must not surface that text anywhere."""
    from minio.error import S3Error

    from app.services import storage_service as storage_module

    class ExplodingMinio:
        def __init__(self, *_args, **_kwargs):
            pass

        def bucket_exists(self, bucket):
            return True

        def put_object(self, *_args, **_kwargs):
            raise S3Error(response=None, code="SignatureDoesNotMatch", message=f"bad request {SIGNED_URL}",
                          resource=None, request_id=None, host_id=None)

        def stat_object(self, *_args, **_kwargs):
            raise S3Error(response=None, code="NoSuchKey", message="none", resource=None, request_id=None, host_id=None)

        def remove_object(self, *_args, **_kwargs):
            pass

    monkeypatch.setattr(storage_module, "Minio", ExplodingMinio)
    real = storage_module.StorageService(endpoint="https://acct.r2.cloudflarestorage.com", access_key="a",
                                         secret_key="s", bucket="doctalk-pdfs", default_ttl=300, region="auto")
    smoke = _load_smoke()
    monkeypatch.setattr(smoke, "storage_service", real)

    with caplog.at_level("DEBUG"):
        assert smoke.main() == 1
    out, err = capsys.readouterr()
    assert "deadbeefsecret" not in out + err + caplog.text
    assert "FAIL storage round trip: StorageUnavailableError" in out
    assert "PASS canary deleted" in out


def test_closed_stdout_does_not_abort_the_cleanup(monkeypatch):
    smoke = _load_smoke()
    storage = FakeStorage()
    monkeypatch.setattr(smoke, "storage_service", storage)

    def broken_print(*_args, **_kwargs):
        raise BrokenPipeError()

    monkeypatch.setattr(smoke, "print", broken_print, raising=False)
    monkeypatch.setattr(smoke.urllib.request, "urlopen", lambda *_a, **_k: (_ for _ in ()).throw(RuntimeError(SIGNED_URL)))

    assert smoke.main() == 1
    assert storage.objects == {}
