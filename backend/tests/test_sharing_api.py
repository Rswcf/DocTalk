from __future__ import annotations

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


class _Result:
    def __init__(
        self,
        *,
        scalar_one_or_none: object = None,
        scalars_all: list[object] | None = None,
        first: object = None,
    ) -> None:
        self._scalar_one_or_none = scalar_one_or_none
        self._scalars_all = scalars_all or []
        self._first = first

    def scalar_one_or_none(self):
        return self._scalar_one_or_none

    def scalars(self):
        return iter(self._scalars_all)

    def first(self):
        return self._first


@pytest.mark.asyncio
async def test_shared_view_returns_safe_message_anchor_without_private_citation_fields(monkeypatch):
    import uuid
    from datetime import datetime, timezone
    from types import SimpleNamespace
    from unittest.mock import AsyncMock

    from fastapi import FastAPI
    from httpx import ASGITransport, AsyncClient

    from app.api import sharing as sharing_api
    from app.core import deps as deps_module

    api_app = FastAPI()
    api_app.include_router(sharing_api.router)

    share_token = uuid.uuid4()
    session_id = uuid.uuid4()
    message_id = uuid.UUID("12345678-90ab-4def-8123-456789abcdef")
    now = datetime.now(timezone.utc)
    share = SimpleNamespace(session_id=session_id, expires_at=None)
    session = SimpleNamespace(
        id=session_id,
        title="Shared diligence answer",
        document_id=uuid.uuid4(),
        created_at=now,
    )
    message = SimpleNamespace(
        id=message_id,
        role="assistant",
        content="The payment term is NET-60.",
        citations=[
            {
                "text_snippet": "Payment is due within sixty days.",
                "page": 4,
                "document_filename": "contract.pdf",
                "bboxes": [{"x": 0.1, "y": 0.2, "w": 0.3, "h": 0.1}],
                "chunk_id": "chunk-1",
                "document_id": str(uuid.uuid4()),
                "confidence_score": 0.91,
            }
        ],
    )
    execute = AsyncMock(
        side_effect=[
            _Result(scalar_one_or_none=share),
            _Result(scalar_one_or_none=session),
            _Result(scalars_all=[message]),
            _Result(first=("contract.pdf",)),
        ]
    )
    db = SimpleNamespace(execute=execute)

    async def _get_db():
        yield db

    api_app.dependency_overrides[deps_module.get_db_session] = _get_db
    monkeypatch.setattr(sharing_api.shared_view_limiter, "is_allowed", AsyncMock(return_value=True))

    async with AsyncClient(transport=ASGITransport(app=api_app), base_url="http://test") as client:
        response = await client.get(f"/api/shared/{share_token}")

    assert response.status_code == 200
    body = response.json()
    assert body["messages"][0]["id"] == "msg-1234567890ab4def"
    citation = body["messages"][0]["citations"][0]
    assert citation == {
        "text_snippet": "Payment is due within sixty days.",
        "page": 4,
        "document_filename": "contract.pdf",
    }
    assert "bboxes" not in response.text
    assert "chunk_id" not in response.text
    assert "document_id" not in response.text
    assert "confidence_score" not in response.text


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
