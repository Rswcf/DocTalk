#!/usr/bin/env python3
"""Production smoke for public demo document reader and retrieval surfaces."""

from __future__ import annotations

import argparse
import json
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any

BACKEND = "https://backend-production-a62e.up.railway.app"

PREFERRED_DEMO_SLUGS = {
    "alphabet-earnings": {
        "query": "revenue",
        "terms": ["Alphabet", "revenues"],
    },
    "attention-paper": {
        "query": "attention",
        "terms": ["attention"],
    },
    "court-filing": {
        "query": "court",
        "terms": ["Court"],
    },
}


@dataclass
class Response:
    status: int
    headers: dict[str, str]
    body: bytes
    elapsed_ms: int
    url: str


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
            final_url = resp.url
    except urllib.error.HTTPError as exc:
        data = exc.read()
        status = exc.code
        response_headers = {key.lower(): value for key, value in exc.headers.items()}
        final_url = url
    return Response(
        status=status,
        headers=response_headers,
        body=data,
        elapsed_ms=int((time.monotonic() - started) * 1000),
        url=final_url,
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
        "STRIPE_SECRET_KEY",
        "AUTH_SECRET",
        "ADAPTER_SECRET",
        "sk_live",
        "sk_test",
        "postgres://",
        "redis://",
        "BEGIN PRIVATE KEY",
    ]
    return [marker for marker in markers if marker in text]


def compact(value: Any, limit: int = 1200) -> Any:
    text = json.dumps(value, ensure_ascii=False, default=str)
    if len(text) <= limit:
        return value
    return text[:limit] + "..."


class Recorder:
    def __init__(self, backend: str) -> None:
        self.backend = backend.rstrip("/")
        self.checks: list[dict[str, Any]] = []

    def record(
        self,
        *,
        group: str,
        name: str,
        method: str,
        path_or_url: str,
        response: Response,
        expected_status: list[int],
        failures: list[str] | None = None,
        body_json: Any = None,
    ) -> None:
        text = response.body.decode("utf-8", errors="replace")
        leaks = sensitive_markers(text)
        assertion_failures = failures or []
        self.checks.append(
            {
                "group": group,
                "name": name,
                "method": method,
                "path_or_url": path_or_url,
                "expected_status": expected_status,
                "status": response.status,
                "elapsed_ms": response.elapsed_ms,
                "content_type": response.headers.get("content-type"),
                "body_json": compact(body_json if body_json is not None else safe_json(response.body)),
                "body_preview": text[:320],
                "sensitive_markers": leaks,
                "assertion_failures": assertion_failures,
                "result": "pass" if response.status in expected_status and not leaks and not assertion_failures else "fail",
            }
        )

    def get_json(self, path: str, *, group: str, name: str) -> Any:
        response = request(self.backend + path, headers={"accept": "application/json"})
        parsed = safe_json(response.body)
        failures = [] if parsed is not None else ["response was not JSON"]
        self.record(
            group=group,
            name=name,
            method="GET",
            path_or_url=path,
            response=response,
            expected_status=[200],
            failures=failures,
            body_json=parsed,
        )
        return parsed

    def post_json(self, path: str, payload: dict[str, Any], *, group: str, name: str) -> Any:
        response = request(
            self.backend + path,
            method="POST",
            body=json.dumps(payload).encode("utf-8"),
            headers={"accept": "application/json", "content-type": "application/json"},
        )
        parsed = safe_json(response.body)
        failures = [] if parsed is not None else ["response was not JSON"]
        self.record(
            group=group,
            name=name,
            method="POST",
            path_or_url=path,
            response=response,
            expected_status=[200],
            failures=failures,
            body_json=parsed,
        )
        return parsed


def choose_demo(demos: Any) -> tuple[dict[str, Any] | None, dict[str, Any]]:
    if not isinstance(demos, list):
        return None, {"query": "document", "terms": []}
    ready = [demo for demo in demos if isinstance(demo, dict) and demo.get("status") == "ready"]
    for slug, search_spec in PREFERRED_DEMO_SLUGS.items():
        for demo in ready:
            if demo.get("slug") == slug:
                return demo, search_spec
    if ready:
        return ready[0], {"query": ready[0].get("filename", "document").split()[0], "terms": []}
    return None, {"query": "document", "terms": []}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--backend", default=BACKEND)
    parser.add_argument("--json-out", required=True)
    args = parser.parse_args()

    recorder = Recorder(args.backend)
    demos = recorder.get_json("/api/documents/demo", group="demo_catalog", name="demo_list_public_ready")
    catalog_failures: list[str] = []
    if not isinstance(demos, list) or not demos:
        catalog_failures.append("demo catalog was empty")
    elif not any(isinstance(item, dict) and item.get("status") == "ready" for item in demos):
        catalog_failures.append("demo catalog had no ready documents")
    recorder.checks[-1]["assertion_failures"].extend(catalog_failures)
    if catalog_failures:
        recorder.checks[-1]["result"] = "fail"

    selected, search_spec = choose_demo(demos)
    if selected is None:
        report = build_report(args.backend, recorder.checks, selected=None)
        write_report(args.json_out, report)
        print("PRODUCTION_DEMO_DOCUMENT_READ_SURFACES FAIL: no ready demo document")
        return 1

    document_id = selected["document_id"]
    detail = recorder.get_json(
        f"/api/documents/{document_id}",
        group="document_reader_api",
        name="demo_document_detail_ready",
    )
    detail_failures: list[str] = []
    if not isinstance(detail, dict):
        detail_failures.append("detail response was not an object")
    else:
        if detail.get("id") != document_id:
            detail_failures.append("detail id did not match catalog document_id")
        if detail.get("status") != "ready":
            detail_failures.append(f"detail status was {detail.get('status')!r}")
        if detail.get("is_demo") is not True:
            detail_failures.append("detail did not mark document as demo")
        if int(detail.get("chunks_indexed") or 0) <= 0:
            detail_failures.append("detail chunks_indexed was not positive")
        if int(detail.get("pages_parsed") or 0) <= 0:
            detail_failures.append("detail pages_parsed was not positive")
    recorder.checks[-1]["assertion_failures"].extend(detail_failures)
    if detail_failures:
        recorder.checks[-1]["result"] = "fail"

    file_url = recorder.get_json(
        f"/api/documents/{document_id}/file-url",
        group="document_reader_api",
        name="demo_document_file_url_presigned",
    )
    file_failures: list[str] = []
    presigned_url = file_url.get("url") if isinstance(file_url, dict) else None
    if not isinstance(presigned_url, str) or not presigned_url.startswith(("http://", "https://")):
        file_failures.append("file-url response did not include an HTTP URL")
    if isinstance(file_url, dict) and int(file_url.get("expires_in") or 0) <= 0:
        file_failures.append("file-url expires_in was not positive")
    recorder.checks[-1]["assertion_failures"].extend(file_failures)
    if file_failures:
        recorder.checks[-1]["result"] = "fail"

    if isinstance(presigned_url, str):
        pdf_response = request(presigned_url, headers={"range": "bytes=0-15"}, timeout=25)
        pdf_failures: list[str] = []
        if not pdf_response.body.startswith(b"%PDF"):
            pdf_failures.append("presigned URL did not return PDF bytes prefix")
        recorder.record(
            group="document_reader_api",
            name="demo_document_presigned_url_fetches_pdf_prefix",
            method="GET",
            path_or_url="presigned-file-url-range",
            response=pdf_response,
            expected_status=[200, 206],
            failures=pdf_failures,
            body_json={"bytes_preview": pdf_response.body[:16].decode("latin-1", errors="replace")},
        )

    brief = recorder.get_json(
        f"/api/documents/{document_id}/brief",
        group="document_reader_api",
        name="demo_document_brief_surface",
    )
    brief_failures: list[str] = []
    if not isinstance(brief, dict):
        brief_failures.append("brief response was not an object")
    elif brief.get("status") not in {"ready", "pending", "empty", "failed"}:
        brief_failures.append(f"unexpected brief status {brief.get('status')!r}")
    recorder.checks[-1]["assertion_failures"].extend(brief_failures)
    if brief_failures:
        recorder.checks[-1]["result"] = "fail"

    text_content = recorder.get_json(
        f"/api/documents/{document_id}/text-content",
        group="document_reader_api",
        name="demo_document_text_content_surface",
    )
    text_failures: list[str] = []
    pages = text_content.get("pages") if isinstance(text_content, dict) else None
    if not isinstance(pages, list) or not pages:
        text_failures.append("text-content pages were empty")
    else:
        combined = "\n".join(str(page.get("text", "")) for page in pages[:5] if isinstance(page, dict))
        for term in search_spec["terms"]:
            if term.lower() not in combined.lower() and term.lower() not in json.dumps(pages[:10]).lower():
                text_failures.append(f"text-content missing expected term {term!r}")
    recorder.checks[-1]["assertion_failures"].extend(text_failures)
    if text_failures:
        recorder.checks[-1]["result"] = "fail"

    search = recorder.post_json(
        f"/api/documents/{document_id}/search",
        {"query": search_spec["query"], "top_k": 3},
        group="retrieval_api",
        name="demo_document_search_returns_citation_candidates",
    )
    search_failures: list[str] = []
    results = search.get("results") if isinstance(search, dict) else None
    if not isinstance(results, list) or not results:
        search_failures.append("search returned no results")
    else:
        first = results[0]
        if not isinstance(first, dict):
            search_failures.append("first search result was not an object")
        else:
            for key in ("chunk_id", "text", "page", "score"):
                if key not in first:
                    search_failures.append(f"first search result missing {key}")
    recorder.checks[-1]["assertion_failures"].extend(search_failures)
    if search_failures:
        recorder.checks[-1]["result"] = "fail"

    first_chunk_id = None
    if isinstance(results, list) and results and isinstance(results[0], dict):
        first_chunk_id = results[0].get("chunk_id")
    if isinstance(first_chunk_id, str):
        chunk = recorder.get_json(
            f"/api/chunks/{first_chunk_id}",
            group="retrieval_api",
            name="demo_document_chunk_detail_returns_source_text",
        )
        chunk_failures: list[str] = []
        if not isinstance(chunk, dict):
            chunk_failures.append("chunk response was not an object")
        else:
            if chunk.get("chunk_id") != first_chunk_id:
                chunk_failures.append("chunk_id did not match search result")
            if not chunk.get("text"):
                chunk_failures.append("chunk text was empty")
            if not isinstance(chunk.get("bboxes"), list):
                chunk_failures.append("chunk bboxes was not a list")
        recorder.checks[-1]["assertion_failures"].extend(chunk_failures)
        if chunk_failures:
            recorder.checks[-1]["result"] = "fail"

    report = build_report(args.backend, recorder.checks, selected=selected)
    write_report(args.json_out, report)
    print(
        "PRODUCTION_DEMO_DOCUMENT_READ_SURFACES "
        f"{report['result'].upper()}: {report['summary']['passed']}/{report['summary']['total']}"
    )
    return 1 if report["summary"]["failed"] else 0


def build_report(backend: str, checks: list[dict[str, Any]], *, selected: dict[str, Any] | None) -> dict[str, Any]:
    failed = [check for check in checks if check["result"] != "pass"]
    return {
        "run": "qa-production-demo-document-read-surfaces",
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "backend": backend,
        "selected_demo": selected,
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


def write_report(path: str, report: dict[str, Any]) -> None:
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2, ensure_ascii=False)
        fh.write("\n")


if __name__ == "__main__":
    raise SystemExit(main())
