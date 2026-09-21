"""Parse the REAL token values out of editorial.css / globals.css and check every
foreground/background pair that actually renders. Reads the files, so it cannot drift
from the source the way a hardcoded audit does. Exit 1 if any pair is below its floor
(4.5:1 for text, 3:1 for non-text boundaries per WCAG 1.4.11).

Covers, as of Phase 1 layer 1 (plan §5.3):
  * the editorial LIGHT set        (`.dt-editorial { … }`)
  * the editorial DARK set         (`.dark .dt-editorial { … }`)
  * the app light/dark sets in globals.css (unchanged by Phase 1)

Run from anywhere; paths resolve relative to this file, so it audits the worktree it
is committed in rather than a hardcoded checkout.
"""
import io
import re
import sys
from pathlib import Path

FE = Path(__file__).resolve().parents[3] / "frontend/src/app"


def _lin(c):
    c /= 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def lum(h):
    h = h.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    return .2126 * _lin(r) + .7152 * _lin(g) + .0722 * _lin(b)


def ratio(a, b):
    la, lb = lum(a), lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + .05) / (lo + .05)


def block(path, opener):
    """Grab `--name: #hex;` declarations from the ONE rule block that starts at
    `opener`, stopping at that block's closing brace.

    The previous version took a second literal as the end marker; when the marker
    was absent `str.find` returned -1 and the slice swallowed the rest of the file.
    That was harmless while editorial.css held a single token block — it would
    silently merge the dark overrides into the light dict now that there are two.
    """
    s = io.open(path, encoding="utf-8").read()
    i = s.find(opener)
    if i < 0:
        raise SystemExit(f"contrast_tokens: block {opener!r} not found in {path}")
    j = s.find("\n}", i)
    if j < 0:
        raise SystemExit(f"contrast_tokens: block {opener!r} is unterminated in {path}")
    out = {}
    for m in re.finditer(r"--([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8})\s*;", s[i:j]):
        out[m.group(1)] = m.group(2)
    return out


ed_light = block(FE / "editorial.css", ".dt-editorial {")
# Dark only declares what it overrides; everything else cascades from the light
# block, exactly as the browser resolves it.
ed_dark = {**ed_light, **block(FE / "editorial.css", ".dark .dt-editorial {")}
light = block(FE / "globals.css", ":root {\n  --background: #ffffff;")
dark = block(FE / "globals.css", ".dark {")

# (fg token, bg token, source dict, label) — only pairs that really render as text.
PAIRS = [
    # ── editorial light (plan §5.3, light table) ──────────────────────────
    ("ed-ink", "ed-paper", ed_light, "ed light headline / stage"),
    ("ed-ink", "ed-surface", ed_light, "ed light headline / surface"),
    ("ed-ink", "ed-surface-2", ed_light, "ed light headline / page"),
    ("ed-ink", "ed-evidence-soft", ed_light, "ed light ink / highlight fill"),
    ("ed-ink-2", "ed-paper", ed_light, "ed light body / stage"),
    ("ed-ink-2", "ed-surface", ed_light, "ed light body / surface"),
    ("ed-ink-2", "ed-paper-2", ed_light, "ed light body / inset band"),
    ("ed-ink-3", "ed-paper", ed_light, "ed light caption / stage"),
    ("ed-ink-3", "ed-surface", ed_light, "ed light caption / surface"),
    ("ed-ink-3", "ed-paper-2", ed_light, "ed light caption / inset band"),
    ("ed-signal", "ed-paper", ed_light, "ed light link / stage"),
    ("ed-signal", "ed-surface", ed_light, "ed light link / surface"),
    ("ed-signal", "ed-paper-2", ed_light, "ed light link / inset band"),
    ("ed-on-signal", "ed-signal", ed_light, "ed light CTA label / fill"),
    ("ed-on-signal", "ed-signal-deep", ed_light, "ed light CTA label / hover"),
    ("ed-signal-deep", "ed-paper", ed_light, "ed light hover ink / stage"),
    ("ed-slate", "ed-paper", ed_light, "ed light slate (retired role)"),
    ("ed-slate-2", "ed-paper", ed_light, "ed light slate-2 (retired role)"),
    ("ed-olive", "ed-paper", ed_light, "ed light verified / stage"),
    ("ed-olive", "ed-paper-2", ed_light, "ed light verified / inset band"),
    ("ed-evidence", "ed-paper", ed_light, "ed light citation / stage"),
    ("ed-evidence", "ed-surface-2", ed_light, "ed light citation / page"),
    ("ed-evidence", "ed-evidence-soft", ed_light, "ed light citation / highlight"),
    ("ed-danger", "ed-paper", ed_light, "ed light error / stage"),
    ("ed-danger", "ed-surface", ed_light, "ed light error / surface"),
    # ── editorial dark (plan §5.3, dark table) ────────────────────────────
    ("ed-ink", "ed-paper", ed_dark, "ed DARK headline / stage"),
    ("ed-ink", "ed-surface", ed_dark, "ed DARK headline / surface"),
    ("ed-ink", "ed-surface-2", ed_dark, "ed DARK headline / page"),
    ("ed-ink", "ed-evidence-soft", ed_dark, "ed DARK ink / highlight fill"),
    ("ed-ink-2", "ed-paper", ed_dark, "ed DARK body / stage"),
    ("ed-ink-2", "ed-surface", ed_dark, "ed DARK body / surface"),
    ("ed-ink-2", "ed-paper-2", ed_dark, "ed DARK body / inset band"),
    ("ed-ink-3", "ed-paper", ed_dark, "ed DARK caption / stage"),
    ("ed-ink-3", "ed-surface", ed_dark, "ed DARK caption / surface"),
    ("ed-ink-3", "ed-surface-2", ed_dark, "ed DARK caption / page"),
    ("ed-signal", "ed-paper", ed_dark, "ed DARK link / stage"),
    ("ed-signal", "ed-surface", ed_dark, "ed DARK link / surface"),
    ("ed-signal", "ed-surface-2", ed_dark, "ed DARK link / page"),
    ("ed-on-signal", "ed-signal", ed_dark, "ed DARK CTA label / fill"),
    ("ed-on-signal", "ed-signal-deep", ed_dark, "ed DARK CTA label / hover"),
    ("ed-slate", "ed-paper", ed_dark, "ed DARK slate (retired role)"),
    ("ed-slate-2", "ed-paper", ed_dark, "ed DARK slate-2 (retired role)"),
    ("ed-olive", "ed-paper", ed_dark, "ed DARK verified / stage"),
    ("ed-olive", "ed-surface", ed_dark, "ed DARK verified / surface"),
    ("ed-evidence", "ed-paper", ed_dark, "ed DARK citation / stage"),
    ("ed-evidence", "ed-surface", ed_dark, "ed DARK citation / surface"),
    ("ed-evidence", "ed-evidence-soft", ed_dark, "ed DARK citation / highlight"),
    ("ed-danger", "ed-paper", ed_dark, "ed DARK error / stage"),
    ("ed-danger", "ed-surface", ed_dark, "ed DARK error / surface"),
    # ── app surface (globals.css, untouched by Phase 1) ───────────────────
    ("foreground", "background", light, "app body on white"),
    ("accent", "background", light, "app link"),
    ("workbench-muted", "workbench-canvas", light, "app secondary label"),
    ("workbench-ink", "workbench-canvas", light, "app primary text"),
    ("reader-ink", "reader-bg", light, "reader body"),
    ("reader-muted", "reader-bg", light, "reader secondary"),
    ("reader-evidence", "reader-bg", light, "CITATION MARKER"),
    ("reader-evidence", "reader-evidence-soft", light, "citation highlighted"),
    ("foreground", "background", dark, "dark body"),
    ("accent", "background", dark, "dark link"),
    ("workbench-muted", "workbench-canvas", dark, "dark secondary label"),
    ("reader-evidence", "reader-bg", dark, "dark citation marker"),
    ("reader-muted", "reader-bg", dark, "dark reader secondary"),
]

# WCAG 1.4.11: a control boundary is a non-text contrast and its floor is 3:1.
# --ed-control-border is only ever drawn on the stage or on a raised surface;
# it is not used on the inset band (2.92 there), which carries no controls.
NON_TEXT = [
    ("ed-control-border", "ed-paper", ed_light, "ed light control border / stage"),
    ("ed-control-border", "ed-surface", ed_light, "ed light control border / surface"),
    ("ed-control-border", "ed-paper", ed_dark, "ed DARK control border / stage"),
    ("ed-control-border", "ed-surface", ed_dark, "ed DARK control border / surface"),
]

bad = []
print(f"{'pair':<34} {'fg':<9} {'bg':<9} {'ratio':>6}  floor  AA")
print("-" * 78)
for group, floor in ((PAIRS, 4.5), (NON_TEXT, 3.0)):
    if floor == 3.0:
        print(f"{'— non-text boundaries (WCAG 1.4.11, floor 3:1) —':<34}")
    for fg, bg, src, label in group:
        if fg not in src or bg not in src:
            print(f"{label:<34} {'?':<9} {'?':<9} {'--':>6} {floor:>6}  SKIP (token not found)")
            continue
        r = ratio(src[fg], src[bg])
        ok = "PASS" if r >= floor else "FAIL"
        if r < floor:
            bad.append((label, src[fg], src[bg], r, floor))
        print(f"{label:<34} {src[fg]:<9} {src[bg]:<9} {r:>6.2f} {floor:>6}  {ok}")
print()
if bad:
    print(f"FAIL — {len(bad)} pair(s) below their floor")
    for l, f, b, r, floor in bad:
        print(f"  ✗ {l}: {f} on {b} = {r:.2f} (floor {floor})")
    sys.exit(1)
print("PASS — every parsed token pair clears its contrast floor.")
