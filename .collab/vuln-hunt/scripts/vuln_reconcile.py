#!/usr/bin/env python3
"""Diff Claude and Codex outputs into reconcile-raw.yaml per design spec §5."""
from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Optional

import yaml

SEVERITY_RANK = {"P0": 0, "P1": 1, "P2": 2, "P3": 3}


def parse_frontmatter(text: str) -> dict:
    m = re.match(r"^---\n(.*?)\n---\n", text, re.DOTALL)
    if not m:
        return {}
    return yaml.safe_load(m.group(1)) or {}


def load_findings(tree: Path) -> dict[str, dict]:
    out: dict[str, dict] = {}
    findings_dir = tree / "findings"
    if not findings_dir.is_dir():
        return out
    for f in findings_dir.iterdir():
        if not f.is_file() or f.suffix != ".md":
            continue
        fm = parse_frontmatter(f.read_text())
        if "cell_id" not in fm:
            continue
        out[fm["cell_id"]] = fm
    return out


def load_manifest(tree: Path) -> dict[str, dict]:
    """Manifest is a TOP-LEVEL list of cells (design spec §3)."""
    path = tree / "manifest.yaml"
    if not path.exists():
        return {}
    data = yaml.safe_load(path.read_text()) or []
    if isinstance(data, dict):  # tolerate legacy {entries: [...]} shape
        data = data.get("entries", [])
    return {e["cell_id"]: e for e in data}


def classify(claude: Optional[dict], codex: Optional[dict],
             claude_state: str, codex_state: str) -> dict:
    """Design spec §5 Stage 2 triage rules.

    Precedence: unreviewed → root-cause mismatch → severity mismatch.
    gap == 0                           → agree
    gap == 1 AND no P0 asymmetry       → agree + severity_disputed
    gap >= 2 OR P0 asymmetry           → same_finding_different_severity (tie-break)
    """
    if claude_state == "unreviewed" and codex_state == "unreviewed":
        return {"alignment": "both_unreviewed"}
    if claude_state == "unreviewed" or codex_state == "unreviewed":
        return {"alignment": "one_unreviewed"}
    if claude_state == "clear" and codex_state == "clear":
        return {"alignment": "both_clear"}
    if claude is None and codex is not None:
        return {"alignment": "only_codex"}
    if codex is None and claude is not None:
        return {"alignment": "only_claude"}
    if claude["finding_key"] != codex["finding_key"]:
        return {"alignment": "same_cell_different_finding"}

    sev_gap = abs(SEVERITY_RANK[claude["severity"]] - SEVERITY_RANK[codex["severity"]])
    p0_asymmetry = (claude["severity"] == "P0") != (codex["severity"] == "P0")
    if sev_gap == 0:
        return {"alignment": "agree", "severity_gap": 0, "p0_asymmetry": False}
    if sev_gap == 1 and not p0_asymmetry:
        return {
            "alignment": "agree",
            "severity_gap": 1,
            "p0_asymmetry": False,
            "severity_disputed": True,
        }
    return {
        "alignment": "same_finding_different_severity",
        "severity_gap": sev_gap,
        "p0_asymmetry": p0_asymmetry,
    }


def main(argv: list[str]) -> int:
    if len(argv) != 4:
        print("usage: vuln_reconcile.py <claude-dir> <codex-dir> <out.yaml>",
              file=sys.stderr)
        return 2
    claude_dir, codex_dir, out_path = Path(argv[1]), Path(argv[2]), Path(argv[3])
    claude_findings = load_findings(claude_dir)
    codex_findings = load_findings(codex_dir)
    claude_manifest = load_manifest(claude_dir)
    codex_manifest = load_manifest(codex_dir)

    all_cells = set(claude_findings) | set(codex_findings) \
        | set(claude_manifest) | set(codex_manifest)

    records = []
    for cell in sorted(all_cells):
        c_fm = claude_findings.get(cell)
        x_fm = codex_findings.get(cell)
        c_state = claude_manifest.get(cell, {}).get("state", "unreviewed")
        x_state = codex_manifest.get(cell, {}).get("state", "unreviewed")
        record = {
            "cell_id": cell,
            "claude": {
                "state": c_state,
                **({"severity": c_fm["severity"],
                    "confidence": c_fm["confidence"],
                    "finding_key": c_fm["finding_key"]} if c_fm else {}),
            },
            "codex": {
                "state": x_state,
                **({"severity": x_fm["severity"],
                    "confidence": x_fm["confidence"],
                    "finding_key": x_fm["finding_key"]} if x_fm else {}),
            },
            **classify(c_fm, x_fm, c_state, x_state),
        }
        records.append(record)

    out_path.write_text(yaml.safe_dump({"records": records}, sort_keys=False))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
