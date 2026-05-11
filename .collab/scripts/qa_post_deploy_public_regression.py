#!/usr/bin/env python3
"""Orchestrate DocTalk public post-deploy regression sweeps."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
TASKS = ROOT / ".collab/tasks"
SCREENSHOTS = TASKS / "screenshots"
DEFAULT_BASE_URL = "https://www.doctalk.site"
DEFAULT_BACKEND = "https://backend-production-a62e.up.railway.app"


@dataclass
class Suite:
    name: str
    command: list[str]
    json_out: Path
    timeout_s: int
    required: bool = True


def date_tag() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d")


def rel(path: Path) -> str:
    resolved = path if path.is_absolute() else ROOT / path
    return str(resolved.resolve().relative_to(ROOT))


def build_suites(args: argparse.Namespace, run_dir: Path) -> list[Suite]:
    base_url = args.base_url.rstrip("/")
    inventory = str(Path(args.inventory))
    screenshot_root = SCREENSHOTS / args.date_tag / "post-deploy-public-regression"

    suites = [
        Suite(
            name="public_html_security",
            command=[
                sys.executable,
                ".collab/scripts/qa_production_public_html_security.py",
                "--base-url",
                base_url,
                "--inventory",
                inventory,
                "--json-out",
                rel(run_dir / "public-html-security.json"),
            ],
            json_out=run_dir / "public-html-security.json",
            timeout_s=600,
        ),
        Suite(
            name="public_mobile_ux",
            command=[
                "node",
                ".collab/scripts/qa_public_mobile_pages_ux.js",
                "--base-url",
                base_url,
                "--inventory",
                inventory,
                "--json-out",
                rel(run_dir / "public-mobile-ux.json"),
                "--screenshot-dir",
                rel(screenshot_root / "public-mobile"),
            ],
            json_out=run_dir / "public-mobile-ux.json",
            timeout_s=900,
        ),
        Suite(
            name="public_performance_smoke",
            command=[
                "node",
                ".collab/scripts/qa_production_public_performance_smoke.js",
                "--base-url",
                base_url,
                "--inventory",
                inventory,
                "--json-out",
                rel(run_dir / "public-performance-smoke.json"),
            ],
            json_out=run_dir / "public-performance-smoke.json",
            timeout_s=900,
        ),
        Suite(
            name="public_machine_entrypoints",
            command=[
                sys.executable,
                ".collab/scripts/qa_production_public_machine_entrypoints.py",
                "--base-url",
                base_url,
                "--expected-site-url",
                args.expected_site_url.rstrip("/"),
                "--json-out",
                rel(run_dir / "public-machine-entrypoints.json"),
            ],
            json_out=run_dir / "public-machine-entrypoints.json",
            timeout_s=600,
        ),
        Suite(
            name="public_metadata_schema",
            command=[
                sys.executable,
                ".collab/scripts/qa_production_public_metadata_schema.py",
                "--base-url",
                base_url,
                "--expected-site-url",
                args.expected_site_url.rstrip("/"),
                "--inventory",
                inventory,
                "--json-out",
                rel(run_dir / "public-metadata-schema.json"),
            ],
            json_out=run_dir / "public-metadata-schema.json",
            timeout_s=600,
        ),
        Suite(
            name="public_link_integrity",
            command=[
                sys.executable,
                ".collab/scripts/qa_production_public_link_integrity.py",
                "--base-url",
                base_url,
                "--inventory",
                inventory,
                "--json-out",
                rel(run_dir / "public-link-integrity.json"),
            ],
            json_out=run_dir / "public-link-integrity.json",
            timeout_s=900,
        ),
        Suite(
            name="public_external_links",
            command=[
                sys.executable,
                ".collab/scripts/qa_production_public_external_links.py",
                "--base-url",
                base_url,
                "--inventory",
                inventory,
                "--json-out",
                rel(run_dir / "public-external-links.json"),
                "--timeout",
                str(args.external_timeout),
            ],
            json_out=run_dir / "public-external-links.json",
            timeout_s=1200,
        ),
        Suite(
            name="public_accessibility_semantics",
            command=[
                "node",
                ".collab/scripts/qa_production_public_accessibility_semantics.js",
                "--base-url",
                base_url,
                "--inventory",
                inventory,
                "--json-out",
                rel(run_dir / "public-accessibility-semantics.json"),
            ],
            json_out=run_dir / "public-accessibility-semantics.json",
            timeout_s=900,
        ),
    ]

    if args.include_demo_reader:
        suites.append(
            Suite(
                name="production_demo_reader_ux",
                command=[
                    "node",
                    ".collab/scripts/qa_production_demo_reader_ux.js",
                    "--base-url",
                    base_url,
                    "--backend",
                    args.backend_url.rstrip("/"),
                    "--json-out",
                    rel(run_dir / "production-demo-reader-ux.json"),
                    "--screenshot-dir",
                    rel(screenshot_root / "production-demo-reader"),
                ],
                json_out=run_dir / "production-demo-reader-ux.json",
                timeout_s=900,
                required=False,
            )
        )

    if args.only:
        wanted = set(args.only)
        suites = [suite for suite in suites if suite.name in wanted]
    return suites


def load_child_summary(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        return {"parse_error": str(exc)}
    return {
        "result": data.get("result"),
        "summary": data.get("summary"),
        "run": data.get("run"),
        "generated_at": data.get("generated_at"),
    }


def run_suite(suite: Suite, *, dry_run: bool) -> dict[str, Any]:
    item: dict[str, Any] = {
        "name": suite.name,
        "required": suite.required,
        "command": suite.command,
        "json_out": rel(suite.json_out),
        "timeout_s": suite.timeout_s,
    }
    if dry_run:
        item["status"] = "dry_run"
        return item

    started = time.monotonic()
    try:
        proc = subprocess.run(
            suite.command,
            cwd=ROOT,
            text=True,
            capture_output=True,
            timeout=suite.timeout_s,
            check=False,
        )
        item.update({
            "status": "completed",
            "returncode": proc.returncode,
            "elapsed_ms": int((time.monotonic() - started) * 1000),
            "stdout": proc.stdout[-8000:],
            "stderr": proc.stderr[-8000:],
            "child": load_child_summary(suite.json_out),
        })
    except subprocess.TimeoutExpired as exc:
        item.update({
            "status": "timeout",
            "returncode": None,
            "elapsed_ms": int((time.monotonic() - started) * 1000),
            "stdout": (exc.stdout or "")[-8000:] if isinstance(exc.stdout, str) else "",
            "stderr": (exc.stderr or "")[-8000:] if isinstance(exc.stderr, str) else "",
            "child": load_child_summary(suite.json_out),
        })
    return item


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL)
    parser.add_argument("--expected-site-url", default=DEFAULT_BASE_URL)
    parser.add_argument("--backend-url", default=DEFAULT_BACKEND)
    parser.add_argument("--inventory", default=str(TASKS / "qa-route-inventory-2026-05-10.json"))
    parser.add_argument("--date-tag", default=date_tag())
    parser.add_argument("--json-out", default=None)
    parser.add_argument("--external-timeout", type=int, default=15)
    parser.add_argument("--include-demo-reader", action="store_true")
    parser.add_argument("--continue-on-fail", action="store_true", default=True)
    parser.add_argument("--fail-fast", action="store_false", dest="continue_on_fail")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--only", action="append", default=[])
    args = parser.parse_args()

    run_dir = TASKS / f"qa-post-deploy-public-regression-{args.date_tag}"
    json_out = Path(args.json_out) if args.json_out else run_dir / "manifest.json"
    if not json_out.is_absolute():
        json_out = ROOT / json_out
    run_dir.mkdir(parents=True, exist_ok=True)
    json_out.parent.mkdir(parents=True, exist_ok=True)

    suites = build_suites(args, run_dir)
    if not suites:
        raise SystemExit("No suites selected")

    results = []
    for suite in suites:
        result = run_suite(suite, dry_run=args.dry_run)
        results.append(result)
        failed = result.get("returncode") not in (0, None) or result.get("status") == "timeout"
        if failed and not args.continue_on_fail:
            break

    failed_required = [
        item for item in results
        if item.get("required") and (item.get("status") == "timeout" or item.get("returncode") not in (0, None))
    ]
    failed_optional = [
        item for item in results
        if not item.get("required") and (item.get("status") == "timeout" or item.get("returncode") not in (0, None))
    ]
    not_run = [suite.name for suite in suites if suite.name not in {item["name"] for item in results}]
    report = {
        "run": "qa-post-deploy-public-regression",
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "base_url": args.base_url.rstrip("/"),
        "expected_site_url": args.expected_site_url.rstrip("/"),
        "backend_url": args.backend_url.rstrip("/"),
        "inventory": args.inventory,
        "dry_run": args.dry_run,
        "include_demo_reader": args.include_demo_reader,
        "result": "fail" if failed_required else ("pass_with_optional_failures" if failed_optional else "pass"),
        "summary": {
            "selected_suites": len(suites),
            "completed_suites": len(results),
            "failed_required": len(failed_required),
            "failed_optional": len(failed_optional),
            "not_run": len(not_run),
        },
        "not_run": not_run,
        "results": results,
    }
    json_out.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(
        "POST_DEPLOY_PUBLIC_REGRESSION "
        f"{report['result'].upper()}: "
        f"{report['summary']['completed_suites']}/{report['summary']['selected_suites']} suites processed, "
        f"failed_required={report['summary']['failed_required']} "
        f"failed_optional={report['summary']['failed_optional']}"
    )
    print(f"Manifest: {rel(json_out)}")
    return 1 if failed_required else 0


if __name__ == "__main__":
    raise SystemExit(main())
