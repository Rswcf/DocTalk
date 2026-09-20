"""Verify any proposed palette against the HIG contrast floors, and show how far a hue
must darken to clear them. Used to CHECK the plan's colour claims, not to author them.

  python3 check_palette.py pairs '[["#a04b34","#eae8e3","terracotta on paper"]]'
  python3 check_palette.py ramp  "#a04b34" "#eae8e3"     # darkening curve to 4.5 / 7.0
"""
import json, sys

def _lin(c):
    c /= 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def lum(h):
    h = h.lstrip("#")
    if len(h) == 3: h = "".join(c * 2 for c in h)
    r, g, b = (int(h[i:i+2], 16) for i in (0, 2, 4))
    return 0.2126*_lin(r) + 0.7152*_lin(g) + 0.0722*_lin(b)

def ratio(a, b):
    la, lb = lum(a), lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)

def rgb(h):
    h = h.lstrip("#")
    if len(h) == 3: h = "".join(c * 2 for c in h)
    return [int(h[i:i+2], 16) for i in (0, 2, 4)]

def hexs(t):
    return "#" + "".join(f"{max(0,min(255,round(v))):02x}" for v in t)

def scale(h, k):
    """Multiply linear-ish by k (k<1 darkens) keeping hue roughly constant."""
    return hexs([v * k for v in rgb(h)])

def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "pairs"
    if mode == "pairs":
        pairs = json.loads(sys.argv[2])
        bad = 0
        print(f"{'fg':<9} {'bg':<9} {'ratio':>6}  AA4.5  AAA7  label")
        print("-" * 68)
        for fg, bg, label in pairs:
            r = ratio(fg, bg)
            aa = "PASS" if r >= 4.5 else "FAIL"
            aaa = "pass" if r >= 7.0 else "—"
            if r < 4.5: bad += 1
            print(f"{fg:<9} {bg:<9} {r:>6.2f}  {aa:<5}  {aaa:<4}  {label}")
        print(f"\n{bad} pair(s) below the 4.5:1 HIG floor.")
        sys.exit(1 if bad else 0)
    elif mode == "ramp":
        base, bg = sys.argv[2], sys.argv[3]
        print(f"darkening {base} against {bg} (current {ratio(base,bg):.2f}:1)")
        hit45 = hit70 = None
        for i in range(0, 61):
            k = 1 - i / 100
            c = scale(base, k)
            r = ratio(c, bg)
            if hit45 is None and r >= 4.5: hit45 = (c, r, k)
            if hit70 is None and r >= 7.0: hit70 = (c, r, k); break
        if hit45: print(f"  clears 4.5:1 at {hit45[0]} ({hit45[1]:.2f}:1, {round((1-hit45[2])*100)}% darker)")
        if hit70: print(f"  clears 7.0:1 at {hit70[0]} ({hit70[1]:.2f}:1, {round((1-hit70[2])*100)}% darker)")
        else: print("  never reaches 7.0:1 within 60% darkening")

if __name__ == "__main__":
    main()
