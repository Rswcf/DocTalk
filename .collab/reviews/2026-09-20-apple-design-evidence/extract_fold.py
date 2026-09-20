"""Extract the above-the-fold grammar of each public DocTalk route from PRODUCTION HTML.

No judgement here - pure extraction, so Jev judges real rendered copy, not my paraphrase.
"""
from __future__ import annotations
import concurrent.futures, html, json, re, sys, urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROUTES = [l.strip() for l in (HERE / "routes-en.txt").read_text().splitlines() if l.strip()]

TAG = re.compile(r"<[^>]+>")
WS = re.compile(r"\s+")


def text(fragment: str) -> str:
    return WS.sub(" ", html.unescape(TAG.sub(" ", fragment))).strip()


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "DocTalk-design-audit/1.0"})
    with urllib.request.urlopen(req, timeout=45) as r:
        return r.read().decode("utf-8", "replace")


def strip_noise(doc: str) -> str:
    for pat in (r"<script\b.*?</script>", r"<style\b.*?</style>", r"<svg\b.*?</svg>",
                r"<header\b.*?</header>", r"<footer\b.*?</footer>", r"<nav\b.*?</nav>"):
        doc = re.sub(pat, " ", doc, flags=re.S | re.I)
    return doc


def analyse(url: str) -> dict:
    try:
        doc = fetch(url)
    except Exception as exc:                                    # noqa: BLE001
        return {"url": url, "error": str(exc)}
    body = strip_noise(doc)

    h1s = [text(m) for m in re.findall(r"<h1\b[^>]*>(.*?)</h1>", body, re.S | re.I)]
    h2s = [text(m) for m in re.findall(r"<h2\b[^>]*>(.*?)</h2>", body, re.S | re.I)]
    ps = [text(m) for m in re.findall(r"<p\b[^>]*>(.*?)</p>", body, re.S | re.I)]
    ps = [p for p in ps if len(p) > 25]

    # Links/buttons that look like calls to action, in document order, before the
    # 3rd h2 - a proxy for "above / near the fold".
    cut = body
    parts = re.split(r"<h2\b", body, flags=re.I)
    if len(parts) > 3:
        cut = "<h2".join(parts[:3])
    ctas = []
    for m in re.finditer(r"<a\b[^>]*href=\"([^\"]*)\"[^>]*>(.*?)</a>", cut, re.S | re.I):
        label = text(m.group(2))
        if 2 <= len(label) <= 44:
            ctas.append({"label": label, "href": m.group(1)})
    for m in re.finditer(r"<button\b[^>]*>(.*?)</button>", cut, re.S | re.I):
        label = text(m.group(1))
        if 2 <= len(label) <= 44:
            ctas.append({"label": label, "href": None})

    # Eyebrow: the editorial kit renders kickers with the mono font var.
    eyebrows = [text(m) for m in re.findall(
        r"<(?:span|div|p)\b[^>]*(?:--dt-mono|ed-label|ed-kicker|tracking-\[?0\.[0-9]+)[^>]*>(.*?)</(?:span|div|p)>",
        cut, re.S | re.I)]
    eyebrows = [e for e in eyebrows if 0 < len(e) <= 60][:3]

    fold_words = len(" ".join(([h1s[0]] if h1s else []) + ps[:2]).split())
    return {
        "url": url.replace("https://www.doctalk.site", "") or "/",
        "headline": h1s[0] if h1s else None,
        "eyebrow": eyebrows[0] if eyebrows else None,
        "subhead": ps[0] if ps else None,
        "second_paragraph": ps[1] if len(ps) > 1 else None,
        "first_section_headings": h2s[:3],
        "actions_near_top": ctas[:8],
        "action_count_near_top": len(ctas),
        "words_before_first_section": fold_words,
        "total_h2_sections": len(h2s),
    }


def main() -> None:
    only = sys.argv[1] if len(sys.argv) > 1 else None
    routes = [r for r in ROUTES if not re.search(r"/blog", r)] if only == "nonblog" else ROUTES
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        rows = list(pool.map(analyse, routes))
    out = HERE / "fold-extract.json"
    out.write_text(json.dumps(rows, indent=2, ensure_ascii=False))
    ok = [r for r in rows if "error" not in r]
    print(f"{len(ok)}/{len(rows)} routes extracted -> {out}")
    for r in ok[:3]:
        print(json.dumps(r, indent=2, ensure_ascii=False)[:900])


if __name__ == "__main__":
    main()
