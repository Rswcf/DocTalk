"""Admin-only, read-only refund queue snapshot. No dotenv or mutation commands."""

import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone


def validate_identity(mode, account, key):
    if not re.fullmatch(r"acct_[A-Za-z0-9]+", account):
        raise ValueError("invalid_expected_account")
    prefixes = ("sk_live_", "rk_live_") if mode == "live" else ("sk_test_", "rk_test_")
    if not key.startswith(prefixes):
        raise ValueError("credential_mode_mismatch")


def import_ops_helper():
    # The shared helper transitively imports settings; suppress dotenv only in
    # this CLI's bootstrap. Real process environment remains authoritative.
    from unittest.mock import patch

    from pydantic_settings.sources import DotEnvSettingsSource

    with (
        patch.object(DotEnvSettingsSource, "__call__", return_value={}),
        patch.object(DotEnvSettingsSource, "_read_env_files", return_value={}),
    ):
        from app.services.refund_ops_service import get_refund_operations_status
    return get_refund_operations_status


async def queue_snapshot(url, limit):
    from pathlib import Path

    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    get_refund_operations_status = import_ops_helper()

    url = url.replace("postgresql://", "postgresql+asyncpg://", 1).replace(
        "postgresql+psycopg://", "postgresql+asyncpg://", 1
    )
    engine = create_async_engine(
        url,
        connect_args={
            "timeout": 5,
            "command_timeout": 5,
            "server_settings": {
                "default_transaction_read_only": "on",
                "statement_timeout": "5000",
            },
        },
    )
    try:
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            async with db.begin():
                if await db.scalar(text("SHOW transaction_read_only")) != "on":
                    raise ValueError("database_not_readonly")
                return await get_refund_operations_status(db, limit=limit)
    finally:
        await engine.dispose()


def parser():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--mode", choices=("test", "live"), required=True)
    p.add_argument("--account", required=True, help="Exact expected Stripe account ID")
    p.add_argument(
        "--limit", type=int, default=50, choices=range(1, 101), metavar="1..100"
    )
    return p


def main(argv=None):
    args = parser().parse_args(argv)
    # This is an operator acknowledgement, not an authentication replacement.
    # Access remains restricted by secure shell/container credentials and DB grants.
    if os.environ.get("DOCTALK_REFUND_OPS_ADMIN") != "1":
        raise ValueError("secure_admin_environment_required")
    key = os.environ.get("STRIPE_SECRET_KEY", "")
    validate_identity(args.mode, args.account, key)
    import asyncio

    import stripe

    client = stripe.StripeClient(
        key, max_network_retries=0, http_client=stripe.RequestsClient(timeout=10)
    )
    account = client.v1.accounts.retrieve_current()
    if account.id != args.account:
        raise ValueError("stripe_account_mismatch")
    snapshot = asyncio.run(queue_snapshot(os.environ["DATABASE_URL"], args.limit))
    result = {
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "scope": "DB-only queue; Stripe Account GET identity only",
        "mode": args.mode,
        "account_verified": True,
        "database_readonly": True,
        "financial_writes": False,
        "operations": snapshot,
    }
    print(json.dumps(result, default=str))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        # Provider/DB errors can contain URLs, credentials or personal data.
        print(
            json.dumps({"error_type": type(exc).__name__, "failed": True}),
            file=sys.stderr,
        )
        sys.exit(1)
