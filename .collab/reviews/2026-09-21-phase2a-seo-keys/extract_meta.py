"""Extract every page's SEO head fields from a Next build: <title>, meta description,
og:title, og:description. One sorted line per (page, field) so two builds diff cleanly."""
import html, re, sys
from pathlib import Path
root = Path(sys.argv[1]) / ".next/server/app"
pats = {
  "title": re.compile(r"<title>(.*?)</title>", re.S),
  "desc":  re.compile(r'<meta name="description" content="([^"]*)"'),
  "ogt":   re.compile(r'<meta property="og:title" content="([^"]*)"'),
  "ogd":   re.compile(r'<meta property="og:description" content="([^"]*)"'),
}
out = []
for f in sorted(root.rglob("*.html")):
    s = f.read_text(encoding="utf-8", errors="replace")
    head = s.split("</head>", 1)[0]
    rel = str(f.relative_to(root))
    for k, p in pats.items():
        m = p.search(head)
        out.append(f"{rel}\t{k}\t{html.unescape(m.group(1)) if m else '<none>'}")
print("\n".join(out))
