from __future__ import annotations

import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.api import documents as documents_api
from app.core import deps as deps_module

api_app = FastAPI()
api_app.include_router(documents_api.documents_router)


class _Result:
    def __init__(self, *, scalar_one_or_none=None, scalars=None) -> None:
        self._scalar_one_or_none = scalar_one_or_none
        self._scalars = scalars or []

    def scalar_one_or_none(self):
        return self._scalar_one_or_none

    def scalars(self):
        return self._scalars


def _override_dependencies(db: object, user: object | None) -> None:
    async def _get_db():
        yield db

    async def _get_user():
        return user

    api_app.dependency_overrides[deps_module.get_db_session] = _get_db
    api_app.dependency_overrides[deps_module.get_current_user_optional] = _get_user


@pytest.fixture(autouse=True)
def _clear_dependency_overrides() -> None:
    api_app.dependency_overrides.clear()
    yield
    api_app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=api_app), base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_get_document_brief_hydrates_citation_refs(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = SimpleNamespace(id=uuid.uuid4())
    document_id = uuid.uuid4()
    chunk_id = uuid.uuid4()
    now = datetime.now(timezone.utc)
    doc = SimpleNamespace(
        id=document_id,
        user_id=user.id,
        demo_slug=None,
        status="ready",
        summary=None,
        suggested_questions=None,
        updated_at=now,
    )
    brief = SimpleNamespace(
        updated_at=now,
        generated_at=now,
        summary="Structured summary.",
        outline=[{"title": "Overview", "level": 1, "summary": "Intro", "source_refs": [{"chunk_id": str(chunk_id)}]}],
        key_points=[{"text": "Main point.", "source_refs": [{"chunk_id": str(chunk_id)}]}],
        facts=[],
        questions=["What matters?"],
        coverage={"status": "representative"},
        error_code=None,
        error_message=None,
    )
    chunk = SimpleNamespace(
        id=chunk_id,
        chunk_index=3,
        page_start=7,
        page_end=8,
        bboxes=[{"page": 7, "x": 0.1, "y": 0.2, "w": 0.3, "h": 0.1}],
        section_title="Overview",
        text="Source text used for citation hydration.",
    )
    db = SimpleNamespace(
        execute=AsyncMock(
            side_effect=[
                _Result(scalar_one_or_none=brief),
                _Result(scalars=[chunk]),
            ]
        )
    )
    _override_dependencies(db, user)
    monkeypatch.setattr(documents_api.doc_service, "get_document", AsyncMock(return_value=doc))

    response = await client.get(f"/api/documents/{document_id}/brief")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ready"
    assert body["summary"] == "Structured summary."
    ref = body["key_points"][0]["source_refs"][0]
    assert ref["chunk_id"] == str(chunk_id)
    assert ref["chunk_index"] == 3
    assert ref["page"] == 7
    assert ref["bboxes"][0]["page"] == 7


@pytest.mark.asyncio
async def test_get_document_brief_masks_cross_user_doc(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = SimpleNamespace(id=uuid.uuid4())
    doc = SimpleNamespace(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        demo_slug=None,
        status="ready",
    )
    _override_dependencies(SimpleNamespace(), user)
    monkeypatch.setattr(documents_api.doc_service, "get_document", AsyncMock(return_value=doc))

    response = await client.get(f"/api/documents/{doc.id}/brief")

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_document_brief_drops_items_with_stale_source_refs(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = SimpleNamespace(id=uuid.uuid4())
    document_id = uuid.uuid4()
    stale_chunk_id = uuid.uuid4()
    now = datetime.now(timezone.utc)
    doc = SimpleNamespace(
        id=document_id,
        user_id=user.id,
        demo_slug=None,
        status="ready",
        summary=None,
        suggested_questions=None,
        updated_at=now,
    )
    brief = SimpleNamespace(
        updated_at=now,
        generated_at=now,
        summary="Structured summary.",
        outline=[{"title": "Stale", "level": 1, "summary": "Old", "source_refs": [{"chunk_id": str(stale_chunk_id)}]}],
        key_points=[{"text": "Unsupported point.", "source_refs": [{"chunk_id": str(stale_chunk_id)}]}],
        facts=[{"label": "Old", "value": "N/A", "context": "", "source_refs": [{"chunk_id": str(stale_chunk_id)}]}],
        questions=["What matters?"],
        coverage={"status": "representative"},
        error_code=None,
        error_message=None,
    )
    db = SimpleNamespace(
        execute=AsyncMock(
            side_effect=[
                _Result(scalar_one_or_none=brief),
                _Result(scalars=[]),
            ]
        )
    )
    _override_dependencies(db, user)
    monkeypatch.setattr(documents_api.doc_service, "get_document", AsyncMock(return_value=doc))

    response = await client.get(f"/api/documents/{document_id}/brief")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ready"
    assert body["summary"] == "Structured summary."
    assert body["outline"] == []
    assert body["key_points"] == []
    assert body["facts"] == []
