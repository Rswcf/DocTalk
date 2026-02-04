import os
import sys
from pathlib import Path

import pytest
import httpx


# Ensure the backend package path (backend/) is importable so `from app.main import app` works
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Provide a default DATABASE_URL so importing the app doesn't fail during tests
# Use asyncpg driver (present in requirements) to avoid missing driver errors.
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/postgres"
)


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


@pytest.fixture
async def client():
    # Import app after env setup
    from app.main import app

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
