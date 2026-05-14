from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest


class _FakeDB:
    def __init__(self) -> None:
        self.added = []
        self.flushed = False
        self.committed = False

    def add(self, value) -> None:
        self.added.append(value)

    async def flush(self) -> None:
        self.flushed = True
        for value in self.added:
            if getattr(value, "id", None) is None:
                value.id = uuid.uuid4()

    async def commit(self) -> None:
        self.committed = True


async def _none_user():
    return None


def _build_app(fake_db: _FakeDB, user: object | None = None):
    from fastapi import FastAPI

    from app.api import feedback as feedback_api
    from app.core import deps as deps_module

    api_app = FastAPI()
    api_app.include_router(feedback_api.router)

    async def _get_db():
        yield fake_db

    async def _get_user():
        return user

    api_app.dependency_overrides[deps_module.get_db_session] = _get_db
    api_app.dependency_overrides[deps_module.get_current_user_optional] = (
        _get_user if user is not None else _none_user
    )
    return api_app, feedback_api


@pytest.mark.asyncio
async def test_feedback_records_anonymous_submission(monkeypatch):
    from httpx import ASGITransport, AsyncClient

    fake_db = _FakeDB()
    api_app, feedback_api = _build_app(fake_db)
    monkeypatch.setattr(feedback_api.feedback_limiter, "is_allowed", AsyncMock(return_value=True))

    async with AsyncClient(transport=ASGITransport(app=api_app), base_url="http://test") as client:
        response = await client.post(
            "/api/feedback",
            json={
                "type": "feature_request",
                "area": "chat_answer",
                "severity": "high",
                "selected_options": ["better tables", "multi-document compare"],
                "message": " Please support reusable prompt templates. ",
                "path": "/d/demo",
                "locale": "en",
                "plan": "free",
            },
        )

    assert response.status_code == 200
    assert response.json()["status"] == "received"
    assert fake_db.flushed is True
    assert fake_db.committed is True
    assert len(fake_db.added) == 2

    feedback, event = fake_db.added
    assert feedback.user_id is None
    assert feedback.type == "feature_request"
    assert feedback.area == "chat_answer"
    assert feedback.message == "Please support reusable prompt templates."
    assert feedback.selected_options == {"items": ["better tables", "multi-document compare"]}
    assert event.event_name == "structured_feedback_submitted"
    assert event.metadata_json["has_message"] is True
    assert event.metadata_json["selected_options_count"] == 2


@pytest.mark.asyncio
async def test_feedback_uses_authenticated_user_identity(monkeypatch):
    from httpx import ASGITransport, AsyncClient

    user_id = uuid.uuid4()
    user = SimpleNamespace(id=user_id, plan="pro")
    fake_db = _FakeDB()
    api_app, feedback_api = _build_app(fake_db, user=user)
    limiter = AsyncMock(return_value=True)
    monkeypatch.setattr(feedback_api.feedback_limiter, "is_allowed", limiter)

    async with AsyncClient(transport=ASGITransport(app=api_app), base_url="http://test") as client:
        response = await client.post(
            "/api/feedback",
            json={
                "type": "bug",
                "area": "citation_jump",
                "severity": "blocking",
                "selected_options": ["wrong page"],
                "plan": "free",
            },
        )

    assert response.status_code == 200
    feedback, event = fake_db.added
    assert feedback.user_id == user_id
    assert feedback.plan == "pro"
    assert event.user_id == user_id
    assert event.plan == "pro"
    limiter.assert_awaited_once_with(f"user:{user_id}")


@pytest.mark.asyncio
async def test_feedback_rate_limit(monkeypatch):
    from httpx import ASGITransport, AsyncClient

    fake_db = _FakeDB()
    api_app, feedback_api = _build_app(fake_db)
    monkeypatch.setattr(feedback_api.feedback_limiter, "is_allowed", AsyncMock(return_value=False))

    async with AsyncClient(transport=ASGITransport(app=api_app), base_url="http://test") as client:
        response = await client.post(
            "/api/feedback",
            json={
                "type": "bug",
                "area": "upload_parse",
                "severity": "medium",
                "selected_options": [],
            },
        )

    assert response.status_code == 429
    assert fake_db.added == []
