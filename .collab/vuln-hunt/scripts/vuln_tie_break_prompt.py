#!/usr/bin/env python3
"""Generate an anonymized tie-break prompt for a disputed cell."""
from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Optional

import yaml

TEMPLATE = """# Tie-Break: {cell_id}

You previously assessed cell **{cell_id}** ({row_key} × {column_key}) as **severity={own_severity}** with **confidence={own_confidence}**, finding_key `{own_finding_key}`.

The parallel reviewer assessed the same cell as **severity={other_severity}** with **confidence={other_confidence}**, finding_key `{other_finding_key}`.

Their cited files: {other_files}

Their evidence (verbatim, agent identity redacted):

---
{other_body}
---

Your task: re-examine the referenced code path. Do you revise, hold, or adjust? Ground your answer in specific file:line evidence.

Output format:
```
new_severity: P0|P1|P2|P3
new_confidence: high|medium|low
rationale: <one paragraph>
```
"""


def parse_finding(path: Path) -> tuple[dict, str]:
    text = path.read_text()
    m = re.match(r"^---\n(.*?)\n---\n(.*)$", text, re.DOTALL)
    if not m:
        raise ValueError(f"no frontmatter in {path}")
    return yaml.safe_load(m.group(1)) or {}, m.group(2)


def find_cell(tree: Path, cell_id: str) -> Optional[Path]:
    findings = tree / "findings"
    if not findings.is_dir():
        return None
    for f in findings.iterdir():
        if f.name.startswith(cell_id + "-"):
            return f
    return None


def anonymize(body: str) -> str:
    """Strip references to either agent name so the prompt-holder can't tell who dissented."""
    return re.sub(r"\b(claude|codex)\b", "<agent>", body, flags=re.IGNORECASE)


def main(argv: list[str]) -> int:
    if len(argv) != 4:
        print("usage: vuln_tie_break_prompt.py <run-dir> <cell_id> <requesting-agent>",
              file=sys.stderr)
        return 2
    run_dir, cell_id, requesting = Path(argv[1]), argv[2], argv[3]
    other = "codex" if requesting == "claude" else "claude"

    own_path = find_cell(run_dir / requesting, cell_id)
    other_path = find_cell(run_dir / other, cell_id)
    if not own_path or not other_path:
        print(f"missing finding file for cell {cell_id}", file=sys.stderr)
        return 1

    own_fm, _ = parse_finding(own_path)
    other_fm, other_body = parse_finding(other_path)

    print(TEMPLATE.format(
        cell_id=cell_id,
        row_key=own_fm["row_key"],
        column_key=own_fm["column_key"],
        own_severity=own_fm["severity"],
        own_confidence=own_fm["confidence"],
        own_finding_key=own_fm["finding_key"],
        other_severity=other_fm["severity"],
        other_confidence=other_fm["confidence"],
        other_finding_key=other_fm["finding_key"],
        other_files=", ".join(other_fm.get("files") or []) or "(none)",
        other_body=anonymize(other_body).strip(),
    ))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
