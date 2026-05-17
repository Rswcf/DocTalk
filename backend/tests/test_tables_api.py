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


def _assign_document_job_defaults(added: list[object]) -> None:
    now = datetime.now(timezone.utc)
    for obj in added:
        if getattr(obj, "job_type", None) and getattr(obj, "id", None) is None:
            obj.id = uuid.uuid4()
        if getattr(obj, "job_type", None) and getattr(obj, "created_at", None) is None:
            obj.created_at = now
        if getattr(obj, "job_type", None) and getattr(obj, "updated_at", None) is None:
            obj.updated_at = now


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
async def test_reconstruct_table_requires_plus(client: AsyncClient) -> None:
    user = _make_user(plan="free")
    db = _make_db()
    _override_dependencies(db, user)

    response = await client.post(f"/api/document-tables/{uuid.uuid4()}/reconstruct")

    _assert_error(response, 403, "PLAN_REQUIRED")


@pytest.mark.asyncio
async def test_reconstruct_table_queues_paid_job(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    user = _make_user(plan="plus")
    doc = _make_doc(user)
    table = SimpleNamespace(id=uuid.uuid4(), document_id=doc.id)
    added: list[object] = []
    queued: list[str] = []

    async def flush() -> None:
        _assign_document_job_defaults(added)

    db = _make_db(
        get=AsyncMock(side_effect=[table, doc]),
        add=added.append,
        flush=AsyncMock(side_effect=flush),
        scalar=AsyncMock(return_value=None),
    )
    monkeypatch.setattr(
        "app.workers.table_worker.run_table_reconstruction_job.delay",
        lambda job_id: queued.append(job_id),
    )
    _override_dependencies(db, user)

    response = await client.post(f"/api/document-tables/{table.id}/reconstruct")

    assert response.status_code == 202
    body = response.json()
    assert body["job_type"] == "table_reconstruct"
    assert body["input_scope"]["table_id"] == str(table.id)
    assert queued == [body["id"]]


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
async def test_export_document_tables_escapes_commas_quotes_and_chinese(client: AsyncClient) -> None:
    user = _make_user(plan="plus")
    doc = _make_doc(user)
    table = SimpleNamespace(
        id=uuid.uuid4(),
        document_id=doc.id,
        page=1,
        table_index=0,
        cells={"rows": [["公司", "备注"], ["MetaX", 'target, "raised"'], ["空值", ""]]},
    )
    db = _make_db(
        get=AsyncMock(return_value=doc),
        execute=AsyncMock(return_value=_Result(scalars_all=[table])),
    )
    _override_dependencies(db, user)

    response = await client.get(f"/api/documents/{doc.id}/tables/export")

    assert response.status_code == 200
    text = response.content.decode("utf-8-sig")
    assert "公司,备注" in text
    assert '"target, ""raised"""' in text
    assert "空值," in text


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


@pytest.mark.asyncio
async def test_list_document_tables_serializes_reconstruction_metadata(client: AsyncClient) -> None:
    user = _make_user(plan="plus")
    doc = _make_doc(user)
    now = datetime.now(timezone.utc)
    table = SimpleNamespace(
        id=uuid.uuid4(),
        document_id=doc.id,
        page=15,
        table_index=1,
        cells={
            "rows": [["Metric", "2026E"], ["Total Equity", "17,499"]],
            "page_end": 16,
            "warnings": ["1 reconstructed numeric token was not found in the source page text."],
            "metadata": {"ai_reconstructed": True, "model": "deepseek-v4-pro"},
        },
        confidence=0.72,
        method="llm_reconstructed",
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
    body = response.json()[0]
    assert body["page_end"] == 16
    assert body["method"] == "llm_reconstructed"
    assert body["metadata_json"]["ai_reconstructed"] is True
    assert body["warnings"] == ["1 reconstructed numeric token was not found in the source page text."]


@pytest.mark.asyncio
async def test_get_table_job_accepts_reconstruct_job(client: AsyncClient) -> None:
    user = _make_user(plan="plus")
    now = datetime.now(timezone.utc)
    job = SimpleNamespace(
        id=uuid.uuid4(),
        user_id=user.id,
        document_id=uuid.uuid4(),
        collection_id=None,
        job_type="table_reconstruct",
        status="succeeded",
        input_scope={"table_id": str(uuid.uuid4())},
        cost_credits=0,
        error_code=None,
        error_message=None,
        metadata_json={"method": "llm_reconstructed"},
        created_at=now,
        updated_at=now,
        completed_at=now,
    )
    db = _make_db(scalar=AsyncMock(return_value=job))
    _override_dependencies(db, user)

    response = await client.get(f"/api/document-table-scans/{job.id}")

    assert response.status_code == 200
    assert response.json()["job_type"] == "table_reconstruct"
