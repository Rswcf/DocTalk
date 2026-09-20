"""Build a Google disavow file from the classified backlink host list.

Input:  data/backlink_hosts_20260920.psv  (host|authority_score|anchor_pattern)
Output: out/disavow-doctalk.site-<date>.txt

Format rules (Search Console):
  - one directive per line, UTF-8
  - `domain:example.com` disavows that domain AND all its subdomains
  - lines starting with # are comments
Collapsing `mail.x.com` into `domain:x.com` is therefore correct and shorter.

KEEP list is explicit: anything genuinely earned must never enter the file.
"""
from __future__ import annotations

import csv
from collections import defaultdict
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent
SRC = HERE / "data" / "backlink_hosts_20260920.psv"
OUT = HERE / "out"

# Never disavow these. Verified individually.
KEEP = {
    "github.com": "the project's own public repository",
    "parse.gl": "editorial mention in an article about AI discovery engines",
    "doctalk-liard.vercel.app": "our own Vercel preview deployment, not a third-party link",
}

# Real domain, but a junk auto-generated page. One link. Disavowing a single
# blogspot subdomain is safe; disavowing blogspot.com would not be.
SUBDOMAIN_ONLY = {"suharikelimddw.blogspot.com"}


def root_of(host: str) -> str:
    """Collapse a `mail.` (or other single) prefix onto the registrable domain.

    Deliberately conservative: only strips a leading `mail.`, `www.` or
    `websites.`/`sites.` label, because a generic 'last two labels' rule breaks
    on the many multi-part suffixes in this list (.co.in, .us.com, .com.lc,
    .uk.net, .org.in, .com.bz, .co.com).
    """
    for prefix in ("mail.", "www.", "websites.", "sites."):
        if host.startswith(prefix):
            return host[len(prefix):]
    return host


def main() -> int:
    rows = list(csv.DictReader(SRC.open(encoding="utf-8"), delimiter="|"))
    groups: dict[str, set[str]] = defaultdict(set)
    kept, subdomain_entries = [], []

    for row in rows:
        host, pattern = row["host"].strip(), row["anchor_pattern"].strip()
        if host in KEEP:
            kept.append((host, KEEP[host]))
            continue
        if host in SUBDOMAIN_ONLY:
            subdomain_entries.append((host, pattern))
            continue
        groups[pattern].add(root_of(host))

    total = sum(len(v) for v in groups.values()) + len(subdomain_entries)
    today = date.today().isoformat()
    lines = [
        f"# Disavow file for doctalk.site — generated {today}",
        "#",
        "# Source: Semrush Backlink Analytics, crawl 2026-09-19 (191 referring domains,",
        "# 307 backlinks). 96% of referring domains sit at Authority Score 0-10.",
        "#",
        "# Two live link-selling campaigns name doctalk.site inside their own ad copy:",
        '#   "high quality dofollow backlinks da 50 pa 40 premium pbn network service',
        '#    doctalk.site rank first page google fast seo link building buy backlinks',
        '#    online cheap"   - 105 backlinks / 70 referring domains, last seen 2026-09-20',
        '#   "expert manual outreach backlinks for doctalk.site designed to improve da,',
        '#    dr and tf..."  - 13 backlinks / 13 referring domains, first seen 2026-09-11',
        "#",
        "# Nobody at DocTalk purchased links. These are unsolicited.",
        "#",
        f"# {total} domains disavowed, grouped by the anchor-text campaign they belong to.",
        "# Deliberately NOT disavowed:",
    ]
    for host, why in sorted(kept):
        lines.append(f"#   {host} — {why}")
    lines.append("")

    for pattern in sorted(groups, key=lambda p: (-len(groups[p]), p)):
        hosts = sorted(groups[pattern])
        lines.append(f"# {pattern} ({len(hosts)})")
        lines.extend(f"domain:{h}" for h in hosts)
        lines.append("")

    if subdomain_entries:
        lines.append("# Single junk pages on shared hosts — subdomain-scoped on purpose,")
        lines.append("# because disavowing the parent domain would be far too broad.")
        for host, pattern in sorted(subdomain_entries):
            lines.append(f"domain:{host}")
        lines.append("")

    OUT.mkdir(exist_ok=True)
    path = OUT / f"disavow-doctalk.site-{today}.txt"
    path.write_text("\n".join(lines), encoding="utf-8")
    print(f"{total} domains disavowed across {len(groups)} campaigns; {len(kept)} kept")
    print(f"written: {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
