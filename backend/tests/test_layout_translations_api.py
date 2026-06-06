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


def _make_doc(user_id: uuid.UUID, *, page_count: int = 10, file_size: int = 1024) -> SimpleNamespace:
    return SimpleNamespace(
        id=uuid.uuid4(),
        user_id=user_id,
        status="ready",
        file_type="pdf",
        filename="paper.pdf",
        file_size=file_size,
        page_count=page_count,
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


def _fake_db(doc: object, *, used: int = 0, active_jobs: list[object] | None = None):
    now = datetime.now(timezone.utc)

    async def refresh(job):
        job.created_at = now
        job.updated_at = now

    return SimpleNamespace(
        get=AsyncMock(return_value=doc),
        execute=AsyncMock(return_value=_Result(scalars_all=active_jobs or [])),
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
async def test_free_user_hits_layout_translation_page_limit_before_trial_is_consumed(client: AsyncClient) -> None:
    user = _make_user("free")
    doc = _make_doc(user.id, page_count=26)
    db = _fake_db(doc, used=0)
    _override_dependencies(db, user)

    response = await client.post(f"/api/documents/{doc.id}/layout-translation", json={"target_language": "zh-CN"})

    assert response.status_code == 413
    detail = response.json()["detail"]
    assert detail["error"] == "LAYOUT_TRANSLATION_PAGE_LIMIT_EXCEEDED"
    assert detail["page_count"] == 26
    assert detail["max_pages"] == 25
    assert detail["required_plan"] == "plus"
    db.scalar.assert_not_called()
    db.add.assert_not_called()


@pytest.mark.asyncio
async def test_plus_user_can_start_layout_translation_for_mid_sized_pdf(client: AsyncClient) -> None:
    user = _make_user("plus")
    doc = _make_doc(user.id, page_count=53)
    db = _fake_db(doc, used=0)
    _override_dependencies(db, user)

    response = await client.post(f"/api/documents/{doc.id}/layout-translation", json={"target_language": "zh-CN"})

    assert response.status_code == 202
    payload = response.json()
    assert payload["metadata_json"]["max_pages"] == 150
    db.scalar.assert_not_called()


@pytest.mark.asyncio
async def test_layout_translation_accepts_non_chinese_target_language(client: AsyncClient) -> None:
    user = _make_user("plus")
    doc = _make_doc(user.id, page_count=12)
    db = _fake_db(doc, used=0)
    _override_dependencies(db, user)

    response = await client.post(f"/api/documents/{doc.id}/layout-translation", json={"target_language": "en"})

    assert response.status_code == 202
    payload = response.json()
    assert payload["input_scope"]["target_language"] == "en"
    assert payload["input_scope"]["target_language_label"] == "English"


@pytest.mark.asyncio
async def test_import_requested_layout_translation_respects_document_limit(client: AsyncClient) -> None:
    user = _make_user("plus")
    doc = _make_doc(user.id, page_count=12)
    db = _fake_db(doc, used=20)
    _override_dependencies(db, user)

    response = await client.post(
        f"/api/documents/{doc.id}/layout-translation",
        json={"target_language": "zh-CN", "add_to_library": True},
    )

    assert response.status_code == 403
    detail = response.json()["detail"]
    assert detail["error"] == "DOCUMENT_LIMIT_REACHED"
    assert detail["limit"] == 20
    db.add.assert_not_called()


@pytest.mark.asyncio
async def test_import_request_on_existing_layout_translation_respects_document_limit(client: AsyncClient) -> None:
    user = _make_user("plus")
    doc = _make_doc(user.id, page_count=12)
    existing = SimpleNamespace(
        id=uuid.uuid4(),
        user_id=user.id,
        document_id=doc.id,
        collection_id=None,
        job_type="layout_translation",
        status="queued",
        input_scope={"target_language": "zh-CN"},
        cost_credits=0,
        error_code=None,
        error_message=None,
        metadata_json={},
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
        completed_at=None,
    )
    db = _fake_db(doc, used=20, active_jobs=[existing])
    _override_dependencies(db, user)

    response = await client.post(
        f"/api/documents/{doc.id}/layout-translation",
        json={"target_language": "zh-CN", "add_to_library": True},
    )

    assert response.status_code == 403
    detail = response.json()["detail"]
    assert detail["error"] == "DOCUMENT_LIMIT_REACHED"
    assert existing.metadata_json == {}


@pytest.mark.asyncio
async def test_layout_translation_rejects_large_files_before_trial_is_consumed(client: AsyncClient) -> None:
    user = _make_user("free")
    doc = _make_doc(user.id, file_size=51 * 1024 * 1024)
    db = _fake_db(doc, used=0)
    _override_dependencies(db, user)

    response = await client.post(f"/api/documents/{doc.id}/layout-translation", json={"target_language": "zh-CN"})

    assert response.status_code == 413
    detail = response.json()["detail"]
    assert detail["error"] == "LAYOUT_TRANSLATION_FILE_TOO_LARGE"
    assert detail["max_mb"] == 50
    db.scalar.assert_not_called()
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
