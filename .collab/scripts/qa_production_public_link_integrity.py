#!/usr/bin/env python3
"""Production public-page internal link and anchor integrity audit."""

from __future__ import annotations

import argparse
import json
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
KNOWN_CLIENT_HASH_ACTIONS = {"auth"}


@dataclass
class Response:
    status: int
    final_url: str
    headers: dict[str, str]
    body: bytes
    elapsed_ms: int


class LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[dict[str, str]] = []
        self.ids: set[str] = set()
        self.names: set[str] = set()

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr_map = {key.lower(): value or "" for key, value in attrs}
        if attr_map.get("id"):
            self.ids.add(attr_map["id"])
        if attr_map.get("name"):
            self.names.add(attr_map["name"])
        if tag.lower() == "a" and attr_map.get("href"):
            self.links.append({
                "href": attr_map["href"],
                "text": " ".join(attr_map.get("aria-label", "").split()),
                "target": attr_map.get("target", ""),
                "rel": attr_map.get("rel", ""),
            })


def request(url: str, timeout: int = 30) -> Response:
    started = time.monotonic()
    req = urllib.request.Request(
        url,
        method="GET",
        headers={
            "User-Agent": "DocTalk-QA-Public-Link-Integrity/1.0",
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


def parse_html(body: bytes) -> LinkParser:
    parser = LinkParser()
    parser.feed(body.decode("utf-8", errors="replace"))
    return parser


def canonical_target(url: str) -> str:
    parsed = urllib.parse.urlparse(url)
    path = parsed.path or "/"
    return urllib.parse.urlunparse((parsed.scheme, parsed.netloc, path, "", parsed.query, ""))


def is_internal(url: str, internal_hosts: set[str]) -> bool:
    parsed = urllib.parse.urlparse(url)
    return parsed.netloc in internal_hosts


def route_url(base_url: str, route: str) -> str:
    return base_url.rstrip("/") + ("" if route == "/" else route)


def check_hash(target_html: LinkParser, fragment: str) -> bool:
    if not fragment:
        return True
    decoded = urllib.parse.unquote(fragment)
    return decoded in target_html.ids or decoded in target_html.names or decoded in KNOWN_CLIENT_HASH_ACTIONS


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default=FRONTEND)
    parser.add_argument("--inventory", default=str(DEFAULT_INVENTORY))
    parser.add_argument("--json-out", required=True)
    args = parser.parse_args()

    base_url = args.base_url.rstrip("/")
    base = urllib.parse.urlparse(base_url)
    internal_hosts = {base.netloc, "www.doctalk.site"}
    routes = load_routes(Path(args.inventory))

    source_pages: dict[str, dict[str, Any]] = {}
    target_refs: dict[str, list[dict[str, str]]] = {}
    external_links: list[dict[str, str]] = []
    skipped_links: list[dict[str, str]] = []

    for route_info in routes:
        route = route_info["route"]
        source_url = route_url(base_url, route)
        res = request(source_url)
        parsed_html = parse_html(res.body) if "html" in (res.headers.get("content-type") or "") else LinkParser()
        source_pages[source_url] = {
            "route": route,
            "status": res.status,
            "content_type": res.headers.get("content-type"),
            "elapsed_ms": res.elapsed_ms,
            "link_count": len(parsed_html.links),
            "ids": sorted(parsed_html.ids),
            "names": sorted(parsed_html.names),
            "parser": parsed_html,
        }

        for link in parsed_html.links:
            href = link["href"].strip()
            if not href:
                continue
            resolved = urllib.parse.urljoin(source_url, href)
            parsed = urllib.parse.urlparse(resolved)
            if parsed.scheme in SKIP_SCHEMES:
                skipped_links.append({"source": route, "href": href, "reason": f"scheme:{parsed.scheme}"})
                continue
            if not parsed.scheme and href.startswith("#"):
                resolved = source_url + href
                parsed = urllib.parse.urlparse(resolved)
            if not is_internal(resolved, internal_hosts):
                external_links.append({"source": route, "href": href, "resolved": resolved})
                continue
            target = canonical_target(resolved)
            target_refs.setdefault(target, []).append({
                "source": route,
                "href": href,
                "fragment": parsed.fragment,
            })

    target_results: dict[str, dict[str, Any]] = {}
    for target, refs in sorted(target_refs.items()):
        res = request(target)
        parsed_html = parse_html(res.body) if "html" in (res.headers.get("content-type") or "") else LinkParser()
        hash_failures = [
            ref for ref in refs
            if ref.get("fragment") and not check_hash(parsed_html, ref["fragment"])
        ]
        target_results[target] = {
            "status": res.status,
            "final_url": res.final_url,
            "content_type": res.headers.get("content-type"),
            "elapsed_ms": res.elapsed_ms,
            "ref_count": len(refs),
            "source_count": len({ref["source"] for ref in refs}),
            "hash_ref_count": len([ref for ref in refs if ref.get("fragment")]),
            "hash_failures": hash_failures,
            "result": "pass" if (200 <= res.status < 400 and not hash_failures) else "fail",
        }

    failed_targets = [
        {"target": target, **result}
        for target, result in target_results.items()
        if result["result"] != "pass"
    ]
    report = {
        "run": "qa-production-public-link-integrity",
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "base_url": base_url,
        "inventory": args.inventory,
        "result": "fail" if failed_targets else "pass",
        "summary": {
            "source_routes": len(routes),
            "source_pages_loaded": len(source_pages),
            "source_anchor_links": sum(page["link_count"] for page in source_pages.values()),
            "unique_internal_targets": len(target_results),
            "failed_internal_targets": len(failed_targets),
            "external_links_observed": len(external_links),
            "skipped_links": len(skipped_links),
            "hash_refs": sum(result["hash_ref_count"] for result in target_results.values()),
            "hash_failures": sum(len(result["hash_failures"]) for result in target_results.values()),
        },
        "failed_targets": failed_targets,
        "targets": target_results,
        "external_links_sample": external_links[:100],
        "skipped_links_sample": skipped_links[:100],
        "sources": {
            url: {
                key: value
                for key, value in page.items()
                if key != "parser"
            }
            for url, page in source_pages.items()
        },
    }

    out = Path(args.json_out)
    out.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(
        "PRODUCTION_PUBLIC_LINK_INTEGRITY "
        f"{report['result'].upper()}: "
        f"{report['summary']['unique_internal_targets'] - len(failed_targets)}/"
        f"{report['summary']['unique_internal_targets']} internal targets passed"
    )
    for item in failed_targets:
        print(
            f"FAIL {item['target']}: status={item['status']} "
            f"hash_failures={len(item['hash_failures'])}"
        )
    return 1 if failed_targets else 0


if __name__ == "__main__":
    raise SystemExit(main())
