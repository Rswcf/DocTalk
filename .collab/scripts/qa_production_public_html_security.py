#!/usr/bin/env python3
"""Production public HTML/security baseline sweep for concrete public routes."""

from __future__ import annotations

import argparse
import json
import re
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path
from typing import Any

FRONTEND = "https://www.doctalk.site"
ROOT = Path(__file__).resolve().parents[2]
DEFAULT_INVENTORY = ROOT / ".collab/tasks/qa-route-inventory-2026-05-10.json"


@dataclass
class Response:
    status: int
    final_url: str
    headers: dict[str, str]
    body: bytes
    elapsed_ms: int


class HeadParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.in_title = False
        self.title_parts: list[str] = []
        self.meta: list[dict[str, str]] = []
        self.links: list[dict[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr_map = {key.lower(): value or "" for key, value in attrs}
        if tag.lower() == "title":
            self.in_title = True
        elif tag.lower() == "meta":
            self.meta.append(attr_map)
        elif tag.lower() == "link":
            self.links.append(attr_map)

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "title":
            self.in_title = False

    def handle_data(self, data: str) -> None:
        if self.in_title:
            self.title_parts.append(data)

    @property
    def title(self) -> str:
        return " ".join(" ".join(self.title_parts).split())

    @property
    def description(self) -> str | None:
        for item in self.meta:
            if item.get("name", "").lower() == "description":
                return item.get("content")
        return None

    @property
    def robots(self) -> str | None:
        for item in self.meta:
            if item.get("name", "").lower() == "robots":
                return item.get("content")
        return None

    @property
    def canonical(self) -> str | None:
        for item in self.links:
            if item.get("rel", "").lower() == "canonical":
                return item.get("href")
        return None


def request(url: str, timeout: int = 25) -> Response:
    started = time.monotonic()
    req = urllib.request.Request(
        url,
        method="GET",
        headers={
            "User-Agent": "DocTalk-QA-Public-Html-Security/1.0",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = resp.read()
            status = resp.status
            headers = {key.lower(): value for key, value in resp.headers.items()}
            final_url = resp.url
    except urllib.error.HTTPError as exc:
        data = exc.read()
        status = exc.code
        headers = {key.lower(): value for key, value in exc.headers.items()}
        final_url = exc.url
    return Response(
        status=status,
        final_url=final_url,
        headers=headers,
        body=data,
        elapsed_ms=int((time.monotonic() - started) * 1000),
    )


def load_routes(inventory: Path) -> list[str]:
    data = json.loads(inventory.read_text(encoding="utf-8"))
    routes = []
    for item in data.get("concrete", []):
        route = item.get("route")
        if item.get("kind") == "gated":
            continue
        if item.get("requires"):
            continue
        if item.get("template") == "/demo/[sample]":
            continue
        if not isinstance(route, str) or "[" in route:
            continue
        routes.append(route)
    return sorted(set(routes))


def media_src_policy(headers: dict[str, str]) -> str | None:
    csp = headers.get("content-security-policy", "")
    match = re.search(r"media-src\s+([^;]+)", csp)
    return match.group(1).strip() if match else None


def body_text_length(html: str) -> int:
    text = re.sub(r"<script\b[^>]*>.*?</script>", " ", html, flags=re.I | re.S)
    text = re.sub(r"<style\b[^>]*>.*?</style>", " ", text, flags=re.I | re.S)
    text = re.sub(r"<[^>]+>", " ", text)
    return len(" ".join(text.split()))


def sensitive_markers(html: str) -> list[str]:
    markers = [
        "localhost",
        "127.0.0.1",
        "host.docker.internal",
        "DATABASE_URL",
        "OPENROUTER_API_KEY",
        "DEEPSEEK_API_KEY",
        "AUTH_SECRET",
        "ADAPTER_SECRET",
        "STRIPE_SECRET_KEY",
        "STRIPE_WEBHOOK_SECRET",
        "sk_live",
        "sk_test",
        "postgres://",
        "redis://",
    ]
    return [marker for marker in markers if marker in html]


def check_route(base_url: str, route: str) -> dict[str, Any]:
    url = base_url.rstrip("/") + route
    res = request(url)
    html = res.body.decode("utf-8", errors="replace")
    parser = HeadParser()
    if "html" in (res.headers.get("content-type") or ""):
        parser.feed(html)
    security_headers = {
        "content-security-policy": bool(res.headers.get("content-security-policy")),
        "x-frame-options_deny": res.headers.get("x-frame-options", "").upper() == "DENY",
        "x-content-type-options_nosniff": res.headers.get("x-content-type-options", "").lower() == "nosniff",
        "referrer-policy_present": bool(res.headers.get("referrer-policy")),
        "permissions-policy_present": bool(res.headers.get("permissions-policy")),
        "hsts_present": bool(res.headers.get("strict-transport-security")),
    }
    leaks = sensitive_markers(html)
    text_chars = body_text_length(html)
    warnings = []
    media_src = media_src_policy(res.headers)
    if media_src != "'self' data:":
        warnings.append(
            {
                "name": "csp_media_src_not_current_local_policy",
                "observed": media_src,
                "expected_after_local_fix": "'self' data:",
            }
        )
    if not parser.canonical and route not in {"/auth", "/auth/error", "/auth/verify-request"}:
        warnings.append({"name": "missing_canonical"})
    if not parser.description and route not in {"/auth", "/auth/error", "/auth/verify-request"}:
        warnings.append({"name": "missing_meta_description"})

    min_body_chars = 30 if route in {"/auth", "/auth/error", "/auth/verify-request"} else 120
    checks = {
        "status_2xx": 200 <= res.status < 300,
        "body_has_content": text_chars >= min_body_chars,
        "title_present": bool(parser.title),
        "security_headers_present": all(security_headers.values()),
        "no_sensitive_markers": not leaks,
    }
    return {
        "route": route,
        "url": url,
        "status": res.status,
        "final_url": res.final_url,
        "elapsed_ms": res.elapsed_ms,
        "content_type": res.headers.get("content-type"),
        "title": parser.title,
        "description_chars": len(parser.description or ""),
        "canonical": parser.canonical,
        "robots_meta": parser.robots,
        "x_robots_tag": res.headers.get("x-robots-tag"),
        "body_text_chars": text_chars,
        "min_body_text_chars": min_body_chars,
        "media_src": media_src,
        "security_headers": security_headers,
        "sensitive_markers": leaks,
        "warnings": warnings,
        "checks": checks,
        "result": "pass" if all(checks.values()) else "fail",
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default=FRONTEND)
    parser.add_argument("--inventory", default=str(DEFAULT_INVENTORY))
    parser.add_argument("--json-out", required=True)
    args = parser.parse_args()

    routes = load_routes(Path(args.inventory))
    results = [check_route(args.base_url, route) for route in routes]
    failed = [item for item in results if item["result"] != "pass"]
    warnings = [item for item in results if item["warnings"]]
    report = {
        "run": "qa-production-public-html-security",
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "base_url": args.base_url,
        "inventory": args.inventory,
        "route_count": len(routes),
        "result": "fail" if failed else ("pass_with_warning" if warnings else "pass"),
        "summary": {
            "passed": len(results) - len(failed),
            "failed": len(failed),
            "warning_routes": len(warnings),
            "csp_media_src_warning_routes": len([
                item for item in results
                if any(w["name"] == "csp_media_src_not_current_local_policy" for w in item["warnings"])
            ]),
            "sensitive_marker_routes": len([item for item in results if item["sensitive_markers"]]),
            "missing_canonical_routes": len([
                item for item in results
                if any(w["name"] == "missing_canonical" for w in item["warnings"])
            ]),
            "missing_description_routes": len([
                item for item in results
                if any(w["name"] == "missing_meta_description" for w in item["warnings"])
            ]),
        },
        "routes": results,
    }
    out = Path(args.json_out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(
        "PRODUCTION_PUBLIC_HTML_SECURITY "
        f"{report['result'].upper()}: {report['summary']['passed']}/{report['route_count']} routes, "
        f"warnings={report['summary']['warning_routes']}"
    )
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
