#!/usr/bin/env python3
"""Run a retrieval-focused prompt matrix over representative test_inputs PDFs.

This is a no-LLM quality slice: it verifies upload -> parse -> indexed chunks ->
search/citation-candidate retrieval for user-style prompt families. It is meant
to complement live RAG runs when provider keys are unavailable or too costly for
full-corpus execution.
"""

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


CASES: list[dict[str, Any]] = [
    {
        "id": "semiconductor-small-en",
        "file": "test_inputs/semiconductor.pdf",
        "timeout": 240,
        "queries": [
            {
                "id": "summary_topic",
                "query": "main semiconductor topic",
                "expect_any": ["semiconductor"],
            },
            {
                "id": "specific_deepseek",
                "query": "Deepseek implication on semiconductor",
                "expect_any": ["deepseek", "semiconductor"],
            },
            {
                "id": "negative_home_address",
                "query": "CEO home address",
                "allow_zero": True,
                "expect_any": [],
            },
        ],
    },
    {
        "id": "pan-zh-market",
        "file": "test_inputs/盘中解读.pdf",
        "timeout": 300,
        "queries": [
            {
                "id": "market_topic",
                "query": "市场 投资 主题",
                "expect_any": ["市场", "投资"],
            },
            {
                "id": "cjk_summary_terms",
                "query": "盘中 解读 市场",
                "expect_any": ["盘中", "市场"],
            },
            {
                "id": "negative_home_address",
                "query": "作者 家庭住址",
                "allow_zero": True,
                "expect_any": [],
            },
        ],
    },
    {
        "id": "memory-mania-en",
        "file": "test_inputs/Memory Mania_ How a Once-in-Four-Decades Shortage Is Fueling a Memory Boom.pdf",
        "timeout": 360,
        "queries": [
            {
                "id": "memory_market_thesis",
                "query": "memory market shortage boom thesis",
                "expect_any": ["memory", "shortage"],
            },
            {
                "id": "cycle_timeframe",
                "query": "once in four decades shortage",
                "expect_any": ["decades", "shortage", "memory"],
            },
            {
                "id": "supply_demand",
                "query": "supply demand memory",
                "expect_any": ["supply", "demand", "memory"],
            },
        ],
    },
    {
        "id": "ssrn-long-academic",
        "file": "test_inputs/ssrn-3247865.pdf",
        "timeout": 420,
        "queries": [
            {
                "id": "academic_subject",
                "query": "central argument quantitative trading strategy",
                "expect_any": ["trading", "strategy"],
            },
            {
                "id": "paper_method",
                "query": "trading strategies performance",
                "expect_any": ["trading", "strategies", "performance"],
            },
            {
                "id": "negative_home_address",
                "query": "author home address",
                "allow_zero": True,
                "expect_any": [],
            },
        ],
    },
    {
        "id": "ai-nuclear-energy",
        "file": "test_inputs/AI for nuclear energy Powering an intelligent, resilient future - Microsoft Industry Blogs.pdf",
        "timeout": 360,
        "queries": [
            {
                "id": "ai_nuclear_topic",
                "query": "AI for nuclear energy resilient future",
                "expect_any": ["nuclear", "energy", "AI"],
            },
            {
                "id": "operations_use_case",
                "query": "nuclear operations artificial intelligence",
                "expect_any": ["nuclear", "operations", "intelligence"],
            },
            {
                "id": "safety_reliability",
                "query": "safety reliability nuclear AI",
                "expect_any": ["safety", "reliability", "nuclear", "AI"],
            },
        ],
    },
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--api-base", default="http://127.0.0.1:8000")
    parser.add_argument("--json-out", required=True)
    parser.add_argument("--case", action="append", help="Run only matching case id. May be repeated.")
    parser.add_argument("--query", action="append", help="Run only matching query id. May be repeated.")
    parser.add_argument("--top-k", type=int, default=3)
    parser.add_argument("--poll-interval", type=float, default=3.0)
    parser.add_argument("--keep", action="store_true")
    return parser.parse_args()


async def create_user() -> dict[str, Any]:
    from app.models.database import AsyncSessionLocal
    from app.services import auth_service

    email = f"qa-retrieval-prompt-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:8]}@example.com"
    async with AsyncSessionLocal() as db:
        user = await auth_service.create_user(db, email=email, name="QA retrieval prompt")
        user.plan = "pro"
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


async def run(args: argparse.Namespace) -> dict[str, Any]:
    selected_cases = set(args.case or [])
    cases = [case for case in CASES if not selected_cases or case["id"] in selected_cases]
    user = await create_user()
    headers = {"Authorization": f"Bearer {token_for(user['id'])}"}
    report: dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "api_base": args.api_base,
        "top_k": args.top_k,
        "user": {"id": str(user["id"]), "plan": user["plan"]},
        "cases_requested": [case["id"] for case in cases],
        "cases": [],
        "cleanup": "pending",
    }
    try:
        async with httpx.AsyncClient(base_url=args.api_base, timeout=90.0) as client:
            health = await client.get("/health")
            report["health"] = {"status_code": health.status_code, "body": safe_json(health)}
            health.raise_for_status()
            for case in cases:
                report["cases"].append(await run_case(args, client, headers, case))

        failures = [
            query
            for case in report["cases"]
            for query in case.get("queries", [])
            if query.get("result") != "pass"
        ]
        report["summary"] = {
            "cases_total": len(report["cases"]),
            "queries_total": sum(len(case.get("queries", [])) for case in report["cases"]),
            "queries_passed": sum(
                1
                for case in report["cases"]
                for query in case.get("queries", [])
                if query.get("result") == "pass"
            ),
            "queries_failed": len(failures),
        }
        report["result"] = "pass" if not failures else "fail"
        return report
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
    args: argparse.Namespace,
    client: httpx.AsyncClient,
    headers: dict[str, str],
    case: dict[str, Any],
) -> dict[str, Any]:
    path = ROOT / case["file"]
    started = time.monotonic()
    upload = await client.post(
        "/api/documents/upload",
        headers=headers,
        files={"file": (path.name, path.read_bytes(), "application/pdf")},
    )
    upload_body = safe_json(upload)
    result: dict[str, Any] = {
        "id": case["id"],
        "file": case["file"],
        "upload_status": upload.status_code,
        "upload_body": compact_body(upload_body),
        "queries": [],
    }
    if upload.status_code != 202:
        result["result"] = "fail"
        result["reason"] = "upload did not return 202"
        return result

    document_id = upload_body.get("document_id")
    result["document_id"] = document_id
    ready = await poll_ready(
        client,
        headers,
        document_id,
        timeout=int(case.get("timeout") or 300),
        poll_interval=args.poll_interval,
    )
    result["polls"] = ready["polls"]
    result["final_document"] = compact_doc(ready["body"])
    if ready["body"].get("status") != "ready":
        result["result"] = "fail"
        result["reason"] = "document did not reach ready"
        return result

    selected_queries = set(args.query or [])
    queries = [query for query in case["queries"] if not selected_queries or query["id"] in selected_queries]
    for query in queries:
        query_result = await run_query(client, headers, document_id, query, args.top_k)
        result["queries"].append(query_result)
        print(
            "CASE {case} QUERY {query}: {result} hits={hits} expected={expected}".format(
                case=case["id"],
                query=query["id"],
                result=query_result["result"].upper(),
                hits=query_result["result_count"],
                expected=query_result["checks"]["expected_terms_present"],
            ),
            flush=True,
        )
    result["elapsed_seconds"] = round(time.monotonic() - started, 3)
    result["result"] = "pass" if all(query["result"] == "pass" for query in result["queries"]) else "fail"
    return result


async def run_query(
    client: httpx.AsyncClient,
    headers: dict[str, str],
    document_id: str,
    query: dict[str, Any],
    top_k: int,
) -> dict[str, Any]:
    res = await client.post(
        f"/api/documents/{document_id}/search",
        headers=headers,
        json={"query": query["query"], "top_k": top_k},
    )
    body = safe_json(res)
    results = body.get("results") if isinstance(body, dict) else []
    result_items = list(results or [])
    combined_text = "\n".join(str(item.get("text") or "") for item in result_items if isinstance(item, dict))
    expect_any = query.get("expect_any") or []
    allow_zero = bool(query.get("allow_zero"))
    checks = {
        "status_200": res.status_code == 200,
        "result_count_expected": True if allow_zero else len(result_items) > 0,
        "expected_terms_present": True if not expect_any else contains_any(combined_text, expect_any),
        "citation_candidate_shape": all(
            isinstance(item.get("chunk_id"), str)
            and isinstance(item.get("page"), int)
            and isinstance(item.get("text"), str)
            for item in result_items
            if isinstance(item, dict)
        )
        and (True if allow_zero and not result_items else bool(result_items)),
    }
    return {
        "id": query["id"],
        "query": query["query"],
        "allow_zero": allow_zero,
        "expect_any": expect_any,
        "status_code": res.status_code,
        "result_count": len(result_items),
        "checks": checks,
        "top_results": [compact_search_result(item) for item in result_items[:top_k]],
        "result": "pass" if all(checks.values()) else "fail",
    }


async def poll_ready(
    client: httpx.AsyncClient,
    headers: dict[str, str],
    document_id: str,
    timeout: int,
    poll_interval: float,
) -> dict[str, Any]:
    started = time.monotonic()
    deadline = started + timeout
    polls: list[dict[str, Any]] = []
    while time.monotonic() < deadline:
        res = await client.get(f"/api/documents/{document_id}", headers=headers)
        body = safe_json(res)
        polls.append(
            {
                "at_seconds": round(time.monotonic() - started, 3),
                "status_code": res.status_code,
                "status": body.get("status") if isinstance(body, dict) else None,
                "chunks_indexed": body.get("chunks_indexed") if isinstance(body, dict) else None,
            }
        )
        res.raise_for_status()
        if body.get("status") in {"ready", "error"}:
            return {"body": body, "polls": polls}
        await asyncio.sleep(poll_interval)
    raise TimeoutError(f"Document {document_id} did not reach ready/error within {timeout}s")


def contains_any(text: str, terms: list[str]) -> bool:
    lowered = text.lower()
    return any(term.lower() in lowered for term in terms)


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
    ]
    return {key: body.get(key) for key in keys if key in body}


def compact_search_result(item: Any) -> dict[str, Any]:
    if not isinstance(item, dict):
        return {"raw": item}
    return {
        "chunk_id": item.get("chunk_id"),
        "page": item.get("page"),
        "score": item.get("score"),
        "text_preview": str(item.get("text") or "")[:360],
        "bboxes_count": len(item.get("bboxes") or []),
    }


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
    summary = report.get("summary") or {}
    print(
        "RETRIEVAL_PROMPT_MATRIX {result}: cases={cases} queries={passed}/{total} cleanup={cleanup}".format(
            result=report.get("result", "fail").upper(),
            cases=summary.get("cases_total"),
            passed=summary.get("queries_passed"),
            total=summary.get("queries_total"),
            cleanup=report.get("cleanup"),
        )
    )
    if report.get("result") != "pass":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
