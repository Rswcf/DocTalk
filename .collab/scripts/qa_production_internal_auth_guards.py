#!/usr/bin/env python3
"""Non-destructive production guards for deep health and internal Auth adapter."""

from __future__ import annotations

import argparse
import json
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any

BACKEND = "https://backend-production-a62e.up.railway.app"
FAKE_UUID = "00000000-0000-4000-8000-000000000001"
WRONG_SECRET = "qa-wrong-secret-do-not-accept"


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
    timeout: int = 20,
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


def body_leaks_sensitive_data(text: str) -> list[str]:
    markers = [
        "Traceback",
        "ADAPTER_SECRET",
        "AUTH_SECRET",
        "DATABASE_URL",
        "OPENROUTER_API_KEY",
        "DEEPSEEK_API_KEY",
        "STRIPE_SECRET_KEY",
        "sk_live",
        "sk_test",
        "postgres://",
        "redis://",
    ]
    return [marker for marker in markers if marker in text]


def run_case(backend: str, case: dict[str, Any]) -> dict[str, Any]:
    headers = {"accept": "application/json", **case.get("headers", {})}
    body = None
    if "json" in case:
        headers["content-type"] = "application/json"
        body = json.dumps(case["json"]).encode("utf-8")
    response = request(
        backend.rstrip("/") + case["path"],
        method=case["method"],
        body=body,
        headers=headers,
    )
    text = response.body.decode("utf-8", errors="replace")
    leaks = body_leaks_sensitive_data(text)
    return {
        "group": case["group"],
        "name": case["name"],
        "method": case["method"],
        "path": case["path"],
        "expected_status": case["expect"],
        "status": response.status,
        "elapsed_ms": response.elapsed_ms,
        "content_type": response.headers.get("content-type"),
        "body_json": safe_json(response.body),
        "body_preview": text[:240],
        "sensitive_markers": leaks,
        "result": "pass" if response.status in case["expect"] and not leaks else "fail",
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--backend", default=BACKEND)
    parser.add_argument("--json-out", required=True)
    args = parser.parse_args()

    adapter_user_body = {
        "email": "qa-should-not-create@example.com",
        "name": "QA Should Not Create",
    }
    adapter_token_body = {
        "identifier": "qa-should-not-create@example.com",
        "token": "qa-token-should-not-create",
        "expires": "2030-01-01T00:00:00Z",
    }
    cases: list[dict[str, Any]] = [
        {
            "group": "health",
            "name": "deep_health_requires_secret",
            "method": "GET",
            "path": "/health?deep=true",
            "expect": [403],
        },
        {
            "group": "health",
            "name": "deep_health_rejects_wrong_secret",
            "method": "GET",
            "path": "/health?deep=true",
            "headers": {"x-health-secret": WRONG_SECRET},
            "expect": [403],
        },
        {
            "group": "internal_auth",
            "name": "adapter_get_user_requires_secret",
            "method": "GET",
            "path": f"/api/internal/auth/users/{FAKE_UUID}",
            "expect": [401],
        },
        {
            "group": "internal_auth",
            "name": "adapter_get_user_rejects_wrong_secret",
            "method": "GET",
            "path": f"/api/internal/auth/users/{FAKE_UUID}",
            "headers": {"X-Adapter-Secret": WRONG_SECRET},
            "expect": [401],
        },
        {
            "group": "internal_auth",
            "name": "adapter_get_user_by_email_requires_secret",
            "method": "GET",
            "path": "/api/internal/auth/users/by-email/qa-should-not-create@example.com",
            "expect": [401],
        },
        {
            "group": "internal_auth",
            "name": "adapter_get_user_by_account_requires_secret",
            "method": "GET",
            "path": "/api/internal/auth/users/by-account/google/qa-provider-account",
            "expect": [401],
        },
        {
            "group": "internal_auth",
            "name": "adapter_create_user_requires_secret",
            "method": "POST",
            "path": "/api/internal/auth/users",
            "json": adapter_user_body,
            "expect": [401],
        },
        {
            "group": "internal_auth",
            "name": "adapter_create_user_rejects_wrong_secret",
            "method": "POST",
            "path": "/api/internal/auth/users",
            "headers": {"X-Adapter-Secret": WRONG_SECRET},
            "json": adapter_user_body,
            "expect": [401],
        },
        {
            "group": "internal_auth",
            "name": "adapter_create_verification_token_requires_secret",
            "method": "POST",
            "path": "/api/internal/auth/verification-tokens",
            "json": adapter_token_body,
            "expect": [401],
        },
        {
            "group": "internal_auth",
            "name": "adapter_use_verification_token_rejects_wrong_secret",
            "method": "POST",
            "path": "/api/internal/auth/verification-tokens/use",
            "headers": {"X-Adapter-Secret": WRONG_SECRET},
            "json": {
                "identifier": adapter_token_body["identifier"],
                "token": adapter_token_body["token"],
            },
            "expect": [401],
        },
    ]

    checks = [run_case(args.backend, case) for case in cases]
    failed = [check for check in checks if check["result"] != "pass"]
    report = {
        "run": "qa-production-internal-auth-guards",
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "backend": args.backend,
        "wrong_secret_label": "intentionally invalid",
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
    print(f"PRODUCTION_INTERNAL_AUTH_GUARDS {report['result'].upper()}: {report['summary']['passed']}/{report['summary']['total']}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
