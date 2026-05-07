from __future__ import annotations

import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.api import question_templates as templates_api
from app.core import deps as deps_module
from app.services import credit_service

api_app = FastAPI()
api_app.include_router(templates_api.router)


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
        doc: object | None = None,
        template: object | None = None,
        collection: object | None = None,
        job: object | None = None,
    ) -> None:
        self.doc = doc
        self.template = template
        self.collection = collection
        self.job = job
        self.added: list[object] = []
        self.committed = 0
        self.rollback = AsyncMock()

    async def get(self, model, object_id):
        name = getattr(model, "__name__", "")
        if name == "Document":
            return self.doc
        if name == "QuestionTemplate":
            return self.template
        return None

    async def execute(self, _stmt):
        if self.collection is not None:
            return _Result(scalar_one_or_none=self.collection)
        if self.job is not None:
            return _Result(scalar_one_or_none=self.job)
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

    async def delete(self, obj) -> None:
        self.added.append(SimpleNamespace(deleted=obj))


def _make_user(*, plan: str = "free") -> SimpleNamespace:
    return SimpleNamespace(id=uuid.uuid4(), plan=plan, email="user@example.com")


def _make_doc(user: SimpleNamespace, *, status: str = "ready", filename: str = "report.pdf") -> SimpleNamespace:
    return SimpleNamespace(id=uuid.uuid4(), user_id=user.id, status=status, demo_slug=None, filename=filename)


def _make_template(user: SimpleNamespace, *, questions: list[str] | None = None) -> SimpleNamespace:
    now = datetime.now(timezone.utc)
    return SimpleNamespace(
        id=uuid.uuid4(),
        user_id=user.id,
        name="Due diligence checklist",
        description=None,
        questions=questions or ["What are the payment terms?"],
        created_at=now,
        updated_at=now,
    )


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
async def test_create_question_template_normalizes_questions(client: AsyncClient) -> None:
    user = _make_user()
    db = _FakeDb()
    _override_dependencies(db, user)

    response = await client.post(
        "/api/question-templates",
        json={
            "name": "  Contract review  ",
            "questions": [" What is the term? ", "What is the term?", "", "List indemnities."],
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Contract review"
    assert body["questions"] == ["What is the term?", "List indemnities."]


@pytest.mark.asyncio
async def test_document_template_run_requires_plus(client: AsyncClient) -> None:
    user = _make_user(plan="free")
    db = _FakeDb()
    _override_dependencies(db, user)

    response = await client.post(
        f"/api/documents/{uuid.uuid4()}/question-template-runs",
        json={"template_id": str(uuid.uuid4())},
    )

    detail = _assert_error(response, 403, "PLAN_REQUIRED")
    assert detail["required_plan"] == "plus"


@pytest.mark.asyncio
async def test_document_template_run_predebits_and_queues(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = _make_user(plan="plus")
    doc = _make_doc(user)
    template = _make_template(user, questions=["Q1?", "Q2?"])
    db = _FakeDb(doc=doc, template=template)
    _override_dependencies(db, user)
    queued: list[str] = []
    ledger_id = uuid.uuid4()
    monkeypatch.setattr(credit_service, "debit_credits", AsyncMock(return_value=ledger_id))
    monkeypatch.setattr(templates_api, "_enqueue_batch_template_job", lambda job_id: queued.append(job_id))

    response = await client.post(
        f"/api/documents/{doc.id}/question-template-runs",
        json={"template_id": str(template.id), "locale": "en"},
    )

    assert response.status_code == 202
    body = response.json()
    assert body["job_type"] == "batch_template"
    assert body["status"] == "queued"
    assert body["input_scope"]["questions"] == ["Q1?", "Q2?"]
    assert queued == [body["id"]]
    credit_service.debit_credits.assert_awaited_once()


@pytest.mark.asyncio
async def test_collection_template_run_requires_pro(client: AsyncClient) -> None:
    user = _make_user(plan="plus")
    db = _FakeDb()
    _override_dependencies(db, user)

    response = await client.post(
        f"/api/collections/{uuid.uuid4()}/question-template-runs",
        json={"template_id": str(uuid.uuid4())},
    )

    detail = _assert_error(response, 403, "PLAN_REQUIRED")
    assert detail["required_plan"] == "pro"


@pytest.mark.asyncio
async def test_collection_template_run_requires_ready_documents(client: AsyncClient) -> None:
    user = _make_user(plan="pro")
    docs = [_make_doc(user, filename="a.pdf"), _make_doc(user, status="parsing", filename="b.pdf")]
    collection = SimpleNamespace(id=uuid.uuid4(), user_id=user.id, documents=docs)
    template = _make_template(user)
    db = _FakeDb(template=template, collection=collection)
    _override_dependencies(db, user)

    response = await client.post(
        f"/api/collections/{collection.id}/question-template-runs",
        json={"template_id": str(template.id)},
    )

    _assert_error(response, 409, "DOCUMENT_NOT_READY")


@pytest.mark.asyncio
async def test_export_question_template_run_returns_csv(client: AsyncClient) -> None:
    user = _make_user(plan="pro")
    job_id = uuid.uuid4()
    result = SimpleNamespace(
        template_key="question_template",
        structured_json={
            "answers": [
                {
                    "document_filename": "合同.pdf",
                    "question": "付款条件是什么？",
                    "answer": "Net 30",
                    "source_refs": [1],
                }
            ]
        },
        rendered_markdown="# Template\n",
        citations=[],
        created_at=datetime.now(timezone.utc),
    )
    job = SimpleNamespace(
        id=job_id,
        user_id=user.id,
        job_type="batch_template",
        extraction_result=result,
    )
    db = _FakeDb(job=job)
    _override_dependencies(db, user)

    response = await client.get(f"/api/question-template-runs/{job_id}/export?format=csv")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert response.content.startswith(b"\xef\xbb\xbf")
    assert "付款条件".encode() in response.content
