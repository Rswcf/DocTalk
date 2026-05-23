#!/usr/bin/env python3
"""Run a small private-corpus live RAG sample through the existing harness.

Requires a running local backend with the desired LLM key configured. The key
is not accepted as a CLI argument and is never written to artifacts.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]


CASES = [
    {
        "id": "semiconductor-small-en",
        "file": "test_inputs/semiconductor.pdf",
        "message": "What is the main topic of this document? Answer with key semiconductor-related points and cite the source.",
        "locale": "en",
        "expect_terms": ["semiconductor"],
        "timeout": 300,
    },
    {
        "id": "pan-zh-market",
        "file": "test_inputs/盘中解读.pdf",
        "message": "这份文件主要讨论什么市场或投资主题？请用中文简要回答并引用来源。",
        "locale": "zh",
        "expect_terms": ["市场"],
        "timeout": 360,
    },
    {
        "id": "memory-mania-en",
        "file": "test_inputs/Memory Mania_ How a Once-in-Four-Decades Shortage Is Fueling a Memory Boom.pdf",
        "message": "Summarize the core memory-market thesis in this document and cite the source.",
        "locale": "en",
        "expect_terms": ["memory"],
        "timeout": 420,
    },
    {
        "id": "ssrn-long-academic",
        "file": "test_inputs/ssrn-3247865.pdf",
        "message": "What is the central argument or subject of this academic paper? Answer concisely and cite the source.",
        "locale": "en",
        "expect_terms": ["trading"],
        "timeout": 600,
    },
    {
        "id": "gs-funds-cjk-one-page",
        "file": "test_inputs/GS 资金流.PDF",
        "message": "这份一页文件展示了什么资金流信息？请用中文回答并引用来源。",
        "locale": "zh",
        "expect_terms": ["资金"],
        "timeout": 420,
    },
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--api-base", default="http://127.0.0.1:8000")
    parser.add_argument("--json-out", required=True)
    parser.add_argument("--raw-dir", default=".collab/tasks")
    parser.add_argument("--case", action="append", help="Run only matching case id. May be repeated.")
    return parser.parse_args()


def run_case(args: argparse.Namespace, case: dict[str, Any]) -> dict[str, Any]:
    raw_path = Path(args.raw_dir) / f"qa-live-rag-corpus-sample-{case['id']}-2026-05-11.json"
    cmd = [
        sys.executable,
        str(ROOT / ".collab/scripts/qa_live_chat_rag_matrix.py"),
        "--api-base",
        args.api_base,
        "--source",
        "upload",
        "--file",
        case["file"],
        "--message",
        case["message"],
        "--mode",
        "quick",
        "--locale",
        case["locale"],
        "--timeout",
        str(case["timeout"]),
        "--poll-interval",
        "3",
        "--json-out",
        str(raw_path),
    ]
    for term in case["expect_terms"]:
        cmd.extend(["--expect-term", term])

    completed = subprocess.run(
        cmd,
        cwd=ROOT,
        text=True,
        capture_output=True,
        timeout=int(case["timeout"]) + 120,
    )
    raw: dict[str, Any] = {}
    if raw_path.exists():
        raw = json.loads(raw_path.read_text(encoding="utf-8"))
    evaluation = raw.get("evaluation") or {}
    chat = raw.get("chat") or {}
    return {
        "id": case["id"],
        "file": case["file"],
        "raw_json": str(raw_path),
        "exit_code": completed.returncode,
        "stdout": completed.stdout[-1200:],
        "stderr": completed.stderr[-1200:],
        "result": raw.get("result") or ("pass" if completed.returncode == 0 else "fail"),
        "quality_score": evaluation.get("quality_score"),
        "checks": evaluation.get("checks"),
        "answer_chars": chat.get("answer_chars"),
        "citations_count": len(chat.get("citations") or []),
        "verification": (chat.get("done") or {}).get("verification"),
        "cleanup": raw.get("cleanup"),
    }


def main() -> int:
    args = parse_args()
    selected_ids = set(args.case or [])
    cases = [case for case in CASES if not selected_ids or case["id"] in selected_ids]
    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "api_base": args.api_base,
        "cases_requested": [case["id"] for case in cases],
        "cases": [],
    }
    for case in cases:
        result = run_case(args, case)
        report["cases"].append(result)
        print(
            "CASE {id}: {result} score={score} answer_chars={chars} citations={citations}".format(
                id=result["id"],
                result=str(result["result"]).upper(),
                score=result["quality_score"],
                chars=result["answer_chars"],
                citations=result["citations_count"],
            )
        )
    failures = [case for case in report["cases"] if case["result"] != "pass" or case["exit_code"] != 0]
    report["status"] = "fail" if failures else "pass"
    report["summary"] = {
        "total": len(report["cases"]),
        "passed": len(report["cases"]) - len(failures),
        "failed": len(failures),
    }
    out = Path(args.json_out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"LIVE_RAG_CORPUS_SAMPLE {report['status'].upper()}: {report['summary']['passed']}/{report['summary']['total']}")
    return 0 if not failures else 1


if __name__ == "__main__":
    raise SystemExit(main())
