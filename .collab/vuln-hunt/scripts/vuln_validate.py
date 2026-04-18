#!/usr/bin/env python3
"""Validate a finding markdown file against locked matrix enums.

Exits 0 on valid, non-zero on error with diagnostic on stderr.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[3]
VULN_HUNT_ROOT = REPO_ROOT / ".collab" / "vuln-hunt"

REQUIRED_FIELDS = {
    "id", "matrix", "agent", "cell_id", "row_key", "column_key",
    "finding_key", "severity", "confidence", "status",
    "files", "exploit_preconditions",
}
VALID_AGENTS = {"claude", "codex"}
VALID_MATRICES = {"A", "B"}
VALID_SEVERITY = {"P0", "P1", "P2", "P3"}
VALID_CONFIDENCE = {"high", "medium", "low"}
VALID_STATUS = {"bug", "risk", "deficiency", "clear", "unreviewed", "not_applicable"}
VALID_INVARIANT_STATE = {"held", "partial", "broken"}


def load_enum(path: Path, root_key: str) -> set[str]:
    data = yaml.safe_load(path.read_text())
    return {item["key"] for item in data[root_key]}


def parse_frontmatter(text: str) -> dict:
    m = re.match(r"^---\n(.*?)\n---\n", text, re.DOTALL)
    if not m:
        raise ValueError("missing YAML frontmatter")
    return yaml.safe_load(m.group(1)) or {}


def validate(path: Path) -> list[str]:
    errors: list[str] = []
    text = path.read_text()
    try:
        fm = parse_frontmatter(text)
    except ValueError as e:
        return [str(e)]

    missing = REQUIRED_FIELDS - fm.keys()
    if missing:
        errors.append(f"missing required fields: {sorted(missing)}")

    if fm.get("matrix") not in VALID_MATRICES:
        errors.append(f"matrix must be one of {VALID_MATRICES}")

    if fm.get("agent") not in VALID_AGENTS:
        errors.append(f"agent must be one of {VALID_AGENTS}")

    if fm.get("severity") not in VALID_SEVERITY:
        errors.append(f"severity must be one of {VALID_SEVERITY}")

    if fm.get("confidence") not in VALID_CONFIDENCE:
        errors.append(f"confidence must be one of {VALID_CONFIDENCE}")

    if fm.get("status") not in VALID_STATUS:
        errors.append(f"status must be one of {VALID_STATUS}")

    matrix = fm.get("matrix")
    rows: set[str] = set()
    cols: set[str] = set()
    if matrix == "A":
        rows = load_enum(VULN_HUNT_ROOT / "matrix-a-rows.yaml", "rows")
        cols = load_enum(VULN_HUNT_ROOT / "matrix-a-cols.yaml", "columns")
    elif matrix == "B":
        rows = load_enum(VULN_HUNT_ROOT / "matrix-b-rows.yaml", "rows")
        cols = load_enum(VULN_HUNT_ROOT / "matrix-b-cols.yaml", "columns")
        if fm.get("invariant_state") not in VALID_INVARIANT_STATE:
            errors.append(
                f"Matrix B finding must set invariant_state to one of {VALID_INVARIANT_STATE}"
            )

    if "row_key" in fm and fm["row_key"] not in rows:
        errors.append(f"row_key {fm['row_key']!r} not in matrix {matrix} enum")

    if "column_key" in fm and fm["column_key"] not in cols:
        errors.append(f"column_key {fm['column_key']!r} not in matrix {matrix} enum")

    cell_id = fm.get("cell_id", "")
    cell_match = re.match(r"^([AB])-(\d{2})-([CD])(\d{2})$", cell_id)
    if not cell_match:
        errors.append(f"cell_id {cell_id!r} does not match ^[AB]-\\d{{2}}-[CD]\\d{{2}}$")
    else:
        letter, row_num, col_letter, col_num = cell_match.groups()
        row_i, col_i = int(row_num), int(col_num)
        if letter == "A" and (
            not (1 <= row_i <= 24) or not (1 <= col_i <= 12) or col_letter != "C"
        ):
            errors.append(
                f"cell_id {cell_id!r} out of Matrix A range (row 01-24, col C01-C12)"
            )
        if letter == "B" and (
            not (1 <= row_i <= 8) or not (1 <= col_i <= 6) or col_letter != "D"
        ):
            errors.append(
                f"cell_id {cell_id!r} out of Matrix B range (row 01-08, col D01-D06)"
            )

    if not isinstance(fm.get("files"), list):
        errors.append("files must be an array")
    if not isinstance(fm.get("exploit_preconditions"), list):
        errors.append("exploit_preconditions must be an array")

    return errors


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("usage: vuln_validate.py <finding.md>", file=sys.stderr)
        return 2
    path = Path(argv[1])
    errors = validate(path)
    if errors:
        print(f"INVALID: {path}", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
