from __future__ import annotations

import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.api import document_diffs as diffs_api
from app.core import deps as deps_module
from app.services import credit_service

api_app = FastAPI()
api_app.include_router(diffs_api.router)


class _Result:
    def __init__(self, *, scalar_one_or_none: object = None, scalars_all: list[object] | None = None) -> None:
        self._scalar_one_or_none = scalar_one_or_none
        self._scalars_all = scalars_all or []
        self.rowcount = 0

    def scalar_one_or_none(self):
        return self._scalar_one_or_none

    def scalars(self):
        return iter(self._scalars_all)


class _FakeDb:
    def __init__(
        self,
        *,
        docs: dict[uuid.UUID, object] | None = None,
        collection: object | None = None,
        job: object | None = None,
    ) -> None:
        self.docs = docs or {}
        self.collection = collection
        self.job = job
        self.added: list[object] = []
        self.committed = 0
        self.rollback = AsyncMock()

    async def get(self, model, object_id):
        name = getattr(model, "__name__", "")
        if name == "Document":
            return self.docs.get(object_id)
        return None

    async def execute(self, _stmt):
        if self.collection is not None:
            return _Result(scalar_one_or_none=self.collection)
        if self.job is not None:
            return _Result(scalar_one_or_none=self.job, scalars_all=[self.job])
        return _Result()

    def add(self, obj) -> None:
        self.added.append(obj)

    async def flush(self) -> None:
        now = datetime.now(timezone.utc)
        for obj in self.added:
            if getattr(obj, "id", None) is None:
                obj.id = uuid.uuid4()
            if getattr(obj, "created_at", None) is None:
                obj.created_at = now
            if getattr(obj, "updated_at", None) is None:
                obj.updated_at = now

    async def commit(self) -> None:
        self.committed += 1

    async def refresh(self, obj) -> None:
        await self.flush()
        if getattr(obj, "created_at", None) is None:
            obj.created_at = datetime.now(timezone.utc)
        if getattr(obj, "updated_at", None) is None:
            obj.updated_at = obj.created_at


def _make_user(*, plan: str = "free") -> SimpleNamespace:
    return SimpleNamespace(id=uuid.uuid4(), plan=plan, email="user@example.com")


def _make_doc(user: SimpleNamespace, *, status: str = "ready", filename: str = "report.pdf") -> SimpleNamespace:
    return SimpleNamespace(id=uuid.uuid4(), user_id=user.id, status=status, demo_slug=None, filename=filename)


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
async def test_create_document_diff_requires_pro(client: AsyncClient) -> None:
    user = _make_user(plan="plus")
    db = _FakeDb()
    _override_dependencies(db, user)

    response = await client.post(
        "/api/document-diffs",
        json={"old_document_id": str(uuid.uuid4()), "new_document_id": str(uuid.uuid4())},
    )

    detail = _assert_error(response, 403, "PLAN_REQUIRED")
    assert detail["required_plan"] == "pro"


@pytest.mark.asyncio
async def test_create_document_diff_rejects_same_document(client: AsyncClient) -> None:
    user = _make_user(plan="pro")
    db = _FakeDb()
    _override_dependencies(db, user)
    document_id = uuid.uuid4()

    response = await client.post(
        "/api/document-diffs",
        json={"old_document_id": str(document_id), "new_document_id": str(document_id)},
    )

    _assert_error(response, 400, "DOCUMENT_DIFF_SAME_DOCUMENT")


@pytest.mark.asyncio
async def test_create_document_diff_requires_ready_documents(client: AsyncClient) -> None:
    user = _make_user(plan="pro")
    old_doc = _make_doc(user)
    new_doc = _make_doc(user, status="parsing")
    db = _FakeDb(docs={old_doc.id: old_doc, new_doc.id: new_doc})
    _override_dependencies(db, user)

    response = await client.post(
        "/api/document-diffs",
        json={"old_document_id": str(old_doc.id), "new_document_id": str(new_doc.id)},
    )

    _assert_error(response, 409, "DOCUMENT_NOT_READY")


@pytest.mark.asyncio
async def test_create_document_diff_predebits_and_queues(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = _make_user(plan="pro")
    old_doc = _make_doc(user, filename="old.pdf")
    new_doc = _make_doc(user, filename="new.pdf")
    db = _FakeDb(docs={old_doc.id: old_doc, new_doc.id: new_doc})
    _override_dependencies(db, user)
    queued: list[str] = []
    ledger_id = uuid.uuid4()
    monkeypatch.setattr(credit_service, "debit_credits", AsyncMock(return_value=ledger_id))
    monkeypatch.setattr(diffs_api, "_enqueue_document_diff_job", lambda job_id: queued.append(job_id))

    response = await client.post(
        "/api/document-diffs",
        json={"old_document_id": str(old_doc.id), "new_document_id": str(new_doc.id), "locale": "en"},
    )

    assert response.status_code == 202
    body = response.json()
    assert body["job_type"] == "document_diff"
    assert body["status"] == "queued"
    assert body["input_scope"]["old_document_filename"] == "old.pdf"
    assert body["input_scope"]["new_document_filename"] == "new.pdf"
    assert queued == [body["id"]]
    credit_service.debit_credits.assert_awaited_once()


@pytest.mark.asyncio
async def test_create_document_diff_requires_docs_in_collection(client: AsyncClient) -> None:
    user = _make_user(plan="pro")
    old_doc = _make_doc(user, filename="old.pdf")
    new_doc = _make_doc(user, filename="new.pdf")
    collection = SimpleNamespace(id=uuid.uuid4(), user_id=user.id, documents=[old_doc])
    db = _FakeDb(docs={old_doc.id: old_doc, new_doc.id: new_doc}, collection=collection)
    _override_dependencies(db, user)

    response = await client.post(
        "/api/document-diffs",
        json={
            "old_document_id": str(old_doc.id),
            "new_document_id": str(new_doc.id),
            "collection_id": str(collection.id),
        },
    )

    _assert_error(response, 400, "DOCUMENT_DIFF_COLLECTION_MISMATCH")


@pytest.mark.asyncio
async def test_export_document_diff_returns_markdown(client: AsyncClient) -> None:
    user = _make_user(plan="pro")
    job_id = uuid.uuid4()
    result = SimpleNamespace(
        template_key="document_diff",
        structured_json={"changes": []},
        rendered_markdown="# Document Diff\n\n中文摘要\n",
        citations=[],
        created_at=datetime.now(timezone.utc),
    )
    job = SimpleNamespace(
        id=job_id,
        user_id=user.id,
        job_type="document_diff",
        document_id=uuid.uuid4(),
        collection_id=None,
        status="succeeded",
        input_scope={},
        cost_credits=12,
        error_code=None,
        error_message=None,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
        completed_at=datetime.now(timezone.utc),
        extraction_result=result,
    )
    db = _FakeDb(job=job)
    _override_dependencies(db, user)

    response = await client.get(f"/api/document-diffs/{job_id}/export?format=md")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/markdown")
    assert "attachment;" in response.headers["content-disposition"]
    assert "中文摘要".encode() in response.content
