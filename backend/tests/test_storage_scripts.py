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
