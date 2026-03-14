import os
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx
import pytest
import pytest_asyncio
from jose import jwt
from sqlalchemy import select

# Ensure the backend package path (backend/) is importable so `from app.main import app` works
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

TEST_AUTH_SECRET = "test-auth-secret"
TEST_ADAPTER_SECRET = "test-adapter-secret"

# Provide a default DATABASE_URL so importing the app doesn't fail during tests
# Use asyncpg driver (present in requirements) to avoid missing driver errors.
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/postgres"
)
os.environ.setdefault("TESTING", "1")
os.environ.setdefault("AUTH_SECRET", TEST_AUTH_SECRET)
os.environ.setdefault("ADAPTER_SECRET", TEST_ADAPTER_SECRET)


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
