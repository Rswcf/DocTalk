#!/usr/bin/env python3
"""Run deterministic URL extractor edge-case QA with a local fixture server."""

from __future__ import annotations

import argparse
import json
import sys
import threading
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Callable
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


PDF_BYTES = (
    b"%PDF-1.4\n"
    b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n"
    b"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n"
    b"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >> endobj\n"
    b"trailer << /Root 1 0 R >>\n%%EOF\n"
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run URL extractor edge matrix.")
    parser.add_argument("--json-out", required=True)
    return parser.parse_args()


class FixtureHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, _fmt: str, *_args: Any) -> None:
        return

    def _send_bytes(self, status: int, body: bytes, content_type: str = "text/html; charset=utf-8") -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _redirect(self, location: str) -> None:
        self.send_response(302)
        self.send_header("Location", location)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path == "/cjk-table":
            body = """
            <!doctype html>
            <html>
              <head>
                <title>Fallback</title>
                <meta property="og:title" content="亚洲市场表格测试">
              </head>
              <body>
                <nav>navigation noise</nav>
                <article>
                  <h1>亚洲市场表格测试</h1>
                  <p>这是一篇用于测试 URL 导入的中文文章，包含芯片、营收和地区增长信息。</p>
                  <table>
                    <thead><tr><th>地区</th><th>FY2026 营收</th></tr></thead>
                    <tbody><tr><td>亚洲 Alpha</td><td>42 亿美元</td></tr></tbody>
                  </table>
                  <h2>Analyst note</h2>
                  <p>The table-heavy section should keep CJK and numeric cells.</p>
                </article>
              </body>
            </html>
            """.encode("utf-8")
            self._send_bytes(200, body)
            return

        if path == "/redirect-once":
            self._redirect("/cjk-table")
            return

        if path == "/redirect-loop-a":
            self._redirect("/redirect-loop-b")
            return

        if path == "/redirect-loop-b":
            self._redirect("/redirect-loop-a")
            return

        if path.startswith("/redirect-chain/"):
            try:
                step = int(path.rsplit("/", 1)[1])
            except ValueError:
                step = 0
            self._redirect(f"/redirect-chain/{step + 1}")
            return

        if path == "/redirect-private":
            self._redirect("http://private.local/metadata")
            return

        if path == "/too-large":
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(10 * 1024 * 1024 + 1))
            self.end_headers()
            return

        if path == "/sample.pdf":
            self._send_bytes(200, PDF_BYTES, "application/pdf")
            return

        if path == "/image-only":
            body = b"""
            <!doctype html>
            <html>
              <head><title>Image Only Landing</title></head>
              <body><main><img src="/chart.png" alt="Quarterly chart"></main></body>
            </html>
            """
            self._send_bytes(200, body)
            return

        self._send_bytes(404, b"not found", "text/plain; charset=utf-8")


def start_server() -> tuple[ThreadingHTTPServer, threading.Thread, int]:
    server = ThreadingHTTPServer(("127.0.0.1", 0), FixtureHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server, thread, int(server.server_address[1])


def patch_validator(port: int) -> Callable[[], None]:
    from app.services.extractors import url_extractor

    original = url_extractor.validate_and_resolve_url

    def fake_validate(url: str) -> tuple[str, str]:
        parsed = urlparse(url)
        if parsed.hostname == "fixture.test" and parsed.port == port:
            return url, "127.0.0.1"
        if parsed.hostname == "private.local":
            raise ValueError("BLOCKED_HOST")
        return original(url)

    url_extractor.validate_and_resolve_url = fake_validate

    def restore() -> None:
        url_extractor.validate_and_resolve_url = original

    return restore


def run_positive_case(name: str, url: str, check: Callable[[str, list[Any], bytes | None], list[str]]) -> dict[str, Any]:
    from app.services.extractors.url_extractor import fetch_and_extract_url

    case: dict[str, Any] = {"name": name, "url": url}
    try:
        title, pages, pdf_bytes = fetch_and_extract_url(url)
        content = "\n\n".join(page.text for page in pages)
        failures = check(title, pages, pdf_bytes)
        case.update(
            {
                "title": title,
                "page_count": len(pages),
                "pdf_bytes": len(pdf_bytes or b""),
                "content_excerpt": content[:500],
                "failures": failures,
                "result": "pass" if not failures else "fail",
            }
        )
    except Exception as exc:
        case.update({"result": "fail", "error": f"{type(exc).__name__}: {exc}"})
    return case


def run_negative_case(name: str, url: str, expected_error: str) -> dict[str, Any]:
    from app.services.extractors.url_extractor import fetch_and_extract_url

    case: dict[str, Any] = {"name": name, "url": url, "expected_error": expected_error}
    try:
        title, pages, pdf_bytes = fetch_and_extract_url(url)
        case.update(
            {
                "result": "fail",
                "actual_error": None,
                "unexpected_title": title,
                "unexpected_page_count": len(pages),
                "unexpected_pdf_bytes": len(pdf_bytes or b""),
            }
        )
    except ValueError as exc:
        actual = str(exc)
        case.update(
            {
                "actual_error": actual,
                "result": "pass" if actual == expected_error else "fail",
            }
        )
    except Exception as exc:
        case.update({"result": "fail", "actual_error": f"{type(exc).__name__}: {exc}"})
    return case


def check_cjk_table(title: str, pages: list[Any], pdf_bytes: bytes | None) -> list[str]:
    content = "\n\n".join(page.text for page in pages)
    failures = []
    if title != "亚洲市场表格测试":
        failures.append(f"title mismatch: {title!r}")
    for term in ("中文文章", "芯片", "FY2026 营收", "亚洲 Alpha", "42 亿美元", "Analyst note"):
        if term not in content:
            failures.append(f"missing term: {term}")
    if "navigation noise" in content:
        failures.append("boilerplate nav text leaked into extraction")
    if pdf_bytes is not None:
        failures.append("expected html extraction, got pdf bytes")
    return failures


def check_pdf(title: str, pages: list[Any], pdf_bytes: bytes | None) -> list[str]:
    failures = []
    if title != "sample.pdf":
        failures.append(f"title mismatch: {title!r}")
    if pages:
        failures.append(f"expected no text pages for pdf, got {len(pages)}")
    if not pdf_bytes or not pdf_bytes.startswith(b"%PDF"):
        failures.append("missing PDF bytes")
    return failures


def main() -> None:
    args = parse_args()
    server, thread, port = start_server()
    restore = patch_validator(port)
    base = f"http://fixture.test:{port}"
    report: dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "fixture_base": base,
        "positive_cases": [],
        "negative_cases": [],
    }

    try:
        report["positive_cases"].append(run_positive_case("cjk_table_html", f"{base}/cjk-table", check_cjk_table))
        report["positive_cases"].append(run_positive_case("single_safe_redirect", f"{base}/redirect-once", check_cjk_table))
        report["positive_cases"].append(run_positive_case("pdf_url", f"{base}/sample.pdf", check_pdf))
        report["negative_cases"].append(run_negative_case("redirect_loop", f"{base}/redirect-loop-a", "REDIRECT_LOOP"))
        report["negative_cases"].append(run_negative_case("too_many_redirects", f"{base}/redirect-chain/0", "TOO_MANY_REDIRECTS"))
        report["negative_cases"].append(run_negative_case("huge_content_length", f"{base}/too-large", "URL_CONTENT_TOO_LARGE"))
        report["negative_cases"].append(run_negative_case("image_only_no_text", f"{base}/image-only", "NO_TEXT_CONTENT"))
        report["negative_cases"].append(run_negative_case("redirect_to_private_host", f"{base}/redirect-private", "BLOCKED_HOST"))
    finally:
        restore()
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)

    all_cases = report["positive_cases"] + report["negative_cases"]
    report["summary"] = {
        "total": len(all_cases),
        "passed": sum(1 for case in all_cases if case.get("result") == "pass"),
        "failed": sum(1 for case in all_cases if case.get("result") != "pass"),
    }
    report["result"] = "pass" if report["summary"]["failed"] == 0 else "fail"

    out = Path(args.json_out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    if report["result"] != "pass":
        print(f"FAIL: url edge matrix failures={report['summary']['failed']}; wrote {out}", file=sys.stderr)
        raise SystemExit(1)
    print(f"PASS: url edge matrix cases={report['summary']['total']}; wrote {out}")


if __name__ == "__main__":
    main()
