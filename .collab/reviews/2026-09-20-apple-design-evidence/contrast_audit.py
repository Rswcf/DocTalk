"""WCAG contrast audit of DocTalk's declared design tokens against the HIG floors.
HIG Dark Mode page: 'no lower than 4.5:1'; 'strive for 7:1, especially in small text'.
Pure arithmetic - no model involved.
"""
def srgb(c):
    c = c / 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def lum(hexstr):
    h = hexstr.lstrip("#")
    if len(h) == 3:
        h = "".join(ch * 2 for ch in h)
    r, g, b = (int(h[i:i+2], 16) for i in (0, 2, 4))
    return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b)

def ratio(a, b):
    la, lb = lum(a), lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)

PAIRS = [
    # (label, foreground, background, role)
    ("editorial body on paper",        "#5b5a52", "#eae8e3", "body text"),
    ("editorial ink on paper",         "#20211e", "#eae8e3", "headline"),
    ("editorial ink-3 muted on paper", "#8a897f", "#eae8e3", "small label / eyebrow"),
    ("editorial terracotta on paper",  "#a04b34", "#eae8e3", "link / CTA text"),
    ("editorial slate on paper",       "#1f3a4d", "#eae8e3", "link"),
    ("editorial olive on paper",       "#3f6a34", "#eae8e3", "verified state"),
    ("white on terracotta CTA",        "#ffffff", "#a04b34", "primary button label"),
    ("white on terracotta-deep",       "#ffffff", "#843c28", "primary button hover"),

    ("app fg on white",                "#09090b", "#ffffff", "body"),
    ("app accent blue on white",       "#1D4ED8", "#ffffff", "link / CTA text"),
    ("white on accent blue",           "#ffffff", "#1D4ED8", "primary button label"),
    ("app fg on page bg",              "#09090b", "#f6f8fc", "body on canvas"),
    ("workbench muted on canvas",      "#64748b", "#eef3fb", "secondary label"),
    ("workbench ink on canvas",        "#111827", "#eef3fb", "primary UI text"),

    ("reader ink on reader bg",        "#1f2933", "#f4f1ea", "reader body"),
    ("reader muted on reader bg",      "#716b63", "#f4f1ea", "reader secondary"),
    ("reader evidence on reader bg",   "#b7791f", "#f4f1ea", "citation marker"),
    ("reader evidence on evidence-soft","#b7791f","#fff4d6", "highlighted citation"),

    ("dark fg on dark bg",             "#fafafa", "#09090b", "body (dark)"),
    ("dark accent on dark bg",         "#60A5FA", "#09090b", "link (dark)"),
    ("dark accent on surface-1",       "#60A5FA", "#18181b", "link on card (dark)"),
    ("accent-fg on dark accent",       "#0b1726", "#60A5FA", "button label (dark)"),
    ("workbench muted on dark canvas", "#64748b", "#111214", "secondary label (dark)"),
]

print(f"{'pair':<36} {'role':<24} {'ratio':>6}  AA4.5  AAA7")
print("-" * 82)
fails, weak = [], []
for label, fg, bg, role in PAIRS:
    r = ratio(fg, bg)
    aa = "PASS" if r >= 4.5 else "FAIL"
    aaa = "pass" if r >= 7.0 else "—"
    if r < 4.5:
        fails.append((label, role, r))
    elif r < 7.0:
        weak.append((label, role, r))
    print(f"{label:<36} {role:<24} {r:>6.2f}  {aa:<5}  {aaa}")

print(f"\nBelow the HIG 4.5:1 floor: {len(fails)}")
for l, ro, r in fails:
    print(f"  ✗ {l} ({ro}) = {r:.2f}:1")
print(f"\nPasses 4.5 but below the 7:1 target for small text: {len(weak)}")
for l, ro, r in weak:
    print(f"  · {l} ({ro}) = {r:.2f}:1")
