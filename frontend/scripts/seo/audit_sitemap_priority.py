"""Classify every LOCALIZED_PATH into a sitemap priority tier with Jev.

Design: .collab/plans/2026-09-20-jev-seo-design.md §3.1 (sitemap derivation).
Sitemap priority is a *relative importance* judgment over page content, which is
exactly the kind of bounded classification System One is for. The raw
probabilities are written alongside the decision so the tier boundaries can be
changed later in code without re-running inference.

Read-only: writes a table, changes no application source.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from jev_client import JevClient, choice  # noqa: E402

SRC = Path(__file__).resolve().parents[2] / "src"
OUT = Path(__file__).resolve().parent / "out"

TIERS = {
    "1.0": "The site's single primary entry point — the home page itself. At most one page qualifies.",
    "0.8": (
        "A top-level conversion or commercial-intent page: pricing, the free trial/demo entry, "
        "or a flagship capability page that is the main reason someone would choose this product."
    ),
    "0.7": (
        "A substantive content page targeting one specific audience, competitor or capability. "
        "It can rank on its own for a real query but is not the primary conversion step."
    ),
    "0.6": (
        "A supporting page: a hub or index that mostly lists other pages, a utility/tool page, "
        "or a secondary capability page that few people search for directly."
    ),
}


def load_locale(name: str) -> dict:
    return json.loads((SRC / "i18n" / "locales" / f"{name}.json").read_text(encoding="utf-8"))


def harvest_paths() -> dict[str, tuple[str, str | None]]:
    """path -> (titleKey, descKey) from the app/[locale] page files."""
    out: dict[str, tuple[str, str | None]] = {}
    for f in (SRC / "app" / "[locale]").rglob("page.tsx"):
        s = f.read_text(encoding="utf-8")
        p = re.search(r"path:\s*'([^']+)'", s)
        t = re.search(r"titleKey:\s*'([^']+)'", s) or re.search(r"t\('([^']*[Hh]eroTitle)'\)", s)
        d = re.search(r"descKey:\s*'([^']+)'", s) or re.search(
            r"t\('([^']*(?:heroDescription|heroSubtitle))'\)", s
        )
        if p and t:
            out[p.group(1)] = (t.group(1), d.group(1) if d else None)
    return out


def main() -> int:
    en = load_locale("en")
    paths = harvest_paths()
    client = JevClient()
    rows = []

    for path in sorted(paths):
        title_key, desc_key = paths[path]
        title = en.get(title_key, "")
        desc = en.get(desc_key, "") if desc_key else ""
        if not title:
            print(f"  SKIP {path}: no English title for {title_key}", file=sys.stderr)
            continue
        state = {"url_path": path, "page_title": title, "page_description": desc}
        resp = client.ask(
            state,
            {
                "tier": choice(
                    {
                        "question": (
                            "This is one page of an AI document-chat product's marketing site. "
                            "Which XML-sitemap priority tier fits `url_path`, judging by "
                            "`page_title` and `page_description`? Priority is relative importance "
                            "within this site only."
                        )
                    },
                    TIERS,
                )
            },
        )
        a = resp["answers"]["tier"]
        rows.append(
            {
                "path": path,
                "tier": a["choice"],
                "confidence": round(a["confidence"], 3),
                "probabilities": {k: round(v, 3) for k, v in a["probabilities"].items()},
                "title": title,
            }
        )
        print(f"  {path:<34} -> {a['choice']}  conf={a['confidence']:.2f}")

    OUT.mkdir(exist_ok=True)
    (OUT / "sitemap_priority.json").write_text(
        json.dumps(rows, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print(f"\n{len(rows)} pages classified. {client.usage_line()}")
    print(f"written: {OUT / 'sitemap_priority.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
