"""Round-trip smoke test of the configured object store, run inside the
backend container (``cd /app && python scripts/storage_smoke.py``, or piped in
base64-encoded when scripts/ is not in the image).

Writes a canary under ``_smoke/``, reads it back, fetches a presigned URL the
way the browser does (with an ``Origin`` header, so the bucket's CORS answer
is checked too), confirms the deep-health probe, then deletes the canary.
Prints the presigned host but never the URL: its query string is a bearer
credential for five minutes.
"""
from __future__ import annotations

import os
import sys
import urllib.request
import uuid
from urllib.parse import urlsplit

# Run as a file, sys.path[0] is backend/scripts; `app` lives one level up.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings
from app.services.storage_service import storage_service

ORIGIN = "https://www.doctalk.site"


def _describe(exc: BaseException) -> str:
    """Exception class (and HTTP status) only: messages and tracebacks can
    carry the signed URL, e.g. an HTTPError for a redirect embeds its target."""
    status = getattr(exc, "code", None)
    return f"{type(exc).__name__}" + (f" status={status}" if isinstance(status, int) else "")


def main() -> int:
    key = f"_smoke/{uuid.uuid4()}.txt"
    body = f"doctalk storage smoke {key}".encode()
    failures: list[str] = []

    def check(label: str, ok: bool) -> None:
        print(f"{'PASS' if ok else 'FAIL'} {label}")
        if not ok:
            failures.append(label)

    def run(label: str, step) -> None:
        try:
            step()
        except Exception as exc:  # noqa: BLE001 - reported without its message, see _describe
            print(f"FAIL {label}: {_describe(exc)}")
            failures.append(label)

    endpoint = settings.MINIO_ENDPOINT
    print(f"endpoint host: {urlsplit(endpoint).netloc or endpoint}  region: {settings.MINIO_REGION}  bucket: {storage_service.bucket}")

    def round_trip() -> None:
        check("health_check", storage_service.health_check() is True)
        storage_service.upload_file(body, key, "text/plain")
        check("object_exists after upload", storage_service.object_exists(key))
        check("download matches upload", storage_service.download_file(key) == body)

    def browser_fetch() -> None:
        url = storage_service.get_presigned_url(key, 120)
        print(f"presigned host: {urlsplit(url).netloc}")
        request = urllib.request.Request(url, headers={"Origin": ORIGIN})
        with urllib.request.urlopen(request, timeout=20) as response:
            fetched = response.read()
            allow_origin = response.headers.get("Access-Control-Allow-Origin")
        check("presigned GET returns the object", fetched == body)
        check(f"CORS allows {ORIGIN}", allow_origin in (ORIGIN, "*"))

    def cleanup() -> None:
        storage_service.delete_file(key)
        check("canary deleted", not storage_service.object_exists(key))

    run("storage round trip", round_trip)
    if not failures:
        run("presigned GET", browser_fetch)
    run("cleanup", cleanup)

    print("SMOKE OK" if not failures else f"SMOKE FAILED: {', '.join(failures)}")
    return 1 if failures else 0

if __name__ == "__main__":
    sys.exit(main())
