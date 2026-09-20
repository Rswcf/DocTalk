"""Parse the REAL token values out of editorial.css / globals.css and check every
foreground/background pair that actually renders. Reads the files, so it cannot drift
from the source the way a hardcoded audit does. Exit 1 if any pair is below 4.5:1.
"""
import re, sys, io
from pathlib import Path

FE = Path("/Users/mayijie/Projects/Code/010_DocTalk/.claude/worktrees/frontend-design-review-c26fcb/frontend/src/app")

def _lin(c):
    c /= 255
    return c/12.92 if c <= 0.04045 else ((c+0.055)/1.055)**2.4
def lum(h):
    h = h.lstrip("#")
    if len(h) == 3: h = "".join(c*2 for c in h)
    r,g,b = (int(h[i:i+2],16) for i in (0,2,4))
    return .2126*_lin(r)+.7152*_lin(g)+.0722*_lin(b)
def ratio(a,b):
    la,lb = lum(a),lum(b); hi,lo = max(la,lb),min(la,lb)
    return (hi+.05)/(lo+.05)

def tokens(path, scope_start, scope_end=None):
    """Grab `--name: #hex;` declarations between two markers."""
    s = io.open(path, encoding="utf-8").read()
    i = s.find(scope_start)
    j = s.find(scope_end, i) if scope_end else len(s)
    out = {}
    for m in re.finditer(r"--([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8})\s*;", s[i:j]):
        out[m.group(1)] = m.group(2)
    return out

ed   = tokens(FE/"editorial.css", ".dt-editorial {", "html:lang")
light= tokens(FE/"globals.css", ":root {\n  --background: #ffffff;", ".dark {")
dark = tokens(FE/"globals.css", ".dark {", ".dt-workbench-canvas")

# (fg token, bg token, source dict, label) — only pairs that really render as text.
PAIRS = [
 ("ed-ink",   "ed-paper",  ed, "editorial headline"),
 ("ed-ink-2", "ed-paper",  ed, "editorial body"),
 ("ed-ink-2", "ed-paper-2",ed, "editorial body on alt band"),
 ("ed-ink-3", "ed-paper",  ed, "editorial caption"),
 ("ed-signal","ed-paper",  ed, "editorial link / CTA text"),
 ("ed-slate", "ed-paper",  ed, "editorial slate link"),
 ("ed-olive", "ed-paper",  ed, "editorial verified"),
 ("foreground","background",light,"app body on white"),
 ("accent",   "background",light,"app link"),
 ("workbench-muted","workbench-canvas",light,"app secondary label"),
 ("workbench-ink",  "workbench-canvas",light,"app primary text"),
 ("reader-ink",     "reader-bg",light,"reader body"),
 ("reader-muted",   "reader-bg",light,"reader secondary"),
 ("reader-evidence","reader-bg",light,"CITATION MARKER"),
 ("reader-evidence","reader-evidence-soft",light,"citation highlighted"),
 ("foreground","background",dark,"dark body"),
 ("accent",   "background",dark,"dark link"),
 ("workbench-muted","workbench-canvas",dark,"dark secondary label"),
 ("reader-evidence","reader-bg",dark,"dark citation marker"),
 ("reader-muted",   "reader-bg",dark,"dark reader secondary"),
]

bad = []
print(f"{'pair':<34} {'fg':<9} {'bg':<9} {'ratio':>6}  AA")
print("-"*70)
for fg,bg,src,label in PAIRS:
    if fg not in src or bg not in src:
        print(f"{label:<34} {'?':<9} {'?':<9} {'--':>6}  SKIP (token not found)"); continue
    r = ratio(src[fg], src[bg])
    ok = "PASS" if r >= 4.5 else "FAIL"
    if r < 4.5: bad.append((label, src[fg], src[bg], r))
    print(f"{label:<34} {src[fg]:<9} {src[bg]:<9} {r:>6.2f}  {ok}")
print()
if bad:
    print(f"FAIL — {len(bad)} pair(s) below 4.5:1")
    for l,f,b,r in bad: print(f"  ✗ {l}: {f} on {b} = {r:.2f}")
    sys.exit(1)
print("PASS — every parsed token pair clears the HIG 4.5:1 floor.")
