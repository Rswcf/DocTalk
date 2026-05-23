#!/usr/bin/env python3
"""Non-destructive guard checks for production Next.js API routes."""

from __future__ import annotations

import argparse
import json
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any

FRONTEND = "https://www.doctalk.site"


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
        "RESEND_API_KEY",
        "STRIPE_SECRET_KEY",
        "AUTH_SECRET",
        "ADAPTER_SECRET",
        "GOOGLE_CLIENT_SECRET",
        "MICROSOFT_CLIENT_SECRET",
        "sk_live",
        "sk_test",
        "postgres://",
        "redis://",
        "BEGIN PRIVATE KEY",
    ]
    return [marker for marker in markers if marker in text]


def build_cases() -> list[dict[str, Any]]:
    csp_oversized = json.dumps({"x": "a" * (11 * 1024)}).encode("utf-8")
    return [
        {
            "group": "auth_public",
            "name": "auth_providers_public",
            "method": "GET",
            "path": "/api/auth/providers",
            "expect": [200],
            "assertions": {"json_object": True, "has_provider_ids": True},
        },
        {
            "group": "auth_public",
            "name": "auth_session_anonymous_public_empty",
            "method": "GET",
            "path": "/api/auth/session",
            "expect": [200],
            "assertions": {"json_null_or_object": True, "no_token": True},
        },
        {
            "group": "upload_token_guard",
            "name": "upload_token_requires_auth",
            "method": "GET",
            "path": "/api/upload-token",
            "expect": [401],
            "assertions": {"no_token": True},
        },
        {
            "group": "indexnow_guard",
            "name": "indexnow_requires_auth",
            "method": "POST",
            "path": "/api/indexnow",
            "expect": [401],
        },
        {
            "group": "indexnow_guard",
            "name": "indexnow_rejects_wrong_secret",
            "method": "POST",
            "path": "/api/indexnow",
            "headers": {"authorization": "Bearer qa-intentionally-wrong-secret"},
            "expect": [401],
        },
        {
            "group": "contact_validation",
            "name": "contact_rejects_invalid_json",
            "method": "POST",
            "path": "/api/contact",
            "headers": {"content-type": "application/json"},
            "body": b"{",
            "expect": [400],
            "assertions": {"body_contains": "Invalid JSON"},
        },
        {
            "group": "contact_validation",
            "name": "contact_rejects_invalid_email_before_resend",
            "method": "POST",
            "path": "/api/contact",
            "json": {"name": "QA", "email": "not-an-email", "message": "This is long enough."},
            "expect": [400],
            "assertions": {"body_contains": "Invalid email"},
        },
        {
            "group": "contact_validation",
            "name": "contact_rejects_short_message_before_resend",
            "method": "POST",
            "path": "/api/contact",
            "json": {"name": "QA", "email": "qa@example.com", "message": "short"},
            "expect": [400],
            "assertions": {"body_contains": "too short"},
        },
        {
            "group": "contact_validation",
            "name": "contact_honeypot_silent_success_without_email",
            "method": "POST",
            "path": "/api/contact",
            "json": {
                "name": "QA",
                "email": "qa@example.com",
                "message": "This message should be ignored by honeypot.",
                "website": "https://bot.example",
            },
            "expect": [200],
            "assertions": {"json_ok_true": True},
        },
        {
            "group": "csp_report_guard",
            "name": "csp_report_get_not_allowed",
            "method": "GET",
            "path": "/api/csp-report",
            "expect": [405],
        },
        {
            "group": "csp_report_guard",
            "name": "csp_report_rejects_unsupported_type",
            "method": "POST",
            "path": "/api/csp-report",
            "headers": {"content-type": "text/plain"},
            "body": b"{}",
            "expect": [415],
        },
        {
            "group": "csp_report_guard",
            "name": "csp_report_rejects_invalid_json",
            "method": "POST",
            "path": "/api/csp-report",
            "headers": {"content-type": "application/json"},
            "body": b"{",
            "expect": [400],
        },
        {
            "group": "csp_report_guard",
            "name": "csp_report_rejects_oversized_payload",
            "method": "POST",
            "path": "/api/csp-report",
            "headers": {"content-type": "application/json"},
            "body": csp_oversized,
            "expect": [413],
        },
        {
            "group": "csp_report_guard",
            "name": "csp_report_empty_json_accepted_without_capture",
            "method": "POST",
            "path": "/api/csp-report",
            "headers": {"content-type": "application/json"},
            "body": b"{}",
            "expect": [204],
            "assertions": {"empty_body": True},
        },
        {
            "group": "frontend_proxy",
            "name": "proxy_public_demo_documents",
            "method": "GET",
            "path": "/api/proxy/api/documents/demo",
            "expect": [200],
            "assertions": {"json_list": True, "has_ready_demo": True},
        },
        {
            "group": "frontend_proxy",
            "name": "proxy_private_user_requires_auth",
            "method": "GET",
            "path": "/api/proxy/api/users/me",
            "expect": [401],
            "assertions": {"no_token": True},
        },
    ]


def assertion_failures(case: dict[str, Any], response: Response, parsed: Any, text: str) -> list[str]:
    assertions = case.get("assertions") or {}
    failures: list[str] = []
    if assertions.get("json_object") and not isinstance(parsed, dict):
        failures.append("expected JSON object")
    if assertions.get("json_null_or_object") and text != "null" and not isinstance(parsed, dict):
        failures.append("expected JSON null or object")
    if assertions.get("json_list") and not isinstance(parsed, list):
        failures.append("expected JSON list")
    if assertions.get("has_provider_ids") and (
        not isinstance(parsed, dict) or not any(key in parsed for key in ("google", "microsoft-entra-id", "resend"))
    ):
        failures.append("expected at least one known auth provider id")
    if assertions.get("no_token"):
        lowered = text.lower()
        if "token" in lowered and "not authenticated" not in lowered:
            failures.append("unexpected token-like field in anonymous response")
    if "body_contains" in assertions and assertions["body_contains"].lower() not in text.lower():
        failures.append(f"missing expected body text: {assertions['body_contains']!r}")
    if assertions.get("json_ok_true") and not (isinstance(parsed, dict) and parsed.get("ok") is True):
        failures.append("expected JSON {ok: true}")
    if assertions.get("empty_body") and text:
        failures.append("expected empty response body")
    if assertions.get("has_ready_demo"):
        if not isinstance(parsed, list) or not any(isinstance(item, dict) and item.get("status") == "ready" for item in parsed):
            failures.append("expected at least one ready demo document")
    if response.elapsed_ms > int(case.get("max_elapsed_ms", 10000)):
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
        headers=headers,
        body=body,
    )
    text = response.body.decode("utf-8", errors="replace")
    parsed = safe_json(response.body)
    leaks = sensitive_markers(text)
    assertion_errors = assertion_failures(case, response, parsed, text)
    return {
        "group": case["group"],
        "name": case["name"],
        "method": case["method"],
        "path": case["path"],
        "expected_status": case["expect"],
        "status": response.status,
        "elapsed_ms": response.elapsed_ms,
        "content_type": response.headers.get("content-type"),
        "body_json": parsed,
        "body_preview": text[:320],
        "sensitive_markers": leaks,
        "assertion_failures": assertion_errors,
        "result": "pass" if response.status in case["expect"] and not leaks and not assertion_errors else "fail",
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default=FRONTEND)
    parser.add_argument("--json-out", required=True)
    args = parser.parse_args()

    checks = [run_case(args.base_url, case) for case in build_cases()]
    failed = [check for check in checks if check["result"] != "pass"]
    report = {
        "run": "qa-production-frontend-api-guards",
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "base_url": args.base_url,
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
        "PRODUCTION_FRONTEND_API_GUARDS "
        f"{report['result'].upper()}: {report['summary']['passed']}/{report['summary']['total']}"
    )
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
