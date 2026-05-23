#!/usr/bin/env python3
"""Non-destructive production billing/payment public sanity checks.

This script intentionally avoids authenticated checkout and never creates a
real payment session. It only checks public pricing, public products, CORS,
and anonymous mutation auth guards.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any

FRONTEND = "https://www.doctalk.site"
BACKEND = "https://backend-production-a62e.up.railway.app"


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
    elapsed_ms = int((time.monotonic() - started) * 1000)
    return Response(status=status, headers=response_headers, body=data, elapsed_ms=elapsed_ms)


def add_check(checks: list[dict[str, Any]], name: str, passed: bool, **details: Any) -> None:
    checks.append(
        {
            "name": name,
            "result": "pass" if passed else "fail",
            "details": details,
        }
    )


def media_src_policy(headers: dict[str, str]) -> str | None:
    csp = headers.get("content-security-policy", "")
    media_src_match = re.search(r"media-src\s+([^;]+)", csp)
    return media_src_match.group(1).strip() if media_src_match else None


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--json-out", required=True)
    args = parser.parse_args()

    checks: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []

    pricing = request(f"{FRONTEND}/pricing")
    pricing_html = pricing.body.decode("utf-8", errors="replace")
    demo = request(f"{FRONTEND}/demo")
    demo_html = demo.body.decode("utf-8", errors="replace")

    add_check(
        checks,
        "pricing_page_200",
        pricing.status == 200,
        status=pricing.status,
        elapsed_ms=pricing.elapsed_ms,
        matched_path=pricing.headers.get("x-matched-path"),
    )
    required_markers = ["DocTalk", "Plus", "Pro", "$9.99", "$19.99", "7-day fair-use refund"]
    missing_markers = [marker for marker in required_markers if marker not in pricing_html]
    add_check(
        checks,
        "pricing_page_contains_plan_and_refund_review_copy",
        not missing_markers,
        missing_markers=missing_markers,
    )
    sensitive_patterns = ["localhost", "127.0.0.1", "sk_live", "sk_test"]
    leaked = [pattern for pattern in sensitive_patterns if pattern in pricing_html]
    add_check(
        checks,
        "pricing_page_no_localhost_or_stripe_secret_leak",
        not leaked,
        leaked_patterns=leaked,
    )

    add_check(
        checks,
        "demo_page_200",
        demo.status == 200,
        status=demo.status,
        elapsed_ms=demo.elapsed_ms,
        matched_path=demo.headers.get("x-matched-path"),
    )
    demo_leaked = [pattern for pattern in sensitive_patterns if pattern in demo_html]
    add_check(
        checks,
        "demo_page_no_localhost_or_stripe_secret_leak",
        not demo_leaked,
        leaked_patterns=demo_leaked,
    )

    for page_name, response in [("pricing", pricing), ("demo", demo)]:
        media_src = media_src_policy(response.headers)
        if media_src != "'self' data:":
            warnings.append(
                {
                    "name": "production_csp_media_src_not_current_local_policy",
                    "page": page_name,
                    "observed": media_src,
                    "expected_after_local_fix": "'self' data:",
                    "impact": "Production may still block landing/demo media until the local CSP fix is deployed.",
                }
            )

    products = request(f"{BACKEND}/api/billing/products")
    try:
        products_json = json.loads(products.body.decode("utf-8"))
    except json.JSONDecodeError:
        products_json = {}
    product_map = {
        item.get("id"): item
        for item in products_json.get("products", [])
        if isinstance(item, dict)
    }
    expected_products = {
        "boost": {"credits": 500, "price_usd": 3.99},
        "power": {"credits": 2000, "price_usd": 9.99},
        "ultra": {"credits": 5000, "price_usd": 19.99},
    }
    add_check(
        checks,
        "public_billing_products_match_contract",
        products.status == 200
        and all(
            product_map.get(pid, {}).get("credits") == spec["credits"]
            and float(product_map.get(pid, {}).get("price_usd", -1)) == spec["price_usd"]
            for pid, spec in expected_products.items()
        ),
        status=products.status,
        elapsed_ms=products.elapsed_ms,
        products=products_json.get("products"),
    )

    options = request(
        f"{BACKEND}/api/billing/products",
        method="OPTIONS",
        headers={
            "Origin": FRONTEND,
            "Access-Control-Request-Method": "GET",
        },
    )
    add_check(
        checks,
        "production_backend_cors_allows_frontend",
        options.status == 200
        and options.headers.get("access-control-allow-origin") == FRONTEND,
        status=options.status,
        allow_origin=options.headers.get("access-control-allow-origin"),
        allow_credentials=options.headers.get("access-control-allow-credentials"),
        allow_methods=options.headers.get("access-control-allow-methods"),
    )

    mutation_headers = {"content-type": "application/json"}
    subscribe = request(
        f"{BACKEND}/api/billing/subscribe",
        method="POST",
        headers=mutation_headers,
        body=b'{"plan":"plus","billing":"monthly"}',
    )
    cancel = request(
        f"{BACKEND}/api/billing/cancel",
        method="POST",
        headers=mutation_headers,
        body=b'{"refund_requested":true}',
    )
    add_check(
        checks,
        "anonymous_subscribe_requires_auth",
        subscribe.status == 401,
        status=subscribe.status,
        body=subscribe.body.decode("utf-8", errors="replace")[:200],
    )
    add_check(
        checks,
        "anonymous_cancel_requires_auth",
        cancel.status == 401,
        status=cancel.status,
        body=cancel.body.decode("utf-8", errors="replace")[:200],
    )

    failed = [check for check in checks if check["result"] != "pass"]
    result = {
        "run": "qa-production-payment-public-sanity",
        "frontend": FRONTEND,
        "backend": BACKEND,
        "status": "fail" if failed else ("pass_with_warning" if warnings else "pass"),
        "checks": checks,
        "warnings": warnings,
    }
    with open(args.json_out, "w", encoding="utf-8") as fh:
        json.dump(result, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    print(f"PRODUCTION_PAYMENT_PUBLIC_SANITY {result['status']}: {len(checks) - len(failed)}/{len(checks)} checks")
    if warnings:
        print(f"Warnings: {len(warnings)}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
