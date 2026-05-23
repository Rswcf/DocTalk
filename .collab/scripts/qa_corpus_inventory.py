#!/usr/bin/env python3
"""Inventory DocTalk QA corpus files without mutating test inputs."""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".pptx", ".xlsx", ".txt", ".md"}
URL_IMPORT_EXTENSIONS = {".html", ".htm"}
PLAN_LIMITS_MB = {
    "free": 25,
    "plus": 50,
    "pro": 100,
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create a QA corpus inventory for test_inputs.")
    parser.add_argument("--input-dir", default="test_inputs", help="Corpus directory to inspect.")
    parser.add_argument("--json-out", help="Write JSON report to this path.")
    parser.add_argument("--md-out", help="Write Markdown report to this path.")
    parser.add_argument(
        "--no-pdf-probe",
        action="store_true",
        help="Skip pdfinfo/PyMuPDF probing for page count and encryption metadata.",
    )
    return parser.parse_args()


def probe_pdf(path: Path) -> dict[str, Any]:
    info: dict[str, Any] = {
        "pages": None,
        "encrypted": None,
        "probe_error": None,
        "probe": None,
    }

    pdfinfo = run_pdfinfo(path)
    if pdfinfo:
        info.update(pdfinfo)
        return info

    try:
        import fitz  # type: ignore

        doc = fitz.open(path)
        try:
            info["pages"] = doc.page_count
            info["encrypted"] = bool(doc.needs_pass)
            info["probe"] = "pymupdf"
        finally:
            doc.close()
    except Exception as exc:  # pragma: no cover - depends on local PDF tooling
        info["probe_error"] = str(exc)
    return info


def run_pdfinfo(path: Path) -> dict[str, Any] | None:
    try:
        result = subprocess.run(
            ["pdfinfo", str(path)],
            check=False,
            capture_output=True,
            text=True,
            timeout=10,
        )
    except (FileNotFoundError, subprocess.SubprocessError):
        return None

    output = f"{result.stdout}\n{result.stderr}".strip()
    if not output:
        return None

    pages = None
    encrypted = None
    for line in output.splitlines():
        key, _, value = line.partition(":")
        key = key.strip().lower()
        value = value.strip()
        if key == "pages":
            try:
                pages = int(value)
            except ValueError:
                pages = None
        elif key == "encrypted":
            encrypted = value.lower().startswith("yes")

    return {
        "pages": pages,
        "encrypted": encrypted,
        "probe": "pdfinfo",
        "probe_error": None if result.returncode == 0 else output[-500:],
    }


def classify_plan(size_mb: float) -> str:
    if size_mb <= PLAN_LIMITS_MB["free"]:
        return "free"
    if size_mb <= PLAN_LIMITS_MB["plus"]:
        return "plus"
    if size_mb <= PLAN_LIMITS_MB["pro"]:
        return "pro"
    return "over_pro_limit"


def classify_language_hint(path: Path) -> str:
    name = path.name
    if re.search(r"[\u3400-\u9fff]", name):
        return "cjk_filename"
    if re.search(r"[äöüÄÖÜß]", name):
        return "german_filename"
    if re.search(r"[\u0600-\u06ff]", name):
        return "arabic_filename"
    return "latin_filename"


def classify_support(ext: str) -> str:
    if ext in SUPPORTED_EXTENSIONS:
        return "upload_supported"
    if ext in URL_IMPORT_EXTENSIONS:
        return "url_or_negative_fixture"
    if ext == ".ds_store":
        return "negative_fixture"
    return "unsupported_or_negative_fixture"


def inventory_file(path: Path, root: Path, probe_pdfs: bool) -> dict[str, Any]:
    stat = path.stat()
    ext = path.suffix.lower() if path.suffix else path.name.lower()
    size_mb = stat.st_size / (1024 * 1024)
    item: dict[str, Any] = {
        "path": str(path.relative_to(root.parent)),
        "filename": path.name,
        "extension": ext,
        "size_bytes": stat.st_size,
        "size_mb": round(size_mb, 3),
        "minimum_plan_by_size": classify_plan(size_mb),
        "support_class": classify_support(ext),
        "language_hint": classify_language_hint(path),
        "mtime": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
    }

    if ext == ".pdf" and probe_pdfs:
        item.update(probe_pdf(path))
    else:
        item.update({"pages": None, "encrypted": None, "probe": None, "probe_error": None})

    return item


def build_report(input_dir: Path, probe_pdfs: bool) -> dict[str, Any]:
    files = sorted([path for path in input_dir.iterdir() if path.is_file()], key=lambda p: p.name.lower())
    items = [inventory_file(path, input_dir, probe_pdfs) for path in files]

    total_size = sum(item["size_bytes"] for item in items)
    by_extension = Counter(item["extension"] for item in items)
    by_support = Counter(item["support_class"] for item in items)
    by_plan = Counter(item["minimum_plan_by_size"] for item in items)
    by_language = Counter(item["language_hint"] for item in items)

    pdf_items = [item for item in items if item["extension"] == ".pdf"]
    page_counts = [item["pages"] for item in pdf_items if isinstance(item.get("pages"), int)]
    encrypted_count = sum(1 for item in pdf_items if item.get("encrypted") is True)

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "input_dir": str(input_dir),
        "counts": {
            "files": len(items),
            "total_size_mb": round(total_size / (1024 * 1024), 3),
            "pdf_files": len(pdf_items),
            "pdfs_with_page_count": len(page_counts),
            "encrypted_pdfs": encrypted_count,
            "max_pages": max(page_counts) if page_counts else None,
            "min_pages": min(page_counts) if page_counts else None,
        },
        "by_extension": dict(sorted(by_extension.items())),
        "by_support_class": dict(sorted(by_support.items())),
        "by_minimum_plan_by_size": dict(sorted(by_plan.items())),
        "by_language_hint": dict(sorted(by_language.items())),
        "items": items,
    }


def to_markdown(report: dict[str, Any]) -> str:
    lines: list[str] = []
    lines.append(f"# QA Corpus Inventory - {report['generated_at'][:10]}")
    lines.append("")
    lines.append(f"Input dir: `{report['input_dir']}`")
    lines.append("")
    lines.append("| Metric | Value |")
    lines.append("|---|---:|")
    for key, value in report["counts"].items():
        lines.append(f"| {key} | {value} |")
    lines.append("")

    for title, key in [
        ("By Extension", "by_extension"),
        ("By Support Class", "by_support_class"),
        ("By Minimum Plan By Size", "by_minimum_plan_by_size"),
        ("By Language Hint", "by_language_hint"),
    ]:
        lines.append(f"## {title}")
        lines.append("")
        lines.append("| Category | Count |")
        lines.append("|---|---:|")
        for category, count in report[key].items():
            lines.append(f"| `{category}` | {count} |")
        lines.append("")

    lines.append("## Files")
    lines.append("")
    lines.append("| File | Ext | MB | Min Plan | Support | Pages | Encrypted | Language Hint |")
    lines.append("|---|---|---:|---|---|---:|---|---|")
    for item in report["items"]:
        lines.append(
            "| {file} | `{ext}` | {mb:.3f} | {plan} | {support} | {pages} | {encrypted} | {language} |".format(
                file=escape_pipes(item["filename"]),
                ext=item["extension"],
                mb=item["size_mb"],
                plan=item["minimum_plan_by_size"],
                support=item["support_class"],
                pages=item["pages"] if item["pages"] is not None else "",
                encrypted=item["encrypted"] if item["encrypted"] is not None else "",
                language=item["language_hint"],
            )
        )
    lines.append("")
    return "\n".join(lines) + "\n"


def escape_pipes(value: str) -> str:
    return value.replace("|", "\\|")


def write_text(path: str, text: str) -> None:
    out = Path(path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(text, encoding="utf-8")


def main() -> None:
    args = parse_args()
    input_dir = Path(args.input_dir)
    if not input_dir.exists() or not input_dir.is_dir():
        raise SystemExit(f"Input directory does not exist: {input_dir}")

    report = build_report(input_dir, probe_pdfs=not args.no_pdf_probe)

    if args.json_out:
        write_text(args.json_out, json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    if args.md_out:
        write_text(args.md_out, to_markdown(report))

    if not args.json_out and not args.md_out:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        counts = report["counts"]
        print(
            "Corpus inventory: {files} files, {total_size_mb} MB, {pdf_files} PDFs, {encrypted_pdfs} encrypted PDFs.".format(
                **counts
            )
        )


if __name__ == "__main__":
    # Avoid inherited locale surprises when emitting multilingual filenames.
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")
    main()

