#!/usr/bin/env python3
"""Production public-page external link health audit."""

from __future__ import annotations

import argparse
import json
import socket
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path
from typing import Any

FRONTEND = "https://www.doctalk.site"
ROOT = Path(__file__).resolve().parents[2]
DEFAULT_INVENTORY = ROOT / ".collab/tasks/qa-route-inventory-2026-05-10.json"
SKIP_SCHEMES = {"mailto", "tel", "javascript", "data", "blob"}
SOFT_STATUS_WARNINGS = {401, 403, 405, 408, 409, 423, 425, 429, 451}


@dataclass
class FetchResult:
    status: int | None
    final_url: str | None
    headers: dict[str, str]
    elapsed_ms: int
    method: str
    error: str | None = None


class LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[dict[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() != "a":
            return
        attr_map = {key.lower(): value or "" for key, value in attrs}
        href = attr_map.get("href", "").strip()
        if not href:
            return
        label = " ".join((attr_map.get("aria-label") or "").split())
        self.links.append({
            "href": href,
            "label": label,
            "target": attr_map.get("target", ""),
            "rel": attr_map.get("rel", ""),
        })


def load_routes(inventory: Path) -> list[dict[str, Any]]:
    data = json.loads(inventory.read_text(encoding="utf-8"))
    routes = []
    for item in data.get("concrete", []):
        route = item.get("route")
        if item.get("kind") == "gated":
            continue
        if item.get("kind") == "auth":
            continue
        if item.get("requires"):
            continue
        if item.get("template") == "/demo/[sample]":
            continue
        if not isinstance(route, str) or "[" in route:
            continue
        routes.append(item)
    return sorted(routes, key=lambda item: item["route"])


def route_url(base_url: str, route: str) -> str:
    return base_url.rstrip("/") + ("" if route == "/" else route)


def request(
    url: str,
    *,
    method: str = "GET",
    timeout: int = 20,
    accept: str = "text/html,application/xhtml+xml,*/*;q=0.8",
) -> FetchResult:
    started = time.monotonic()
    req = urllib.request.Request(
        url,
        method=method,
        headers={
            "User-Agent": "DocTalk-QA-External-Link-Audit/1.0 (+https://www.doctalk.site)",
            "Accept": accept,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            if method != "HEAD":
                resp.read(8192)
            return FetchResult(
                status=resp.status,
                final_url=resp.url,
                headers={key.lower(): value for key, value in resp.headers.items()},
                elapsed_ms=int((time.monotonic() - started) * 1000),
                method=method,
            )
    except urllib.error.HTTPError as exc:
        return FetchResult(
            status=exc.code,
            final_url=exc.url,
            headers={key.lower(): value for key, value in exc.headers.items()},
            elapsed_ms=int((time.monotonic() - started) * 1000),
            method=method,
            error=None,
        )
    except (urllib.error.URLError, TimeoutError, socket.timeout, ssl.SSLError) as exc:
        reason = getattr(exc, "reason", exc)
        return FetchResult(
            status=None,
            final_url=None,
            headers={},
            elapsed_ms=int((time.monotonic() - started) * 1000),
            method=method,
            error=f"{type(reason).__name__}: {reason}",
        )


def parse_html(body: bytes) -> LinkParser:
    parser = LinkParser()
    parser.feed(body.decode("utf-8", errors="replace"))
    return parser


def canonical_external(url: str) -> str:
    parsed = urllib.parse.urlparse(url)
    path = parsed.path or "/"
    scheme = parsed.scheme.lower()
    netloc = parsed.netloc.lower()
    return urllib.parse.urlunparse((scheme, netloc, path, "", parsed.query, ""))


def is_internal(url: str, internal_hosts: set[str]) -> bool:
    parsed = urllib.parse.urlparse(url)
    return parsed.netloc.lower() in internal_hosts


def classify(result: FetchResult) -> tuple[str, str]:
    if result.status is None:
        return "warning", "network_or_tls_error"
    if 200 <= result.status < 400:
        return "pass", "reachable"
    if result.status in SOFT_STATUS_WARNINGS:
        return "warning", "access_limited_or_rate_limited"
    if result.status in {404, 410}:
        return "fail", "not_found_or_gone"
    if 500 <= result.status <= 599:
        return "fail", "server_error"
    return "warning", "unexpected_status"


def check_external(url: str, timeout: int) -> FetchResult:
    head = request(url, method="HEAD", timeout=timeout, accept="*/*")
    if head.status is not None and head.status not in {405, 403, 429}:
        return head
    get = request(url, method="GET", timeout=timeout)
    if get.status is not None or head.status is None:
        return get
    return head


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default=FRONTEND)
    parser.add_argument("--inventory", default=str(DEFAULT_INVENTORY))
    parser.add_argument("--json-out", required=True)
    parser.add_argument("--timeout", type=int, default=20)
    parser.add_argument("--max-targets", type=int, default=0)
    args = parser.parse_args()

    base_url = args.base_url.rstrip("/")
    base = urllib.parse.urlparse(base_url)
    internal_hosts = {base.netloc.lower(), "www.doctalk.site", "doctalk.site"}
    routes = load_routes(Path(args.inventory))

    external_refs: dict[str, dict[str, Any]] = {}
    skipped_links: list[dict[str, str]] = []
    source_pages: dict[str, dict[str, Any]] = {}

    for route_info in routes:
        route = route_info["route"]
        source_url = route_url(base_url, route)
        source_res = request(source_url, timeout=args.timeout)
        content_type = source_res.headers.get("content-type", "")
        body = b""
        if source_res.status and 200 <= source_res.status < 400 and "html" in content_type:
            # Fetch the body after the source reachability probe because request()
            # intentionally reads only a small chunk for external checks.
            req = urllib.request.Request(
                source_url,
                headers={
                    "User-Agent": "DocTalk-QA-External-Link-Audit/1.0 (+https://www.doctalk.site)",
                    "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
                },
            )
            with urllib.request.urlopen(req, timeout=args.timeout) as resp:
                body = resp.read()
                content_type = resp.headers.get("content-type", content_type)
        parsed_html = parse_html(body) if body else LinkParser()
        source_pages[route] = {
            "status": source_res.status,
            "content_type": content_type,
            "link_count": len(parsed_html.links),
            "elapsed_ms": source_res.elapsed_ms,
        }

        for link in parsed_html.links:
            href = link["href"].strip()
            resolved = urllib.parse.urljoin(source_url, href)
            parsed = urllib.parse.urlparse(resolved)
            if parsed.scheme in SKIP_SCHEMES:
                skipped_links.append({"source": route, "href": href, "reason": f"scheme:{parsed.scheme}"})
                continue
            if parsed.scheme not in {"http", "https"}:
                skipped_links.append({"source": route, "href": href, "reason": f"scheme:{parsed.scheme or 'relative'}"})
                continue
            if is_internal(resolved, internal_hosts):
                continue
            canonical = canonical_external(resolved)
            item = external_refs.setdefault(canonical, {
                "target": canonical,
                "refs": [],
            })
            item["refs"].append({
                "source": route,
                "href": href,
                "resolved": resolved,
                "label": link["label"],
                "target_attr": link["target"],
                "rel": link["rel"],
            })

    targets = list(external_refs.values())
    if args.max_targets > 0:
        targets = targets[:args.max_targets]

    checked_targets: dict[str, dict[str, Any]] = {}
    for item in targets:
        result = check_external(item["target"], args.timeout)
        status, reason = classify(result)
        checked_targets[item["target"]] = {
            "result": status,
            "reason": reason,
            "status": result.status,
            "final_url": result.final_url,
            "method": result.method,
            "elapsed_ms": result.elapsed_ms,
            "error": result.error,
            "content_type": result.headers.get("content-type"),
            "ref_count": len(item["refs"]),
            "source_count": len({ref["source"] for ref in item["refs"]}),
            "refs_sample": item["refs"][:10],
        }

    failures = [
        {"target": target, **data}
        for target, data in checked_targets.items()
        if data["result"] == "fail"
    ]
    warnings = [
        {"target": target, **data}
        for target, data in checked_targets.items()
        if data["result"] == "warning"
    ]
    report = {
        "run": "qa-production-public-external-links",
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "base_url": base_url,
        "inventory": args.inventory,
        "result": "fail" if failures else "pass",
        "summary": {
            "source_routes": len(routes),
            "source_pages_loaded": len(source_pages),
            "source_anchor_links": sum(page["link_count"] for page in source_pages.values()),
            "external_refs": sum(len(item["refs"]) for item in external_refs.values()),
            "unique_external_targets_observed": len(external_refs),
            "unique_external_targets_checked": len(checked_targets),
            "passed": sum(1 for item in checked_targets.values() if item["result"] == "pass"),
            "warnings": len(warnings),
            "failed": len(failures),
            "skipped_links": len(skipped_links),
        },
        "failures": failures,
        "warnings": warnings,
        "targets": checked_targets,
        "sources": source_pages,
        "skipped_links_sample": skipped_links[:100],
    }

    out = Path(args.json_out)
    out.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(
        "PRODUCTION_PUBLIC_EXTERNAL_LINKS "
        f"{report['result'].upper()}: "
        f"{report['summary']['passed']}/{report['summary']['unique_external_targets_checked']} "
        f"external targets reachable, "
        f"warnings={report['summary']['warnings']} failed={report['summary']['failed']}"
    )
    for item in failures[:30]:
        print(f"FAIL {item['target']}: status={item['status']} reason={item['reason']}")
    for item in warnings[:30]:
        print(f"WARN {item['target']}: status={item['status']} reason={item['reason']}")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
