#!/usr/bin/env python3
"""Old-vs-new heading report for ParseService over a folder of PDFs.

Loads two copies of backend/app/services/parse_service.py by path (the old one
from a git ref, the new one from the working tree), runs
extract_pages -> extract_elements + chunk_document on every PDF with each, and
writes a per-document comparison:

  - heading count and heading characters (heading elements)
  - paragraph characters (paragraph elements, NOT chunk characters: chunk text
    includes the 50-token overlap and moves with window boundaries)
  - heading share = heading chars / (heading + paragraph chars)
  - the headings added / removed, for manual review

Paragraph characters must rise or hold, except where a real heading is newly
detected. A drop in paragraph characters means body text became a heading.

Run from the repo root with the backend dev venv (Python 3.12):

  python .collab/scripts/parse_heading_corpus.py --old-ref main \
      --pdf-dir test_inputs --pdf-dir backend/seed_data \
      --out-md /tmp/heading-report.md --diff-dir /tmp/heading-diffs

`--old-ref` takes any git ref; `--old-path` takes a file instead. `--new-path`
defaults to the working-tree parse_service.py.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import subprocess
import sys
import tempfile
from collections import Counter
from pathlib import Path
from typing import Any

REPO = Path(__file__).resolve().parents[2]
SERVICE_REL = "backend/app/services/parse_service.py"


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    # Register before exec: @dataclass looks the module up in sys.modules.
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def source_at_ref(ref: str) -> Path:
    text = subprocess.run(
        ["git", "-C", str(REPO), "show", f"{ref}:{SERVICE_REL}"],
        check=True, capture_output=True, text=True,
    ).stdout
    tmp = Path(tempfile.mkdtemp(prefix="parse_old_")) / "parse_service_old.py"
    tmp.write_text(text, encoding="utf-8")
    return tmp


def measure(module, pdf_bytes: bytes) -> dict[str, Any]:
    svc = module.ParseService()
    pages = svc.extract_pages(pdf_bytes)
    if svc.detect_scanned(pages):
        return {"scanned": True, "pages": len(pages)}
    elements = svc.extract_elements(pages)
    chunks = svc.chunk_document(pages)
    headings = [(e.page_start, e.text) for e in elements if e.element_type == "heading"]
    heading_chars = sum(len(t) for _p, t in headings)
    paragraph_chars = sum(len(e.text) for e in elements if e.element_type != "heading")
    total = heading_chars + paragraph_chars
    return {
        "scanned": False,
        "pages": len(pages),
        "version": getattr(module, "PARSE_PIPELINE_VERSION", None),
        "headings": headings,
        "heading_count": len(headings),
        "heading_chars": heading_chars,
        "paragraph_chars": paragraph_chars,
        "heading_share": (heading_chars / total) if total else 0.0,
        "chunks": len(chunks),
        "section_titles": len({c.section_title for c in chunks if c.section_title}),
    }


def heading_diff(old: list, new: list) -> tuple[list, list]:
    old_c, new_c = Counter(old), Counter(new)
    removed = sorted((old_c - new_c).elements())
    added = sorted((new_c - old_c).elements())
    return added, removed


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--old-ref", help="git ref for the old parse_service.py")
    ap.add_argument("--old-path", type=Path, help="file path for the old parse_service.py")
    ap.add_argument("--new-path", type=Path, default=REPO / SERVICE_REL)
    ap.add_argument("--pdf-dir", type=Path, action="append", required=True)
    ap.add_argument("--out-md", type=Path)
    ap.add_argument("--out-json", type=Path)
    ap.add_argument("--diff-dir", type=Path, help="write one added/removed heading list per changed PDF")
    args = ap.parse_args()
    if bool(args.old_ref) == bool(args.old_path):
        ap.error("pass exactly one of --old-ref / --old-path")

    old_mod = load_module("parse_service_old", args.old_path or source_at_ref(args.old_ref))
    new_mod = load_module("parse_service_new", args.new_path)

    pdfs = sorted(p for d in args.pdf_dir for p in d.glob("*.pdf"))
    rows: list[dict[str, Any]] = []
    for pdf in pdfs:
        data = pdf.read_bytes()
        try:
            old = measure(old_mod, data)
            new = measure(new_mod, data)
        except Exception as exc:  # report and keep going: one bad PDF must not end the run
            rows.append({"name": pdf.name, "error": repr(exc)})
            print(f"ERROR {pdf.name}: {exc!r}", file=sys.stderr)
            continue
        row: dict[str, Any] = {"name": pdf.name, "pages": old["pages"], "scanned": old["scanned"]}
        if not old["scanned"]:
            added, removed = heading_diff(old["headings"], new["headings"])
            row.update({
                "old": {k: v for k, v in old.items() if k != "headings"},
                "new": {k: v for k, v in new.items() if k != "headings"},
                "added": added,
                "removed": removed,
            })
            if args.diff_dir and (added or removed):
                args.diff_dir.mkdir(parents=True, exist_ok=True)
                lines = [f"# {pdf.name}", "", f"## Removed headings ({len(removed)}) -> now paragraphs", ""]
                lines += [f"- p{p}: {t}" for p, t in removed]
                lines += ["", f"## Added headings ({len(added)})", ""]
                lines += [f"- p{p}: {t}" for p, t in added]
                (args.diff_dir / f"{pdf.stem}.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
        rows.append(row)
        print(f"done {pdf.name}", file=sys.stderr)

    md = render_markdown(rows)
    if args.out_md:
        args.out_md.write_text(md, encoding="utf-8")
    else:
        print(md)
    if args.out_json:
        args.out_json.write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
    return 0


def render_markdown(rows: list[dict[str, Any]]) -> str:
    out = [
        "| Document | Pages | Headings old → new | Heading share old → new | Paragraph chars old → new (Δ) | Added / removed headings |",
        "|---|---:|---:|---:|---:|---:|",
    ]
    regressions = []
    for r in sorted(rows, key=lambda r: -(r.get("old", {}).get("heading_share", 0.0))):
        if "error" in r:
            out.append(f"| {r['name']} | | error: {r['error']} | | | |")
            continue
        if r["scanned"]:
            out.append(f"| {r['name']} | {r['pages']} | no text layer | | | |")
            continue
        o, n = r["old"], r["new"]
        delta = n["paragraph_chars"] - o["paragraph_chars"]
        if delta < 0:
            regressions.append(r["name"])
        out.append(
            f"| {r['name']} | {r['pages']} | {o['heading_count']} → {n['heading_count']} "
            f"| {o['heading_share']:.1%} → {n['heading_share']:.1%} "
            f"| {o['paragraph_chars']:,} → {n['paragraph_chars']:,} ({delta:+,}) "
            f"| +{len(r['added'])} / −{len(r['removed'])} |"
        )
    measured = [r for r in rows if "old" in r]
    out += [
        "",
        f"{len(measured)} PDFs with a text layer; "
        f"{sum(1 for r in measured if r['added'] or r['removed'])} changed; "
        f"paragraph characters fell in {len(regressions)}"
        + (f": {', '.join(regressions)}" if regressions else "") + ".",
    ]
    return "\n".join(out) + "\n"


if __name__ == "__main__":
    raise SystemExit(main())
