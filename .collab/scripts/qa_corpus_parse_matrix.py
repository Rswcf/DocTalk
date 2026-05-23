#!/usr/bin/env python3
"""Run broad/full corpus upload and parse checks using test_inputs."""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import httpx
from jose import jwt

ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


BROAD_FILES = [
    "test_inputs/semiconductor.pdf",
    "test_inputs/0206 The Flow Show.pdf",
    "test_inputs/1.Top of Mind_ Europe’s shifting security landscape.pdf",
    "test_inputs/2.China Musings_ Global marketing feedback_ China is back.pdf",
    "test_inputs/4.Alibaba Group (BABA)_ Addressing key debates on Alibaba Cloud capex targets and outlook; Buy.pdf",
    "test_inputs/Global Technology_ Semiconductors - Memory_ Global Memory S_D update and BOM cost analysis_ Expect further tightness across D....pdf",
    "test_inputs/Forecasting the Economic Effects of AI (03-2026).pdf",
    "test_inputs/ssrn-3247865.pdf",
    "test_inputs/Citrini Research _ Substack.pdf",
    "test_inputs/Frontier_AI_Strategic_Outlook.pdf",
    "test_inputs/THE 2028 GLOBAL INTELLIGENCE CRISIS.PDF",
    "test_inputs/GS 资金流.PDF",
    "test_inputs/Goldman's Commodity Desk Lays Out The Oil Price Scenarios From Iran War.PDF",
    "test_inputs/Claude Code 源码架构深度分析.pdf",
    "test_inputs/盘中解读.pdf",
    "test_inputs/【GMF Research】为什么难以回到稀缺准备金框架 兼论Kevin Warsh.pdf",
    "test_inputs/关于四川大学王竹卿一系列违法违规行为.pdf",
    "test_inputs/Frisst KI SaaS? Machtverschiebung von „Software-Tool“ zu „Aufgaben-Ausführung“.pdf",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run DocTalk corpus parse QA matrix.")
    parser.add_argument("--api-base", default="http://127.0.0.1:8000")
    parser.add_argument("--tier", choices=["broad", "full"], default="broad")
    parser.add_argument("--manifest", default=".collab/tasks/qa-corpus-inventory-2026-05-10.json")
    parser.add_argument("--timeout", type=int, default=600)
    parser.add_argument("--poll-interval", type=float, default=5.0)
    parser.add_argument("--json-out")
    parser.add_argument("--keep", action="store_true")
    return parser.parse_args()


async def create_user(prefix: str, plan: str = "pro") -> dict[str, Any]:
    from app.models.database import AsyncSessionLocal
    from app.services import auth_service

    email = f"qa-corpus-{prefix}-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:8]}@example.com"
    async with AsyncSessionLocal() as db:
        user = await auth_service.create_user(db, email=email, name=f"QA corpus {prefix}")
        if plan != getattr(user, "plan", "free"):
            user.plan = plan
            await db.commit()
            await db.refresh(user)
        return {"id": user.id, "email": user.email, "plan": user.plan}


async def delete_user(user_id: uuid.UUID) -> None:
    from sqlalchemy import select

    from app.models.database import AsyncSessionLocal
    from app.models.tables import Document, User
    from app.services.doc_service import doc_service

    async with AsyncSessionLocal() as db:
        doc_ids = (await db.scalars(select(Document.id).where(Document.user_id == user_id))).all()
        for document_id in doc_ids:
            await doc_service.delete_document(document_id, db)
        user = await db.get(User, user_id)
        if user is not None:
            await db.delete(user)
        await db.commit()


async def qa_counts(user_id: uuid.UUID) -> dict[str, int]:
    from sqlalchemy import func, select

    from app.models.database import AsyncSessionLocal
    from app.models.tables import Document, User

    async with AsyncSessionLocal() as db:
        users = await db.scalar(select(func.count()).select_from(User).where(User.id == user_id))
        docs = await db.scalar(select(func.count()).select_from(Document).where(Document.user_id == user_id))
        return {"users": int(users or 0), "documents": int(docs or 0)}


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


def load_cases(args: argparse.Namespace) -> list[dict[str, Any]]:
    manifest = json.loads((ROOT / args.manifest).read_text(encoding="utf-8"))
    items_by_path = {item["path"]: item for item in manifest.get("items", [])}
    if args.tier == "full":
        paths = [
            item["path"]
            for item in manifest.get("items", [])
            if item.get("support_class") == "upload_supported" and item.get("extension") == ".pdf"
        ]
    else:
        paths = BROAD_FILES
    cases = []
    for path in paths:
        item = items_by_path.get(path, {})
        cases.append({
            "path": path,
            "filename": Path(path).name,
            "size_mb": item.get("size_mb"),
            "expected_pages": item.get("pages"),
            "encrypted": item.get("encrypted"),
            "language_hint": item.get("language_hint"),
            "minimum_plan_by_size": item.get("minimum_plan_by_size"),
        })
    return cases


async def run(args: argparse.Namespace) -> dict[str, Any]:
    user = await create_user(args.tier, "pro")
    headers = {"Authorization": f"Bearer {token_for(user['id'])}"}
    cases = load_cases(args)
    report: dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "api_base": args.api_base,
        "tier": args.tier,
        "manifest": args.manifest,
        "user": {"id": str(user["id"]), "plan": user["plan"]},
        "case_count": len(cases),
        "cases": [],
        "cleanup": "pending",
    }
    try:
        async with httpx.AsyncClient(base_url=args.api_base, timeout=180.0) as client:
            health = await client.get("/health")
            report["health"] = {"status_code": health.status_code, "body": safe_json(health)}
            health.raise_for_status()
            for index, case in enumerate(cases, start=1):
                print(f"[{index}/{len(cases)}] {case['filename']}", flush=True)
                report["cases"].append(
                    await run_case(client, headers, case, args.timeout, args.poll_interval)
                )
        failures = [c for c in report["cases"] if c.get("result") == "fail"]
        warnings = [c for c in report["cases"] if c.get("outcome") == "typed_error"]
        report["summary"] = {
            "ready": sum(1 for c in report["cases"] if c.get("outcome") == "ready"),
            "typed_error": len(warnings),
            "failed": len(failures),
            "total_ready_seconds": round(sum(float(c.get("ready_seconds") or 0) for c in report["cases"]), 3),
            "max_ready_seconds": max((float(c.get("ready_seconds") or 0) for c in report["cases"]), default=0),
        }
        report["result"] = "pass" if not failures else "fail"
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
                await delete_user(user["id"])
                report["cleanup"] = "deleted qa user and owned docs"
            except Exception as cleanup_exc:
                report["cleanup"] = f"failed: {type(cleanup_exc).__name__}: {cleanup_exc}"
        report["cleanup_counts"] = await qa_counts(user["id"])
        if args.json_out:
            out = Path(args.json_out)
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


async def run_case(
    client: httpx.AsyncClient,
    headers: dict[str, str],
    case: dict[str, Any],
    timeout: int,
    poll_interval: float,
) -> dict[str, Any]:
    path = ROOT / case["path"]
    started = time.monotonic()
    data = path.read_bytes()
    result: dict[str, Any] = {**case}
    try:
        upload = await client.post(
            "/api/documents/upload",
            headers=headers,
            files={"file": (path.name, data, "application/pdf")},
        )
    except Exception as exc:
        result.update({
            "outcome": "upload_exception",
            "result": "fail",
            "error": f"{type(exc).__name__}: {exc}",
            "elapsed_seconds": round(time.monotonic() - started, 3),
        })
        return result

    upload_body = safe_json(upload)
    result["upload_status"] = upload.status_code
    result["upload_body"] = compact_body(upload_body)
    if upload.status_code != 202:
        result.update({
            "outcome": "upload_failed",
            "result": "fail",
            "elapsed_seconds": round(time.monotonic() - started, 3),
        })
        return result

    document_id = upload_body.get("document_id")
    result["document_id"] = document_id
    final = await poll_terminal(client, document_id, headers, timeout, poll_interval)
    body = final["body"]
    result["polls"] = final["polls"]
    result["final_document"] = compact_doc(body)
    result["elapsed_seconds"] = round(time.monotonic() - started, 3)
    status = body.get("status")
    if status == "ready":
        result["outcome"] = "ready"
        result["result"] = "pass"
        result["ready_seconds"] = result["elapsed_seconds"]
        text = await client.get(f"/api/documents/{document_id}/text-content", headers=headers)
        text_body = safe_json(text)
        pages = text_body.get("pages") if isinstance(text_body, dict) else []
        result["text_content"] = {
            "status_code": text.status_code,
            "page_count": len(pages or []),
            "first_page_chars": len((pages or [{}])[0].get("text", "")) if pages else 0,
        }
        expected_pages = case.get("expected_pages")
        actual_pages = body.get("page_count")
        if expected_pages and actual_pages and int(expected_pages) != int(actual_pages):
            result.setdefault("warnings", []).append(f"page_count_mismatch expected={expected_pages} actual={actual_pages}")
        if text.status_code != 200 or not pages:
            result.setdefault("warnings", []).append("text_content_missing_or_empty")
    elif status == "error" and str(body.get("error_msg") or "").startswith("ERR_CODE:"):
        result["outcome"] = "typed_error"
        result["result"] = "pass"
    else:
        result["outcome"] = status or "unknown"
        result["result"] = "fail"
    return result


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
            "pages_parsed": body.get("pages_parsed") if isinstance(body, dict) else None,
            "chunks_indexed": body.get("chunks_indexed") if isinstance(body, dict) else None,
        })
        res.raise_for_status()
        if status in {"ready", "error"}:
            return {"body": body, "polls": polls}
        await asyncio.sleep(poll_interval)
    return {
        "body": {"status": "timeout", "error_msg": f"Timed out after {timeout}s"},
        "polls": polls,
    }


def compact_doc(body: dict[str, Any]) -> dict[str, Any]:
    keys = ["id", "filename", "status", "page_count", "pages_parsed", "chunks_total", "chunks_indexed", "error_msg", "file_type"]
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
    failed = [c["filename"] for c in report["cases"] if c.get("result") == "fail"]
    if failed:
        print(f"FAIL: {len(failed)} corpus cases failed: {', '.join(failed)}", file=sys.stderr)
        raise SystemExit(1)
    summary = report.get("summary", {})
    print(
        f"PASS: {summary.get('ready', 0)} ready, {summary.get('typed_error', 0)} typed errors; cleanup={report['cleanup']}"
    )


if __name__ == "__main__":
    main()
