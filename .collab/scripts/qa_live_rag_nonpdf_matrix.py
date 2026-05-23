#!/usr/bin/env python3
"""Run or plan private live RAG checks for generated non-PDF documents.

The fixtures are the same generated DOCX/PPTX/XLSX/TXT/MD cases used by the
multi-format extractor/API matrices. This harness never accepts or writes LLM
provider keys; actual execution expects the running local backend to already
have normal environment configuration.
"""

from __future__ import annotations

import argparse
import asyncio
import importlib.util
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx

ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT / "backend"
LIVE_HELPER_PATH = ROOT / ".collab/scripts/qa_live_chat_rag_matrix.py"
FIXTURE_PATH = ROOT / ".collab/scripts/qa_multiformat_extraction_matrix.py"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


def load_module(name: str, path: Path) -> Any:
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load module from {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


live_chat = load_module("qa_live_chat_rag_matrix", LIVE_HELPER_PATH)
fixtures = load_module("qa_multiformat_extraction_matrix", FIXTURE_PATH)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--api-base", default="http://127.0.0.1:8000")
    parser.add_argument("--json-out", required=True)
    parser.add_argument("--plan-only", action="store_true")
    parser.add_argument("--case", action="append", help="Run only matching case id. May be repeated.")
    parser.add_argument("--prompt", action="append", help="Run only matching prompt id. May be repeated.")
    parser.add_argument("--mode", default="quick", choices=["quick", "balanced", "thorough"])
    parser.add_argument("--timeout", type=int, default=360)
    parser.add_argument("--poll-interval", type=float, default=3.0)
    parser.add_argument("--allow-blocked", action="store_true")
    parser.add_argument("--keep", action="store_true")
    return parser.parse_args()


def case_id(case: Any) -> str:
    return f"{case.file_type}-{case.name}".replace("_", "-")


def prompt_family(case: Any) -> list[dict[str, Any]]:
    terms = list(case.expected_terms)
    prompt_terms = ", ".join(f"`{term}`" for term in terms[:3])
    prompts: list[dict[str, Any]] = [
        {
            "id": "summary_cited",
            "message": "Summarize this document in 3 bullets. Every bullet must be grounded in the document and include citations.",
            "expect_any": terms,
            "require_citations": True,
        },
        {
            "id": "specific_terms_cited",
            "message": f"What does this document say about {prompt_terms}? Answer only from the document and cite the source.",
            "expect_any": terms,
            "require_citations": True,
        },
        {
            "id": "negative_unanswerable",
            "message": "Does this document provide an internal admin password? If the document does not say, state that it is not provided and do not invent one.",
            "expect_any": [
                "not provided",
                "does not provide",
                "do not provide",
                "not contain",
                "not mention",
                "no mention",
                "not specified",
                "not available",
                "no such information",
                "no admin password",
            ],
            "forbid_any": ["password is", "admin:"],
            "require_citations": False,
        },
        {
            "id": "cross_language_zh",
            "message": "请用中文概括这份非 PDF 文件的核心信息，并引用来源。",
            "expect_any": ["文件", "文档", "表格", "计划", "风险", "收入", "引用"],
            "require_citations": True,
        },
    ]
    if case.expect_table:
        prompts.insert(
            2,
            {
                "id": "table_or_structure_cited",
                "message": "Which table rows, slide fields, spreadsheet values, or structured entries are important in this document? Cite the source.",
                "expect_any": terms,
                "require_citations": True,
            },
        )
    return prompts


def build_cases(args: argparse.Namespace) -> list[dict[str, Any]]:
    selected_cases = set(args.case or [])
    selected_prompts = set(args.prompt or [])
    planned: list[dict[str, Any]] = []
    for fixture_case in fixtures.cases():
        cid = case_id(fixture_case)
        if selected_cases and cid not in selected_cases:
            continue
        prompts = [p for p in prompt_family(fixture_case) if not selected_prompts or p["id"] in selected_prompts]
        planned.append(
            {
                "id": cid,
                "name": fixture_case.name,
                "file_type": fixture_case.file_type,
                "filename": fixture_case.filename,
                "content_type": fixture_case.content_type,
                "bytes": len(fixture_case.data),
                "expected_terms": list(fixture_case.expected_terms),
                "expect_table": bool(fixture_case.expect_table),
                "min_pages": fixture_case.min_pages,
                "fixture": fixture_case,
                "prompts": prompts,
            }
        )
    return planned


async def promote_identity(identity: Any) -> None:
    from app.models.database import AsyncSessionLocal
    from app.models.tables import User

    async with AsyncSessionLocal() as db:
        user = await db.get(User, identity.user_id)
        if user is None:
            raise RuntimeError(f"QA user not found: {identity.user_id}")
        user.plan = "pro"
        user.credits_balance = max(int(user.credits_balance or 0), 20000)
        await db.commit()


def contains_any(text: str, terms: list[str]) -> bool:
    lowered = text.lower()
    return any(term.lower() in lowered for term in terms)


def evaluate_prompt(prompt: dict[str, Any], chat: dict[str, Any], messages: dict[str, Any]) -> dict[str, Any]:
    answer = chat.get("answer") or ""
    citations = chat.get("citations") or []
    done = chat.get("done") or {}
    errors = chat.get("errors") or []
    expect_any = prompt.get("expect_any") or []
    forbid_any = prompt.get("forbid_any") or []
    require_citations = bool(prompt.get("require_citations", True))

    message_items = messages.get("body", {}).get("messages") if isinstance(messages.get("body"), dict) else None
    assistant_messages = [m for m in message_items or [] if m.get("role") == "assistant"] if isinstance(message_items, list) else []
    assistant_citations = assistant_messages[-1].get("citations") if assistant_messages else None

    checks = {
        "stream_http_200": chat.get("status_code") == 200,
        "no_error_event": not errors,
        "done_event_present": bool(done),
        "answer_min_80_chars": len(answer) >= 80,
        "expected_any_present": True if not expect_any else contains_any(answer, expect_any),
        "forbidden_terms_absent": not contains_any(answer, forbid_any),
        "citation_requirement_met": (len(citations) > 0 and int(done.get("citations_count") or 0) > 0) if require_citations else True,
        "citation_shape_valid": all(
            isinstance(c.get("chunk_id"), str)
            and isinstance(c.get("page"), int)
            and isinstance(c.get("text_snippet"), str)
            for c in citations
            if isinstance(c, dict)
        )
        and (bool(citations) if require_citations else True),
        "messages_api_has_assistant": bool(assistant_messages),
        "messages_api_citation_requirement_met": bool(assistant_citations) if require_citations else True,
    }
    blocked_reason = None
    if errors:
        first = errors[0] if isinstance(errors[0], dict) else {}
        if first.get("code") == "LLM_ERROR":
            blocked_reason = first.get("message") or "LLM provider unavailable"

    result = "pass" if all(checks.values()) else "fail"
    if blocked_reason:
        result = "blocked"
    return {
        "result": result,
        "blocked_reason": blocked_reason,
        "quality_score": round(sum(1 for passed in checks.values() if passed) / len(checks), 3),
        "checks": checks,
        "answer_chars": len(answer),
        "citations_count": len(citations),
    }


async def upload_fixture(
    args: argparse.Namespace,
    client: httpx.AsyncClient,
    request_headers: dict[str, str],
    case: dict[str, Any],
) -> tuple[str, list[dict[str, Any]]]:
    fixture_case = case["fixture"]
    steps: list[dict[str, Any]] = []
    upload = await client.post(
        "/api/documents/upload",
        headers=request_headers,
        files={"file": (fixture_case.filename, fixture_case.data, fixture_case.content_type)},
    )
    upload_body = live_chat.safe_json(upload)
    steps.append({"name": "upload_document", "status_code": upload.status_code, "body": upload_body})
    upload.raise_for_status()
    document_id = str(upload_body["document_id"])
    poll = await live_chat.wait_ready(client, document_id, request_headers, args.timeout, args.poll_interval)
    steps.append({"name": "poll_document", **poll})
    if poll["final"].get("status") != "ready":
        raise RuntimeError(f"Document {document_id} ended with status {poll['final'].get('status')}")
    return document_id, steps


async def create_session(client: httpx.AsyncClient, document_id: str, request_headers: dict[str, str]) -> str:
    session_res = await client.post(f"/api/documents/{document_id}/sessions", headers=request_headers)
    session_res.raise_for_status()
    return str(live_chat.safe_json(session_res)["session_id"])


async def run_prompt(
    args: argparse.Namespace,
    client: httpx.AsyncClient,
    request_headers: dict[str, str],
    document_id: str,
    prompt: dict[str, Any],
) -> dict[str, Any]:
    session_id = await create_session(client, document_id, request_headers)
    prompt_args = argparse.Namespace(
        message=prompt["message"],
        mode=args.mode,
        locale="zh" if prompt["id"] == "cross_language_zh" else "en",
        timeout=args.timeout,
    )
    started = time.monotonic()
    chat = await live_chat.stream_chat(prompt_args, client, session_id, request_headers)
    citation_chunks = await live_chat.fetch_citation_chunks(client, chat.get("citations") or [], request_headers)
    messages_res = await client.get(f"/api/sessions/{session_id}/messages", headers=request_headers)
    messages = {
        "status_code": messages_res.status_code,
        "body": live_chat.safe_json(messages_res),
    }
    evaluation = evaluate_prompt(prompt, chat, messages)
    return {
        "id": prompt["id"],
        "message": prompt["message"],
        "session_id": session_id,
        "elapsed_seconds": round(time.monotonic() - started, 3),
        "chat": {
            "status_code": chat.get("status_code"),
            "content_type": chat.get("content_type"),
            "elapsed_seconds": chat.get("elapsed_seconds"),
            "event_counts": chat.get("event_counts"),
            "answer": chat.get("answer"),
            "answer_chars": chat.get("answer_chars"),
            "citations": chat.get("citations"),
            "done": chat.get("done"),
            "errors": chat.get("errors"),
        },
        "citation_chunks": citation_chunks,
        "messages": messages,
        "evaluation": evaluation,
        "result": evaluation["result"],
    }


async def run(args: argparse.Namespace) -> dict[str, Any]:
    cases = build_cases(args)
    plan_cases = [
        {key: value for key, value in case.items() if key != "fixture"}
        for case in cases
    ]
    report: dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "api_base": args.api_base,
        "mode": args.mode,
        "plan": plan_cases,
        "cases": [],
    }
    total_prompts = sum(len(case["prompts"]) for case in cases)
    if args.plan_only:
        report["status"] = "plan_only"
        report["summary"] = {
            "cases_total": len(cases),
            "prompts_total": total_prompts,
            "citation_required_prompts": sum(
                1 for case in cases for prompt in case["prompts"] if prompt["require_citations"]
            ),
            "negative_prompts": sum(1 for case in cases for prompt in case["prompts"] if prompt["id"].startswith("negative")),
            "file_types": sorted({case["file_type"] for case in cases}),
        }
        return report

    identity = None
    try:
        identity = await live_chat.create_qa_identity()
        await promote_identity(identity)
        report["qa_user"] = {"id": str(identity.user_id), "email": identity.email, "plan": "pro"}
        request_headers = live_chat.headers(identity)
        async with httpx.AsyncClient(base_url=args.api_base, timeout=30.0) as client:
            health = await client.get("/health")
            report["health"] = {"status_code": health.status_code, "body": live_chat.safe_json(health)}
            health.raise_for_status()
            for case in cases:
                case_report: dict[str, Any] = {
                    key: value for key, value in case.items() if key not in {"fixture", "prompts"}
                }
                case_report["steps"] = []
                case_report["prompts"] = []
                try:
                    document_id, steps = await upload_fixture(args, client, request_headers, case)
                    case_report["document_id"] = document_id
                    case_report["steps"].extend(steps)
                    for prompt in case["prompts"]:
                        try:
                            prompt_result = await run_prompt(args, client, request_headers, document_id, prompt)
                        except Exception as exc:
                            prompt_result = {
                                "id": prompt["id"],
                                "message": prompt["message"],
                                "result": "fail",
                                "error": f"{type(exc).__name__}: {exc}",
                            }
                        case_report["prompts"].append(prompt_result)
                        print(
                            "CASE {case} PROMPT {prompt}: {result} score={score} chars={chars} citations={citations}".format(
                                case=case["id"],
                                prompt=prompt["id"],
                                result=str(prompt_result.get("result")).upper(),
                                score=(prompt_result.get("evaluation") or {}).get("quality_score"),
                                chars=(prompt_result.get("chat") or {}).get("answer_chars"),
                                citations=(prompt_result.get("evaluation") or {}).get("citations_count"),
                            )
                        )
                except Exception as exc:
                    case_report["error"] = f"{type(exc).__name__}: {exc}"

                failed = [p for p in case_report["prompts"] if p.get("result") == "fail"]
                blocked = [p for p in case_report["prompts"] if p.get("result") == "blocked"]
                case_report["result"] = (
                    "fail"
                    if case_report.get("error") or failed or len(case_report["prompts"]) != len(case["prompts"])
                    else "blocked" if blocked else "pass"
                )
                case_report["summary"] = {
                    "prompts_requested": len(case["prompts"]),
                    "prompts_passed": len([p for p in case_report["prompts"] if p.get("result") == "pass"]),
                    "prompts_failed": len(failed),
                    "prompts_blocked": len(blocked),
                }
                report["cases"].append(case_report)
    finally:
        if args.keep:
            report["cleanup"] = "kept"
        else:
            try:
                report["cleanup"] = await live_chat.delete_qa_identity(identity)
            except Exception as cleanup_exc:
                report["cleanup"] = f"failed: {type(cleanup_exc).__name__}: {cleanup_exc}"

    failures = [case for case in report["cases"] if case.get("result") != "pass"]
    hard_failures = [case for case in report["cases"] if case.get("result") == "fail"]
    blocked_cases = [case for case in report["cases"] if case.get("result") == "blocked"]
    passed_prompts = sum((case.get("summary") or {}).get("prompts_passed", 0) for case in report["cases"])
    blocked_prompts = sum((case.get("summary") or {}).get("prompts_blocked", 0) for case in report["cases"])
    report["status"] = "fail" if hard_failures else "blocked" if blocked_cases else "pass"
    report["summary"] = {
        "cases_total": len(report["cases"]),
        "cases_passed": len(report["cases"]) - len(failures),
        "cases_failed": len(hard_failures),
        "cases_blocked": len(blocked_cases),
        "prompts_total": total_prompts,
        "prompts_passed": passed_prompts,
        "prompts_failed": sum((case.get("summary") or {}).get("prompts_failed", 0) for case in report["cases"]),
        "prompts_blocked": blocked_prompts,
    }
    return report


def main() -> int:
    args = parse_args()
    report = asyncio.run(run(args))
    out = Path(args.json_out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    if report["status"] == "plan_only":
        print(
            "LIVE_RAG_NONPDF PLAN_ONLY: cases={cases_total} prompts={prompts_total} citation_required={citation_required_prompts}".format(
                **report["summary"],
            )
        )
    else:
        print(
            "LIVE_RAG_NONPDF {status}: cases={cases_passed}/{cases_total} prompts={prompts_passed}/{prompts_total}".format(
                status=report["status"].upper(),
                cases_passed=report["summary"].get("cases_passed", 0),
                cases_total=report["summary"].get("cases_total", 0),
                prompts_passed=report["summary"].get("prompts_passed", 0),
                prompts_total=report["summary"].get("prompts_total", 0),
            )
        )
    return 0 if report["status"] in {"pass", "plan_only"} or (report["status"] == "blocked" and args.allow_blocked) else 1


if __name__ == "__main__":
    raise SystemExit(main())
