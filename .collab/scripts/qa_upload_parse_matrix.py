#!/usr/bin/env python3
"""Run upload, validation, and parse matrix checks against local DocTalk."""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import httpx
from jose import jwt

ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


@dataclass(frozen=True)
class PositiveCase:
    name: str
    path: str
    filename: str | None = None
    content_type: str = "application/pdf"
    expected: str = "ready"
    search_query: str | None = None
    require_text_pages: bool = True
    check_sanitized_filename: bool = False


@dataclass(frozen=True)
class NegativeCase:
    name: str
    expected_status: int
    expected_error: str
    path: str | None = None
    filename: str | None = None
    content_type: str = "application/pdf"
    payload: bytes | None = None


POSITIVE_CASES = [
    PositiveCase(
        name="small_english_pdf",
        path="test_inputs/semiconductor.pdf",
        search_query="semiconductor",
    ),
    PositiveCase(
        name="cjk_pdf",
        path="test_inputs/盘中解读.pdf",
    ),
    PositiveCase(
        name="uppercase_extension_cjk_filename",
        path="test_inputs/GS 资金流.PDF",
        content_type="application/octet-stream",
    ),
    PositiveCase(
        name="very_long_mixed_filename",
        path="test_inputs/Anthropic 的数据中心雄心——以及能将其实现的前谷歌高管们——来自 The Information --- Anthropic's Data Center Ambition—and the Ex-Google Execs Who Could Mak.pdf",
    ),
    PositiveCase(
        name="encrypted_permission_edge",
        path="test_inputs/1.Top of Mind_ Europe’s shifting security landscape.pdf",
        expected="ready_or_typed_error",
    ),
    PositiveCase(
        name="dangerous_filename_sanitization",
        path="test_inputs/semiconductor.pdf",
        filename="../../QA:path*with?bad.pdf",
        check_sanitized_filename=True,
    ),
]


NEGATIVE_CASES = [
    NegativeCase(
        name="unsupported_ds_store_fixture",
        path="test_inputs/.DS_Store",
        content_type="application/octet-stream",
        expected_status=400,
        expected_error="UNSUPPORTED_FORMAT",
    ),
    NegativeCase(
        name="unsupported_html_upload_fixture",
        path="test_inputs/ai-report-2026-02-10-en.html",
        content_type="text/html",
        expected_status=400,
        expected_error="UNSUPPORTED_FORMAT",
    ),
    NegativeCase(
        name="invalid_pdf_magic_bytes",
        filename="invalid.pdf",
        content_type="application/pdf",
        payload=b"This is not a PDF.\n",
        expected_status=400,
        expected_error="INVALID_FILE_CONTENT",
    ),
    NegativeCase(
        name="zero_byte_pdf",
        filename="empty.pdf",
        content_type="application/pdf",
        payload=b"",
        expected_status=400,
        expected_error="INVALID_FILE_CONTENT",
    ),
    NegativeCase(
        name="free_large_pdf_limit",
        path="test_inputs/Citrini Research _ Substack.pdf",
        content_type="application/pdf",
        expected_status=400,
        expected_error="FILE_TOO_LARGE",
    ),
    NegativeCase(
        name="free_large_cjk_pdf_limit",
        path="test_inputs/关于四川大学王竹卿一系列违法违规行为.pdf",
        content_type="application/pdf",
        expected_status=400,
        expected_error="FILE_TOO_LARGE",
    ),
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run DocTalk upload/parse QA matrix.")
    parser.add_argument("--api-base", default="http://127.0.0.1:8000")
    parser.add_argument("--timeout", type=int, default=240)
    parser.add_argument("--poll-interval", type=float, default=3.0)
    parser.add_argument("--json-out")
    parser.add_argument("--keep", action="store_true")
    return parser.parse_args()


async def create_user(prefix: str, plan: str) -> dict[str, Any]:
    from app.models.database import AsyncSessionLocal
    from app.services import auth_service

    email = f"qa-upload-{prefix}-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:8]}@example.com"
    async with AsyncSessionLocal() as db:
        user = await auth_service.create_user(db, email=email, name=f"QA upload {prefix}")
        if plan != getattr(user, "plan", "free"):
            user.plan = plan
            await db.commit()
            await db.refresh(user)
        return {"id": user.id, "email": user.email, "plan": user.plan}


async def delete_users(user_ids: list[uuid.UUID]) -> None:
    from sqlalchemy import select

    from app.models.database import AsyncSessionLocal
    from app.models.tables import Document, User
    from app.services.doc_service import doc_service

    async with AsyncSessionLocal() as db:
        for user_id in user_ids:
            doc_ids = (
                await db.scalars(select(Document.id).where(Document.user_id == user_id))
            ).all()
            for document_id in doc_ids:
                await doc_service.delete_document(document_id, db)
            user = await db.get(User, user_id)
            if user is not None:
                await db.delete(user)
        await db.commit()


def token_for(user_id: uuid.UUID) -> str:
    from app.core.config import settings

    if not settings.AUTH_SECRET:
        raise RuntimeError("AUTH_SECRET is required")
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {
            "sub": str(user_id),
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(hours=2)).timestamp()),
        },
        settings.AUTH_SECRET,
        algorithm="HS256",
    )


async def run(args: argparse.Namespace) -> dict[str, Any]:
    pro_user = await create_user("pro", "pro")
    free_user = await create_user("free", "free")
    report: dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "api_base": args.api_base,
        "users": {
            "positive_user": {"id": str(pro_user["id"]), "plan": pro_user["plan"]},
            "negative_user": {"id": str(free_user["id"]), "plan": free_user["plan"]},
        },
        "positive_cases": [],
        "negative_cases": [],
        "cleanup": "pending",
    }
    pro_headers = {"Authorization": f"Bearer {token_for(pro_user['id'])}"}
    free_headers = {"Authorization": f"Bearer {token_for(free_user['id'])}"}

    try:
        async with httpx.AsyncClient(base_url=args.api_base, timeout=60.0) as client:
            health = await client.get("/health")
            report["health"] = {"status_code": health.status_code, "body": safe_json(health)}
            health.raise_for_status()

            for case in POSITIVE_CASES:
                report["positive_cases"].append(
                    await run_positive_case(client, pro_headers, case, args.timeout, args.poll_interval)
                )

            for case in NEGATIVE_CASES:
                report["negative_cases"].append(
                    await run_negative_case(client, free_headers, case)
                )

        all_cases = report["positive_cases"] + report["negative_cases"]
        report["result"] = "pass" if all(c.get("result") == "pass" for c in all_cases) else "fail"
        return report
    except Exception as exc:
        report["result"] = "fail"
        report["error"] = f"{type(exc).__name__}: {exc}"
        raise
    finally:
        if args.keep:
            report["cleanup"] = "kept"
        else:
            try:
                await delete_users([pro_user["id"], free_user["id"]])
                report["cleanup"] = "deleted qa users and owned docs"
            except Exception as cleanup_exc:
                report["cleanup"] = f"failed: {type(cleanup_exc).__name__}: {cleanup_exc}"
        if args.json_out:
            out = Path(args.json_out)
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


async def run_positive_case(
    client: httpx.AsyncClient,
    headers: dict[str, str],
    case: PositiveCase,
    timeout: int,
    poll_interval: float,
) -> dict[str, Any]:
    path = ROOT / case.path
    filename = case.filename or path.name
    data = path.read_bytes()
    started = time.monotonic()
    upload = await upload_bytes(client, headers, filename, data, case.content_type)
    upload_body = safe_json(upload)
    result: dict[str, Any] = {
        "name": case.name,
        "path": case.path,
        "filename_sent": filename,
        "content_type": case.content_type,
        "upload_status": upload.status_code,
        "upload_body": compact_body(upload_body),
    }
    if upload.status_code != 202:
        result["result"] = "fail"
        result["reason"] = "upload did not return 202"
        return result

    document_id = upload_body.get("document_id")
    result["document_id"] = document_id
    final = await poll_terminal(client, document_id, headers, timeout, poll_interval)
    result["polls"] = final["polls"]
    result["final_document"] = compact_doc(final["body"])
    result["elapsed_seconds"] = round(time.monotonic() - started, 3)
    final_status = final["body"].get("status")

    checks = []
    if case.expected == "ready":
        checks.append(("final_status_ready", final_status == "ready"))
    elif case.expected == "ready_or_typed_error":
        error_msg = final["body"].get("error_msg") or ""
        checks.append(("final_status_ready_or_typed_error", final_status == "ready" or (final_status == "error" and error_msg.startswith("ERR_CODE:"))))
    else:
        checks.append((f"unknown_expected_{case.expected}", False))

    if final_status == "ready" and case.require_text_pages:
        text_content = await client.get(f"/api/documents/{document_id}/text-content", headers=headers)
        text_body = safe_json(text_content)
        pages = text_body.get("pages") if isinstance(text_body, dict) else []
        result["text_content"] = {
            "status_code": text_content.status_code,
            "page_count": len(pages or []),
            "first_page_chars": len((pages or [{}])[0].get("text", "")) if pages else 0,
        }
        checks.append(("text_content_pages_present", text_content.status_code == 200 and len(pages or []) > 0))

    if final_status == "ready" and case.search_query:
        search_result = await search_with_retries(
            client,
            headers,
            document_id,
            case.search_query,
            attempts=4,
            delay_seconds=2.0,
        )
        result["search"] = search_result
        if search_result["attempts"] > 1 and search_result["result_count"] > 0:
            result.setdefault("warnings", []).append("search required retry after document status was ready")
        checks.append(("search_result_present", search_result["status_code"] == 200 and search_result["result_count"] > 0))

    if case.check_sanitized_filename:
        final_filename = str(final["body"].get("filename") or "")
        unsafe_chars = set('<>:"|?*\\/')
        checks.append(("filename_sanitized", ".." not in final_filename and not any(ch in unsafe_chars for ch in final_filename)))

    result["checks"] = [{"name": name, "result": "pass" if ok else "fail"} for name, ok in checks]
    result["result"] = "pass" if all(ok for _, ok in checks) else "fail"
    return result


async def run_negative_case(
    client: httpx.AsyncClient,
    headers: dict[str, str],
    case: NegativeCase,
) -> dict[str, Any]:
    if case.payload is not None:
        data = case.payload
        filename = case.filename or "payload.bin"
        path_text = None
    elif case.path is not None:
        path = ROOT / case.path
        data = path.read_bytes()
        filename = case.filename or path.name
        path_text = case.path
    else:
        raise ValueError(f"Negative case {case.name} needs path or payload")

    res = await upload_bytes(client, headers, filename, data, case.content_type)
    body = safe_json(res)
    actual_error = error_code(body)
    return {
        "name": case.name,
        "path": path_text,
        "filename_sent": filename,
        "content_type": case.content_type,
        "expected_status": case.expected_status,
        "actual_status": res.status_code,
        "expected_error": case.expected_error,
        "actual_error": actual_error,
        "result": "pass" if res.status_code == case.expected_status and actual_error == case.expected_error else "fail",
        "body": compact_body(body),
    }


async def upload_bytes(
    client: httpx.AsyncClient,
    headers: dict[str, str],
    filename: str,
    data: bytes,
    content_type: str,
) -> httpx.Response:
    return await client.post(
        "/api/documents/upload",
        headers=headers,
        files={"file": (filename, data, content_type)},
    )


async def search_with_retries(
    client: httpx.AsyncClient,
    headers: dict[str, str],
    document_id: str,
    query: str,
    *,
    attempts: int,
    delay_seconds: float,
) -> dict[str, Any]:
    last_status = 0
    last_results: list[Any] = []
    attempt_summaries = []
    for attempt in range(1, attempts + 1):
        search = await client.post(
            f"/api/documents/{document_id}/search",
            headers=headers,
            json={"query": query, "top_k": 1},
        )
        search_body = safe_json(search)
        results = search_body.get("results") if isinstance(search_body, dict) else []
        last_status = search.status_code
        last_results = list(results or [])
        attempt_summaries.append({
            "attempt": attempt,
            "status_code": search.status_code,
            "result_count": len(last_results),
        })
        if search.status_code == 200 and last_results:
            break
        if attempt < attempts:
            await asyncio.sleep(delay_seconds)
    return {
        "status_code": last_status,
        "query": query,
        "attempts": len(attempt_summaries),
        "attempt_summaries": attempt_summaries,
        "result_count": len(last_results),
        "first": compact_body(last_results[0]) if last_results else None,
    }


async def poll_terminal(
    client: httpx.AsyncClient,
    document_id: str,
    headers: dict[str, str],
    timeout: int,
    poll_interval: float,
) -> dict[str, Any]:
    started = time.monotonic()
    deadline = started + timeout
    polls: list[dict[str, Any]] = []
    while time.monotonic() < deadline:
        res = await client.get(f"/api/documents/{document_id}", headers=headers)
        body = safe_json(res)
        status = body.get("status") if isinstance(body, dict) else None
        polls.append({
            "at_seconds": round(time.monotonic() - started, 3),
            "status_code": res.status_code,
            "status": status,
        })
        res.raise_for_status()
        if status in {"ready", "error"}:
            return {"body": body, "polls": polls}
        await asyncio.sleep(poll_interval)
    raise TimeoutError(f"Document {document_id} did not reach ready/error within {timeout}s")


def error_code(body: Any) -> str | None:
    if not isinstance(body, dict):
        return None
    detail = body.get("detail")
    if isinstance(detail, dict):
        return detail.get("error")
    if isinstance(body.get("error"), str):
        return body["error"]
    return None


def compact_doc(body: dict[str, Any]) -> dict[str, Any]:
    keys = [
        "id",
        "filename",
        "status",
        "page_count",
        "pages_parsed",
        "chunks_total",
        "chunks_indexed",
        "error_msg",
        "file_type",
        "has_converted_pdf",
    ]
    return {k: body.get(k) for k in keys if k in body}


def compact_body(body: Any) -> Any:
    text = json.dumps(body, ensure_ascii=False, default=str)
    if len(text) <= 1200:
        return body
    return {"truncated_json": text[:1200]}


def safe_json(response: httpx.Response) -> Any:
    try:
        return response.json()
    except Exception:
        return {"text": response.text[:1000]}


def main() -> None:
    args = parse_args()
    try:
        report = asyncio.run(run(args))
    except Exception as exc:
        print(f"FAIL: {type(exc).__name__}: {exc}", file=sys.stderr)
        raise SystemExit(1)
    cases = report["positive_cases"] + report["negative_cases"]
    failed = [c["name"] for c in cases if c.get("result") != "pass"]
    if failed:
        print(f"FAIL: {len(failed)} cases failed: {', '.join(failed)}", file=sys.stderr)
        raise SystemExit(1)
    print(f"PASS: {len(cases)} upload/parse cases; cleanup={report['cleanup']}")


if __name__ == "__main__":
    main()
