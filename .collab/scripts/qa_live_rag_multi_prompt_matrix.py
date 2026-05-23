#!/usr/bin/env python3
"""Run a multi-prompt private live RAG quality matrix against local DocTalk.

The harness uses the existing live chat helpers, but uploads each document once
and then creates one independent session per prompt. It never accepts or writes
LLM provider keys; the running backend is expected to have normal environment
configuration.
"""

from __future__ import annotations

import argparse
import asyncio
import importlib.util
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx

ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT / "backend"
HELPER_PATH = ROOT / ".collab/scripts/qa_live_chat_rag_matrix.py"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

spec = importlib.util.spec_from_file_location("qa_live_chat_rag_matrix", HELPER_PATH)
if spec is None or spec.loader is None:
    raise RuntimeError(f"Cannot load helper module from {HELPER_PATH}")
live_chat = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = live_chat
spec.loader.exec_module(live_chat)


CASES: list[dict[str, Any]] = [
    {
        "id": "semiconductor-small-en",
        "file": "test_inputs/semiconductor.pdf",
        "locale": "en",
        "timeout": 300,
        "prompts": [
            {
                "id": "summary_cited",
                "message": "Summarize the document in 4 bullets. Every bullet should be grounded in the document and include citations.",
                "expect_terms": ["semiconductor"],
                "require_citations": True,
            },
            {
                "id": "specific_fact",
                "message": "What semiconductor-related business or market topic does the document discuss? Answer concisely and cite the source.",
                "expect_terms": ["semiconductor"],
                "require_citations": True,
            },
            {
                "id": "negative_unanswerable",
                "message": "Does this document provide an internal admin password? If the document does not say, state that it is not provided and do not invent one.",
                "expect_terms": [],
                "expect_any": ["not provided", "does not provide", "do not provide", "not mention", "not specified", "not available", "no admin password"],
                "forbid_any": ["password is", "admin:"],
                "require_citations": False,
            },
        ],
    },
    {
        "id": "pan-zh-market",
        "file": "test_inputs/盘中解读.pdf",
        "locale": "zh",
        "timeout": 360,
        "prompts": [
            {
                "id": "summary_zh_cited",
                "message": "请用中文用 4 个要点总结这份文件，并给出引用。",
                "expect_terms": ["市场"],
                "expect_any": ["引用", "来源", "市场"],
                "require_citations": True,
            },
            {
                "id": "specific_market",
                "message": "这份文件提到哪些市场、行业或投资主题？请只基于文件回答并引用来源。",
                "expect_terms": ["市场"],
                "require_citations": True,
            },
            {
                "id": "negative_unanswerable_zh",
                "message": "这份文件是否提供内部管理员密码？如果没有，请明确说文件没有提供，不要编造。",
                "expect_terms": [],
                "expect_any": ["没有提供", "未提供", "未提及", "没有提到", "没有管理员密码"],
                "forbid_any": ["密码是", "admin:"],
                "require_citations": False,
            },
        ],
    },
    {
        "id": "memory-mania-en",
        "file": "test_inputs/Memory Mania_ How a Once-in-Four-Decades Shortage Is Fueling a Memory Boom.pdf",
        "locale": "en",
        "timeout": 420,
        "prompts": [
            {
                "id": "summary_cited",
                "message": "Summarize the core memory-market thesis in 5 bullets with citations.",
                "expect_terms": ["memory"],
                "require_citations": True,
            },
            {
                "id": "numerical_or_timeframe",
                "message": "What timeframe, shortage description, or market-cycle claim does the document make? Preserve any numbers or time periods and cite the source.",
                "expect_terms": ["memory"],
                "expect_any": ["shortage", "cycle", "timeframe", "period", "year"],
                "require_citations": True,
            },
            {
                "id": "cross_language_zh",
                "message": "请用中文总结这份英文文件关于 memory market 的核心观点，并引用来源。",
                "expect_terms": ["memory"],
                "expect_any": ["存储", "内存", "记忆体", "memory"],
                "require_citations": True,
            },
        ],
    },
]


def slugify(value: str) -> str:
    stem = Path(value).stem.lower()
    stem = re.sub(r"[^a-z0-9\u3400-\u9fff]+", "-", stem).strip("-")
    return stem[:80] or "document"


def generic_prompt_family(locale: str, pages: int | None) -> list[dict[str, Any]]:
    is_cjk = locale == "zh"
    prompts: list[dict[str, Any]] = []
    if is_cjk:
        prompts.extend([
            {
                "id": "summary_cited",
                "message": "请用中文用 4 个要点总结这份文件。每个要点都必须基于文件内容，并给出引用。",
                "expect_any": ["引用", "来源", "文件"],
                "require_citations": True,
            },
            {
                "id": "specific_topic",
                "message": "这份文件的核心主题、涉及的组织或市场是什么？请只基于文件回答并引用来源。",
                "expect_any": ["文件", "提到", "主题", "市场", "公司"],
                "require_citations": True,
            },
            {
                "id": "negative_unanswerable",
                "message": "这份文件是否提供内部管理员密码？如果没有，请明确说文件没有提供，不要编造。",
                "expect_any": ["没有提供", "未提供", "未提及", "没有提到", "文件没有", "没有管理员密码"],
                "forbid_any": ["密码是", "admin:"],
                "require_citations": False,
            },
        ])
    else:
        prompts.extend([
            {
                "id": "summary_cited",
                "message": "Summarize this document in 4 bullets. Every bullet must be grounded in the document and include citations.",
                "expect_any": ["document", "report", "paper", "company", "market", "analysis"],
                "require_citations": True,
            },
            {
                "id": "specific_topic",
                "message": "What are the document's main subject, organizations, markets, or products? Answer only from the document and cite the source.",
                "expect_any": ["document", "report", "market", "company", "AI", "analysis"],
                "require_citations": True,
            },
            {
                "id": "negative_unanswerable",
                "message": "Does this document provide an internal admin password? If the document does not say, state that it is not provided and do not invent one.",
                "expect_any": ["not provided", "does not provide", "do not provide", "not mention", "not specified", "not available", "no admin password"],
                "forbid_any": ["password is", "admin:"],
                "require_citations": False,
            },
        ])

    if pages is None or pages >= 2:
        if is_cjk:
            prompts.insert(2, {
                "id": "numbers_dates_cited",
                "message": "请直接在聊天中列出文件中重要的数字、日期、金额或时间段，并逐条给出引用。若文件没有相关信息，请明确说明，不要启动结构化提取任务。",
                "expect_any": ["数字", "日期", "时间", "金额", "没有"],
                "require_citations": True,
            })
        else:
            prompts.insert(2, {
                "id": "numbers_dates_cited",
                "message": "Answer directly in chat. List important numbers, dates, amounts, or time periods from the document, with citations. If none are present, say so explicitly. Do not start a separate structured extraction job.",
                "expect_any": ["number", "date", "year", "time", "amount", "period", "none"],
                "require_citations": True,
            })

    if is_cjk:
        prompts.append({
            "id": "cross_language_en",
            "message": "Answer in English: what is the main point of this Chinese document? Cite the source.",
            "expect_any": ["document", "main", "point", "source", "market", "company", "analysis", "report"],
            "require_citations": True,
        })
    else:
        prompts.append({
            "id": "cross_language_zh",
            "message": "请用中文概括这份文件的核心观点，并引用来源。",
            "expect_any": ["文件", "文档", "核心", "观点", "来源", "市场", "公司", "分析", "技术", "行业"],
            "require_citations": True,
        })
    return prompts


def load_inventory_cases(args: argparse.Namespace) -> list[dict[str, Any]]:
    inventory_path = ROOT / args.inventory
    data = json.loads(inventory_path.read_text(encoding="utf-8"))
    items = data.get("items") or []
    cases: list[dict[str, Any]] = []
    for item in items:
        if item.get("support_class") != "upload_supported":
            continue
        if item.get("extension") != ".pdf":
            continue
        if item.get("minimum_plan_by_size") == "over_pro_limit":
            continue
        locale = "zh" if item.get("language_hint") == "cjk_filename" else "en"
        pages = item.get("pages") if isinstance(item.get("pages"), int) else None
        timeout = 900 if (pages or 0) >= 200 else 600 if (pages or 0) >= 50 else 360
        cases.append({
            "id": f"corpus-{slugify(item['filename'])}",
            "file": item["path"],
            "locale": locale,
            "timeout": timeout,
            "inventory": {
                "filename": item.get("filename"),
                "pages": pages,
                "size_mb": item.get("size_mb"),
                "minimum_plan_by_size": item.get("minimum_plan_by_size"),
                "language_hint": item.get("language_hint"),
                "encrypted": item.get("encrypted"),
            },
            "prompts": generic_prompt_family(locale, pages),
        })
    cases.sort(key=lambda case: (case["inventory"].get("pages") or 0, case["id"]))
    return cases


def select_cases(args: argparse.Namespace) -> list[dict[str, Any]]:
    source_cases = load_inventory_cases(args) if args.from_inventory else CASES
    selected_cases = set(args.case or [])
    cases = [case for case in source_cases if not selected_cases or case["id"] in selected_cases]
    if args.start_index:
        cases = cases[args.start_index:]
    if args.max_cases:
        cases = cases[:args.max_cases]
    return cases


def prompt_plan(case: dict[str, Any], selected_prompts: set[str]) -> list[dict[str, Any]]:
    prompts = [p for p in case["prompts"] if not selected_prompts or p["id"] in selected_prompts]
    return [
        {
            "id": prompt["id"],
            "require_citations": bool(prompt.get("require_citations", True)),
            "message": prompt["message"],
            "expect_terms": prompt.get("expect_terms") or [],
            "expect_any": prompt.get("expect_any") or [],
            "forbid_any": prompt.get("forbid_any") or [],
        }
        for prompt in prompts
    ]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--api-base", default="http://127.0.0.1:8000")
    parser.add_argument("--json-out", required=True)
    parser.add_argument("--inventory", default=".collab/tasks/qa-corpus-inventory-2026-05-10.json")
    parser.add_argument("--from-inventory", action="store_true", help="Generate cases from the corpus inventory.")
    parser.add_argument("--max-cases", type=int, default=0)
    parser.add_argument("--start-index", type=int, default=0)
    parser.add_argument("--plan-only", action="store_true", help="Write selected corpus/prompt plan without hitting backend or LLM.")
    parser.add_argument("--case", action="append", help="Run only matching case id. May be repeated.")
    parser.add_argument("--prompt", action="append", help="Run only matching prompt id. May be repeated.")
    parser.add_argument("--mode", default="quick", choices=["quick", "balanced", "thorough"])
    parser.add_argument("--poll-interval", type=float, default=3.0)
    parser.add_argument("--keep", action="store_true")
    return parser.parse_args()


def contains_any(text: str, terms: list[str]) -> bool:
    lowered = text.lower()
    return any(term.lower() in lowered for term in terms)


def evaluate_prompt(prompt: dict[str, Any], chat: dict[str, Any], messages: dict[str, Any]) -> dict[str, Any]:
    answer = chat.get("answer") or ""
    answer_lower = answer.lower()
    citations = chat.get("citations") or []
    done = chat.get("done") or {}
    errors = chat.get("errors") or []
    expected_terms = prompt.get("expect_terms") or []
    expect_any = prompt.get("expect_any") or []
    forbid_any = prompt.get("forbid_any") or []
    require_citations = bool(prompt.get("require_citations", True))
    min_answer_chars = int(prompt.get("min_answer_chars") or (10 if str(prompt.get("id", "")).startswith("negative") else 80))

    message_items = messages.get("body", {}).get("messages") if isinstance(messages.get("body"), dict) else None
    assistant_messages = [m for m in message_items or [] if m.get("role") == "assistant"] if isinstance(message_items, list) else []
    assistant_citations = assistant_messages[-1].get("citations") if assistant_messages else None

    checks = {
        "stream_http_200": chat.get("status_code") == 200,
        "no_error_event": not errors,
        "done_event_present": bool(done),
        "answer_min_chars": len(answer) >= min_answer_chars,
        "expected_terms_present": all(term.lower() in answer_lower for term in expected_terms),
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

    return {
        "result": "pass" if all(checks.values()) else "fail",
        "quality_score": round(sum(1 for passed in checks.values() if passed) / len(checks), 3),
        "checks": checks,
        "answer_chars": len(answer),
        "citations_count": len(citations),
    }


async def create_session(
    client: httpx.AsyncClient,
    document_id: str,
    request_headers: dict[str, str],
) -> str:
    session_res = await client.post(f"/api/documents/{document_id}/sessions", headers=request_headers)
    session_res.raise_for_status()
    return str(live_chat.safe_json(session_res)["session_id"])


async def run_prompt(
    args: argparse.Namespace,
    client: httpx.AsyncClient,
    identity: Any,
    document_id: str,
    session_id: str,
    case: dict[str, Any],
    prompt: dict[str, Any],
) -> dict[str, Any]:
    request_headers = live_chat.headers(identity)
    prompt_args = argparse.Namespace(
        message=prompt["message"],
        mode=args.mode,
        locale=prompt.get("locale") or case.get("locale") or "en",
        timeout=prompt.get("timeout") or case.get("timeout") or 300,
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


async def run_case(args: argparse.Namespace, client: httpx.AsyncClient, case: dict[str, Any]) -> dict[str, Any]:
    identity = None
    selected_prompts = set(args.prompt or [])
    prompts = [p for p in case["prompts"] if not selected_prompts or p["id"] in selected_prompts]
    report: dict[str, Any] = {
        "id": case["id"],
        "file": case["file"],
        "locale": case.get("locale"),
        "steps": [],
        "prompts": [],
        "cleanup": "pending",
    }
    try:
        identity = await live_chat.create_qa_identity()
        report["qa_user"] = {"id": str(identity.user_id), "email": identity.email}
        document_id = await live_chat.resolve_document(
            argparse.Namespace(
                source="upload",
                file=case["file"],
                url=None,
                timeout=case.get("timeout") or 300,
                poll_interval=args.poll_interval,
            ),
            client,
            identity,
            report,
        )
        report["document_id"] = document_id
        request_headers = live_chat.headers(identity)
        session_id = await create_session(client, document_id, request_headers)
        for prompt in prompts:
            try:
                prompt_result = await run_prompt(args, client, identity, document_id, session_id, case, prompt)
            except Exception as exc:
                prompt_result = {
                    "id": prompt["id"],
                    "message": prompt["message"],
                    "result": "fail",
                    "error": f"{type(exc).__name__}: {exc}",
                }
            report["prompts"].append(prompt_result)
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
        report["error"] = f"{type(exc).__name__}: {exc}"
    finally:
        if args.keep:
            report["cleanup"] = "kept"
        else:
            try:
                report["cleanup"] = await live_chat.delete_qa_identity(identity)
            except Exception as cleanup_exc:
                report["cleanup"] = f"failed: {type(cleanup_exc).__name__}: {cleanup_exc}"

    failed = [p for p in report["prompts"] if p.get("result") != "pass"]
    report["result"] = "fail" if report.get("error") or failed or len(report["prompts"]) != len(prompts) else "pass"
    report["summary"] = {
        "prompts_requested": len(prompts),
        "prompts_passed": len(report["prompts"]) - len(failed),
        "prompts_failed": len(failed),
    }
    return report


async def cleanup_counts() -> dict[str, int]:
    from sqlalchemy import func, select

    from app.models.database import AsyncSessionLocal
    from app.models.tables import Document, User

    async with AsyncSessionLocal() as db:
        users = await db.scalar(select(func.count()).select_from(User).where(User.email.like("qa-live-chat-%@example.com")))
        docs = await db.scalar(
            select(func.count())
            .select_from(Document)
            .join(User, Document.user_id == User.id)
            .where(User.email.like("qa-live-chat-%@example.com"))
        )
    return {
        "qa_live_chat_users": int(users or 0),
        "qa_live_chat_documents": int(docs or 0),
    }


async def run(args: argparse.Namespace) -> dict[str, Any]:
    cases = select_cases(args)
    selected_prompts = set(args.prompt or [])
    planned_prompts = [
        {
            "id": case["id"],
            "file": case["file"],
            "locale": case.get("locale"),
            "inventory": case.get("inventory"),
            "prompts": prompt_plan(case, selected_prompts),
        }
        for case in cases
    ]
    report: dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "api_base": args.api_base,
        "mode": args.mode,
        "case_source": "inventory" if args.from_inventory else "static",
        "inventory": args.inventory if args.from_inventory else None,
        "cases_requested": [case["id"] for case in cases],
        "plan": planned_prompts,
        "cases": [],
    }
    if args.plan_only:
        total_prompts = sum(len(case["prompts"]) for case in planned_prompts)
        report["status"] = "plan_only"
        report["summary"] = {
            "cases_total": len(planned_prompts),
            "prompts_total": total_prompts,
            "citation_required_prompts": sum(
                1 for case in planned_prompts for prompt in case["prompts"] if prompt["require_citations"]
            ),
            "negative_prompts": sum(
                1 for case in planned_prompts for prompt in case["prompts"] if prompt["id"].startswith("negative")
            ),
        }
        return report
    async with httpx.AsyncClient(base_url=args.api_base, timeout=30.0) as client:
        health = await client.get("/health")
        report["health"] = {"status_code": health.status_code, "body": live_chat.safe_json(health)}
        health.raise_for_status()
        for case in cases:
            report["cases"].append(await run_case(args, client, case))

    failures = [case for case in report["cases"] if case.get("result") != "pass"]
    total_prompts = sum((case.get("summary") or {}).get("prompts_requested", 0) for case in report["cases"])
    passed_prompts = sum((case.get("summary") or {}).get("prompts_passed", 0) for case in report["cases"])
    report["cleanup_counts"] = await cleanup_counts()
    report["status"] = "fail" if failures else "pass"
    report["summary"] = {
        "cases_total": len(report["cases"]),
        "cases_passed": len(report["cases"]) - len(failures),
        "cases_failed": len(failures),
        "prompts_total": total_prompts,
        "prompts_passed": passed_prompts,
        "prompts_failed": total_prompts - passed_prompts,
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
            "LIVE_RAG_MULTI_PROMPT PLAN_ONLY: cases={cases_total} prompts={prompts_total} citation_required={citation_required_prompts}".format(
                **report["summary"],
            )
        )
    else:
        print(
            "LIVE_RAG_MULTI_PROMPT {status}: cases={cases_passed}/{cases_total} prompts={prompts_passed}/{prompts_total}".format(
                status=report["status"].upper(),
                cases_passed=report["summary"].get("cases_passed", 0),
                cases_total=report["summary"].get("cases_total", 0),
                prompts_passed=report["summary"].get("prompts_passed", 0),
                prompts_total=report["summary"].get("prompts_total", 0),
            )
        )
    return 0 if report["status"] in {"pass", "plan_only"} else 1


if __name__ == "__main__":
    raise SystemExit(main())
