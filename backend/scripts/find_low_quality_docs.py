"""Find (and optionally re-parse) documents that predate a parse-pipeline fix or whose
extracted text is low quality — the R2b backfill finder.

Read-only by default. With --enqueue it re-dispatches parse_document (idempotent; the worker
now self-detects script via OSD, so no locale is required). To avoid a re-processing loop,
documents already OCR'd at the current PARSE_PIPELINE_VERSION are skipped unless --force.

Usage (in-prod, inside the backend container):
    DB=$DATABASE_PUBLIC_URL python3 scripts/find_low_quality_docs.py            # list
    DB=$DATABASE_PUBLIC_URL python3 scripts/find_low_quality_docs.py --enqueue  # re-parse
    ... --quality 0.7 --limit 50 --locale ur --force
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys

# Make the backend root importable when run as `python3 scripts/find_low_quality_docs.py`
# (sys.path[0] would otherwise be backend/scripts and `app` would not resolve).
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncpg  # noqa: E402

from app.services.parse_service import PARSE_PIPELINE_VERSION  # noqa: E402


def _dsn() -> str:
    raw = os.environ.get("DB") or os.environ.get("DATABASE_PUBLIC_URL") or os.environ.get("DATABASE_URL", "")
    return raw.replace("postgresql+asyncpg://", "postgresql://").replace("postgresql+psycopg://", "postgresql://")


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--quality", type=float, default=0.70, help="text_quality below this is a candidate")
    ap.add_argument("--limit", type=int, default=100)
    ap.add_argument("--enqueue", action="store_true", help="re-dispatch parse_document for candidates")
    ap.add_argument("--force", action="store_true", help="include docs already OCR'd at current version")
    ap.add_argument("--locale", default=None, help="optional OCR locale hint (OSD self-detects otherwise)")
    args = ap.parse_args()

    con = await asyncpg.connect(_dsn())
    try:
        rows = await con.fetch(
            """
            SELECT id::text, left(filename, 50) AS fn, file_type, status,
                   parse_version, parse_method, text_quality
            FROM documents
            WHERE demo_slug IS NULL
              AND status = 'ready'
              AND (parse_version IS NULL
                   OR parse_version < $1
                   OR (text_quality IS NOT NULL AND text_quality < $2))
            ORDER BY text_quality NULLS FIRST, created_at
            LIMIT $3
            """,
            PARSE_PIPELINE_VERSION, args.quality, args.limit,
        )
        print(f"PARSE_PIPELINE_VERSION={PARSE_PIPELINE_VERSION}  candidates={len(rows)}  "
              f"(quality<{args.quality})")
        enqueue: list[str] = []
        for r in rows:
            m = dict(r)
            # A doc already processed at the current pipeline version won't improve by
            # re-running the same pipeline — skip ALL such rows (not just OCR'd ones) to avoid
            # a re-enqueue loop on low-quality text/non-PDF docs the worker can't OCR better.
            # Only OLD-version or never-versioned docs auto-enqueue; current-version low-quality
            # docs are listed for manual review and need --force.
            at_current = (m["parse_version"] or 0) >= PARSE_PIPELINE_VERSION
            skip = at_current and not args.force
            flag = " SKIP(processed@current; --force to override)" if skip else ""
            print(f"  {m['id']} v={m['parse_version']} m={m['parse_method']} "
                  f"q={m['text_quality']} {m['file_type']:4} {m['fn']}{flag}")
            if not skip:
                enqueue.append(m["id"])

        if args.enqueue and enqueue:
            from app.workers.parse_worker import parse_document
            for did in enqueue:
                parse_document.delay(did, locale=args.locale)
            print(f"\nENQUEUED {len(enqueue)} re-parse tasks (locale={args.locale}).")
        elif args.enqueue:
            print("\nNothing to enqueue.")
    finally:
        await con.close()


if __name__ == "__main__":
    asyncio.run(main())
