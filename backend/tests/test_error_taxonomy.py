from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.api import chat as chat_api
from app.api import chunks as chunks_api
from app.api import collections as collections_api
from app.api import documents as documents_api
from app.api import export as export_api
from app.api import search as search_api
from app.api import sharing as sharing_api
from app.api import users as users_api
from app.core import deps as deps_module
from app.core import url_validator
from app.core.config import settings
from app.services import chat_service as chat_service_module
from app.services.extractors import url_extractor

_UNSET = object()

api_app = FastAPI()
api_app.include_router(documents_api.documents_router)
api_app.include_router(chat_api.chat_router)
api_app.include_router(collections_api.collections_router)
api_app.include_router(chunks_api.chunks_router)
api_app.include_router(search_api.search_router)
api_app.include_router(export_api.router)
api_app.include_router(sharing_api.router)
api_app.include_router(users_api.router)


class _Scalars:
    def __init__(self, values: list[object]) -> None:
        self._values = values

    def all(self) -> list[object]:
        return self._values

    def __iter__(self):
        return iter(self._values)


class _Result:
    def __init__(
        self,
        *,
        scalar: object = None,
        scalar_one_or_none: object = None,
        first: object = None,
        all_rows: list[object] | None = None,
        scalars_all: list[object] | None = None,
    ) -> None:
        self._scalar = scalar
        self._scalar_one_or_none = scalar_one_or_none
        self._first = first
        self._all_rows = all_rows or []
        self._scalars_all = scalars_all or []

    def scalar(self):
        return self._scalar

    def scalar_one_or_none(self):
        return self._scalar_one_or_none

    def first(self):
        return self._first

    def all(self):
        return self._all_rows

    def scalars(self):
        return _Scalars(self._scalars_all)


def _make_user(*, plan: str = "free", **overrides: object) -> SimpleNamespace:
    payload: dict[str, object] = {
        "id": uuid.uuid4(),
        "plan": plan,
        "email": "user@example.com",
        "stripe_subscription_id": None,
        "stripe_customer_id": None,
    }
    payload.update(overrides)
    return SimpleNamespace(**payload)


def _make_db(**overrides: object) -> SimpleNamespace:
    payload: dict[str, object] = {
        "scalar": AsyncMock(return_value=0),
        "execute": AsyncMock(return_value=_Result()),
        "get": AsyncMock(return_value=None),
        "add": lambda _obj: None,
        "delete": AsyncMock(),
        "commit": AsyncMock(),
        "refresh": AsyncMock(),
        "rollback": AsyncMock(),
    }
    payload.update(overrides)
    return SimpleNamespace(**payload)


def _override_dependencies(
    db: object,
    *,
    auth_user: object = _UNSET,
    optional_user: object = _UNSET,
) -> None:
    async def _get_db():
        yield db

    api_app.dependency_overrides[deps_module.get_db_session] = _get_db

    if auth_user is not _UNSET:
        async def _require_auth():
            return auth_user

        api_app.dependency_overrides[deps_module.require_auth] = _require_auth

    if optional_user is not _UNSET:
        async def _get_current_user_optional():
            return optional_user

        api_app.dependency_overrides[deps_module.get_current_user_optional] = _get_current_user_optional


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
async def test_upload_document_limit_reached(client: AsyncClient) -> None:
    user = _make_user(plan="free")
    db = _make_db(scalar=AsyncMock(return_value=settings.FREE_MAX_DOCUMENTS))
    _override_dependencies(db, auth_user=user)

    response = await client.post(
        "/api/documents/upload",
        files={"file": ("report.pdf", b"%PDF-1.4\nhello", "application/pdf")},
    )
    detail = _assert_error(response, 403, "DOCUMENT_LIMIT_REACHED")
    assert isinstance(detail["limit"], int)
    assert isinstance(detail["current"], int)


@pytest.mark.asyncio
async def test_ingest_url_document_limit_reached(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = _make_user(plan="free")
    db = _make_db(scalar=AsyncMock(return_value=settings.FREE_MAX_DOCUMENTS))
    _override_dependencies(db, auth_user=user)
    monkeypatch.setattr(url_validator, "validate_url", lambda url: url)

    response = await client.post("/api/documents/ingest-url", json={"url": "https://example.com"})
    detail = _assert_error(response, 403, "DOCUMENT_LIMIT_REACHED")
    assert isinstance(detail["limit"], int)
    assert isinstance(detail["current"], int)


@pytest.mark.asyncio
async def test_upload_file_too_large(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    user = _make_user(plan="free")
    db = _make_db(scalar=AsyncMock(return_value=0))
    _override_dependencies(db, auth_user=user)
    monkeypatch.setattr(settings, "FREE_MAX_FILE_SIZE_MB", 0)

    response = await client.post(
        "/api/documents/upload",
        files={"file": ("report.pdf", b"%PDF-1.4\nx", "application/pdf")},
    )
    detail = _assert_error(response, 400, "FILE_TOO_LARGE")
    assert isinstance(detail["max_mb"], int)


@pytest.mark.asyncio
async def test_ingest_url_pdf_file_too_large(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = _make_user(plan="free")
    db = _make_db(scalar=AsyncMock(return_value=0))
    _override_dependencies(db, auth_user=user)
    monkeypatch.setattr(settings, "FREE_MAX_FILE_SIZE_MB", 0)
    monkeypatch.setattr(url_validator, "validate_url", lambda url: url)
    monkeypatch.setattr(
        url_extractor,
        "fetch_and_extract_url",
        lambda _url: ("downloaded.pdf", [], b"x"),
    )

    response = await client.post("/api/documents/ingest-url", json={"url": "https://example.com"})
    detail = _assert_error(response, 400, "FILE_TOO_LARGE")
    assert isinstance(detail["max_mb"], int)


@pytest.mark.asyncio
async def test_ingest_url_text_file_too_large(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = _make_user(plan="free")
    db = _make_db(scalar=AsyncMock(return_value=0))
    _override_dependencies(db, auth_user=user)
    monkeypatch.setattr(settings, "FREE_MAX_FILE_SIZE_MB", 0)
    monkeypatch.setattr(url_validator, "validate_url", lambda url: url)
    monkeypatch.setattr(
        url_extractor,
        "fetch_and_extract_url",
        lambda _url: ("Example", [SimpleNamespace(text="hello")], None),
    )

    response = await client.post("/api/documents/ingest-url", json={"url": "https://example.com"})
    detail = _assert_error(response, 400, "FILE_TOO_LARGE")
    assert isinstance(detail["max_mb"], int)


@pytest.mark.asyncio
async def test_upload_unsupported_format(client: AsyncClient) -> None:
    user = _make_user(plan="free")
    db = _make_db()
    _override_dependencies(db, auth_user=user)

    response = await client.post(
        "/api/documents/upload",
        files={"file": ("payload.exe", b"MZ...", "application/octet-stream")},
    )
    _assert_error(response, 400, "UNSUPPORTED_FORMAT")


@pytest.mark.asyncio
async def test_upload_invalid_file_content(client: AsyncClient) -> None:
    user = _make_user(plan="free")
    db = _make_db(scalar=AsyncMock(return_value=0))
    _override_dependencies(db, auth_user=user)

    response = await client.post(
        "/api/documents/upload",
        files={"file": ("report.pdf", b"not-a-pdf", "application/pdf")},
    )
    _assert_error(response, 400, "INVALID_FILE_CONTENT")


@pytest.mark.asyncio
async def test_ingest_url_invalid_scheme(client: AsyncClient) -> None:
    user = _make_user(plan="free")
    db = _make_db()
    _override_dependencies(db, auth_user=user)

    response = await client.post("/api/documents/ingest-url", json={"url": "ftp://example.com"})
    _assert_error(response, 400, "URL_INVALID")


@pytest.mark.asyncio
async def test_ingest_url_fetch_blocked_hides_reason(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = _make_user(plan="free")
    db = _make_db(scalar=AsyncMock(return_value=0))
    _override_dependencies(db, auth_user=user)
    monkeypatch.setattr(url_validator, "validate_url", lambda url: url)

    def _raise_blocked(_url: str):
        raise ValueError("BLOCKED_HOST")

    monkeypatch.setattr(url_extractor, "fetch_and_extract_url", _raise_blocked)

    response = await client.post("/api/documents/ingest-url", json={"url": "https://example.com"})
    detail = _assert_error(response, 400, "URL_FETCH_BLOCKED")
    assert "reason" not in detail
    assert "BLOCKED_HOST" not in response.text


@pytest.mark.asyncio
async def test_ingest_url_content_too_large(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = _make_user(plan="free")
    db = _make_db(scalar=AsyncMock(return_value=0))
    _override_dependencies(db, auth_user=user)
    monkeypatch.setattr(url_validator, "validate_url", lambda url: url)

    def _raise_limit(_url: str):
        raise ValueError("URL_CONTENT_TOO_LARGE")

    monkeypatch.setattr(url_extractor, "fetch_and_extract_url", _raise_limit)

    response = await client.post("/api/documents/ingest-url", json={"url": "https://example.com"})
    _assert_error(response, 400, "URL_CONTENT_TOO_LARGE")


@pytest.mark.asyncio
async def test_ingest_url_no_text_content(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = _make_user(plan="free")
    db = _make_db(scalar=AsyncMock(return_value=0))
    _override_dependencies(db, auth_user=user)
    monkeypatch.setattr(url_validator, "validate_url", lambda url: url)

    def _raise_empty(_url: str):
        raise ValueError("NO_TEXT_CONTENT")

    monkeypatch.setattr(url_extractor, "fetch_and_extract_url", _raise_empty)

    response = await client.post("/api/documents/ingest-url", json={"url": "https://example.com"})
    _assert_error(response, 400, "NO_TEXT_CONTENT")


@pytest.mark.asyncio
async def test_ingest_url_fetch_failed(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = _make_user(plan="free")
    db = _make_db(scalar=AsyncMock(return_value=0))
    _override_dependencies(db, auth_user=user)
    monkeypatch.setattr(url_validator, "validate_url", lambda url: url)

    def _raise_runtime(_url: str):
        raise RuntimeError("gateway timeout")

    monkeypatch.setattr(url_extractor, "fetch_and_extract_url", _raise_runtime)

    response = await client.post("/api/documents/ingest-url", json={"url": "https://example.com"})
    _assert_error(response, 400, "URL_FETCH_FAILED")
    assert "gateway timeout" not in response.text


@pytest.mark.asyncio
async def test_documents_not_found(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    db = _make_db()
    _override_dependencies(db, optional_user=None)
    monkeypatch.setattr(documents_api.doc_service, "get_document", AsyncMock(return_value=None))

    response = await client.get(f"/api/documents/{uuid.uuid4()}")
    _assert_error(response, 404, "DOCUMENT_NOT_FOUND")


@pytest.mark.asyncio
async def test_reparse_document_processing(client: AsyncClient) -> None:
    user = _make_user()
    doc = SimpleNamespace(id=uuid.uuid4(), user_id=user.id, status="parsing")
    db = _make_db(get=AsyncMock(return_value=doc))
    _override_dependencies(db, auth_user=user)

    response = await client.post(f"/api/documents/{doc.id}/reparse")
    detail = _assert_error(response, 409, "DOCUMENT_PROCESSING")
    assert isinstance(detail["status"], str)


@pytest.mark.asyncio
async def test_document_file_url_storage_unavailable(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    document_id = uuid.uuid4()
    db = _make_db()
    _override_dependencies(db, optional_user=None)
    doc = SimpleNamespace(storage_key="documents/key.pdf", converted_storage_key=None)
    monkeypatch.setattr(documents_api.doc_service, "get_document", AsyncMock(return_value=doc))
    monkeypatch.setattr(documents_api, "can_access_document", lambda _doc, _user: True)
    monkeypatch.setattr(
        documents_api.storage_service,
        "get_presigned_url",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(RuntimeError("minio down")),
    )

    response = await client.get(f"/api/documents/{document_id}/file-url")
    _assert_error(response, 502, "STORAGE_UNAVAILABLE")


@pytest.mark.asyncio
async def test_update_document_instructions_too_long(client: AsyncClient) -> None:
    user = _make_user(plan="pro")
    doc = SimpleNamespace(id=uuid.uuid4(), user_id=user.id, custom_instructions=None)
    db = _make_db(get=AsyncMock(return_value=doc))
    _override_dependencies(db, auth_user=user)

    response = await client.patch(
        f"/api/documents/{doc.id}",
        json={"custom_instructions": "x" * 2001},
    )
    detail = _assert_error(response, 400, "INSTRUCTIONS_TOO_LONG")
    assert isinstance(detail["max"], int)


@pytest.mark.asyncio
async def test_update_document_custom_instructions_require_pro(client: AsyncClient) -> None:
    user = _make_user(plan="free")
    doc = SimpleNamespace(id=uuid.uuid4(), user_id=user.id, custom_instructions=None)
    db = _make_db(get=AsyncMock(return_value=doc))
    _override_dependencies(db, auth_user=user)

    response = await client.patch(
        f"/api/documents/{doc.id}",
        json={"custom_instructions": "Please answer in bullet points"},
    )
    _assert_error(response, 403, "CUSTOM_INSTRUCTIONS_REQUIRE_PRO")


@pytest.mark.asyncio
async def test_create_session_limit_reached(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    user = _make_user(plan="free")
    db = _make_db(
        execute=AsyncMock(return_value=_Result(scalar=settings.FREE_MAX_SESSIONS_PER_DOC)),
    )
    _override_dependencies(db, optional_user=user)
    monkeypatch.setattr(
        chat_api,
        "verify_document_access",
        AsyncMock(return_value=SimpleNamespace(demo_slug=None)),
    )

    response = await client.post(f"/api/documents/{uuid.uuid4()}/sessions")
    detail = _assert_error(response, 403, "SESSION_LIMIT_REACHED")
    assert isinstance(detail["limit"], int)
    assert isinstance(detail["plan"], str)


@pytest.mark.asyncio
async def test_create_demo_session_rate_limited(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db = _make_db()
    _override_dependencies(db, optional_user=None)
    monkeypatch.setattr(
        chat_api,
        "verify_document_access",
        AsyncMock(return_value=SimpleNamespace(demo_slug="demo")),
    )
    monkeypatch.setattr(chat_api.demo_session_create_limiter, "is_allowed", AsyncMock(return_value=False))

    response = await client.post(f"/api/documents/{uuid.uuid4()}/sessions")
    detail = _assert_error(response, 429, "DEMO_SESSION_RATE_LIMITED")
    assert isinstance(detail["retry_after"], int)


@pytest.mark.asyncio
async def test_create_demo_session_limit_reached(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db = _make_db(execute=AsyncMock(return_value=_Result(scalar=chat_api.DEMO_MAX_SESSIONS_PER_DOC)))
    _override_dependencies(db, optional_user=None)
    monkeypatch.setattr(
        chat_api,
        "verify_document_access",
        AsyncMock(return_value=SimpleNamespace(demo_slug="demo")),
    )
    monkeypatch.setattr(chat_api.demo_session_create_limiter, "is_allowed", AsyncMock(return_value=True))

    response = await client.post(f"/api/documents/{uuid.uuid4()}/sessions")
    detail = _assert_error(response, 429, "DEMO_SESSION_LIMIT_REACHED")
    assert isinstance(detail["limit"], int)


@pytest.mark.asyncio
async def test_chat_rate_limited_authenticated(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = _make_user(plan="plus")
    db = _make_db()
    _override_dependencies(db, optional_user=user)
    session = SimpleNamespace(document=SimpleNamespace(status="ready", demo_slug=None), document_id=uuid.uuid4())
    monkeypatch.setattr(chat_api, "verify_session_access", AsyncMock(return_value=session))
    monkeypatch.setattr(chat_api.auth_chat_limiter, "is_allowed", AsyncMock(return_value=False))

    response = await client.post(f"/api/sessions/{uuid.uuid4()}/chat", json={"message": "Hello"})
    detail = _assert_error(response, 429, "RATE_LIMITED")
    assert detail["message"] == "Rate limit exceeded"


@pytest.mark.asyncio
async def test_chat_rate_limited_demo(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db = _make_db()
    _override_dependencies(db, optional_user=None)
    session = SimpleNamespace(document=SimpleNamespace(status="ready", demo_slug="demo"), document_id=uuid.uuid4())
    monkeypatch.setattr(chat_api, "verify_session_access", AsyncMock(return_value=session))
    monkeypatch.setattr(chat_api.demo_chat_limiter, "is_allowed", AsyncMock(return_value=False))

    response = await client.post(f"/api/sessions/{uuid.uuid4()}/chat", json={"message": "Hello"})
    detail = _assert_error(response, 429, "RATE_LIMITED")
    assert detail["message"] == "Rate limit exceeded"


@pytest.mark.asyncio
async def test_chat_demo_message_limit_reached(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db = _make_db()
    _override_dependencies(db, optional_user=None)
    session = SimpleNamespace(document=SimpleNamespace(status="ready", demo_slug="demo"), document_id=uuid.uuid4())
    monkeypatch.setattr(chat_api, "verify_session_access", AsyncMock(return_value=session))
    monkeypatch.setattr(chat_api.demo_chat_limiter, "is_allowed", AsyncMock(return_value=True))
    monkeypatch.setattr(
        chat_api.demo_message_tracker,
        "check_and_increment",
        AsyncMock(return_value=(False, chat_api.DEMO_MESSAGE_LIMIT)),
    )

    response = await client.post(f"/api/sessions/{uuid.uuid4()}/chat", json={"message": "Hello"})
    detail = _assert_error(response, 429, "DEMO_MESSAGE_LIMIT_REACHED")
    assert isinstance(detail["limit"], int)


@pytest.mark.asyncio
async def test_chat_insufficient_credits_precheck(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = _make_user(plan="plus")
    db = _make_db(commit=AsyncMock())
    _override_dependencies(db, optional_user=user)
    session = SimpleNamespace(document=SimpleNamespace(status="ready", demo_slug=None), document_id=uuid.uuid4())
    monkeypatch.setattr(chat_api, "verify_session_access", AsyncMock(return_value=session))
    monkeypatch.setattr(chat_api.auth_chat_limiter, "is_allowed", AsyncMock(return_value=True))
    monkeypatch.setattr(chat_api.credit_service, "get_estimated_cost", lambda _mode: 7)
    monkeypatch.setattr(chat_api.credit_service, "get_user_credits", AsyncMock(return_value=1))

    async def _noop(*_args, **_kwargs):
        return None

    monkeypatch.setattr("app.services.credit_service.ensure_monthly_credits", _noop)

    response = await client.post(f"/api/sessions/{uuid.uuid4()}/chat", json={"message": "Hello"})
    detail = _assert_error(response, 402, "INSUFFICIENT_CREDITS")
    assert isinstance(detail["required"], int)
    assert isinstance(detail["balance"], int)


@pytest.mark.asyncio
async def test_chat_continue_continuation_limit(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = _make_user(plan="plus")
    msg = SimpleNamespace(continuation_count=settings.MAX_CONTINUATIONS_PER_MESSAGE)
    db = _make_db(execute=AsyncMock(return_value=_Result(scalar_one_or_none=msg)))
    _override_dependencies(db, optional_user=user)
    session = SimpleNamespace(document=SimpleNamespace(status="ready", demo_slug=None))
    monkeypatch.setattr(chat_api, "verify_session_access", AsyncMock(return_value=session))
    monkeypatch.setattr(chat_api.auth_chat_limiter, "is_allowed", AsyncMock(return_value=True))

    response = await client.post(
        f"/api/sessions/{uuid.uuid4()}/chat/continue",
        json={"message_id": str(uuid.uuid4())},
    )
    detail = _assert_error(response, 400, "CONTINUATION_LIMIT")
    assert isinstance(detail["max"], int)


@pytest.mark.asyncio
async def test_session_not_found(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    db = _make_db()
    _override_dependencies(db, optional_user=None)
    monkeypatch.setattr(chat_api, "verify_session_access", AsyncMock(return_value=None))

    response = await client.get(f"/api/sessions/{uuid.uuid4()}/messages")
    _assert_error(response, 404, "SESSION_NOT_FOUND")


@pytest.mark.asyncio
async def test_message_not_found(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    user = _make_user(plan="plus")
    db = _make_db(execute=AsyncMock(return_value=_Result(scalar_one_or_none=None)))
    _override_dependencies(db, optional_user=user)
    session = SimpleNamespace(document=SimpleNamespace(status="ready", demo_slug=None))
    monkeypatch.setattr(chat_api, "verify_session_access", AsyncMock(return_value=session))
    monkeypatch.setattr(chat_api.auth_chat_limiter, "is_allowed", AsyncMock(return_value=True))

    response = await client.post(
        f"/api/sessions/{uuid.uuid4()}/chat/continue",
        json={"message_id": str(uuid.uuid4())},
    )
    _assert_error(response, 404, "MESSAGE_NOT_FOUND")


@pytest.mark.asyncio
async def test_collection_limit_reached(client: AsyncClient) -> None:
    user = _make_user(plan="free")
    db = _make_db(execute=AsyncMock(return_value=_Result(scalar=settings.FREE_MAX_COLLECTIONS)))
    _override_dependencies(db, auth_user=user)

    response = await client.post("/api/collections", json={"name": "A"})
    detail = _assert_error(response, 403, "COLLECTION_LIMIT_REACHED")
    assert isinstance(detail["limit"], int)
    assert isinstance(detail["plan"], str)


@pytest.mark.asyncio
async def test_collection_doc_limit_reached(client: AsyncClient) -> None:
    user = _make_user(plan="free")
    collection_id = uuid.uuid4()
    document_id = uuid.uuid4()
    coll = SimpleNamespace(id=collection_id, user_id=user.id)
    doc = SimpleNamespace(id=document_id, user_id=user.id)

    async def _fake_get(model, obj_id):
        if model is collections_api.Collection and obj_id == collection_id:
            return coll
        if model is collections_api.Document and obj_id == document_id:
            return doc
        return None

    db = _make_db(
        get=AsyncMock(side_effect=_fake_get),
        execute=AsyncMock(
            side_effect=[
                _Result(scalar=settings.FREE_MAX_DOCS_PER_COLLECTION),
                _Result(first=None),
            ]
        ),
    )
    _override_dependencies(db, auth_user=user)

    response = await client.post(
        f"/api/collections/{collection_id}/documents",
        json={"document_ids": [str(document_id)]},
    )
    detail = _assert_error(response, 403, "COLLECTION_DOC_LIMIT_REACHED")
    assert isinstance(detail["limit"], int)
    assert isinstance(detail["plan"], str)


@pytest.mark.asyncio
async def test_collection_not_found(client: AsyncClient) -> None:
    user = _make_user(plan="free")
    db = _make_db(execute=AsyncMock(return_value=_Result(scalar_one_or_none=None)))
    _override_dependencies(db, auth_user=user)

    response = await client.get(f"/api/collections/{uuid.uuid4()}")
    _assert_error(response, 404, "COLLECTION_NOT_FOUND")


@pytest.mark.asyncio
async def test_export_requires_paid_plan(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    user = _make_user(plan="free")
    db = _make_db()
    _override_dependencies(db, auth_user=user)
    monkeypatch.setattr(
        export_api,
        "verify_session_access",
        AsyncMock(return_value=SimpleNamespace(title="Title", document=None)),
    )

    response = await client.get(f"/api/sessions/{uuid.uuid4()}/export?format=pdf")
    detail = _assert_error(response, 403, "EXPORT_REQUIRES_PAID_PLAN")
    assert isinstance(detail["format"], str)
    assert isinstance(detail["required_plans"], list)


@pytest.mark.asyncio
async def test_export_validation_failed(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    user = _make_user(plan="plus")
    db = _make_db(execute=AsyncMock(return_value=_Result(scalars_all=[])))
    _override_dependencies(db, auth_user=user)
    monkeypatch.setattr(
        export_api,
        "verify_session_access",
        AsyncMock(return_value=SimpleNamespace(title="Title", document=None)),
    )

    def _raise_validation(*_args, **_kwargs):
        raise ValueError("Export limited to 500 messages")

    monkeypatch.setattr(export_api, "render_markdown", _raise_validation)

    response = await client.get(f"/api/sessions/{uuid.uuid4()}/export?format=md")
    detail = _assert_error(response, 400, "EXPORT_VALIDATION_FAILED")
    assert isinstance(detail["reason"], str)


@pytest.mark.asyncio
async def test_export_renderer_failed(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    user = _make_user(plan="plus")
    db = _make_db(execute=AsyncMock(return_value=_Result(scalars_all=[])))
    _override_dependencies(db, auth_user=user)
    monkeypatch.setattr(
        export_api,
        "verify_session_access",
        AsyncMock(return_value=SimpleNamespace(title="Title", document=None)),
    )

    def _raise_renderer(*_args, **_kwargs):
        raise export_api.ExportError("renderer crashed")

    monkeypatch.setattr(export_api, "render_pdf", _raise_renderer)

    response = await client.get(f"/api/sessions/{uuid.uuid4()}/export?format=pdf")
    _assert_error(response, 500, "EXPORT_RENDERER_FAILED")
    assert "renderer crashed" not in response.text


@pytest.mark.asyncio
async def test_share_limit_reached(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    user = _make_user(plan="free")
    db = _make_db(
        execute=AsyncMock(
            side_effect=[
                _Result(scalar_one_or_none=None),
                _Result(scalar=3),
            ]
        ),
    )
    _override_dependencies(db, auth_user=user)
    monkeypatch.setattr(
        sharing_api,
        "verify_session_access",
        AsyncMock(return_value=SimpleNamespace(id=uuid.uuid4())),
    )

    response = await client.post(f"/api/sessions/{uuid.uuid4()}/share")
    detail = _assert_error(response, 403, "SHARE_LIMIT_REACHED")
    assert isinstance(detail["limit"], int)
    assert isinstance(detail["plan"], str)


@pytest.mark.asyncio
async def test_share_expired(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    share = SimpleNamespace(
        session_id=uuid.uuid4(),
        expires_at=datetime.now(timezone.utc) - timedelta(minutes=1),
    )
    db = _make_db(execute=AsyncMock(return_value=_Result(scalar_one_or_none=share)))
    _override_dependencies(db)
    monkeypatch.setattr(sharing_api.shared_view_limiter, "is_allowed", AsyncMock(return_value=True))

    response = await client.get(f"/api/shared/{uuid.uuid4()}")
    _assert_error(response, 410, "SHARE_EXPIRED")


@pytest.mark.asyncio
async def test_share_not_found(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    db = _make_db(execute=AsyncMock(return_value=_Result(scalar_one_or_none=None)))
    _override_dependencies(db)
    monkeypatch.setattr(sharing_api.shared_view_limiter, "is_allowed", AsyncMock(return_value=True))

    response = await client.get(f"/api/shared/{uuid.uuid4()}")
    _assert_error(response, 404, "SHARE_NOT_FOUND")


@pytest.mark.asyncio
async def test_chunk_not_found(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    db = _make_db(execute=AsyncMock(return_value=_Result(scalar_one_or_none=None)))
    _override_dependencies(db, optional_user=None)
    monkeypatch.setattr(chunks_api.anon_read_limiter, "is_allowed", AsyncMock(return_value=True))

    response = await client.get(f"/api/chunks/{uuid.uuid4()}")
    _assert_error(response, 404, "CHUNK_NOT_FOUND")


@pytest.mark.asyncio
async def test_users_delete_stripe_unavailable_lookup(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = _make_user(
        stripe_subscription_id="sub_active",
        stripe_customer_id=None,
    )
    db = _make_db(execute=AsyncMock(return_value=_Result(all_rows=[])))
    _override_dependencies(db, auth_user=user)
    monkeypatch.setattr(users_api.settings, "STRIPE_SECRET_KEY", "sk_test")
    monkeypatch.setattr(
        users_api,
        "_resolve_active_subscription_id",
        AsyncMock(side_effect=RuntimeError("stripe unavailable")),
    )

    response = await client.delete("/api/users/me")
    _assert_error(response, 502, "STRIPE_UNAVAILABLE")


@pytest.mark.asyncio
async def test_users_delete_stripe_unavailable_cancel(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = _make_user(
        stripe_subscription_id="sub_active",
        stripe_customer_id=None,
    )
    db = _make_db(execute=AsyncMock(return_value=_Result(all_rows=[])))
    _override_dependencies(db, auth_user=user)
    monkeypatch.setattr(users_api.settings, "STRIPE_SECRET_KEY", "sk_test")
    monkeypatch.setattr(
        users_api,
        "_resolve_active_subscription_id",
        AsyncMock(return_value="sub_active"),
    )
    monkeypatch.setattr(
        users_api.stripe.Subscription,
        "cancel",
        lambda _sub_id: (_ for _ in ()).throw(RuntimeError("cancel failed")),
    )

    response = await client.delete("/api/users/me")
    _assert_error(response, 502, "STRIPE_UNAVAILABLE")


@pytest.mark.asyncio
async def test_documents_not_found_masks_authz(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """
    Codex r4 finding #3: 404 must look identical whether the doc is truly
    missing or exists but belongs to another user. Any divergence creates
    an enumeration oracle.
    """
    doc_id = uuid.uuid4()

    # Case A: truly missing.
    db_missing = _make_db()
    _override_dependencies(db_missing, optional_user=_make_user())
    monkeypatch.setattr(documents_api.doc_service, "get_document", AsyncMock(return_value=None))
    resp_missing = await client.get(f"/api/documents/{doc_id}")

    # Case B: exists but not yours. can_access_document returns False.
    other_user = _make_user()
    other_doc = SimpleNamespace(id=doc_id, user_id=uuid.uuid4(), demo_slug=None, converted_storage_key=None)
    db_found = _make_db()
    _override_dependencies(db_found, optional_user=other_user)
    monkeypatch.setattr(documents_api.doc_service, "get_document", AsyncMock(return_value=other_doc))
    monkeypatch.setattr(documents_api, "can_access_document", lambda _doc, _user: False)
    resp_found = await client.get(f"/api/documents/{doc_id}")

    assert resp_missing.status_code == 404
    assert resp_found.status_code == 404
    assert resp_missing.json() == resp_found.json(), "404 body diverges → enumeration oracle"


@pytest.mark.asyncio
async def test_search_rate_limited(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    db = _make_db()
    _override_dependencies(db, optional_user=None)
    monkeypatch.setattr(search_api.anon_read_limiter, "is_allowed", AsyncMock(return_value=False))

    response = await client.post(
        f"/api/documents/{uuid.uuid4()}/search",
        json={"query": "hello", "top_k": 5},
    )
    detail = _assert_error(response, 429, "RATE_LIMITED")
    assert detail["retry_after"] == 60
    assert response.headers.get("retry-after") == "60"


@pytest.mark.asyncio
async def test_chunks_rate_limited(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    db = _make_db()
    _override_dependencies(db, optional_user=None)
    monkeypatch.setattr(chunks_api.anon_read_limiter, "is_allowed", AsyncMock(return_value=False))

    response = await client.get(f"/api/chunks/{uuid.uuid4()}")
    detail = _assert_error(response, 429, "RATE_LIMITED")
    assert detail["retry_after"] == 60
    assert response.headers.get("retry-after") == "60"


@pytest.mark.asyncio
async def test_chat_service_mode_not_allowed_sse_emits_required_plan() -> None:
    """
    chat_service emits MODE_NOT_ALLOWED as an SSE error frame (not an
    HTTPException) when a Free-plan user requests Thorough mode. The
    required_plan field was added in Phase 1 so the frontend can render
    a targeted upgrade CTA. Regression test this contract directly.
    """
    user = _make_user(plan="free")
    session_id = uuid.uuid4()

    async def _fake_scalar(*_a, **_kw):
        return SimpleNamespace(id=session_id, document_id=None, collection_id=None)

    # Minimal DB stub that returns a session object on the first execute()
    # call so chat_stream reaches the Thorough-mode gate before touching
    # anything else. Use AsyncMock for call-site parity.
    class _SessionResult:
        def scalar_one_or_none(self):
            return SimpleNamespace(id=session_id, document_id=None, collection_id=None)

    db = _make_db(execute=AsyncMock(return_value=_SessionResult()))

    svc = chat_service_module.ChatService()
    gen = svc.chat_stream(
        session_id=session_id,
        user_message="hello",
        db=db,  # type: ignore[arg-type]
        user=user,
        locale="en",
        mode="thorough",
        domain_mode=None,
    )

    first = await gen.__anext__()
    assert first["event"] == "error"
    assert first["data"]["code"] == "MODE_NOT_ALLOWED"
    assert first["data"]["required_plan"] == "plus"


@pytest.mark.asyncio
async def test_upload_unknown_valueerror_returns_server_error(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = _make_user(plan="free")
    db = _make_db(scalar=AsyncMock(return_value=0))
    _override_dependencies(db, auth_user=user)
    monkeypatch.setattr(
        documents_api.doc_service,
        "create_document",
        AsyncMock(side_effect=ValueError("VERY_SECRET_DETAIL")),
    )

    response = await client.post(
        "/api/documents/upload",
        files={"file": ("report.pdf", b"%PDF-1.4\nok", "application/pdf")},
    )
    _assert_error(response, 500, "SERVER_ERROR")
    assert "VERY_SECRET_DETAIL" not in response.text
