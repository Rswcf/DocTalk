import os
import subprocess
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional
from urllib.parse import urlsplit, urlunsplit

import httpx
import pytest
import pytest_asyncio
from jose import jwt
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import create_async_engine

# Ensure the backend package path (backend/) is importable so `from app.main import app` works
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

TEST_AUTH_SECRET = "test-auth-secret"
TEST_ADAPTER_SECRET = "test-adapter-secret"

# ==============================================================================
# LOUD COMMENT — READ BEFORE TOUCHING DATABASE_URL LOGIC IN THIS FILE.
#
# This project's shared DEV Postgres database (`doctalk`) was wiped by the
# integration test suite TWICE in one session (2026-08-02):
#   1. test_migrations.py's downgrade/upgrade round-trip (it wipes+rebuilds
#      schema BY DESIGN — its own docstring says "do NOT point it at a
#      shared DB" — but nothing ever enforced that).
#   2. This conftest's own fixtures (auth_user create/delete, the new
#      real-Postgres quote-billing integration tests) writing/deleting rows
#      directly against `doctalk`, after an agent exported the CORRECT (but
#      literal, un-derived) DATABASE_URL to fix an unrelated credential
#      mismatch — pointing the ENTIRE test session at the live dev DB.
#
# So: regardless of what DATABASE_URL resolves to — a real shell-exported env
# var, or pydantic-settings picking it up from the repo-root .env file (which
# DOES contain the real `doctalk` credentials for local dev) — this file
# NEVER uses that value's database NAME as-is. `_derive_scratch_test_database_url`
# unconditionally overrides the database name to `_TEST_DB_NAME`, keeping only
# host/port/credentials. The os.environ mutation below happens before any
# `app.*` module is ever imported (conftest.py always loads before test
# modules), so every fixture, the FastAPI app's own DB engine, AND every
# alembic subprocess spawned by test_migrations.py (which inherits this same
# env var via `os.environ.copy()`) all resolve against `doctalk_test` —
# NEVER the real `doctalk` database — no matter what any human or agent
# exports or configures. Do not weaken this to `setdefault` or any
# conditional form; that is exactly the bug that caused both incidents.
#
# FIX2-E (Codex r2 "new breakage" #2): the derivation above preserves the
# source URL's HOST — deriving from a Railway/production DATABASE_URL still
# points `doctalk_test` at that REMOTE cluster (only the database NAME
# changes, not where it lives). Since exporting the wrong DATABASE_URL is
# EXACTLY how the two incidents above happened, `_provision_scratch_test_
# database` (below) hard-refuses to provision against any non-loopback host
# unless the operator explicitly opts in via a SEPARATE env var,
# DOCTALK_TEST_DATABASE_URL — deliberately not reusing DATABASE_URL's name,
# so it can never be set "by accident" the same way. When set, it is used
# AS-IS (no derivation, no host restriction) since the operator is
# knowingly declaring "this is my dedicated test database."
# ==============================================================================

_TEST_DB_NAME = "doctalk_test"
_LOOPBACK_HOSTS = {"localhost", "127.0.0.1", "::1"}


def _read_env_file_database_url() -> Optional[str]:
    """Mirror app.core.config's .env discovery (backend/.env, then repo-root
    .env) WITHOUT importing app.core.config — importing it would instantiate
    Settings (and downstream, app.models.database's engine) against whatever
    DATABASE_URL is live at that moment, before we've had a chance to
    override it below."""
    for candidate in (Path(".env"), Path("..") / ".env"):
        if not candidate.exists():
            continue
        for line in candidate.read_text().splitlines():
            stripped = line.strip()
            if stripped.startswith("DATABASE_URL="):
                return stripped.split("=", 1)[1].strip().strip('"').strip("'")
    return None


def _derive_scratch_test_database_url(url: str) -> str:
    """Keep scheme/host/port/credentials from `url`; always force the
    database NAME to the dedicated scratch DB — see the loud comment above
    for why this must never be conditional."""
    parts = urlsplit(url)
    return urlunsplit((parts.scheme, parts.netloc, f"/{_TEST_DB_NAME}", parts.query, parts.fragment))


_explicit_test_database_url = os.environ.get("DOCTALK_TEST_DATABASE_URL")
if _explicit_test_database_url:
    # Operator opt-in: used exactly as given, bypassing derivation and the
    # loopback-host check entirely — see the loud comment above.
    os.environ["DATABASE_URL"] = _explicit_test_database_url
else:
    _base_database_url = (
        os.environ.get("DATABASE_URL")
        or _read_env_file_database_url()
        or "postgresql+asyncpg://doctalk:doctalk@localhost:5432/doctalk"
    )
    os.environ["DATABASE_URL"] = _derive_scratch_test_database_url(_base_database_url)
os.environ.setdefault("TESTING", "1")
os.environ.setdefault("AUTH_SECRET", TEST_AUTH_SECRET)
os.environ.setdefault("ADAPTER_SECRET", TEST_ADAPTER_SECRET)


def _assert_safe_to_provision(database_url: str) -> None:
    """FIX2-E (Codex r2 "new breakage" #2): refuse to provision/migrate the
    scratch database against any non-loopback host, unless
    DOCTALK_TEST_DATABASE_URL was explicitly set (in which case the
    operator already declared it safe — see the loud comment above).
    Called from _provision_scratch_test_database, itself gated by
    SKIP_INTEGRATION, so this never runs (and never needs to) for a plain
    unit-only `pytest -q` session."""
    if os.environ.get("DOCTALK_TEST_DATABASE_URL"):
        return
    host = (urlsplit(database_url).hostname or "").lower()
    if host in _LOOPBACK_HOSTS:
        return
    raise RuntimeError(
        f"Refusing to provision the integration-test scratch database against "
        f"non-loopback host {host!r}. DATABASE_URL (or the repo-root .env file) "
        f"appears to point at a shared/remote database (e.g. Railway) — "
        f"proceeding would CREATE and DESTRUCTIVELY MIGRATE a database THERE, "
        f"exactly how this project's shared dev database was wiped twice already. "
        f"Either point DATABASE_URL at a local Postgres (localhost/127.0.0.1/::1), "
        f"or set DOCTALK_TEST_DATABASE_URL explicitly to a dedicated test database "
        f"URL you have verified is safe to create and wipe."
    )


async def _ensure_scratch_database_exists(database_url: str) -> None:
    """CREATE DATABASE IF NOT EXISTS for the scratch DB, via an autocommit
    connection to the `postgres` maintenance database (CREATE DATABASE
    cannot run inside a transaction block)."""
    parts = urlsplit(database_url)
    db_name = parts.path.lstrip("/")
    # db_name is always our own hardcoded _TEST_DB_NAME in practice; this
    # guard is defense-in-depth against ever string-interpolating something
    # unexpected into a bare CREATE DATABASE statement below (identifiers
    # can't be bound parameters).
    if not db_name or not all(c.isalnum() or c == "_" for c in db_name):
        raise RuntimeError(f"Refusing to provision unexpected scratch database name: {db_name!r}")

    maintenance_url = urlunsplit((parts.scheme, parts.netloc, "/postgres", parts.query, parts.fragment))
    engine = create_async_engine(maintenance_url, isolation_level="AUTOCOMMIT")
    try:
        async with engine.connect() as conn:
            exists = await conn.scalar(
                text("SELECT 1 FROM pg_database WHERE datname = :name"), {"name": db_name}
            )
            if not exists:
                await conn.execute(text(f'CREATE DATABASE "{db_name}"'))
    finally:
        await engine.dispose()


def _alembic_upgrade_head() -> None:
    """Provision/advance the scratch DB's schema. Inherits os.environ (and
    therefore the scratch DATABASE_URL forced above) via env=os.environ.copy(),
    same pattern as test_migrations.py's own `_alembic` helper."""
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=str(BACKEND_DIR),
        env=os.environ.copy(),
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(
            "alembic upgrade head failed while provisioning the scratch test "
            f"database:\nstdout:\n{result.stdout}\nstderr:\n{result.stderr}"
        )


@pytest_asyncio.fixture(scope="session", autouse=True, loop_scope="session")
async def _provision_scratch_test_database():
    """Session-scoped, autouse: ensures `doctalk_test` exists and is
    migrated to head before any integration test runs. No-ops immediately
    (no Postgres connection attempted at all) when SKIP_INTEGRATION is set,
    so a plain unit-only `pytest -q` run is completely unaffected."""
    skip_env = os.getenv("SKIP_INTEGRATION", "1").lower()
    if skip_env in {"1", "true", "yes", "on"}:
        return
    _assert_safe_to_provision(os.environ["DATABASE_URL"])
    await _ensure_scratch_database_exists(os.environ["DATABASE_URL"])
    _alembic_upgrade_head()


def pytest_configure(config: pytest.Config) -> None:
    # Register custom markers to avoid warnings
    config.addinivalue_line(
        "markers", "integration: marks tests that require external services (deselect with -m 'not integration')",
    )


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    # Skip integration tests if SKIP_INTEGRATION is set (default to skip)
    skip_env = os.getenv("SKIP_INTEGRATION", "1").lower()
    should_skip = skip_env in {"1", "true", "yes", "on"}
    if not should_skip:
        return
    skip_marker = pytest.mark.skip(reason="SKIP_INTEGRATION set; external services not available")
    for item in items:
        mark_names = {m.name for m in item.iter_markers()}
        if "integration" in mark_names:
            item.add_marker(skip_marker)


@pytest_asyncio.fixture(loop_scope="session")
async def client():
    # Import app after env setup
    from app.main import app

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture(loop_scope="session")
async def auth_user():
    from app.models.database import AsyncSessionLocal
    from app.models.tables import Document, User
    from app.services import auth_service
    from app.services.doc_service import doc_service

    email = f"test-{uuid.uuid4()}@example.com"
    async with AsyncSessionLocal() as db:
        user = await auth_service.create_user(db, email=email, name="Test User")

    try:
        yield user
    finally:
        async with AsyncSessionLocal() as db:
            doc_ids = (
                await db.scalars(select(Document.id).where(Document.user_id == user.id))
            ).all()
            for document_id in doc_ids:
                await doc_service.delete_document(document_id, db)

            persisted_user = await db.get(User, user.id)
            if persisted_user is not None:
                await db.delete(persisted_user)
                await db.commit()


@pytest.fixture
def auth_headers(auth_user):
    now = datetime.now(timezone.utc)
    token = jwt.encode(
        {
            "sub": str(auth_user.id),
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(hours=1)).timestamp()),
        },
        TEST_AUTH_SECRET,
        algorithm="HS256",
    )
    return {"Authorization": f"Bearer {token}"}
