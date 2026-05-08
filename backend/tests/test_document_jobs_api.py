from __future__ import annotations

import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.api import document_jobs as jobs_api
from app.core import deps as deps_module

api_app = FastAPI()
api_app.include_router(jobs_api.router)


class _Result:
    def __init__(self, *, scalar_one_or_none: object = None, scalars_all: list[object] | None = None) -> None:
        self._scalar_one_or_none = scalar_one_or_none
        self._scalars_all = scalars_all or []

    def scalar_one_or_none(self):
        return self._scalar_one_or_none

    def scalars(self):
        return iter(self._scalars_all)


def _make_user() -> SimpleNamespace:
    return SimpleNamespace(id=uuid.uuid4(), plan="plus", email="user@example.com")


def _override_dependencies(db: object, user: object) -> None:
    async def _get_db():
        yield db

    async def _require_auth():
        return user

    api_app.dependency_overrides[deps_module.get_db_session] = _get_db
    api_app.dependency_overrides[deps_module.require_auth] = _require_auth


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
async def test_document_job_api_returns_table_artifact(client: AsyncClient) -> None:
    user = _make_user()
    job_id = uuid.uuid4()
    document_id = uuid.uuid4()
    now = datetime.now(timezone.utc)
    job = SimpleNamespace(
        id=job_id,
        user_id=user.id,
        document_id=document_id,
        collection_id=None,
        job_type="table_scan",
        status="succeeded",
        input_scope={"export_requested": True},
        cost_credits=0,
        error_code=None,
        error_message=None,
        metadata_json={},
        created_at=now,
        updated_at=now,
        completed_at=now,
    )
    table = SimpleNamespace(
        id=uuid.uuid4(),
        document_id=document_id,
        page=1,
        table_index=0,
        cells={"rows": [["A", "B"], ["1", "2"]]},
        confidence=0.88,
        method="pymupdf",
    )
    db = SimpleNamespace(
        execute=AsyncMock(side_effect=[_Result(scalar_one_or_none=job), _Result(scalars_all=[table])]),
    )
    _override_dependencies(db, user)

    response = await client.get(f"/api/document-jobs/{job_id}")

    assert response.status_code == 200
    artifact = response.json()["artifact"]
    assert artifact["artifact_type"] == "table_export"
    assert artifact["status"] == "succeeded"
    assert artifact["preview"][0]["rows"][0] == ["A", "B"]
