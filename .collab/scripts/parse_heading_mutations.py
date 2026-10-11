"""Mutation check for the parse v5 heading rule.

Applies each mutation below to backend/app/services/parse_service.py, runs
tests/test_parse_service.py, and reports the mutations no test kills. The file is
restored afterwards. Run from the repo root with a Python 3.12 venv built from
backend/requirements-dev.txt:

  python .collab/scripts/parse_heading_mutations.py
"""
import subprocess
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[2] / "backend"
SERVICE = BACKEND / "app/services/parse_service.py"

M = {
    "active cap 1": ("RUN_ACTIVE_CAP = 400", "RUN_ACTIVE_CAP = 1"),
    "gap 3.0": ("RUN_GAP_LINE_HEIGHTS = 1.0", "RUN_GAP_LINE_HEIGHTS = 3.0"),
    "gap 0.3": ("RUN_GAP_LINE_HEIGHTS = 1.0", "RUN_GAP_LINE_HEIGHTS = 0.3"),
    "overlap 0": ("RUN_MIN_OVERLAP = 0.30", "RUN_MIN_OVERLAP = 0.0"),
    "size class 30%": ("return abs(a - b) <= max(0.35, 0.08 * max(a, b))", "return abs(a - b) <= max(0.35, 0.30 * max(a, b))"),
    "size class exact": ("return abs(a - b) <= max(0.35, 0.08 * max(a, b))", "return abs(a - b) <= 0.0"),
    "min page chars 0": ("REF_MIN_PAGE_CHARS = 200", "REF_MIN_PAGE_CHARS = 0"),
    "min page chars 5000": ("REF_MIN_PAGE_CHARS = 200", "REF_MIN_PAGE_CHARS = 5000"),
    "doc page share 0.9": ("REF_DOC_PAGE_SHARE = 0.25", "REF_DOC_PAGE_SHARE = 0.9"),
    "doc share over known pages": ("n >= self.REF_DOC_PAGE_SHARE * len(per_page)]", "n >= self.REF_DOC_PAGE_SHARE * sum(pages_per_size.values())]"),
    "wrap limit 10": ("HEADING_MAX_WRAP_LINES = 3", "HEADING_MAX_WRAP_LINES = 10"),
    "wrap limit 2": ("HEADING_MAX_WRAP_LINES = 3", "HEADING_MAX_WRAP_LINES = 2"),
    "digit guard <=": ("return letters >= 2 and figures < letters", "return letters >= 2 and figures <= letters"),
    "letters>=1": ("return letters >= 2 and figures < letters", "return letters >= 1 and figures < letters"),
    "no digit guard": ("return letters >= 2 and figures < letters", "return True"),
    "cjk weight 1": ("            return 2\n        return 1 if ch.isalpha()", "            return 1\n        return 1 if ch.isalpha()"),
    "marks not letters": ('return 1 if ch.isalpha() or unicodedata.category(ch).startswith("M") else 0', "return 1 if ch.isalpha() else 0"),
    "no address guard": ("        if _BARE_ADDRESS_RE.match(text):\n            return False", "        if False:\n            return False"),
    "no extractor exemption": ("        if block.extractor_title:\n            return True\n", ""),
    "dominant tie smaller": ("key=lambda kv: (kv[1], kv[0])", "key=lambda kv: (kv[1], -kv[0])"),
    "dominant counts whitespace": ('n_chars = len((s.get("text") or "").strip())', 'n_chars = len((s.get("text") or "")) or 1'),
    "rule floor = font median": ("median(rule_sizes) if rule_sizes else 12.0)", "median(font_sizes) if font_sizes else 12.0)"),
    "font floor = rule median": ("floors = (median(font_sizes) if font_sizes", "floors = (median(rule_sizes) if rule_sizes"),
    "no floor gate": ("        if block.font_size <= font_floor * self.HEADING_SIZE_FACTOR and rule_size <= rule_floor * self.HEADING_SIZE_FACTOR:\n            return False\n", ""),
    "same-row check removed": ("                    if lo < jlo + 0.5 * jh:", "                    if False:"),
    "off-axis join runs": ("on_axis = [i for i, b in enumerate(blocks) if not b.off_axis]", "on_axis = list(range(len(blocks)))"),
    "running text run>=1": ("if b.off_axis or b.run_len < 2 or self._rule_size(b) <= 0:", "if b.off_axis or self._rule_size(b) <= 0:"),
    "single short run counts": ("            if lines[0].run_len <= self.HEADING_MAX_WRAP_LINES and not any(", "            if False and not any("),
    "extent 0": ("REF_MIN_LINE_EXTENT = 0.20", "REF_MIN_LINE_EXTENT = 0.0"),
    "page share 0.0": ("REF_SUBSTANTIAL_SHARE = 0.30", "REF_SUBSTANTIAL_SHARE = 0.0"),
    "page share 0.99": ("REF_SUBSTANTIAL_SHARE = 0.30", "REF_SUBSTANTIAL_SHARE = 0.99"),
    "smallest substantial": ("return max(substantial) if substantial", "return min(substantial) if substantial"),
    "doc ref smallest": ("doc_ref = max(common) if common else 0.0", "doc_ref = min(common) if common else 0.0"),
    "factor 1.15": ("HEADING_SIZE_FACTOR = 1.25", "HEADING_SIZE_FACTOR = 1.15"),
    "factor 1.4": ("HEADING_SIZE_FACTOR = 1.25", "HEADING_SIZE_FACTOR = 1.4"),
    "neighbour by font_size": ("        size_of = [self._rule_size(b) for b in blocks]", "        size_of = [b.font_size for b in blocks]"),
    "rule_size = font_size": ("rule_size=b.dominant_size if b.dominant_size > 0 else b.font_size,", "rule_size=b.font_size,"),
    "vertical ignored": ("            vertical = int(angle) % 180 == 90\n", "            vertical = False\n"),
    "no continuity guard": ("        if block.run_len > self.HEADING_MAX_WRAP_LINES:\n            return False\n        rule_size", "        rule_size"),
    "no size groups": ("            if groups and self._same_size(size_of[groups[-1][-1]], size_of[k]):", "            if groups:"),
}


def main() -> int:
    orig = SERVICE.read_text()
    survivors = []
    try:
        for name, (old, new) in M.items():
            if orig.count(old) != 1:
                print(f"!! pattern for {name!r} found {orig.count(old)}x")
                continue
            SERVICE.write_text(orig.replace(old, new))
            run = subprocess.run(
                [sys.executable, "-m", "pytest", "tests/test_parse_service.py", "-q", "-x", "-p", "no:warnings"],
                capture_output=True, text=True, cwd=BACKEND,
            )
            failed = [line.split("::")[-1].split(" ")[0] for line in run.stdout.splitlines() if line.startswith("FAILED")]
            if not failed:
                survivors.append(name)
            print(f"{name:30} -> {'SURVIVES' if not failed else 'killed by ' + failed[0]}")
    finally:
        SERVICE.write_text(orig)
    print("survivors:", survivors)
    return 1 if survivors else 0


if __name__ == "__main__":
    raise SystemExit(main())
