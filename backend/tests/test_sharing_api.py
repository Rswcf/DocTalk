import pytest


@pytest.mark.asyncio
async def test_create_share_requires_auth():
    from httpx import ASGITransport, AsyncClient

    from app.main import app

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        resp = await client.post(
            "/api/sessions/00000000-0000-0000-0000-000000000001/share"
        )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_revoke_share_requires_auth():
    from httpx import ASGITransport, AsyncClient

    from app.main import app

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        resp = await client.delete(
            "/api/sessions/00000000-0000-0000-0000-000000000001/share"
        )
    assert resp.status_code == 401
