"""Submit changed pages to IndexNow (Bing, Yandex, Seznam, Naver) after a release.

Ship-checklist step, not CI (Fable, .collab/dialogue/2026-10-10-fable-step5-indexnow.md).
ChatGPT search reads Bing's index, so a page Bing has not refetched is a page
ChatGPT cannot cite in its new form.

Submit only the URLs whose content changed, never the whole sitemap. Before it
sends anything, the script checks against PRODUCTION, without caches:
  - the public key file is live and matches,
  - every URL is listed in the live sitemap,
  - every URL returns HTTP 200 and carries no `noindex`.
One failed check stops the run with nothing sent.

Usage (paths or full URLs; a dry run unless --send):
  python3 frontend/scripts/seo/indexnow_submit.py /blog/my-post /ja/use-cases/students
  python3 frontend/scripts/seo/indexnow_submit.py --file changed.txt --send

The key is public by design: it is read from frontend/public/<key>.txt, the file
production serves. This script never touches /api/indexnow or AUTH_SECRET.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

HOST = "www.doctalk.site"
BASE = f"https://{HOST}"
PUBLIC = Path(__file__).resolve().parents[2] / "public"


def _public_key() -> str:
    """The IndexNow key is the name of the one 32-hex .txt file in frontend/public (same as route.ts)."""
    names = [f.stem for f in PUBLIC.glob("*.txt") if re.fullmatch(r"[0-9a-f]{32}", f.stem)]
    if len(names) != 1:
        sys.exit(f"expected one IndexNow key file in {PUBLIC}, found {len(names)}")
    return names[0]


KEY = _public_key()
ENDPOINT = "https://api.indexnow.org/indexnow"
HEADERS = {"Cache-Control": "no-cache", "Pragma": "no-cache", "User-Agent": "doctalk-indexnow-submit"}
NOINDEX = re.compile(r'<meta name="robots" content="[^"]*noindex', re.I)


def fetch(url: str) -> tuple[int, str]:
    sep = "&" if "?" in url else "?"
    req = urllib.request.Request(f"{url}{sep}v={int(time.time())}", headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as err:
        return err.code, ""


def to_url(arg: str) -> str:
    arg = arg.strip()
    if arg.startswith("http"):
        return arg
    return BASE + (arg if arg.startswith("/") else f"/{arg}")


def validate(urls: list[str]) -> list[str]:
    problems = []
    status, body = fetch(f"{BASE}/{KEY}.txt")
    if status != 200 or body.strip() != KEY:
        return [f"key file: HTTP {status}, content does not match"]
    status, sitemap = fetch(f"{BASE}/sitemap.xml")
    if status != 200:
        return [f"sitemap: HTTP {status}"]
    listed = set(re.findall(r"<loc>([^<]+)</loc>", sitemap))
    for url in urls:
        if not url.startswith(f"{BASE}/") and url != BASE:
            problems.append(f"{url}: not on {HOST}")
            continue
        if url not in listed:
            problems.append(f"{url}: not in the live sitemap")
            continue
        status, html = fetch(url)
        if status != 200:
            problems.append(f"{url}: HTTP {status}")
        elif NOINDEX.search(html):
            problems.append(f"{url}: noindex")
    return problems


def submit(urls: list[str]) -> int:
    payload = {"host": HOST, "key": KEY, "keyLocation": f"{BASE}/{KEY}.txt", "urlList": urls}
    req = urllib.request.Request(
        ENDPOINT,
        data=json.dumps(payload).encode(),
        method="POST",
        headers={"Content-Type": "application/json; charset=utf-8"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            print(f"IndexNow HTTP {resp.status} {resp.reason}")
            return 0
    except urllib.error.HTTPError as err:
        print(f"IndexNow HTTP {err.code} {err.reason} {err.read()[:300]!r}")
        return 2


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("urls", nargs="*", help="paths (/blog/x) or full URLs")
    parser.add_argument("--file", help="file with one path or URL per line (# comments allowed)")
    parser.add_argument("--send", action="store_true", help="submit after validation (default: dry run)")
    args = parser.parse_args()

    raw = list(args.urls)
    if args.file:
        with open(args.file, encoding="utf-8") as handle:
            raw += [line for line in handle if line.strip() and not line.lstrip().startswith("#")]
    urls = list(dict.fromkeys(to_url(item) for item in raw))
    if not urls:
        parser.error("no URLs given")
    if len(urls) > 10000:
        parser.error("IndexNow accepts at most 10,000 URLs per request")

    problems = validate(urls)
    if problems:
        print("\n".join(problems))
        print(f"stopped: {len(problems)} problem(s), nothing sent")
        return 1
    print(f"validated {len(urls)} URL(s)")
    if not args.send:
        print("dry run: add --send to submit")
        return 0
    code = submit(urls)
    print("\n".join(urls))
    return code


if __name__ == "__main__":
    sys.exit(main())
