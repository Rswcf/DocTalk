#!/usr/bin/env python3
"""Production public demo live RAG prompt matrix with quota awareness."""

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
HELPER_PATH = ROOT / ".collab/scripts/qa_live_chat_rag_matrix.py"

spec = importlib.util.spec_from_file_location("qa_live_chat_rag_matrix", HELPER_PATH)
if spec is None or spec.loader is None:
    raise RuntimeError(f"Cannot load helper module from {HELPER_PATH}")
live_chat = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = live_chat
spec.loader.exec_module(live_chat)

DEMO_MESSAGE_LIMIT = 5

PROMPTS: list[dict[str, Any]] = [
    {
        "id": "attention_summary_cited",
        "demo_slug": "attention-paper",
        "locale": "en",
        "message": "Summarize the key idea of multi-head attention in two cited bullets.",
        "expect_terms": ["attention"],
        "expect_any": ["head", "heads", "multi-head"],
        "require_citations": True,
    },
    {
        "id": "alphabet_specific_cited",
        "demo_slug": "alphabet-earnings",
        "locale": "en",
        "message": "Which company and reporting period does this earnings release discuss? Answer concisely and cite the source.",
        "expect_terms": ["Alphabet"],
        "expect_any": ["Q4", "quarter", "2025", "earnings"],
        "require_citations": True,
    },
    {
        "id": "court_negative_unanswerable",
        "demo_slug": "court-filing",
        "locale": "en",
        "message": "Does this court filing provide a judge's private home address? If it does not, say that the document does not provide it and do not invent one.",
        "expect_terms": [],
        "expect_any": ["does not provide", "not provide", "does not state", "not state", "not included", "not mention"],
        "forbid_any": ["street", "avenue", "road", "drive", "lane"],
        "require_citations": False,
    },
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--api-base", default="https://backend-production-a62e.up.railway.app")
    parser.add_argument("--json-out", required=True)
    parser.add_argument("--max-prompts", type=int, default=3)
    parser.add_argument("--mode", default="quick", choices=["quick", "balanced", "thorough"])
    parser.add_argument("--timeout", type=int, default=240)
    return parser.parse_args()


def contains_any(text: str, terms: list[str]) -> bool:
    lowered = text.lower()
    return any(term.lower() in lowered for term in terms)


def evaluate(prompt: dict[str, Any], chat: dict[str, Any], messages: dict[str, Any]) -> dict[str, Any]:
    answer = chat.get("answer") or ""
    answer_lower = answer.lower()
    citations = chat.get("citations") or []
    done = chat.get("done") or {}
    errors = chat.get("errors") or []
    expected_terms = prompt.get("expect_terms") or []
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


async def delete_session(client: httpx.AsyncClient, session_id: str) -> dict[str, Any]:
    res = await client.delete(f"/api/sessions/{session_id}")
    return {"session_id": session_id, "status_code": res.status_code, "body": live_chat.safe_json(res)}


async def create_demo_session(client: httpx.AsyncClient, document_id: str) -> dict[str, Any]:
    res = await client.post(f"/api/documents/{document_id}/sessions")
    return {"status_code": res.status_code, "body": live_chat.safe_json(res)}


async def run_prompt(
    args: argparse.Namespace,
    client: httpx.AsyncClient,
    demos_by_slug: dict[str, dict[str, Any]],
    prompt: dict[str, Any],
) -> dict[str, Any]:
    demo = demos_by_slug[prompt["demo_slug"]]
    session = await create_demo_session(client, str(demo["document_id"]))
    if session["status_code"] != 201:
        return {
            "id": prompt["id"],
            "demo_slug": prompt["demo_slug"],
            "result": "fail",
            "error": "create_session_failed",
            "session": session,
        }
    session_id = str(session["body"]["session_id"])
    prompt_args = argparse.Namespace(
        message=prompt["message"],
        mode=args.mode,
        locale=prompt.get("locale") or "en",
        timeout=args.timeout,
    )
    started = time.monotonic()
    chat = await live_chat.stream_chat(prompt_args, client, session_id, {})
    citation_chunks = await live_chat.fetch_citation_chunks(client, chat.get("citations") or [], {})
    messages_res = await client.get(f"/api/sessions/{session_id}/messages")
    messages = {"status_code": messages_res.status_code, "body": live_chat.safe_json(messages_res)}
    evaluation = evaluate(prompt, chat, messages)
    cleanup = await delete_session(client, session_id)
    return {
        "id": prompt["id"],
        "demo_slug": prompt["demo_slug"],
        "filename": demo.get("filename"),
        "message": prompt["message"],
        "session_id": session_id,
        "session": session,
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
        "cleanup": cleanup,
        "result": evaluation["result"],
    }


async def run(args: argparse.Namespace) -> dict[str, Any]:
    report: dict[str, Any] = {
        "run": "qa-production-demo-rag-prompt-matrix",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "api_base": args.api_base,
        "mode": args.mode,
        "max_prompts": args.max_prompts,
        "prompts": [],
        "cleanup": [],
    }
    async with httpx.AsyncClient(base_url=args.api_base, timeout=30.0) as client:
        health = await client.get("/health")
        report["health"] = {"status_code": health.status_code, "body": live_chat.safe_json(health)}
        demos_res = await client.get("/api/documents/demo")
        demos = live_chat.safe_json(demos_res)
        report["demo_documents"] = {"status_code": demos_res.status_code, "body": demos}
        demos_res.raise_for_status()
        demos_by_slug = {item["slug"]: item for item in demos if isinstance(item, dict)}

        quota_probe = await create_demo_session(client, str(demos_by_slug["attention-paper"]["document_id"]))
        report["quota_probe"] = quota_probe
        if quota_probe["status_code"] == 201:
            probe_session_id = str(quota_probe["body"]["session_id"])
            report["cleanup"].append(await delete_session(client, probe_session_id))
        used = int((quota_probe.get("body") or {}).get("demo_messages_used") or 0)
        remaining = max(DEMO_MESSAGE_LIMIT - used, 0)
        runnable_count = min(args.max_prompts, remaining, len(PROMPTS))
        report["quota"] = {
            "limit": DEMO_MESSAGE_LIMIT,
            "used_before_run": used,
            "remaining_before_run": remaining,
            "planned_prompts": runnable_count,
        }

        for prompt in PROMPTS[:runnable_count]:
            try:
                result = await run_prompt(args, client, demos_by_slug, prompt)
            except Exception as exc:
                result = {
                    "id": prompt["id"],
                    "demo_slug": prompt["demo_slug"],
                    "result": "fail",
                    "error": f"{type(exc).__name__}: {exc}",
                }
            report["prompts"].append(result)

        for prompt in PROMPTS[runnable_count:]:
            report["prompts"].append(
                {
                    "id": prompt["id"],
                    "demo_slug": prompt["demo_slug"],
                    "result": "blocked",
                    "blocked_reason": "demo_message_quota_preserved",
                }
            )

    executed = [p for p in report["prompts"] if p["result"] != "blocked"]
    failed = [p for p in executed if p["result"] != "pass"]
    blocked = [p for p in report["prompts"] if p["result"] == "blocked"]
    report["summary"] = {
        "total_prompts": len(report["prompts"]),
        "executed": len(executed),
        "passed": len([p for p in executed if p["result"] == "pass"]),
        "failed": len(failed),
        "blocked": len(blocked),
    }
    report["result"] = "fail" if failed else ("pass_with_blocked" if blocked else "pass")
    return report


def main() -> None:
    args = parse_args()
    report = asyncio.run(run(args))
    out = Path(args.json_out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        "PRODUCTION_DEMO_RAG_PROMPT_MATRIX "
        f"{report['result'].upper()}: {report['summary']['passed']}/{report['summary']['executed']} executed, "
        f"blocked={report['summary']['blocked']}"
    )
    if report["result"] == "fail":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
