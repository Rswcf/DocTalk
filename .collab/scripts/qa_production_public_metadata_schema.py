#!/usr/bin/env python3
"""Production public metadata, share-card, and JSON-LD schema audit."""

from __future__ import annotations

import argparse
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
from typing import Any

FRONTEND = "https://www.doctalk.site"
ROOT = Path(__file__).resolve().parents[2]
DEFAULT_INVENTORY = ROOT / ".collab/tasks/qa-route-inventory-2026-05-10.json"
SITE_HOST = "www.doctalk.site"
BLOCKED_URL_HOSTS = {"localhost", "127.0.0.1", "host.docker.internal"}

SENSITIVE_MARKERS = [
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
    "BEGIN PRIVATE KEY",
]


@dataclass
class Response:
    status: int
    final_url: str
    headers: dict[str, str]
    body: bytes
    elapsed_ms: int


class MetadataParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=False)
        self.in_title = False
        self.title_parts: list[str] = []
        self.in_json_ld = False
        self.json_ld_parts: list[str] = []
        self.json_ld_scripts: list[str] = []
        self.meta: list[dict[str, str]] = []
        self.links: list[dict[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr_map = {key.lower(): value or "" for key, value in attrs}
        lower = tag.lower()
        if lower == "title":
            self.in_title = True
        elif lower == "meta":
            self.meta.append(attr_map)
        elif lower == "link":
            self.links.append(attr_map)
        elif lower == "script" and attr_map.get("type", "").lower() == "application/ld+json":
            self.in_json_ld = True
            self.json_ld_parts = []

    def handle_endtag(self, tag: str) -> None:
        lower = tag.lower()
        if lower == "title":
            self.in_title = False
        elif lower == "script" and self.in_json_ld:
            self.in_json_ld = False
            self.json_ld_scripts.append(unescape("".join(self.json_ld_parts).strip()))

    def handle_data(self, data: str) -> None:
        if self.in_title:
            self.title_parts.append(data)
        elif self.in_json_ld:
            self.json_ld_parts.append(data)

    @property
    def title(self) -> str:
        return " ".join(" ".join(self.title_parts).split())

    def meta_value(self, *, name: str | None = None, prop: str | None = None) -> str | None:
        for item in self.meta:
            if name and item.get("name", "").lower() == name.lower():
                return item.get("content")
            if prop and item.get("property", "").lower() == prop.lower():
                return item.get("content")
        return None

    @property
    def description(self) -> str | None:
        return self.meta_value(name="description")

    @property
    def canonical(self) -> str | None:
        for item in self.links:
            rel_tokens = {token.strip().lower() for token in item.get("rel", "").split()}
            if "canonical" in rel_tokens:
                return item.get("href")
        return None


def request(url: str, timeout: int = 30) -> Response:
    started = time.monotonic()
    req = urllib.request.Request(
        url,
        method="GET",
        headers={
            "User-Agent": "DocTalk-QA-Public-Metadata-Schema/1.0",
            "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
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


def normalize_url(url: str | None) -> str | None:
    if not url:
        return None
    parsed = urllib.parse.urlparse(url)
    if not parsed.scheme or not parsed.netloc:
        return url.rstrip("/") or "/"
    path = parsed.path.rstrip("/") or "/"
    return urllib.parse.urlunparse((parsed.scheme, parsed.netloc, path, "", "", ""))


def expected_url(base_url: str, route: str) -> str:
    return normalize_url(base_url.rstrip("/") + ("" if route == "/" else route)) or base_url


def parse_json_ld(scripts: list[str]) -> tuple[list[Any], list[str]]:
    parsed: list[Any] = []
    errors: list[str] = []
    for index, script in enumerate(scripts):
        try:
            parsed.append(json.loads(script))
        except json.JSONDecodeError as exc:
            errors.append(f"script[{index}]: {exc.msg} at line {exc.lineno} col {exc.colno}")
    return parsed, errors


def schema_type_values(value: Any) -> list[str]:
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        result: list[str] = []
        for item in value:
            result.extend(schema_type_values(item))
        return result
    return []


def flatten_json_ld(value: Any) -> list[dict[str, Any]]:
    nodes: list[dict[str, Any]] = []
    if isinstance(value, list):
        for item in value:
            nodes.extend(flatten_json_ld(item))
    elif isinstance(value, dict):
        nodes.append(value)
        for item in value.values():
            nodes.extend(flatten_json_ld(item))
    return nodes


def schema_types(items: list[Any]) -> list[str]:
    found: list[str] = []
    for node in flatten_json_ld(items):
        found.extend(schema_type_values(node.get("@type")))
    return sorted(set(found))


def required_schema_types(route: str, template: str | None, area: str | None) -> set[str]:
    if route == "/":
        return {"WebSite", "Organization", "SoftwareApplication", "FAQPage", "HowTo"}
    if template == "/blog/[slug]":
        return {"Article", "BreadcrumbList"}
    if template == "/blog/category/[category]":
        return {"CollectionPage", "BreadcrumbList"}
    if area in {"compare", "alternatives", "use-cases"} and route not in {"/compare", "/alternatives", "/use-cases"}:
        return {"Article", "BreadcrumbList"}
    if route == "/pricing":
        return {"SoftwareApplication", "FAQPage", "BreadcrumbList"}
    if route in {"/about", "/contact"}:
        return {"Organization", "BreadcrumbList"}
    if route.startswith("/features/") or route.startswith("/tools/"):
        return {"SoftwareApplication", "BreadcrumbList"}
    return {"BreadcrumbList"}


def collect_urls(value: Any) -> list[str]:
    urls: list[str] = []
    if isinstance(value, dict):
        for item in value.values():
            urls.extend(collect_urls(item))
    elif isinstance(value, list):
        for item in value:
            urls.extend(collect_urls(item))
    elif isinstance(value, str) and re.match(r"https?://", value):
        urls.append(value)
    return urls


def invalid_urls(urls: list[str]) -> list[str]:
    bad: list[str] = []
    for url in urls:
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme != "https":
            bad.append(url)
            continue
        if parsed.hostname in BLOCKED_URL_HOSTS:
            bad.append(url)
    return sorted(set(bad))


def sensitive_markers(html: str) -> list[str]:
    return [marker for marker in SENSITIVE_MARKERS if marker in html]


def check_route(base_url: str, expected_site_url: str, route_info: dict[str, Any]) -> dict[str, Any]:
    route = route_info["route"]
    url = base_url.rstrip("/") + ("" if route == "/" else route)
    res = request(url)
    html = res.body.decode("utf-8", errors="replace")
    parser = MetadataParser()
    if "html" in (res.headers.get("content-type") or ""):
        parser.feed(html)

    json_ld, json_ld_errors = parse_json_ld(parser.json_ld_scripts)
    types = schema_types(json_ld)
    required_types = required_schema_types(route, route_info.get("template"), route_info.get("area"))
    missing_required_types = sorted(required_types - set(types))
    json_ld_urls = collect_urls(json_ld)
    bad_json_ld_urls = invalid_urls(json_ld_urls)
    leaks = sensitive_markers(html)

    canonical = normalize_url(parser.canonical)
    expected = expected_url(expected_site_url, route)
    og_url = normalize_url(parser.meta_value(prop="og:url"))
    og_image = parser.meta_value(prop="og:image")
    twitter_image = parser.meta_value(name="twitter:image")
    checks = {
        "status_2xx": 200 <= res.status < 300,
        "html_content_type": "text/html" in (res.headers.get("content-type") or ""),
        "title_present": bool(parser.title),
        "description_present": bool(parser.description),
        "canonical_matches_route": canonical == expected,
        "og_title_present": bool(parser.meta_value(prop="og:title")),
        "og_description_present": bool(parser.meta_value(prop="og:description")),
        "og_url_matches_canonical": og_url == expected,
        "og_site_name_doctalk": parser.meta_value(prop="og:site_name") == "DocTalk",
        "og_image_https_doctalk": bool(og_image)
        and urllib.parse.urlparse(og_image).scheme == "https"
        and urllib.parse.urlparse(og_image).netloc == SITE_HOST,
        "twitter_card_large_image": parser.meta_value(name="twitter:card") == "summary_large_image",
        "twitter_title_present": bool(parser.meta_value(name="twitter:title")),
        "twitter_description_present": bool(parser.meta_value(name="twitter:description")),
        "twitter_image_https_doctalk": bool(twitter_image)
        and urllib.parse.urlparse(twitter_image).scheme == "https"
        and urllib.parse.urlparse(twitter_image).netloc == SITE_HOST,
        "json_ld_present": bool(parser.json_ld_scripts),
        "json_ld_parseable": not json_ld_errors,
        "required_schema_types_present": not missing_required_types,
        "json_ld_urls_https_allowlisted": not bad_json_ld_urls,
        "no_sensitive_markers": not leaks,
    }

    warnings = []
    if len(parser.description or "") < 80:
        warnings.append({"name": "short_meta_description", "description_chars": len(parser.description or "")})
    if parser.meta_value(prop="og:image:width") != "1200" or parser.meta_value(prop="og:image:height") != "630":
        warnings.append({
            "name": "og_image_dimensions_missing_or_unexpected",
            "width": parser.meta_value(prop="og:image:width"),
            "height": parser.meta_value(prop="og:image:height"),
        })

    return {
        "route": route,
        "template": route_info.get("template"),
        "area": route_info.get("area"),
        "kind": route_info.get("kind"),
        "url": url,
        "status": res.status,
        "final_url": res.final_url,
        "elapsed_ms": res.elapsed_ms,
        "content_type": res.headers.get("content-type"),
        "title": parser.title,
        "description_chars": len(parser.description or ""),
        "canonical": parser.canonical,
        "expected_canonical": expected,
        "og": {
            "title": parser.meta_value(prop="og:title"),
            "description_chars": len(parser.meta_value(prop="og:description") or ""),
            "url": parser.meta_value(prop="og:url"),
            "site_name": parser.meta_value(prop="og:site_name"),
            "image": og_image,
            "image_width": parser.meta_value(prop="og:image:width"),
            "image_height": parser.meta_value(prop="og:image:height"),
        },
        "twitter": {
            "card": parser.meta_value(name="twitter:card"),
            "title": parser.meta_value(name="twitter:title"),
            "description_chars": len(parser.meta_value(name="twitter:description") or ""),
            "image": twitter_image,
        },
        "json_ld": {
            "script_count": len(parser.json_ld_scripts),
            "parse_errors": json_ld_errors,
            "types": types,
            "required_types": sorted(required_types),
            "missing_required_types": missing_required_types,
            "url_count": len(json_ld_urls),
            "invalid_urls": bad_json_ld_urls,
        },
        "sensitive_markers": leaks,
        "warnings": warnings,
        "checks": checks,
        "result": "pass" if all(checks.values()) else "fail",
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default=FRONTEND)
    parser.add_argument("--expected-site-url", default=None)
    parser.add_argument("--inventory", default=str(DEFAULT_INVENTORY))
    parser.add_argument("--json-out", required=True)
    args = parser.parse_args()

    routes = load_routes(Path(args.inventory))
    expected_site_url = (args.expected_site_url or args.base_url).rstrip("/")
    results = [check_route(args.base_url, expected_site_url, item) for item in routes]
    failed = [item for item in results if item["result"] != "pass"]
    warning_routes = [item for item in results if item["warnings"]]
    report = {
        "run": "qa-production-public-metadata-schema",
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "base_url": args.base_url.rstrip("/"),
        "expected_site_url": expected_site_url,
        "inventory": args.inventory,
        "route_count": len(routes),
        "result": "fail" if failed else ("pass_with_warning" if warning_routes else "pass"),
        "summary": {
            "passed": len(results) - len(failed),
            "failed": len(failed),
            "warning_routes": len(warning_routes),
            "total": len(results),
            "json_ld_scripts": sum(item["json_ld"]["script_count"] for item in results),
            "routes_with_article_schema": len([
                item for item in results if "Article" in item["json_ld"]["types"]
            ]),
            "routes_with_faq_schema": len([
                item for item in results if "FAQPage" in item["json_ld"]["types"]
            ]),
            "routes_with_software_schema": len([
                item for item in results if "SoftwareApplication" in item["json_ld"]["types"]
            ]),
        },
        "results": results,
    }

    out = Path(args.json_out)
    out.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(
        "PRODUCTION_PUBLIC_METADATA_SCHEMA "
        f"{report['result'].upper()}: {report['summary']['passed']}/{report['summary']['total']} passed"
    )
    for item in failed:
        failed_checks = [key for key, passed in item["checks"].items() if not passed]
        print(f"FAIL {item['route']}: failed_checks={failed_checks}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
