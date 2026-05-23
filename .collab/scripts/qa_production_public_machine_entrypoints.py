#!/usr/bin/env python3
"""Non-destructive production checks for public machine entry points and static assets."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from html.parser import HTMLParser
from typing import Any, Callable

FRONTEND = "https://www.doctalk.site"
INDEXNOW_KEY = "38e9d0db4a654c64b237039b2ac0af5d"
MAX_BODY = 2_000_000

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

PRIVATE_SITEMAP_PREFIXES = (
    "/api/",
    "/auth",
    "/billing",
    "/profile",
    "/collections",
    "/document-diff",
    "/admin",
    "/d/",
)


class LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[dict[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() != "link":
            return
        self.links.append({key.lower(): value or "" for key, value in attrs})


@dataclass
class Response:
    status: int
    final_url: str
    headers: dict[str, str]
    body: bytes
    truncated: bool
    elapsed_ms: int


def request(url: str, *, max_body: int = MAX_BODY, timeout: int = 30) -> Response:
    req = urllib.request.Request(
        url,
        method="GET",
        headers={
            "User-Agent": "DocTalk-QA-Public-Machine-Entrypoints/1.0",
            "Accept": "*/*",
        },
    )
    started = time.monotonic()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = resp.read(max_body + 1)
            status = resp.status
            headers = {key.lower(): value for key, value in resp.headers.items()}
            final_url = resp.url
    except urllib.error.HTTPError as exc:
        data = exc.read(max_body + 1)
        status = exc.code
        headers = {key.lower(): value for key, value in exc.headers.items()}
        final_url = exc.url
    return Response(
        status=status,
        final_url=final_url,
        headers=headers,
        body=data[:max_body],
        truncated=len(data) > max_body,
        elapsed_ms=int((time.monotonic() - started) * 1000),
    )


def text_body(res: Response) -> str:
    return res.body.decode("utf-8", errors="replace")


def sensitive_markers(data: bytes) -> list[str]:
    text = data.decode("utf-8", errors="ignore")
    return [marker for marker in SENSITIVE_MARKERS if marker in text]


def header_security(res: Response) -> dict[str, bool]:
    return {
        "x_content_type_options_nosniff": res.headers.get("x-content-type-options", "").lower() == "nosniff",
        "hsts_present": bool(res.headers.get("strict-transport-security")),
    }


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def result_for(
    *,
    name: str,
    group: str,
    path: str,
    res: Response,
    checks: dict[str, bool],
    details: dict[str, Any] | None = None,
    warnings: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    leaks = sensitive_markers(res.body)
    full_checks = {
        "status_200": res.status == 200,
        "not_truncated": not res.truncated,
        "no_sensitive_markers": not leaks,
        **checks,
    }
    return {
        "group": group,
        "name": name,
        "path": path,
        "status": res.status,
        "final_url": res.final_url,
        "elapsed_ms": res.elapsed_ms,
        "content_type": res.headers.get("content-type"),
        "content_length_header": res.headers.get("content-length"),
        "body_bytes_read": len(res.body),
        "body_sha256": sha256(res.body),
        "security_headers": header_security(res),
        "sensitive_markers": leaks,
        "warnings": warnings or [],
        "details": details or {},
        "checks": full_checks,
        "result": "pass" if all(full_checks.values()) else "fail",
    }


def check_robots(base_url: str, expected_site_url: str) -> dict[str, Any]:
    path = "/robots.txt"
    res = request(base_url + path)
    text = text_body(res)
    disallows = [
        line.split(":", 1)[1].strip()
        for line in text.splitlines()
        if line.lower().startswith("disallow:")
    ]
    checks = {
        "text_plain": "text/plain" in (res.headers.get("content-type") or ""),
        "has_user_agent": bool(re.search(r"(?im)^user-agent:", text)),
        "allows_root": bool(re.search(r"(?im)^allow:\s*/\s*$", text)),
        "has_sitemap": f"Sitemap: {expected_site_url}/sitemap.xml" in text,
        "private_routes_disallowed": all(route in disallows for route in PRIVATE_SITEMAP_PREFIXES),
        "does_not_disallow_entire_site": "/" not in disallows,
    }
    return result_for(
        name="robots_txt",
        group="crawler_entrypoints",
        path=path,
        res=res,
        checks=checks,
        details={"disallow_count": len(disallows), "disallows": disallows[:20]},
    )


def check_sitemap(base_url: str, expected_site_url: str) -> dict[str, Any]:
    path = "/sitemap.xml"
    res = request(base_url + path)
    text = text_body(res)
    locs: list[str] = []
    parse_error: str | None = None
    try:
        root = ET.fromstring(text)
        locs = [
            (elem.text or "").strip()
            for elem in root.findall(".//{*}loc")
            if (elem.text or "").strip()
        ]
    except ET.ParseError as exc:
        parse_error = str(exc)

    parsed_urls = [urllib.parse.urlparse(url) for url in locs]
    expected = urllib.parse.urlparse(expected_site_url)
    paths = {url.path or "/" for url in parsed_urls}
    private_urls = [
        url
        for url in locs
        if any((urllib.parse.urlparse(url).path or "/").startswith(prefix) for prefix in PRIVATE_SITEMAP_PREFIXES)
    ]
    required_paths = {
        "/",
        "/demo",
        "/pricing",
        "/features",
        "/features/citations",
        "/features/multi-format",
        "/use-cases",
        "/blog",
        "/blog/how-to-chat-with-pdf-ai",
        "/tools/word-counter",
    }
    checks = {
        "xml_content_type": any(
            expected in (res.headers.get("content-type") or "")
            for expected in ("application/xml", "text/xml")
        ),
        "xml_parseable": parse_error is None,
        "url_count_reasonable": len(locs) >= 50,
        "required_public_paths_present": required_paths.issubset(paths),
        "all_urls_on_expected_site": bool(locs)
        and all(url.scheme == expected.scheme and url.netloc == expected.netloc for url in parsed_urls),
        "no_private_or_gated_urls": not private_urls,
        "no_duplicate_urls": len(locs) == len(set(locs)),
    }
    return result_for(
        name="sitemap_xml",
        group="crawler_entrypoints",
        path=path,
        res=res,
        checks=checks,
        details={
            "url_count": len(locs),
            "required_paths": sorted(required_paths),
            "missing_required_paths": sorted(required_paths - paths),
            "private_urls": private_urls,
            "parse_error": parse_error,
            "sample_urls": locs[:12],
        },
    )


def check_llms(base_url: str) -> dict[str, Any]:
    path = "/llms.txt"
    res = request(base_url + path)
    text = text_body(res)
    links = re.findall(r"https://[^\]\s)]+", text)
    checks = {
        "text_plain": "text/plain" in (res.headers.get("content-type") or ""),
        "has_product_title": text.startswith("# DocTalk"),
        "has_core_sections": all(section in text for section in ("## Product", "## Use Cases", "## Blog")),
        "has_document_chat_positioning": "document chat" in text.lower() and "cited answers" in text.lower(),
        "all_links_https_doctalk": bool(links)
        and all(urllib.parse.urlparse(link).netloc == "www.doctalk.site" for link in links),
    }
    return result_for(
        name="llms_txt",
        group="crawler_entrypoints",
        path=path,
        res=res,
        checks=checks,
        details={"link_count": len(links), "sample_links": links[:10]},
    )


def check_png_asset(base_url: str, path: str, *, name: str, min_bytes: int) -> dict[str, Any]:
    res = request(base_url + path)
    checks = {
        "png_content_type": "image/png" in (res.headers.get("content-type") or ""),
        "png_magic": res.body.startswith(b"\x89PNG\r\n\x1a\n"),
        "min_size": len(res.body) >= min_bytes,
    }
    return result_for(name=name, group="share_and_icon_assets", path=path, res=res, checks=checks)


def check_svg_asset(base_url: str, path: str, *, name: str, expected_size: str | None = None) -> dict[str, Any]:
    res = request(base_url + path)
    text = text_body(res)
    checks = {
        "svg_content_type": "image/svg+xml" in (res.headers.get("content-type") or ""),
        "has_svg_root": "<svg" in text,
        "no_script_or_event_handlers": "<script" not in text.lower() and " onload=" not in text.lower(),
    }
    if expected_size:
        checks["expected_size"] = expected_size in text
    return result_for(name=name, group="share_and_icon_assets", path=path, res=res, checks=checks)


def check_root_icon_metadata(base_url: str) -> dict[str, Any]:
    path = "/"
    res = request(base_url + path)
    parser = LinkParser()
    parser.feed(text_body(res))
    icon_links = [
        link for link in parser.links
        if "icon" in link.get("rel", "").lower() or "manifest" in link.get("rel", "").lower()
    ]
    favicon_links = [
        link for link in icon_links
        if link.get("rel", "").lower() == "icon" or "shortcut icon" in link.get("rel", "").lower()
    ]
    apple_links = [link for link in icon_links if "apple-touch-icon" in link.get("rel", "").lower()]
    manifest_links = [link for link in icon_links if "manifest" in link.get("rel", "").lower()]
    warnings = []
    if not apple_links:
        warnings.append({
            "name": "missing_apple_touch_icon",
            "impact": "iOS home-screen bookmarks and some previews may fall back to a generic icon.",
        })
    if not manifest_links:
        warnings.append({
            "name": "missing_web_manifest",
            "impact": "Installability/PWA metadata is absent; acceptable for a non-PWA but worth tracking.",
        })
    apple_probe: dict[str, Any] | None = None
    if apple_links:
        apple_href = apple_links[0].get("href", "")
        apple_res = request(urllib.parse.urljoin(base_url + "/", apple_href))
        apple_probe = {
            "href": apple_href,
            "status": apple_res.status,
            "content_type": apple_res.headers.get("content-type"),
            "body_bytes_read": len(apple_res.body),
        }
    manifest_probe: dict[str, Any] | None = None
    manifest_parse_error: str | None = None
    manifest_data: Any = None
    if manifest_links:
        manifest_href = manifest_links[0].get("href", "")
        manifest_res = request(urllib.parse.urljoin(base_url + "/", manifest_href))
        try:
            manifest_data = json.loads(text_body(manifest_res))
        except Exception as exc:
            manifest_parse_error = str(exc)
        manifest_probe = {
            "href": manifest_href,
            "status": manifest_res.status,
            "content_type": manifest_res.headers.get("content-type"),
            "body_bytes_read": len(manifest_res.body),
            "parse_error": manifest_parse_error,
            "name": manifest_data.get("name") if isinstance(manifest_data, dict) else None,
            "icon_count": len(manifest_data.get("icons", [])) if isinstance(manifest_data, dict) else 0,
        }
    checks = {
        "html_content_type": "text/html" in (res.headers.get("content-type") or ""),
        "has_favicon_link": bool(favicon_links),
    }
    if apple_probe:
        checks["apple_touch_icon_reachable"] = apple_probe["status"] == 200
        checks["apple_touch_icon_is_image"] = str(apple_probe["content_type"] or "").startswith("image/")
    if manifest_probe:
        checks["manifest_reachable"] = manifest_probe["status"] == 200
        checks["manifest_content_type"] = any(
            expected in str(manifest_probe["content_type"] or "")
            for expected in ("application/manifest+json", "application/json")
        )
        checks["manifest_parseable"] = manifest_parse_error is None
        checks["manifest_has_name_and_icons"] = manifest_probe["name"] == "DocTalk" and manifest_probe["icon_count"] > 0
    return result_for(
        name="root_icon_metadata",
        group="share_and_icon_assets",
        path=path,
        res=res,
        checks=checks,
        details={
            "icon_links": icon_links,
            "favicon_count": len(favicon_links),
            "apple_touch_icon_count": len(apple_links),
            "manifest_count": len(manifest_links),
            "apple_probe": apple_probe,
            "manifest_probe": manifest_probe,
        },
        warnings=warnings,
    )


def check_indexnow_key(base_url: str) -> dict[str, Any]:
    path = f"/{INDEXNOW_KEY}.txt"
    res = request(base_url + path)
    text = text_body(res).strip()
    checks = {
        "text_plain": "text/plain" in (res.headers.get("content-type") or ""),
        "exact_key_body": text == INDEXNOW_KEY,
        "single_line": "\n" not in text,
    }
    return result_for(
        name="indexnow_key_file",
        group="crawler_entrypoints",
        path=path,
        res=res,
        checks=checks,
        details={"body_length": len(text)},
    )


def check_pdf_worker(base_url: str) -> dict[str, Any]:
    path = "/pdf.worker.min.mjs"
    res = request(base_url + path)
    text = text_body(res)
    checks = {
        "javascript_content_type": any(
            expected in (res.headers.get("content-type") or "")
            for expected in ("text/javascript", "application/javascript", "application/octet-stream")
        ),
        "has_pdfjs_worker_symbols": "WorkerMessageHandler" in text and "PDFWorker" in text,
        "size_reasonable": len(res.body) > 500_000,
    }
    return result_for(name="pdfjs_worker", group="pdf_render_static_assets", path=path, res=res, checks=checks)


def check_binary_asset(
    base_url: str,
    path: str,
    *,
    name: str,
    min_bytes: int,
    magic_check: Callable[[bytes], bool] | None = None,
) -> dict[str, Any]:
    res = request(base_url + path)
    checks = {
        "min_size": len(res.body) >= min_bytes,
    }
    if magic_check:
        checks["magic_bytes"] = magic_check(res.body)
    return result_for(name=name, group="pdf_render_static_assets", path=path, res=res, checks=checks)


def build_results(base_url: str, expected_site_url: str) -> list[dict[str, Any]]:
    return [
        check_robots(base_url, expected_site_url),
        check_sitemap(base_url, expected_site_url),
        check_llms(base_url),
        check_indexnow_key(base_url),
        check_root_icon_metadata(base_url),
        check_png_asset(base_url, "/opengraph-image", name="opengraph_image", min_bytes=10_000),
        check_png_asset(base_url, "/twitter-image", name="twitter_image", min_bytes=10_000),
        check_svg_asset(base_url, "/icon.svg", name="app_icon_svg", expected_size='width="32"'),
        check_svg_asset(base_url, "/logo-icon.svg", name="public_logo_icon_svg"),
        check_png_asset(base_url, "/logo-icon.png", name="public_logo_icon_png", min_bytes=5_000),
        check_pdf_worker(base_url),
        check_binary_asset(base_url, "/cmaps/UniJIS-UCS2-H.bcmap", name="pdfjs_japanese_cmap", min_bytes=20_000),
        check_binary_asset(base_url, "/cmaps/UniGB-UCS2-H.bcmap", name="pdfjs_chinese_cmap", min_bytes=40_000),
        check_binary_asset(
            base_url,
            "/standard_fonts/LiberationSans-Regular.ttf",
            name="pdfjs_standard_font",
            min_bytes=100_000,
            magic_check=lambda body: body.startswith(b"\x00\x01\x00\x00") or body.startswith(b"ttcf"),
        ),
    ]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default=FRONTEND)
    parser.add_argument("--expected-site-url", default=None)
    parser.add_argument("--json-out", required=True)
    args = parser.parse_args()

    base_url = args.base_url.rstrip("/")
    expected_site_url = (args.expected_site_url or base_url).rstrip("/")
    results = build_results(base_url, expected_site_url)
    failed = [item for item in results if item["result"] != "pass"]
    warning_items = [item for item in results if item["warnings"]]
    report = {
        "run": "qa-production-public-machine-entrypoints",
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "base_url": base_url,
        "expected_site_url": expected_site_url,
        "result": "fail" if failed else ("pass_with_warning" if warning_items else "pass"),
        "summary": {
            "passed": len(results) - len(failed),
            "failed": len(failed),
            "warnings": len(warning_items),
            "total": len(results),
            "groups": sorted({item["group"] for item in results}),
        },
        "results": results,
    }

    out = args.json_out
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2, ensure_ascii=False)
        fh.write("\n")

    print(
        "PRODUCTION_PUBLIC_MACHINE_ENTRYPOINTS "
        f"{report['result'].upper()}: {report['summary']['passed']}/{report['summary']['total']} passed"
    )
    for item in failed:
        failed_checks = [key for key, passed in item["checks"].items() if not passed]
        print(f"FAIL {item['name']}: status={item['status']} failed_checks={failed_checks}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
