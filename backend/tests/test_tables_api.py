from __future__ import annotations

import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.api import tables as tables_api
from app.core import deps as deps_module

api_app = FastAPI()
api_app.include_router(tables_api.router)


class _Result:
    def __init__(self, *, scalar_one_or_none: object = None, scalars_all: list[object] | None = None) -> None:
        self._scalar_one_or_none = scalar_one_or_none
        self._scalars_all = scalars_all or []

    def scalar_one_or_none(self):
        return self._scalar_one_or_none

    def scalars(self):
        return iter(self._scalars_all)


def _make_user(*, plan: str = "free") -> SimpleNamespace:
    return SimpleNamespace(id=uuid.uuid4(), plan=plan, email="user@example.com")


def _make_doc(user: SimpleNamespace, *, status: str = "ready") -> SimpleNamespace:
    return SimpleNamespace(id=uuid.uuid4(), user_id=user.id, status=status, demo_slug=None, filename="report.pdf")


def _make_db(**overrides: object) -> SimpleNamespace:
    payload: dict[str, object] = {
        "get": AsyncMock(return_value=None),
        "scalar": AsyncMock(return_value=None),
        "execute": AsyncMock(return_value=_Result()),
        "add": lambda _obj: None,
        "flush": AsyncMock(),
        "commit": AsyncMock(),
        "refresh": AsyncMock(),
    }
    payload.update(overrides)
    return SimpleNamespace(**payload)


def _override_dependencies(db: object, user: object) -> None:
    async def _get_db():
        yield db

    async def _require_auth():
        return user

    api_app.dependency_overrides[deps_module.get_db_session] = _get_db
    api_app.dependency_overrides[deps_module.require_auth] = _require_auth


def _assert_error(response, status_code: int, error_code: str) -> dict:
    assert response.status_code == status_code
    detail = response.json()["detail"]
    assert detail["error"] == error_code
    return detail


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
async def test_scan_tables_requires_ready_document(client: AsyncClient) -> None:
    user = _make_user(plan="plus")
    doc = _make_doc(user, status="parsing")
    db = _make_db(get=AsyncMock(return_value=doc))
    _override_dependencies(db, user)

    response = await client.post(f"/api/documents/{doc.id}/tables/scan")

    _assert_error(response, 409, "DOCUMENT_NOT_READY")


@pytest.mark.asyncio
async def test_export_table_requires_plus(client: AsyncClient) -> None:
    user = _make_user(plan="free")
    db = _make_db()
    _override_dependencies(db, user)

    response = await client.get(f"/api/document-tables/{uuid.uuid4()}/export")

    _assert_error(response, 403, "PLAN_REQUIRED")


@pytest.mark.asyncio
async def test_export_table_returns_csv_for_paid_user(client: AsyncClient) -> None:
    user = _make_user(plan="plus")
    doc = _make_doc(user)
    table = SimpleNamespace(
        id=uuid.uuid4(),
        document_id=doc.id,
        page=2,
        table_index=0,
        cells={"rows": [["指标", "Value"], ["Revenue", "$1,000"]]},
    )
    db = _make_db(get=AsyncMock(side_effect=[table, doc]))
    _override_dependencies(db, user)

    response = await client.get(f"/api/document-tables/{table.id}/export")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert "attachment;" in response.headers["content-disposition"]
    assert response.content.startswith(b"\xef\xbb\xbf")
    assert "Revenue".encode() in response.content


@pytest.mark.asyncio
async def test_export_all_document_tables_returns_combined_csv(client: AsyncClient) -> None:
    user = _make_user(plan="plus")
    doc = _make_doc(user)
    table = SimpleNamespace(
        id=uuid.uuid4(),
        document_id=doc.id,
        page=3,
        table_index=1,
        cells={"rows": [["公司", "评级"], ["MetaX", "Equal-weight"]]},
    )
    db = _make_db(
        get=AsyncMock(return_value=doc),
        execute=AsyncMock(return_value=_Result(scalars_all=[table])),
    )
    _override_dependencies(db, user)

    response = await client.get(f"/api/documents/{doc.id}/tables/export")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert response.content.startswith(b"\xef\xbb\xbf")
    assert "MetaX".encode() in response.content


@pytest.mark.asyncio
async def test_list_document_tables_serializes_rows(client: AsyncClient) -> None:
    user = _make_user(plan="plus")
    doc = _make_doc(user)
    now = datetime.now(timezone.utc)
    table = SimpleNamespace(
        id=uuid.uuid4(),
        document_id=doc.id,
        page=1,
        table_index=0,
        cells={"rows": [["A", "B"], ["1", "2"]]},
        confidence=0.65,
        method="markdown",
        created_at=now,
        updated_at=now,
    )
    db = _make_db(
        get=AsyncMock(return_value=doc),
        execute=AsyncMock(return_value=_Result(scalars_all=[table])),
    )
    _override_dependencies(db, user)

    response = await client.get(f"/api/documents/{doc.id}/tables")

    assert response.status_code == 200
    assert response.json()[0]["rows"] == [["A", "B"], ["1", "2"]]
