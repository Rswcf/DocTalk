"""Report exact legacy settlement candidates; apply only a reviewed manifest.

Report: python3 scripts/legacy_credit_settlements.py --user-id UUID --ledger-id UUID ...
Apply: DOCTALK_LEGACY_SETTLEMENT_ADMIN=1 python3 scripts/legacy_credit_settlements.py \
       --apply /private/path/reviewed.json --reviewed-by OPERATOR
All database access uses DATABASE_URL. No provider API is imported or called.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.models.database import AsyncSessionLocal  # noqa: E402
from app.services.legacy_settlement_service import (  # noqa: E402
    apply_manifest,
    build_manifest,
)


async def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--user-id")
    parser.add_argument("--ledger-id", action="append", default=[])
    parser.add_argument("--apply", metavar="REVIEWED_MANIFEST")
    parser.add_argument("--reviewed-by")
    args = parser.parse_args()
    if args.apply and (args.user_id or args.ledger_id):
        parser.error("apply uses only the exact reviewed manifest")
    if not args.apply and (not args.user_id or not args.ledger_id):
        parser.error("report requires --user-id and explicit --ledger-id values")
    async with AsyncSessionLocal() as db:
        try:
            if args.apply:
                with open(args.apply) as handle:
                    manifest = json.load(handle)
                count = await apply_manifest(db, manifest, args.reviewed_by)
                await db.commit()
                print(
                    json.dumps(
                        {
                            "attested_count": count,
                            "manifest_sha256": manifest["manifest_sha256"],
                        }
                    )
                )
            else:
                # Enforce report-only at the database, not just application intent.
                import sqlalchemy as sa

                await db.execute(sa.text("SET TRANSACTION READ ONLY"))
                report = await build_manifest(db, args.user_id, args.ledger_id)
                await db.rollback()
                print(json.dumps(report, indent=2, sort_keys=True))
        except BaseException:
            await db.rollback()
            raise


if __name__ == "__main__":
    asyncio.run(main())
