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

import os
import subprocess
import sys
from pathlib import Path

import pytest

# Project root holds alembic.ini (backend/alembic.ini)
BACKEND_DIR = Path(__file__).resolve().parent.parent


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
    # Start from a known state: fully upgraded.
    _alembic("upgrade", "head")
    # Walk all the way back. If any migration's downgrade() is missing or
    # broken, alembic will raise and the test fails with diagnostic output.
    _alembic("downgrade", "base")
    # Re-apply everything. Catches migrations that can downgrade but leave
    # state that prevents re-upgrade (e.g., dropped enum types still in use).
    _alembic("upgrade", "head")
