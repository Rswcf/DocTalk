from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest


class _FakeDB:
    def __init__(self) -> None:
        self.added = []
        self.committed = False

    def add(self, value) -> None:
        self.added.append(value)

    async def commit(self) -> None:
        self.committed = True


async def _none_user():
    return None


@pytest.mark.asyncio
async def test_public_auth_funnel_event_is_recorded_without_user(monkeypatch):
    from fastapi import FastAPI
    from httpx import ASGITransport, AsyncClient

    from app.api import events as events_api
    from app.core import deps as deps_module

    api_app = FastAPI()
    api_app.include_router(events_api.router)
    fake_db = _FakeDB()

    async def _get_db():
        yield fake_db

    api_app.dependency_overrides[deps_module.get_db_session] = _get_db
    api_app.dependency_overrides[deps_module.get_current_user_optional] = _none_user
    monkeypatch.setattr(events_api.public_event_limiter, "is_allowed", AsyncMock(return_value=True))

    async with AsyncClient(transport=ASGITransport(app=api_app), base_url="http://test") as client:
        response = await client.post(
            "/api/events",
            json={
                "event_name": "auth_provider_clicked",
                "properties": {
                    "source": "auth_modal",
                    "provider": "google",
                    "path": "/",
                    "ignored": {"nested": "object"},
                },
            },
        )

    assert response.status_code == 204
    assert fake_db.committed is True
    assert len(fake_db.added) == 1
    event = fake_db.added[0]
    assert event.user_id is None
    assert event.event_name == "auth_provider_clicked"
    assert event.source == "auth_modal"
    assert event.metadata_json["provider"] == "google"
    assert event.metadata_json["ignored"] == "{'nested': 'object'}"


@pytest.mark.asyncio
async def test_public_event_rejects_private_event_without_user(monkeypatch):
    from fastapi import FastAPI
    from httpx import ASGITransport, AsyncClient

    from app.api import events as events_api
    from app.core import deps as deps_module

    api_app = FastAPI()
    api_app.include_router(events_api.router)
    fake_db = _FakeDB()

    async def _get_db():
        yield fake_db

    api_app.dependency_overrides[deps_module.get_db_session] = _get_db
    api_app.dependency_overrides[deps_module.get_current_user_optional] = _none_user
    monkeypatch.setattr(events_api.public_event_limiter, "is_allowed", AsyncMock(return_value=True))

    async with AsyncClient(transport=ASGITransport(app=api_app), base_url="http://test") as client:
        response = await client.post(
            "/api/events",
            json={"event_name": "checkout_completed", "properties": {"source": "test"}},
        )

    assert response.status_code == 401
    assert fake_db.added == []


@pytest.mark.asyncio
async def test_public_event_rate_limit(monkeypatch):
    from fastapi import FastAPI
    from httpx import ASGITransport, AsyncClient

    from app.api import events as events_api
    from app.core import deps as deps_module

    api_app = FastAPI()
    api_app.include_router(events_api.router)

    async def _get_db():
        yield _FakeDB()

    api_app.dependency_overrides[deps_module.get_db_session] = _get_db
    api_app.dependency_overrides[deps_module.get_current_user_optional] = _none_user
    monkeypatch.setattr(events_api.public_event_limiter, "is_allowed", AsyncMock(return_value=False))

    async with AsyncClient(transport=ASGITransport(app=api_app), base_url="http://test") as client:
        response = await client.post(
            "/api/events",
            json={"event_name": "auth_modal_opened", "properties": {"source": "auth_modal"}},
        )

    assert response.status_code == 429


@pytest.mark.asyncio
async def test_authenticated_user_can_record_private_event(monkeypatch):
    from fastapi import FastAPI
    from httpx import ASGITransport, AsyncClient

    from app.api import events as events_api
    from app.core import deps as deps_module

    api_app = FastAPI()
    api_app.include_router(events_api.router)
    fake_db = _FakeDB()
    user_id = uuid.uuid4()

    async def _get_db():
        yield fake_db

    async def _get_user():
        return SimpleNamespace(id=user_id)

    api_app.dependency_overrides[deps_module.get_db_session] = _get_db
    api_app.dependency_overrides[deps_module.get_current_user_optional] = _get_user
    monkeypatch.setattr(events_api.public_event_limiter, "is_allowed", AsyncMock(return_value=False))

    async with AsyncClient(transport=ASGITransport(app=api_app), base_url="http://test") as client:
        response = await client.post(
            "/api/events",
            json={"event_name": "checkout_completed", "properties": {"source": "stripe"}},
        )

    assert response.status_code == 204
    event = fake_db.added[0]
    assert event.user_id == user_id
    assert event.event_name == "checkout_completed"
