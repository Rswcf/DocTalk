from __future__ import annotations

import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.api import layout_translations as layout_api
from app.core import deps as deps_module

api_app = FastAPI()
api_app.include_router(layout_api.router)


class _Result:
    def __init__(self, *, scalar_one_or_none: object = None, scalars_all: list[object] | None = None) -> None:
        self._scalar_one_or_none = scalar_one_or_none
        self._scalars_all = scalars_all or []

    def scalar_one_or_none(self):
        return self._scalar_one_or_none

    def scalars(self):
        return iter(self._scalars_all)


def _make_user(plan: str = "free") -> SimpleNamespace:
    return SimpleNamespace(id=uuid.uuid4(), plan=plan, email="user@example.com")


def _make_doc(user_id: uuid.UUID) -> SimpleNamespace:
    return SimpleNamespace(
        id=uuid.uuid4(),
        user_id=user_id,
        status="ready",
        file_type="pdf",
        filename="paper.pdf",
        storage_key="documents/paper.pdf",
        demo_slug=None,
    )


def _override_dependencies(db: object, user: object) -> None:
    async def _get_db():
        yield db

    async def _require_auth():
        return user

    api_app.dependency_overrides[deps_module.get_db_session] = _get_db
    api_app.dependency_overrides[deps_module.require_auth] = _require_auth


@pytest.fixture(autouse=True)
def _clear_dependency_overrides(monkeypatch: pytest.MonkeyPatch) -> None:
    api_app.dependency_overrides.clear()
    monkeypatch.setattr(layout_api, "_enqueue_layout_translation_job", lambda job_id: None)
    monkeypatch.setattr(
        layout_api,
        "layout_translation_config_status",
        lambda: SimpleNamespace(ready=True, missing=()),
    )
    yield
    api_app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=api_app), base_url="http://test") as ac:
        yield ac


def _fake_db(doc: object, *, used: int = 0):
    now = datetime.now(timezone.utc)

    async def refresh(job):
        job.created_at = now
        job.updated_at = now

    return SimpleNamespace(
        get=AsyncMock(return_value=doc),
        execute=AsyncMock(return_value=_Result(scalars_all=[])),
        scalar=AsyncMock(return_value=used),
        add=Mock(),
        commit=AsyncMock(),
        refresh=AsyncMock(side_effect=refresh),
    )


@pytest.mark.asyncio
async def test_free_user_can_start_two_trial_layout_translations(client: AsyncClient) -> None:
    user = _make_user("free")
    doc = _make_doc(user.id)
    db = _fake_db(doc, used=1)
    _override_dependencies(db, user)

    response = await client.post(f"/api/documents/{doc.id}/layout-translation", json={"target_language": "zh-CN"})

    assert response.status_code == 202
    payload = response.json()
    assert payload["job_type"] == "layout_translation"
    assert payload["status"] == "queued"
    assert payload["artifact"]["artifact_type"] == "layout_translation"
    assert payload["metadata_json"]["free_remaining_after"] == 0


@pytest.mark.asyncio
async def test_free_user_hits_layout_translation_limit(client: AsyncClient) -> None:
    user = _make_user("free")
    doc = _make_doc(user.id)
    db = _fake_db(doc, used=2)
    _override_dependencies(db, user)

    response = await client.post(f"/api/documents/{doc.id}/layout-translation", json={"target_language": "zh-CN"})

    assert response.status_code == 403
    detail = response.json()["detail"]
    assert detail["error"] == "LAYOUT_TRANSLATION_LIMIT_REACHED"
    assert detail["limit"] == 2
    assert detail["required_plan"] == "plus"
    db.add.assert_not_called()


@pytest.mark.asyncio
async def test_layout_translation_does_not_consume_trial_when_sidecar_not_configured(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = _make_user("free")
    doc = _make_doc(user.id)
    db = _fake_db(doc, used=0)
    _override_dependencies(db, user)
    monkeypatch.setattr(
        layout_api,
        "layout_translation_config_status",
        lambda: SimpleNamespace(ready=False, missing=("RETAINPDF_API_BASE_URL",)),
    )

    response = await client.post(f"/api/documents/{doc.id}/layout-translation", json={"target_language": "zh-CN"})

    assert response.status_code == 503
    detail = response.json()["detail"]
    assert detail["error"] == "LAYOUT_TRANSLATION_NOT_CONFIGURED"
    assert detail["missing"] == ["RETAINPDF_API_BASE_URL"]
    db.add.assert_not_called()
