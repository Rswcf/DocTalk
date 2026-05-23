#!/usr/bin/env python3
"""Non-destructive production checks for anonymous document entry points."""

from __future__ import annotations

import argparse
import json
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any

BACKEND = "https://backend-production-a62e.up.railway.app"
FAKE_UUID = "00000000-0000-4000-8000-000000000011"
OTHER_FAKE_UUID = "00000000-0000-4000-8000-000000000012"

MINIMAL_PDF = (
    b"%PDF-1.4\n"
    b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n"
    b"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n"
    b"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >> endobj\n"
    b"trailer << /Root 1 0 R >>\n%%EOF\n"
)


@dataclass
class Response:
    status: int
    headers: dict[str, str]
    body: bytes
    elapsed_ms: int


def request(
    url: str,
    *,
    method: str = "GET",
    body: bytes | None = None,
    headers: dict[str, str] | None = None,
    timeout: int = 25,
) -> Response:
    req = urllib.request.Request(url, data=body, method=method, headers=headers or {})
    started = time.monotonic()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = resp.read()
            status = resp.status
            response_headers = {key.lower(): value for key, value in resp.headers.items()}
    except urllib.error.HTTPError as exc:
        data = exc.read()
        status = exc.code
        response_headers = {key.lower(): value for key, value in exc.headers.items()}
    return Response(
        status=status,
        headers=response_headers,
        body=data,
        elapsed_ms=int((time.monotonic() - started) * 1000),
    )


def safe_json(body: bytes) -> Any:
    try:
        return json.loads(body.decode("utf-8"))
    except Exception:
        return None


def sensitive_markers(text: str) -> list[str]:
    markers = [
        "Traceback",
        "DATABASE_URL",
        "OPENROUTER_API_KEY",
        "DEEPSEEK_API_KEY",
        "STRIPE_SECRET_KEY",
        "AUTH_SECRET",
        "ADAPTER_SECRET",
        "sk_live",
        "sk_test",
        "postgres://",
        "redis://",
        "BEGIN PRIVATE KEY",
    ]
    return [marker for marker in markers if marker in text]


def multipart_file_body(
    *,
    field_name: str,
    filename: str,
    content_type: str,
    payload: bytes,
    boundary: str,
) -> bytes:
    return b"".join(
        [
            f"--{boundary}\r\n".encode("ascii"),
            (
                f'Content-Disposition: form-data; name="{field_name}"; '
                f'filename="{filename}"\r\n'
            ).encode("ascii"),
            f"Content-Type: {content_type}\r\n\r\n".encode("ascii"),
            payload,
            b"\r\n",
            f"--{boundary}--\r\n".encode("ascii"),
        ]
    )


def build_cases() -> list[dict[str, Any]]:
    boundary = "DocTalkQaBoundary0511"
    upload_body = multipart_file_body(
        field_name="file",
        filename="anonymous-upload-guard.pdf",
        content_type="application/pdf",
        payload=MINIMAL_PDF,
        boundary=boundary,
    )
    return [
        {
            "group": "public_document_baseline",
            "name": "documents_list_anonymous_empty",
            "method": "GET",
            "path": "/api/documents",
            "expect": [200],
            "assertions": {"list_response": True},
        },
        {
            "group": "public_document_baseline",
            "name": "demo_documents_public",
            "method": "GET",
            "path": "/api/documents/demo",
            "expect": [200],
            "assertions": {"list_response": True},
        },
        {
            "group": "ingest_auth_guards",
            "name": "upload_pdf_requires_auth_before_create",
            "method": "POST",
            "path": "/api/documents/upload",
            "body": upload_body,
            "headers": {
                "accept": "application/json",
                "content-type": f"multipart/form-data; boundary={boundary}",
            },
            "expect": [401],
            "assertions": {"no_document_id": True},
        },
        {
            "group": "ingest_auth_guards",
            "name": "ingest_url_requires_auth_before_fetch",
            "method": "POST",
            "path": "/api/documents/ingest-url",
            "json": {"url": "https://example.com/"},
            "expect": [401],
            "assertions": {"no_document_id": True, "no_url_fetch_error": True},
        },
        {
            "group": "ingest_auth_guards",
            "name": "ingest_private_url_requires_auth_before_ssrf_validation",
            "method": "POST",
            "path": "/api/documents/ingest-url",
            "json": {"url": "http://127.0.0.1:1/metadata"},
            "expect": [401],
            "assertions": {"no_document_id": True, "no_url_fetch_error": True},
        },
        {
            "group": "document_access_404",
            "name": "document_detail_fake_id_does_not_leak",
            "method": "GET",
            "path": f"/api/documents/{FAKE_UUID}",
            "expect": [404],
        },
        {
            "group": "document_access_404",
            "name": "document_brief_fake_id_does_not_leak",
            "method": "GET",
            "path": f"/api/documents/{FAKE_UUID}/brief",
            "expect": [404],
        },
        {
            "group": "document_access_404",
            "name": "document_file_url_fake_id_does_not_leak",
            "method": "GET",
            "path": f"/api/documents/{FAKE_UUID}/file-url",
            "expect": [404],
            "assertions": {"no_presigned_url": True},
        },
        {
            "group": "document_access_404",
            "name": "document_converted_file_url_fake_id_does_not_leak",
            "method": "GET",
            "path": f"/api/documents/{FAKE_UUID}/file-url?variant=converted",
            "expect": [404],
            "assertions": {"no_presigned_url": True},
        },
        {
            "group": "document_access_404",
            "name": "document_text_content_fake_id_does_not_leak",
            "method": "GET",
            "path": f"/api/documents/{FAKE_UUID}/text-content",
            "expect": [404],
        },
        {
            "group": "document_chat_entry_404",
            "name": "document_session_create_fake_id_does_not_create",
            "method": "POST",
            "path": f"/api/documents/{FAKE_UUID}/sessions",
            "expect": [404],
            "assertions": {"no_session_id": True},
        },
        {
            "group": "document_chat_entry_404",
            "name": "document_session_list_fake_id_does_not_leak",
            "method": "GET",
            "path": f"/api/documents/{FAKE_UUID}/sessions",
            "expect": [404],
            "assertions": {"no_session_id": True},
        },
        {
            "group": "document_mutation_auth_guards",
            "name": "document_reparse_requires_auth",
            "method": "POST",
            "path": f"/api/documents/{FAKE_UUID}/reparse",
            "expect": [401],
        },
        {
            "group": "document_mutation_auth_guards",
            "name": "document_update_requires_auth",
            "method": "PATCH",
            "path": f"/api/documents/{FAKE_UUID}",
            "json": {"custom_instructions": "Always answer in one sentence."},
            "expect": [401],
        },
        {
            "group": "document_mutation_auth_guards",
            "name": "document_delete_requires_auth",
            "method": "DELETE",
            "path": f"/api/documents/{FAKE_UUID}",
            "expect": [401],
        },
        {
            "group": "document_input_validation",
            "name": "invalid_uuid_detail_returns_validation_error_without_leak",
            "method": "GET",
            "path": "/api/documents/not-a-uuid",
            "expect": [422],
        },
        {
            "group": "document_input_validation",
            "name": "invalid_uuid_file_url_returns_validation_error_without_leak",
            "method": "GET",
            "path": "/api/documents/not-a-uuid/file-url",
            "expect": [422],
        },
        {
            "group": "document_input_validation",
            "name": "search_bad_top_k_fake_id_validates_contract",
            "method": "POST",
            "path": f"/api/documents/{OTHER_FAKE_UUID}/search",
            "json": {"query": "test", "top_k": 0},
            "expect": [422],
        },
    ]


def assertion_failures(case: dict[str, Any], response: Response, text: str, parsed: Any) -> list[str]:
    failures: list[str] = []
    assertions = case.get("assertions") or {}
    if assertions.get("list_response") and not isinstance(parsed, list):
        failures.append("expected JSON list response")
    if assertions.get("no_document_id") and "document_id" in text:
        failures.append("unexpected document_id in anonymous response")
    if assertions.get("no_session_id") and "session_id" in text:
        failures.append("unexpected session_id in anonymous response")
    if assertions.get("no_presigned_url"):
        body_url = parsed.get("url") if isinstance(parsed, dict) else None
        if body_url or "X-Amz-Signature" in text or "AWSAccessKeyId" in text:
            failures.append("unexpected presigned file URL data")
    if assertions.get("no_url_fetch_error") and any(
        marker in text for marker in ("URL_FETCH_FAILED", "URL_FETCH_BLOCKED", "NO_TEXT_CONTENT")
    ):
        failures.append("URL validation/fetch appears to have run before auth")
    if response.elapsed_ms > int(case.get("max_elapsed_ms", 8000)):
        failures.append(f"slow response: {response.elapsed_ms}ms")
    return failures


def run_case(base_url: str, case: dict[str, Any]) -> dict[str, Any]:
    headers = {"accept": "application/json"}
    headers.update(case.get("headers") or {})
    body = case.get("body")
    if "json" in case:
        headers["content-type"] = "application/json"
        body = json.dumps(case["json"]).encode("utf-8")
    response = request(
        base_url.rstrip("/") + case["path"],
        method=case["method"],
        body=body,
        headers=headers,
    )
    text = response.body.decode("utf-8", errors="replace")
    parsed = safe_json(response.body)
    leaks = sensitive_markers(text)
    assertion_errors = assertion_failures(case, response, text, parsed)
    expected = case["expect"]
    return {
        "group": case["group"],
        "name": case["name"],
        "method": case["method"],
        "path": case["path"],
        "expected_status": expected,
        "status": response.status,
        "elapsed_ms": response.elapsed_ms,
        "content_type": response.headers.get("content-type"),
        "body_json": parsed,
        "body_preview": text[:320],
        "sensitive_markers": leaks,
        "assertion_failures": assertion_errors,
        "result": "pass" if response.status in expected and not leaks and not assertion_errors else "fail",
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--backend", default=BACKEND)
    parser.add_argument("--json-out", required=True)
    args = parser.parse_args()

    checks = [run_case(args.backend, case) for case in build_cases()]
    failed = [check for check in checks if check["result"] != "pass"]
    report = {
        "run": "qa-production-document-entry-guards",
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "backend": args.backend,
        "result": "fail" if failed else "pass",
        "summary": {
            "total": len(checks),
            "passed": len(checks) - len(failed),
            "failed": len(failed),
            "groups": {
                group: {
                    "total": len([c for c in checks if c["group"] == group]),
                    "failed": len([c for c in checks if c["group"] == group and c["result"] != "pass"]),
                }
                for group in sorted({c["group"] for c in checks})
            },
        },
        "checks": checks,
    }
    with open(args.json_out, "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    print(
        "PRODUCTION_DOCUMENT_ENTRY_GUARDS "
        f"{report['result'].upper()}: {report['summary']['passed']}/{report['summary']['total']}"
    )
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
