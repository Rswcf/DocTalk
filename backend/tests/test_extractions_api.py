from __future__ import annotations

import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.api import extractions as extractions_api
from app.core import deps as deps_module
from app.services import credit_service
from app.services.extraction_service import FREE_MONTHLY_EXTRACTION_LIMIT

api_app = FastAPI()
api_app.include_router(extractions_api.router)


class _Result:
    def __init__(self, *, scalar: object = None, scalar_one_or_none: object = None, rowcount: int = 0) -> None:
        self._scalar = scalar
        self._scalar_one_or_none = scalar_one_or_none
        self.rowcount = rowcount

    def scalar(self):
        return self._scalar

    def scalar_one_or_none(self):
        return self._scalar_one_or_none

    def scalars(self):
        return iter([])


def _make_user(*, plan: str = "free") -> SimpleNamespace:
    return SimpleNamespace(id=uuid.uuid4(), plan=plan, email="user@example.com", monthly_credits_granted_at=None)


def _make_doc(user: SimpleNamespace, *, status: str = "ready") -> SimpleNamespace:
    return SimpleNamespace(id=uuid.uuid4(), user_id=user.id, status=status, demo_slug=None)


def _make_db(**overrides: object) -> SimpleNamespace:
    payload: dict[str, object] = {
        "get": AsyncMock(return_value=None),
        "scalar": AsyncMock(return_value=0),
        "execute": AsyncMock(return_value=_Result()),
        "add": lambda _obj: None,
        "flush": AsyncMock(),
        "commit": AsyncMock(),
        "refresh": AsyncMock(),
        "rollback": AsyncMock(),
    }
    payload.update(overrides)
    return SimpleNamespace(**payload)


class _LazyTrapExtractionJob:
    def __init__(self) -> None:
        now = datetime.now(timezone.utc)
        self.id = uuid.uuid4()
        self.document_id = uuid.uuid4()
        self.collection_id = None
        self.job_type = "extraction"
        self.status = "queued"
        self.input_scope = {}
        self.cost_credits = 0
        self.error_code = None
        self.error_message = None
        self.created_at = now
        self.updated_at = now
        self.completed_at = None

    @property
    def extraction_result(self):
        raise AssertionError("lazy extraction_result relationship was accessed")


def _override_dependencies(db: object, user: object) -> None:
    async def _get_db():
        yield db

    async def _require_auth():
        return user

    api_app.dependency_overrides[deps_module.get_db_session] = _get_db
    api_app.dependency_overrides[deps_module.require_auth] = _require_auth


def _assert_error(response, status_code: int, error_code: str) -> dict:
    assert response.status_code == status_code
    body = response.json()
    assert "detail" in body
    detail = body["detail"]
    assert detail["error"] == error_code
    assert isinstance(detail.get("message"), str)
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
async def test_create_extraction_requires_ready_document(client: AsyncClient) -> None:
    user = _make_user(plan="plus")
    doc = _make_doc(user, status="parsing")
    db = _make_db(get=AsyncMock(return_value=doc))
    _override_dependencies(db, user)

    response = await client.post(
        f"/api/documents/{doc.id}/extractions",
        json={"template_key": "executive_summary"},
    )

    _assert_error(response, 409, "DOCUMENT_NOT_READY")


@pytest.mark.asyncio
async def test_create_extraction_enforces_free_monthly_limit(client: AsyncClient) -> None:
    user = _make_user(plan="free")
    doc = _make_doc(user)
    db = _make_db(
        get=AsyncMock(return_value=doc),
        scalar=AsyncMock(return_value=FREE_MONTHLY_EXTRACTION_LIMIT),
    )
    _override_dependencies(db, user)

    response = await client.post(
        f"/api/documents/{doc.id}/extractions",
        json={"template_key": "executive_summary"},
    )

    detail = _assert_error(response, 403, "EXTRACTION_LIMIT_REACHED")
    assert detail["limit"] == FREE_MONTHLY_EXTRACTION_LIMIT


@pytest.mark.asyncio
async def test_create_extraction_insufficient_credits_rolls_back(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = _make_user(plan="plus")
    doc = _make_doc(user)
    db = _make_db(get=AsyncMock(return_value=doc))
    _override_dependencies(db, user)
    monkeypatch.setattr(credit_service, "debit_credits", AsyncMock(return_value=None))
    monkeypatch.setattr(credit_service, "get_user_credits", AsyncMock(return_value=12))

    response = await client.post(
        f"/api/documents/{doc.id}/extractions",
        json={"template_key": "executive_summary"},
    )

    detail = _assert_error(response, 402, "INSUFFICIENT_CREDITS")
    assert detail["required"] == 25
    assert detail["balance"] == 12
    db.rollback.assert_awaited_once()


def test_extraction_job_response_does_not_lazy_load_unloaded_result() -> None:
    body = extractions_api._job_response(_LazyTrapExtractionJob())

    assert body.status == "queued"
    assert body.result is None


@pytest.mark.asyncio
async def test_export_extraction_csv_returns_download_response(client: AsyncClient) -> None:
    user = _make_user(plan="plus")
    job_id = uuid.uuid4()
    result = SimpleNamespace(
        template_key="key_facts",
        structured_json={
            "facts": [
                {
                    "label": "收入",
                    "value": "$1,000",
                    "context": "同比增长, 12%",
                    "source_refs": [1, 2],
                }
            ]
        },
        rendered_markdown="",
    )
    job = SimpleNamespace(id=job_id, extraction_result=result)
    db = _make_db(execute=AsyncMock(return_value=_Result(scalar_one_or_none=job)))
    _override_dependencies(db, user)

    response = await client.get(f"/api/extractions/{job_id}/export?format=csv")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert "attachment;" in response.headers["content-disposition"]
    assert response.content.startswith(b"\xef\xbb\xbf")
    assert "收入".encode() in response.content
