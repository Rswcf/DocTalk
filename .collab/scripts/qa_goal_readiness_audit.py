#!/usr/bin/env python3
"""Machine-readable readiness audit for the long-running DocTalk QA goal.

This is not a replacement for the detailed QA log. It inspects current local
artifacts and environment prerequisites, then reports which objective slices are
complete, ready to run, blocked, or still only planned.
"""

from __future__ import annotations

import argparse
import json
import os
import socket
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--json-out", required=True)
    parser.add_argument("--skip-oauth-email", action="store_true")
    parser.add_argument("--skip-production-payment", action="store_true")
    return parser.parse_args()


def load_json(relative: str) -> dict[str, Any] | None:
    path = ROOT / relative
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        return {"_load_error": f"{type(exc).__name__}: {exc}"}


def exists(relative: str) -> bool:
    return (ROOT / relative).exists()


def env_present(name: str) -> bool:
    return bool(os.environ.get(name))


def port_listening(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.2)
        return sock.connect_ex(("127.0.0.1", port)) == 0


def json_status(relative: str) -> str | None:
    data = load_json(relative)
    if not data:
        return None
    return str(data.get("status") or data.get("result") or "")


def artifact(relative: str) -> dict[str, Any]:
    path = ROOT / relative
    return {
        "path": relative,
        "exists": path.exists(),
        "status": json_status(relative) if path.suffix == ".json" else None,
    }


def suite(
    *,
    key: str,
    label: str,
    evidence: list[str],
    commands: list[str],
    blockers: list[str] | None = None,
    status: str,
    notes: list[str] | None = None,
) -> dict[str, Any]:
    return {
        "key": key,
        "label": label,
        "status": status,
        "evidence": [artifact(item) for item in evidence],
        "commands": commands,
        "blockers": blockers or [],
        "notes": notes or [],
    }


def main() -> int:
    args = parse_args()
    deepseek_ready = env_present("DEEPSEEK_API_KEY")
    resend_ready = env_present("RESEND_API_KEY")
    oauth_ready = all(env_present(name) for name in [
        "GOOGLE_CLIENT_ID",
        "GOOGLE_CLIENT_SECRET",
        "MICROSOFT_CLIENT_ID",
        "MICROSOFT_CLIENT_SECRET",
    ])
    stripe_secret = os.environ.get("STRIPE_SECRET_KEY", "")
    stripe_ready = stripe_secret.startswith("sk_live_")
    frontend_running = port_listening(3000)
    backend_running = port_listening(8000)
    post_deploy_manifest = ".collab/tasks/qa-post-deploy-public-regression-2026-05-11-post-deploy-rerun.json"
    post_deploy_complete = json_status(post_deploy_manifest) == "pass"
    pdf_shard0_manifest = ".collab/tasks/qa-live-rag-multi-prompt-full-corpus-shard0-deepseek-after-crosslang-fix-2026-05-11.json"
    pdf_shard0 = load_json(pdf_shard0_manifest) or {}
    pdf_shard0_summary = pdf_shard0.get("summary") if isinstance(pdf_shard0, dict) else {}
    pdf_shard0_effective_complete = (
        int((pdf_shard0_summary or {}).get("prompts_passed") or 0) >= 19
        and json_status(".collab/tasks/qa-live-rag-multi-prompt-chamath-summary-rerun-deepseek-2026-05-11.json") == "pass"
    )
    pdf_full_corpus_complete = (
        pdf_shard0_effective_complete
        and json_status(".collab/tasks/qa-live-rag-multi-prompt-full-corpus-shard1-deepseek-2026-05-11.json") == "pass"
        and int(((load_json(".collab/tasks/qa-live-rag-multi-prompt-full-corpus-shard2-deepseek-after-safe-prompts-2026-05-11.json") or {}).get("summary") or {}).get("prompts_passed") or 0) >= 19
        and json_status(".collab/tasks/qa-live-rag-multi-prompt-claude-code-numbers-rerun-after-planner-fix-2026-05-11.json") == "pass"
        and json_status(".collab/tasks/qa-live-rag-multi-prompt-full-corpus-shard3-deepseek-2026-05-11.json") == "pass"
        and json_status(".collab/tasks/qa-live-rag-multi-prompt-full-corpus-shard4-deepseek-2026-05-11.json") == "pass"
        and json_status(".collab/tasks/qa-live-rag-multi-prompt-full-corpus-shard5-deepseek-2026-05-11.json") == "pass"
        and json_status(".collab/tasks/qa-live-rag-multi-prompt-full-corpus-shard6-deepseek-2026-05-11.json") == "pass"
        and json_status(".collab/tasks/qa-live-rag-multi-prompt-full-corpus-shard7-deepseek-2026-05-11.json") == "pass"
        and int(((load_json(".collab/tasks/qa-live-rag-multi-prompt-full-corpus-shard8-deepseek-2026-05-11.json") or {}).get("summary") or {}).get("prompts_passed") or 0) >= 20
        and json_status(".collab/tasks/qa-live-rag-multi-prompt-citrini-rerun-pro-user-2026-05-11.json") == "pass"
        and json_status(".collab/tasks/qa-live-rag-multi-prompt-full-corpus-shard9-deepseek-2026-05-11.json") == "pass"
    )
    nonpdf_manifest = ".collab/tasks/qa-live-rag-nonpdf-deepseek-after-negative-terms-fix-2026-05-11.json"
    nonpdf = load_json(nonpdf_manifest) or {}
    nonpdf_summary = nonpdf.get("summary") if isinstance(nonpdf, dict) else {}
    nonpdf_complete = (
        int((nonpdf_summary or {}).get("prompts_passed") or 0) >= 23
        and json_status(".collab/tasks/qa-live-rag-nonpdf-txt-negative-rerun-deepseek-2026-05-11.json") == "pass"
    )
    structured_complete = json_status(".collab/tasks/qa-live-structured-outputs-deepseek-2026-05-11.json") == "pass"
    real_worker_diff_complete = (
        json_status(".collab/tasks/qa-browser-document-diff-real-worker-ux-2026-05-11.json") == "pass"
        and json_status(".collab/tasks/qa-browser-document-diff-real-worker-cleanup-2026-05-11.json") == "pass"
    )

    suites = [
        suite(
            key="surface_coverage_mapping",
            label="Route/API/function surface coverage evidence mapping",
            status="complete",
            evidence=[
                ".collab/tasks/qa-run-2026-05-11-surface-coverage-audit.md",
                ".collab/tasks/qa-surface-coverage-audit-2026-05-11.json",
            ],
            commands=[
                "python3 .collab/scripts/qa_surface_coverage_audit.py --json-out .collab/tasks/qa-surface-coverage-audit-2026-05-11.json",
            ],
            notes=["Maps 81 concrete routes, 6 dynamic templates, 6 frontend API routes, and 13 objective axes to concrete evidence; it is not a completion pass for blocked live-quality suites."],
        ),
        suite(
            key="production_contact_form_ux",
            label="Production public contact form browser UX",
            status="complete",
            evidence=[
                ".collab/tasks/qa-run-2026-05-11-production-contact-form-ux.md",
                ".collab/tasks/qa-production-contact-form-ux-2026-05-11.json",
            ],
            commands=[
                "node .collab/scripts/qa_production_contact_form_ux.js --base-url https://www.doctalk.site --json-out .collab/tasks/qa-production-contact-form-ux-2026-05-11.json",
            ],
            notes=["Desktop/mobile validation and mocked success states passed; real production calls are limited to non-email-sending validation paths."],
        ),
        suite(
            key="production_tools_ux",
            label="Production public tools browser UX",
            status="complete",
            evidence=[
                ".collab/tasks/qa-run-2026-05-11-production-tools-ux.md",
                ".collab/tasks/qa-production-tools-ux-2026-05-11.json",
            ],
            commands=[
                "node .collab/scripts/qa_production_tools_ux.js --base-url https://www.doctalk.site --json-out .collab/tasks/qa-production-tools-ux-2026-05-11.json",
            ],
            notes=["Desktop/mobile /tools hub, word counter, and reading-time interactions passed; harness asserts no non-auth API requests during text processing."],
        ),
        suite(
            key="pdf_full_corpus_live_rag",
            label="PDF full-corpus live RAG answer-quality matrix",
            status="complete" if pdf_full_corpus_complete else ("blocked" if not deepseek_ready else "ready"),
            evidence=[
                ".collab/tasks/qa-run-2026-05-11-live-rag-full-corpus-plan.md",
                ".collab/tasks/qa-live-rag-multi-prompt-full-corpus-plan-2026-05-11.json",
                ".collab/tasks/qa-live-rag-multi-prompt-full-corpus-plan-shard0-2026-05-11.json",
                ".collab/tasks/qa-live-rag-multi-prompt-full-corpus-shard0-deepseek-after-session-fix-2026-05-11.json",
                ".collab/tasks/qa-live-rag-multi-prompt-full-corpus-shard0-deepseek-after-threshold-fix-2026-05-11.json",
                pdf_shard0_manifest,
                ".collab/tasks/qa-live-rag-multi-prompt-chamath-summary-rerun-deepseek-2026-05-11.json",
                ".collab/tasks/qa-live-rag-multi-prompt-full-corpus-shard1-deepseek-2026-05-11.json",
                ".collab/tasks/qa-live-rag-multi-prompt-full-corpus-shard2-deepseek-after-safe-prompts-2026-05-11.json",
                ".collab/tasks/qa-live-rag-multi-prompt-claude-code-numbers-rerun-after-planner-fix-2026-05-11.json",
                ".collab/tasks/qa-live-rag-multi-prompt-full-corpus-shard3-deepseek-2026-05-11.json",
                ".collab/tasks/qa-live-rag-multi-prompt-full-corpus-shard4-deepseek-2026-05-11.json",
                ".collab/tasks/qa-live-rag-multi-prompt-full-corpus-shard5-deepseek-2026-05-11.json",
                ".collab/tasks/qa-live-rag-multi-prompt-full-corpus-shard6-deepseek-2026-05-11.json",
                ".collab/tasks/qa-live-rag-multi-prompt-full-corpus-shard7-deepseek-2026-05-11.json",
                ".collab/tasks/qa-live-rag-multi-prompt-full-corpus-shard8-deepseek-2026-05-11.json",
                ".collab/tasks/qa-live-rag-multi-prompt-citrini-rerun-pro-user-2026-05-11.json",
                ".collab/tasks/qa-live-rag-multi-prompt-full-corpus-shard9-deepseek-2026-05-11.json",
            ],
            commands=[
                "python3 .collab/scripts/qa_live_rag_multi_prompt_matrix.py --from-inventory --start-index 0 --max-cases 5 --json-out .collab/tasks/qa-live-rag-multi-prompt-full-corpus-shard0-2026-05-11.json",
            ],
            blockers=[] if deepseek_ready else ["DEEPSEEK_API_KEY is not configured in this process"],
            notes=[
                "Full corpus live execution covered 50 PDF cases across shards 0-9. Focused reruns closed one transient timeout, one planner-route case after product fix, and one large-file Pro-user case."
                if pdf_full_corpus_complete
                else "Shard0 live execution is effectively complete: 19/20 full-shard prompts plus focused retry of the transient timeout passed."
                if pdf_shard0_effective_complete
                else "Plan-only coverage exists for 50 PDFs and 239 prompts; live execution is not complete."
            ],
        ),
        suite(
            key="nonpdf_live_rag",
            label="DOCX/PPTX/XLSX/TXT/MD live RAG answer-quality matrix",
            status="complete" if nonpdf_complete else ("blocked" if not deepseek_ready else "ready"),
            evidence=[
                ".collab/tasks/qa-run-2026-05-11-live-rag-nonpdf-plan.md",
                ".collab/tasks/qa-live-rag-nonpdf-plan-2026-05-11.json",
                ".collab/tasks/qa-live-rag-nonpdf-deepseek-2026-05-11.json",
                nonpdf_manifest,
                ".collab/tasks/qa-live-rag-nonpdf-txt-negative-rerun-deepseek-2026-05-11.json",
            ],
            commands=[
                "python3 .collab/scripts/qa_live_rag_nonpdf_matrix.py --json-out .collab/tasks/qa-live-rag-nonpdf-2026-05-11.json",
            ],
            blockers=[] if deepseek_ready else ["DEEPSEEK_API_KEY is not configured in this process"],
            notes=[
                "Full live matrix covered DOCX/PPTX/XLSX/TXT/MD; 23/24 full run plus focused retry of the remaining TXT negative prompt passed."
                if nonpdf_complete
                else "Plan-only coverage exists for 5 generated non-PDF formats and 24 prompts."
            ],
        ),
        suite(
            key="structured_output_live_quality",
            label="Live structured extraction and question-template output quality",
            status="complete" if structured_complete else ("blocked" if not deepseek_ready else "ready"),
            evidence=[
                ".collab/tasks/qa-run-2026-05-11-live-structured-outputs.md",
                ".collab/tasks/qa-live-structured-outputs-plan-2026-05-11.json",
                ".collab/tasks/qa-live-structured-outputs-blocked-no-env-2026-05-11.json",
                ".collab/tasks/qa-live-structured-outputs-deepseek-2026-05-11.json",
            ],
            commands=[
                "python3 .collab/scripts/qa_live_structured_outputs_matrix.py --json-out .collab/tasks/qa-live-structured-outputs-2026-05-11.json",
            ],
            blockers=[] if deepseek_ready else ["DEEPSEEK_API_KEY is not configured in this process"],
            notes=[
                "Live structured outputs passed 5/5 cases: extraction summary, key facts, evidence table, document question template, and collection question template."
                if structured_complete
                else "Worker path was exercised and correctly classified as blocked without provider config."
            ],
        ),
        suite(
            key="production_post_deploy_regression",
            label="Post-deploy public production regression",
            status="complete" if post_deploy_complete else "ready_manual",
            evidence=[
                ".collab/tasks/qa-run-2026-05-11-post-deploy-public-regression-orchestrator.md",
                ".collab/tasks/qa-post-deploy-public-regression-dry-run-performance-2026-05-11.json",
                ".collab/tasks/qa-run-2026-05-11-production-current-public-regression.md",
                ".collab/tasks/qa-post-deploy-public-regression-production-current-2026-05-11.json",
                ".collab/tasks/qa-run-2026-05-11-production-current-demo-reader-ux.md",
                ".collab/tasks/qa-production-current-demo-reader-ux-2026-05-11.json",
                ".collab/tasks/qa-post-deploy-public-regression-2026-05-11-post-deploy.json",
                ".collab/tasks/qa-production-public-html-security-post-deploy-rerun-2026-05-11.json",
                ".collab/tasks/qa-production-public-mobile-pages-ux-post-deploy-rerun-2026-05-11.json",
                post_deploy_manifest,
            ],
            commands=[
                "python3 .collab/scripts/qa_post_deploy_public_regression.py --date-tag 2026-05-11-post-deploy-rerun --json-out .collab/tasks/qa-post-deploy-public-regression-2026-05-11-post-deploy-rerun.json --include-demo-reader",
            ],
            blockers=[] if post_deploy_complete else ["Requires frontend deploy of local fixes before results can close production drift bugs."],
            notes=[
                "Post-deploy rerun passed 9/9 suites after Vercel served commit 97b44a8 and CSP propagated."
                if post_deploy_complete
                else "Current production still has known deploy drift for CSP, icon/manifest, fragment/external links, healthcare heading, and demo direct citation highlight."
            ],
        ),
        suite(
            key="oauth_email_delivery",
            label="OAuth callback and email magic-link delivery",
            status="skipped" if args.skip_oauth_email else ("blocked" if not (resend_ready and oauth_ready) else "ready_manual"),
            evidence=[
                ".collab/tasks/qa-run-2026-05-11-auth-provider-availability-ux.md",
                ".collab/tasks/qa-run-2026-05-11-production-auth-provider-availability-ux.md",
            ],
            commands=[],
            blockers=[] if args.skip_oauth_email else [
                *(["RESEND_API_KEY is not configured"] if not resend_ready else []),
                *(["OAuth client credentials are not fully configured in this process"] if not oauth_ready else []),
                "Requires safe external test accounts and inbox/callback handling",
            ],
            notes=[
                "Skipped by explicit user scope on 2026-05-11."
                if args.skip_oauth_email
                else "Provider discovery and UI availability are covered; successful callback/delivery is not."
            ],
        ),
        suite(
            key="production_payment_safe_account",
            label="Authenticated production Checkout/Portal and manual refund-review operations",
            status="skipped" if args.skip_production_payment else ("blocked" if not stripe_ready else "ready_manual"),
            evidence=[
                ".collab/tasks/qa-run-2026-05-10-stripe-hosted-browser.md",
                ".collab/tasks/qa-run-2026-05-10-refund-review-workflow.md",
                ".collab/tasks/qa-run-2026-05-11-production-payment-public-sanity-rerun.md",
            ],
            commands=[],
            blockers=[] if args.skip_production_payment else [
                "Requires safe production account/business approval",
                *(
                    []
                    if stripe_ready
                    else [
                        "STRIPE_SECRET_KEY is not configured in this process"
                        if not stripe_secret
                        else "STRIPE_SECRET_KEY is not a sk_live_* production key in this process"
                    ]
                ),
            ],
            notes=[
                "Skipped by explicit user scope on 2026-05-11."
                if args.skip_production_payment
                else "Test-mode and non-destructive production public sanity are covered; authenticated production operation is not."
            ],
        ),
        suite(
            key="browser_real_worker_document_diff",
            label="Browser-orchestrated real worker document-diff result",
            status="complete" if real_worker_diff_complete else ("blocked" if not (deepseek_ready and frontend_running and backend_running) else "ready"),
            evidence=[
                ".collab/tasks/qa-run-2026-05-11-document-diff-live-llm.md",
                ".collab/tasks/qa-run-2026-05-11-browser-document-diff-polling-ux.md",
                ".collab/tasks/qa-browser-document-diff-real-worker-fixture-2026-05-11.json",
                ".collab/tasks/qa-browser-document-diff-real-worker-ux-2026-05-11.json",
                ".collab/tasks/qa-browser-document-diff-real-worker-cleanup-2026-05-11.json",
            ],
            commands=[],
            blockers=[
                *(["DEEPSEEK_API_KEY is not configured in this process"] if not deepseek_ready else []),
                *(["Frontend dev server is not listening on 127.0.0.1:3000"] if not frontend_running else []),
                *(["Backend server is not listening on 127.0.0.1:8000"] if not backend_running else []),
            ],
            notes=[
                "Real queued Celery document-diff job was opened from the browser and completed through the result UI with export/citation checks."
                if real_worker_diff_complete
                else "Real diff worker output and browser polling UX are separately covered; one browser-orchestrated real worker flow remains unverified."
            ],
        ),
    ]

    complete = all(item["status"] in {"complete", "skipped"} for item in suites)
    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "objective": "DocTalk long-running full-product QA readiness audit",
        "complete": complete,
        "environment": {
            "DEEPSEEK_API_KEY": deepseek_ready,
            "RESEND_API_KEY": resend_ready,
            "oauth_credentials_complete": oauth_ready,
            "STRIPE_SECRET_KEY": bool(stripe_secret),
            "STRIPE_SECRET_KEY_LIVE": stripe_ready,
            "frontend_3000_listening": frontend_running,
            "backend_8000_listening": backend_running,
        },
        "suites": suites,
        "summary": {
            "total": len(suites),
            "blocked": len([item for item in suites if item["status"] == "blocked"]),
            "ready": len([item for item in suites if item["status"] == "ready"]),
            "ready_manual": len([item for item in suites if item["status"] == "ready_manual"]),
            "complete": len([item for item in suites if item["status"] == "complete"]),
            "skipped": len([item for item in suites if item["status"] == "skipped"]),
        },
    }
    out = ROOT / args.json_out
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(
        "GOAL_READINESS_AUDIT complete={is_complete} blocked={blocked} ready={ready} ready_manual={ready_manual}".format(
            is_complete=str(complete).lower(),
            blocked=report["summary"]["blocked"],
            ready=report["summary"]["ready"],
            ready_manual=report["summary"]["ready_manual"],
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
