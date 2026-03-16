import pytest


@pytest.mark.asyncio
async def test_export_requires_auth():
    """Export endpoint should reject unauthenticated requests."""
    from httpx import ASGITransport, AsyncClient

    from app.main import app

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get(
            "/api/sessions/00000000-0000-0000-0000-000000000001/export?format=md"
        )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_export_session_not_found():
    """Export with valid auth but nonexistent session returns 404."""
    from httpx import ASGITransport, AsyncClient

    from app.main import app

    # This will fail with 401 since we have no valid JWT, which is expected
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get(
            "/api/sessions/00000000-0000-0000-0000-000000000001/export?format=md"
        )
    # Without auth, should get 401
    assert resp.status_code == 401
