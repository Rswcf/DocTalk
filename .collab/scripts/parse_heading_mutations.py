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
    "no floor gate": ("            block.font_size <= font_floor * self.HEADING_SIZE_FACTOR\n            and rule_size", "            False\n            and rule_size"),
    "same-row check removed": ("                    if lo < jlo + 0.5 * jh:", "                    if False:"),
    "off-axis join runs": ("on_axis = [i for i, b in enumerate(blocks) if not b.off_axis]", "on_axis = list(range(len(blocks)))"),
    "single short run counts": ('            if short and not (', '            if False and not ('),
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
    "no continuity guard": ("        if block.run_len > self.HEADING_MAX_WRAP_LINES and not (", "        if False and not ("),
    "no size groups": ("            if groups and self._same_size(size_of[groups[-1][-1]], size_of[k]):", "            if groups:"),
    # review r2
    "A: one wide line is a run": ("        runs = {rid: lines for rid, lines in runs.items() if len(lines) >= 2}\n", ""),
    "B: no display exemption": ("block.run_chars <= self.HEADING_DISPLAY_MAX_CHARS and rule_size", "False and rule_size"),
    "B: display factor 1.6": ("HEADING_DISPLAY_FACTOR = 1.5", "HEADING_DISPLAY_FACTOR = 1.6"),
    "B: display factor 1.2": ("HEADING_DISPLAY_FACTOR = 1.5", "HEADING_DISPLAY_FACTOR = 1.2"),
    "B: display chars 120": ("HEADING_DISPLAY_MAX_CHARS = 160", "HEADING_DISPLAY_MAX_CHARS = 120"),
    "B: display chars unlimited": ("HEADING_DISPLAY_MAX_CHARS = 160", "HEADING_DISPLAY_MAX_CHARS = 10**9"),
    "B: display base = page body": ("        base = max(reference_size, font_floor, rule_floor)", "        base = reference_size"),
    # review r3
    "F1: second look admits titles": ("                    and size <= self.HEADING_SIZE_FACTOR * smallest\n", ""),
    "F2: second look may lower": ('if second is not None and (second >= doc_ref or self._same_size(second, doc_ref)):', 'if second is not None:'),
    "second look on every page": ("            if ref is None and body_sizes:", "            if body_sizes:"),
    "C: rule floor only": ("and rule_size <= max(rule_floor, font_floor) * self.HEADING_SIZE_FACTOR", "and rule_size <= rule_floor * self.HEADING_SIZE_FACTOR"),
    "E: no second look": ("                    any(self._same_size(size, s) for s in body_sizes)\n", "                    False\n"),
    "lone 3-line run counts": ('lines[0].run_len <= self.HEADING_MAX_WRAP_LINES or lines[0].run_chars', 'lines[0].run_len < 3 or lines[0].run_chars'),
    "chain anchored at first size": ("            if groups and self._same_size(size_of[groups[-1][-1]], size_of[k]):", "            if groups and self._same_size(size_of[groups[-1][0]], size_of[k]):"),
    "overlap vs wider line": ("overlap < min_overlap * (width if width < jwidth else jwidth)", "overlap < min_overlap * (width if width > jwidth else jwidth)"),
    "kana weight 1": ('            or "\\u3040" <= ch <= "\\u30ff"  # hiragana + katakana\n', ""),
    "ext-A weight 1": ('            or "\\u3400" <= ch <= "\\u4dbf"  # extension A\n', ""),
    "compat ideographs weight 1": ('            or "\\uf900" <= ch <= "\\ufaff"  # compatibility ideographs\n', ""),
    # review r4
    "H: short-text run needs no partner": (" or lines[0].run_chars <= self.HEADING_DISPLAY_MAX_CHARS\n", "\n"),
    "J: one page makes a body size": ("for size, n in self._cluster_sizes(pages_per_size) if n >= 2)", "for size, n in self._cluster_sizes(pages_per_size) if n >= 1)"),
    "K: CJK counted once in run_chars": ("chars[roots[i]] += len(text) + sum(1 for ch in text if self._letter_weight(ch) == 2)", "chars[roots[i]] += len(text)"),
    "run_chars = longest line": ("chars[roots[i]] += len(text) + sum(1 for ch in text if self._letter_weight(ch) == 2)", "chars[roots[i]] = max(chars[roots[i]], len(text))"),
    "document body counts second-look sizes": (
        "        doc_ref = max(common) if common else 0.0\n\n        body_sizes = ",
        "        doc_ref = max(common) if common else 0.0\n"
        "        for p, vertical, blocks in per_page:\n"
        "            if page_refs[p.page_number] is None:\n"
        "                band_w, band_h = self._band_dims(p.width_pt, p.height_pt, p.rotation)\n"
        "                sizes = sorted(size for size, n in self._cluster_sizes(pages_per_size) if n >= 2)\n"
        "                second = self._page_reference(self._running_text_chars(blocks, vertical, band_w, band_h, sizes)) if sizes else None\n"
        "                if second is not None:\n"
        "                    pages_per_size[second] = pages_per_size.get(second, 0.0) + 1.0\n"
        "        common = [s for s, n in self._cluster_sizes(pages_per_size) if n >= self.REF_DOC_PAGE_SHARE * len(per_page)]\n"
        "        doc_ref = max(common) if common else 0.0\n\n        body_sizes = ",
    ),
}


# Mutants that no test kills on purpose, with the reason.
ACCEPTED = {
    # Extractor titles become headings before any size test: differs only for a non-PDF document
    # with a title on every page, which loses them all in v3 too (a separate task); not pinned.
    "extractor title ahead of size checks": (
        '        rule_size = self._rule_size(block)\n        font_floor, rule_floor = floors\n',
        '        if block.extractor_title:\n            return True\n        rule_size = self._rule_size(block)\n        font_floor, rule_floor = floors\n',
    ),
    "reach over every line": ("            reach = gap * max(ext[i][1] - ext[i][0] for i in group)", "            reach = gap * max(e[1] - e[0] for e in ext)"),  # cost only
    "doc ref fallback = span-mean floor": ("doc_ref = max(common) if common else 0.0", "doc_ref = max(common) if common else floors[0]"),  # differs only for lines whose dominant size is below their span mean (drop caps)
}


def main() -> int:
    orig = SERVICE.read_text()
    survivors, stale = [], []
    try:
        for name, (old, new) in {**M, **ACCEPTED}.items():
            if orig.count(old) != 1:
                print(f"!! pattern for {name!r} found {orig.count(old)}x")
                stale.append(name)
                continue
            SERVICE.write_text(orig.replace(old, new))
            run = subprocess.run(
                [sys.executable, "-m", "pytest", "tests/test_parse_service.py", "-q", "-x", "-p", "no:warnings"],
                capture_output=True, text=True, cwd=BACKEND,
            )
            failed = [line.split("::")[-1].split(" ")[0] for line in run.stdout.splitlines() if line.startswith("FAILED")]
            if not failed and name not in ACCEPTED:
                survivors.append(name)
            tag = " (accepted)" if name in ACCEPTED else ""
            print(f"{name:36} -> {'SURVIVES' + tag if not failed else 'killed by ' + failed[0]}")
    finally:
        SERVICE.write_text(orig)
    print(f"{len(M)} mutations, {len(ACCEPTED)} accepted; survivors: {survivors}; stale patterns: {stale}")
    return 1 if survivors or stale else 0


if __name__ == "__main__":
    raise SystemExit(main())
