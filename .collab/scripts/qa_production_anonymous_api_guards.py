#!/usr/bin/env python3
"""Non-destructive anonymous auth-guard checks against production APIs."""

from __future__ import annotations

import argparse
import json
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any

FRONTEND = "https://www.doctalk.site"
BACKEND = "https://backend-production-a62e.up.railway.app"
FAKE_UUID = "00000000-0000-4000-8000-000000000001"


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


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--backend", default=BACKEND)
    parser.add_argument("--frontend", default=FRONTEND)
    parser.add_argument("--json-out", required=True)
    args = parser.parse_args()

    public_cases = [
        {"name": "health_public", "method": "GET", "path": "/health", "expect": [200]},
        {"name": "version_public", "method": "GET", "path": "/version", "expect": [200]},
        {"name": "billing_products_public", "method": "GET", "path": "/api/billing/products", "expect": [200]},
        {"name": "documents_list_anonymous_empty", "method": "GET", "path": "/api/documents", "expect": [200]},
        {"name": "demo_documents_public", "method": "GET", "path": "/api/documents/demo", "expect": [200]},
        {"name": "extraction_templates_public", "method": "GET", "path": "/api/extraction-templates", "expect": [200]},
    ]
    private_cases = [
        {"name": "users_me_requires_auth", "method": "GET", "path": "/api/users/me", "expect": [401]},
        {"name": "users_profile_requires_auth", "method": "GET", "path": "/api/users/profile", "expect": [401]},
        {"name": "users_usage_requires_auth", "method": "GET", "path": "/api/users/usage-breakdown", "expect": [401]},
        {"name": "users_export_requires_auth", "method": "GET", "path": "/api/users/me/export", "expect": [401]},
        {"name": "users_delete_requires_auth", "method": "DELETE", "path": "/api/users/me", "expect": [401]},
        {"name": "credits_balance_requires_auth", "method": "GET", "path": "/api/credits/balance", "expect": [401]},
        {"name": "credits_history_requires_auth", "method": "GET", "path": "/api/credits/history", "expect": [401]},
        {"name": "collections_list_requires_auth", "method": "GET", "path": "/api/collections", "expect": [401]},
        {
            "name": "collections_create_requires_auth",
            "method": "POST",
            "path": "/api/collections",
            "json": {"name": "anonymous-guard"},
            "expect": [401],
        },
        {"name": "document_diffs_list_requires_auth", "method": "GET", "path": "/api/document-diffs", "expect": [401]},
        {
            "name": "document_diffs_create_requires_auth",
            "method": "POST",
            "path": "/api/document-diffs",
            "json": {"old_document_id": FAKE_UUID, "new_document_id": "00000000-0000-4000-8000-000000000002"},
            "expect": [401],
        },
        {"name": "question_templates_list_requires_auth", "method": "GET", "path": "/api/question-templates", "expect": [401]},
        {
            "name": "question_templates_create_requires_auth",
            "method": "POST",
            "path": "/api/question-templates",
            "json": {"name": "anonymous-guard", "questions": ["What is this?"]},
            "expect": [401],
        },
        {
            "name": "extraction_create_requires_auth",
            "method": "POST",
            "path": f"/api/documents/{FAKE_UUID}/extractions",
            "json": {"template_key": "executive_summary", "locale": "en"},
            "expect": [401],
        },
        {
            "name": "table_scan_requires_auth",
            "method": "POST",
            "path": f"/api/documents/{FAKE_UUID}/tables/scan",
            "expect": [401],
        },
        {
            "name": "billing_checkout_requires_auth",
            "method": "POST",
            "path": "/api/billing/checkout",
            "json": {"product_id": "boost"},
            "expect": [401],
        },
        {
            "name": "billing_subscribe_requires_auth",
            "method": "POST",
            "path": "/api/billing/subscribe",
            "json": {"plan": "plus", "billing": "monthly"},
            "expect": [401],
        },
        {"name": "billing_portal_requires_auth", "method": "POST", "path": "/api/billing/portal", "expect": [401]},
        {
            "name": "billing_cancel_requires_auth",
            "method": "POST",
            "path": "/api/billing/cancel",
            "json": {"refund_requested": True},
            "expect": [401],
        },
    ]
    anonymous_not_found_cases = [
        {"name": "private_session_messages_do_not_leak", "method": "GET", "path": f"/api/sessions/{FAKE_UUID}/messages", "expect": [404]},
        {"name": "private_chunk_do_not_leak", "method": "GET", "path": f"/api/chunks/{FAKE_UUID}", "expect": [404]},
        {
            "name": "private_document_search_do_not_leak",
            "method": "POST",
            "path": f"/api/documents/{FAKE_UUID}/search",
            "json": {"query": "test", "top_k": 3},
            "expect": [404],
        },
    ]

    checks: list[dict[str, Any]] = []
    for group, cases in [
        ("public", public_cases),
        ("private_auth_guard", private_cases),
        ("anonymous_not_found", anonymous_not_found_cases),
    ]:
        for case in cases:
            headers = {"accept": "application/json"}
            body = None
            if "json" in case:
                headers["content-type"] = "application/json"
                body = json.dumps(case["json"]).encode("utf-8")
            res = request(
                args.backend.rstrip("/") + case["path"],
                method=case["method"],
                body=body,
                headers=headers,
            )
            text = res.body.decode("utf-8", errors="replace")
            leaks = body_leaks_sensitive_data(text)
            checks.append(
                {
                    "group": group,
                    "name": case["name"],
                    "method": case["method"],
                    "path": case["path"],
                    "expected_status": case["expect"],
                    "status": res.status,
                    "elapsed_ms": res.elapsed_ms,
                    "content_type": res.headers.get("content-type"),
                    "body_json": safe_json(res.body),
                    "body_preview": text[:240],
                    "sensitive_markers": leaks,
                    "result": "pass" if res.status in case["expect"] and not leaks else "fail",
                }
            )

    cors = request(
        args.backend.rstrip() + "/api/users/me",
        method="OPTIONS",
        headers={
            "Origin": args.frontend.rstrip("/"),
            "Access-Control-Request-Method": "GET",
        },
    )
    checks.append(
        {
            "group": "cors",
            "name": "private_api_cors_allows_frontend_origin",
            "method": "OPTIONS",
            "path": "/api/users/me",
            "expected_status": [200],
            "status": cors.status,
            "allow_origin": cors.headers.get("access-control-allow-origin"),
            "allow_credentials": cors.headers.get("access-control-allow-credentials"),
            "result": "pass"
            if cors.status == 200
            and cors.headers.get("access-control-allow-origin") == args.frontend.rstrip("/")
            and cors.headers.get("access-control-allow-credentials") == "true"
            else "fail",
        }
    )

    failed = [check for check in checks if check["result"] != "pass"]
    report = {
        "run": "qa-production-anonymous-api-guards",
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "backend": args.backend,
        "frontend": args.frontend,
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
    print(f"PRODUCTION_ANONYMOUS_API_GUARDS {report['result'].upper()}: {report['summary']['passed']}/{report['summary']['total']}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
