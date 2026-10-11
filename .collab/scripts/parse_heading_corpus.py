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
  - the headings added / removed, for manual review, each removed heading with
    the reason the new parser gives (needs its v5 helpers):
      run       in a run of 4+ same-size lines (a paragraph)
      body      not over 1.25x its own page's body size (the expected reason)
      inherited not over 1.25x the document's body size, which its page took
                because it has too little running text of its own
      floor     not over 1.25x the document's median line (the v1-v4 reference)
      guard     cleared every size test but failed a shape guard (digits, address)
    "inherited" and "guard" removals are where a real title can be lost: read them.

Paragraph characters must rise or hold, except where a real heading is newly
detected. A drop in paragraph characters means body text became a heading. A rise
can hide a lost title, so also read the removed headings.

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


REASONS = ("run", "body", "inherited", "floor", "guard")


def removal_reasons(module, pages, removed: list) -> dict:
    """Why each removed heading is not one in `module` (the new parser)."""
    svc = module.ParseService()
    if not all(hasattr(svc, n) for n in ("_prepare_blocks", "_running_text_chars", "_reference_sizes")):
        return {}
    lines: dict[int, list] = {}
    for b in svc._prepare_blocks(pages):
        lines.setdefault(b.page, []).append(b)
    document_angle = svc._document_line_angle(pages)
    per_page, own_ref = [], {}
    for p in pages:
        if p.page_number in lines:
            band_w, band_h = svc._band_dims(p.width_pt, p.height_pt, p.rotation)
            vertical = int(svc._dominant_line_angle(p.blocks, band_w, band_h, document_angle)) % 180 == 90
            per_page.append((p, vertical, lines[p.page_number]))
            chars = svc._running_text_chars(lines[p.page_number], vertical, band_w, band_h)
            own_ref[p.page_number] = svc._page_reference(chars)
    references, (font_floor, rule_floor) = svc._reference_sizes(per_page)
    factor = svc.HEADING_SIZE_FACTOR
    reasons = {}
    for page, text in removed:
        line = next((b for b in lines.get(page, []) if b.text.strip().replace("\x00", "") == text), None)
        if line is None:
            continue
        size = svc._rule_size(line)
        if line.run_len > svc.HEADING_MAX_WRAP_LINES:
            reasons[(page, text)] = "run"
        elif size <= references[page] * factor:
            reasons[(page, text)] = "body" if own_ref.get(page) is not None else "inherited"
        elif line.font_size <= font_floor * factor and size <= rule_floor * factor:
            reasons[(page, text)] = "floor"
        else:
            reasons[(page, text)] = "guard"
    return reasons


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
        "_pages": pages,
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
            reasons = removal_reasons(new_mod, new["_pages"], removed)
            row.update({
                "old": {k: v for k, v in old.items() if k not in ("headings", "_pages")},
                "new": {k: v for k, v in new.items() if k not in ("headings", "_pages")},
                "added": added,
                "removed": removed,
                "removed_by_reason": {r: sum(1 for v in reasons.values() if v == r) for r in REASONS},
            })
            if args.diff_dir and (added or removed):
                args.diff_dir.mkdir(parents=True, exist_ok=True)
                lines = [f"# {pdf.name}", "", f"## Removed headings ({len(removed)}) -> now paragraphs", ""]
                lines += [f"- p{p} [{reasons.get((p, t), '?')}]: {t}" for p, t in removed]
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
        "| Document | Pages | Headings old → new | Heading share old → new | Paragraph chars old → new (Δ) "
        "| Added / removed headings | Removed: run / body / inherited / floor / guard |",
        "|---|---:|---:|---:|---:|---:|---:|",
    ]
    regressions = []
    for r in sorted(rows, key=lambda r: -(r.get("old", {}).get("heading_share", 0.0))):
        if "error" in r:
            out.append(f"| {r['name']} | | error: {r['error']} | | | | |")
            continue
        if r["scanned"]:
            out.append(f"| {r['name']} | {r['pages']} | no text layer | | | | |")
            continue
        o, n = r["old"], r["new"]
        delta = n["paragraph_chars"] - o["paragraph_chars"]
        if delta < 0:
            regressions.append(r["name"])
        out.append(
            f"| {r['name']} | {r['pages']} | {o['heading_count']} → {n['heading_count']} "
            f"| {o['heading_share']:.1%} → {n['heading_share']:.1%} "
            f"| {o['paragraph_chars']:,} → {n['paragraph_chars']:,} ({delta:+,}) "
            f"| +{len(r['added'])} / −{len(r['removed'])} "
            f"| {' / '.join(str(r['removed_by_reason'].get(k, 0)) for k in REASONS)} |"
        )
    measured = [r for r in rows if "old" in r]
    to_read = sum(r["removed_by_reason"].get("inherited", 0) + r["removed_by_reason"].get("guard", 0) for r in measured)
    out += [
        "",
        f"{len(measured)} PDFs with a text layer; "
        f"{sum(1 for r in measured if r['added'] or r['removed'])} changed; "
        f"paragraph characters fell in {len(regressions)}"
        + (f": {', '.join(regressions)}" if regressions else "") + "; "
        f"{to_read} removed headings to read (inherited + guard).",
    ]
    return "\n".join(out) + "\n"


if __name__ == "__main__":
    raise SystemExit(main())
