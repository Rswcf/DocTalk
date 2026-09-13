"""Alembic downgrade round-trip test.

Ensures every migration has a working downgrade() path. Running
`upgrade head → downgrade base → upgrade head` catches:

- Missing or broken `downgrade()` implementations
- Syntax errors in downgrade SQL
- State inconsistency that blocks re-upgrade (e.g., data-loss-on-downgrade
  that leaves constraints referencing dropped columns)

Marked `integration` because it requires a live PostgreSQL database. Runs
against the same DATABASE_URL used by the rest of the integration suite;
the test wipes and rebuilds schema, so do NOT point it at a shared DB.
"""
from __future__ import annotations

import asyncio
import os
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlsplit

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

# Project root holds alembic.ini (backend/alembic.ini)
BACKEND_DIR = Path(__file__).resolve().parent.parent


def _reset_scratch_schema() -> None:
    """Remove test data so downgrade checks only migration reversibility."""
    database_url = os.environ["DATABASE_URL"]
    database_name = urlsplit(database_url).path.lstrip("/")
    if not os.environ.get("DOCTALK_TEST_DATABASE_URL") and database_name != "doctalk_test":
        raise RuntimeError(
            f"Refusing to reset non-scratch database {database_name!r}"
        )
    async_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)

    async def reset() -> None:
        engine = create_async_engine(async_url)
        try:
            async with engine.begin() as connection:
                await connection.execute(text("DROP SCHEMA public CASCADE"))
                await connection.execute(text("CREATE SCHEMA public"))
        finally:
            await engine.dispose()

    asyncio.run(reset())


def _alembic(*args: str) -> None:
    """Invoke alembic as a subprocess from the backend dir."""
    env = os.environ.copy()
    # alembic reads DATABASE_URL via env.py; ensure both sync and async
    # forms are usable. Tests use a dedicated throw-away DB.
    result = subprocess.run(
        # Use the same interpreter that runs pytest; "python" may not exist
        # on systems that only ship python3.
        [sys.executable, "-m", "alembic", *args],
        cwd=str(BACKEND_DIR),
        env=env,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise AssertionError(
            f"alembic {' '.join(args)} failed (exit {result.returncode}):\n"
            f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
        )


@pytest.mark.integration
def test_migrations_downgrade_and_reupgrade_round_trip():
    """All migrations must support a full downgrade → upgrade cycle."""
    # Earlier integration cases intentionally create collection-only sessions,
    # which cannot exist before migration 0009. Reset this dedicated scratch
    # schema so the round trip tests migration DDL rather than test-order data.
    _reset_scratch_schema()
    # Start from a known state: fully upgraded and empty.
    _alembic("upgrade", "head")
    # Walk all the way back. If any migration's downgrade() is missing or
    # broken, alembic will raise and the test fails with diagnostic output.
    _alembic("downgrade", "base")
    # Re-apply everything. Catches migrations that can downgrade but leave
    # state that prevents re-upgrade (e.g., dropped enum types still in use).
    _alembic("upgrade", "head")
