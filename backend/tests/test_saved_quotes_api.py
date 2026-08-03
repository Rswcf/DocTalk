"""Tests for the saved-quotes CRUD endpoints (M3-B2, plan D8 amended by
§8.5 M3 / §8.4 point 2). Mocked-db pattern mirrors test_quotes_api.py.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.api import quotes as quotes_api
from app.core import deps as deps_module
from app.core.config import settings
from app.services import saved_quotes_service
from app.services.quote_search_service import QuoteCard

api_app = FastAPI()
api_app.include_router(quotes_api.router)


def _make_user(*, plan: str = "free") -> SimpleNamespace:
    return SimpleNamespace(id=uuid.uuid4(), plan=plan, email="user@example.com")


def _make_doc(user: SimpleNamespace, *, status: str = "ready", demo_slug=None) -> SimpleNamespace:
    return SimpleNamespace(id=uuid.uuid4(), user_id=user.id, status=status, demo_slug=demo_slug)


def _make_db(**overrides: object) -> SimpleNamespace:
    payload: dict[str, object] = {
        "get": AsyncMock(return_value=None),
        "execute": AsyncMock(),
        "add": lambda _obj: None,
        "commit": AsyncMock(),
        "rollback": AsyncMock(),
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


def _sample_card(**overrides) -> QuoteCard:
    base = dict(
        display_text="the exact quoted sentence",
        page=4, page_end=4, bboxes=[{"x": 0.1, "y": 0.2, "w": 0.3, "h": 0.05, "page": 4}],
        tier="exact", source_kind="extracted_text", chunk_id=str(uuid.uuid4()), score=100.0,
    )
    base.update(overrides)
    return QuoteCard(**base)


def _saved_row(**overrides) -> SimpleNamespace:
    now = datetime.now(timezone.utc)
    base = dict(
        id=uuid.uuid4(), document_id=uuid.uuid4(), page=4, page_end=4,
        quote_text="the exact quoted sentence",
        bboxes=[{"x": 0.1, "y": 0.2, "w": 0.3, "h": 0.05, "page": 4}],
        verification_tier="exact", verification_score=100.0, verifier_version="v1",
        source_kind="extracted_text", note=None, created_at=now, updated_at=now,
        # FIX-7-backend (Codex M3 r1 LOW): _saved_quote_board_response
        # reads row.document.filename (list_all_saved_quotes'
        # selectinload) — a plain default here so every test using this
        # helper works with the board endpoint without needing to opt in.
        document=SimpleNamespace(filename="test-document.pdf"),
    )
    base.update(overrides)
    return SimpleNamespace(**base)


def _assert_error(response, status_code: int, error_code: str) -> dict:
    assert response.status_code == status_code
    body = response.json()
    detail = body["detail"]
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


# -------------------------- POST create --------------------------

@pytest.mark.asyncio
async def test_create_requires_auth(client: AsyncClient) -> None:
    document_id = uuid.uuid4()
    response = await client.post(
        f"/api/documents/{document_id}/quotes",
        json={"chunk_id": str(uuid.uuid4()), "quote_text": "x"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_create_rejects_inaccessible_document(client: AsyncClient) -> None:
    user = _make_user()
    other_user_doc = _make_doc(_make_user())
    db = _make_db(get=AsyncMock(return_value=other_user_doc))
    _override_dependencies(db, user)

    response = await client.post(
        f"/api/documents/{other_user_doc.id}/quotes",
        json={"chunk_id": str(uuid.uuid4()), "quote_text": "x"},
    )

    _assert_error(response, 404, "DOCUMENT_NOT_FOUND")


@pytest.mark.asyncio
async def test_create_rejects_malformed_chunk_id(client: AsyncClient) -> None:
    user = _make_user()
    doc = _make_doc(user)
    db = _make_db(get=AsyncMock(return_value=doc))
    _override_dependencies(db, user)

    response = await client.post(
        f"/api/documents/{doc.id}/quotes",
        json={"chunk_id": "not-a-uuid", "quote_text": "x"},
    )

    _assert_error(response, 422, "INVALID_CHUNK_ID")


@pytest.mark.asyncio
async def test_create_rejects_a_quote_that_fails_reverification(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The core anti-fabrication guarantee at the HTTP boundary: a client
    posting text that verify_saved_quote cannot locate gets a hard 422,
    never a silently-persisted "verified" row."""
    user = _make_user()
    doc = _make_doc(user)
    db = _make_db(get=AsyncMock(return_value=doc))
    _override_dependencies(db, user)
    monkeypatch.setattr(
        quotes_api.quote_search_service, "verify_saved_quote", AsyncMock(return_value=None)
    )
    save_mock = AsyncMock()
    monkeypatch.setattr(saved_quotes_service, "save_quote", save_mock)

    response = await client.post(
        f"/api/documents/{doc.id}/quotes",
        json={"chunk_id": str(uuid.uuid4()), "quote_text": "I confess to fraud"},
    )

    _assert_error(response, 422, "QUOTE_NOT_VERIFIABLE")
    save_mock.assert_not_awaited()


@pytest.mark.asyncio
async def test_create_happy_path_reverifies_then_saves(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = _make_user()
    doc = _make_doc(user)
    added: list[object] = []
    db = _make_db(get=AsyncMock(return_value=doc), add=lambda obj: added.append(obj))
    _override_dependencies(db, user)

    card = _sample_card()
    chunk_id = uuid.UUID(card.chunk_id)
    verify_mock = AsyncMock(return_value=card)
    monkeypatch.setattr(quotes_api.quote_search_service, "verify_saved_quote", verify_mock)
    row = _saved_row(document_id=doc.id)
    # FIX-1 (Codex M3 r1 HIGH — cap race): the idempotency AND cap checks
    # now live INSIDE save_quote()'s own locked critical section, so this
    # endpoint no longer calls get_existing_saved_quote/
    # count_active_saved_quotes itself — mocking save_quote's outcome
    # directly is the only thing left to control here.
    monkeypatch.setattr(
        saved_quotes_service, "save_quote",
        AsyncMock(return_value=saved_quotes_service.SaveQuoteOutcome(
            row=row, created=True, limit_reached=False, active_count=2,
        )),
    )

    response = await client.post(
        f"/api/documents/{doc.id}/quotes",
        json={"chunk_id": str(chunk_id), "quote_text": "the exact quoted sentence", "page_hint": 4},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["id"] == str(row.id)
    assert body["tier"] == "exact"
    assert body["score"] == 100.0
    assert body["source_kind"] == "extracted_text"
    assert body["note"] is None

    verify_mock.assert_awaited_once()
    assert verify_mock.await_args.kwargs["chunk_id"] == chunk_id
    assert verify_mock.await_args.kwargs["quote_text"] == "the exact quoted sentence"
    assert verify_mock.await_args.kwargs["page_hint"] == 4

    events = [obj for obj in added if getattr(obj, "event_name", None) == "quote_saved"]
    assert len(events) == 1


@pytest.mark.asyncio
async def test_create_idempotent_repeat_save_returns_200_shape_without_cap_check(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Idempotent hit: no quote_saved telemetry event fires a second time,
    and the API layer trusts save_quote()'s own limit_reached=False as-is
    (the cap check itself, and "does an idempotent hit skip it," are unit-
    tested directly against save_quote() in test_saved_quotes_service.py —
    this test only proves the API layer wires the outcome correctly).

    Contract fix (live E2E finding, 2026-08-03): this test's own NAME always
    said "returns_200_shape" but the assertion below wrongly asserted 201 —
    the plan's actual contract ("Idempotent save returns the existing row
    (200 not 409)") was never enforced. Fixed both the implementation
    (quotes.py now overrides the response status to 200 via the injected
    Response when created=False) and this assertion."""
    user = _make_user()
    doc = _make_doc(user)
    added: list[object] = []
    db = _make_db(get=AsyncMock(return_value=doc), add=lambda obj: added.append(obj))
    _override_dependencies(db, user)

    card = _sample_card()
    monkeypatch.setattr(quotes_api.quote_search_service, "verify_saved_quote", AsyncMock(return_value=card))
    existing_row = _saved_row(document_id=doc.id)
    monkeypatch.setattr(
        saved_quotes_service, "save_quote",
        AsyncMock(return_value=saved_quotes_service.SaveQuoteOutcome(
            row=existing_row, created=False, limit_reached=False, active_count=0,
        )),
    )

    response = await client.post(
        f"/api/documents/{doc.id}/quotes",
        json={"chunk_id": card.chunk_id, "quote_text": card.display_text},
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(existing_row.id)
    events = [obj for obj in added if getattr(obj, "event_name", None) == "quote_saved"]
    assert events == []


@pytest.mark.asyncio
async def test_create_rejects_new_save_at_the_free_plan_cap(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = _make_user(plan="free")
    doc = _make_doc(user)
    added: list[object] = []
    db = _make_db(get=AsyncMock(return_value=doc), add=lambda obj: added.append(obj))
    _override_dependencies(db, user)

    card = _sample_card()
    monkeypatch.setattr(quotes_api.quote_search_service, "verify_saved_quote", AsyncMock(return_value=card))
    # FIX-1: save_quote() itself now decides limit_reached (inside its
    # locked critical section) — the API layer just reacts to the outcome.
    save_mock = AsyncMock(return_value=saved_quotes_service.SaveQuoteOutcome(
        row=None, created=False, limit_reached=True, active_count=settings.FREE_SAVED_QUOTES_LIMIT,
    ))
    monkeypatch.setattr(saved_quotes_service, "save_quote", save_mock)

    response = await client.post(
        f"/api/documents/{doc.id}/quotes",
        json={"chunk_id": card.chunk_id, "quote_text": card.display_text},
    )

    detail = _assert_error(response, 403, "SAVED_QUOTES_LIMIT_REACHED")
    assert detail["limit"] == settings.FREE_SAVED_QUOTES_LIMIT
    assert detail["plan"] == "free"
    save_mock.assert_awaited_once()
    events = [obj for obj in added if getattr(obj, "event_name", None) == "quote_save_limit_hit"]
    assert len(events) == 1
    assert events[0].metadata_json["current"] == settings.FREE_SAVED_QUOTES_LIMIT


# FIX-1 (Codex M3 r1 HIGH — cap race): the "pro plan isn't capped by the
# free limit" behavior moved OUT of this layer entirely — save_quote()
# decides limit_reached now, inside its own locked critical section (see
# test_saved_quotes_service.py's TestSaveQuoteIdempotency). What used to
# live here as test_create_pro_plan_unaffected_by_free_limit would only be
# re-asserting mock wiring at this point; the real behavior is covered
# where the decision actually happens.


# -------------------------- GET list --------------------------

@pytest.mark.asyncio
async def test_list_document_quotes_requires_auth(client: AsyncClient) -> None:
    response = await client.get(f"/api/documents/{uuid.uuid4()}/quotes")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_list_document_quotes_rejects_inaccessible_document(client: AsyncClient) -> None:
    user = _make_user()
    other_user_doc = _make_doc(_make_user())
    db = _make_db(get=AsyncMock(return_value=other_user_doc))
    _override_dependencies(db, user)

    response = await client.get(f"/api/documents/{other_user_doc.id}/quotes")

    _assert_error(response, 404, "DOCUMENT_NOT_FOUND")


@pytest.mark.asyncio
async def test_list_document_quotes_happy_path(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = _make_user()
    doc = _make_doc(user)
    db = _make_db(get=AsyncMock(return_value=doc))
    _override_dependencies(db, user)

    rows = [_saved_row(document_id=doc.id), _saved_row(document_id=doc.id)]
    list_mock = AsyncMock(return_value=rows)
    monkeypatch.setattr(saved_quotes_service, "list_saved_quotes_for_document", list_mock)

    response = await client.get(f"/api/documents/{doc.id}/quotes")

    assert response.status_code == 200
    body = response.json()
    assert len(body["quotes"]) == 2
    assert list_mock.await_args.kwargs["user_id"] == user.id
    assert list_mock.await_args.kwargs["document_id"] == doc.id


@pytest.mark.asyncio
async def test_list_all_quotes_requires_auth(client: AsyncClient) -> None:
    response = await client.get("/api/quotes")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_list_all_quotes_happy_path(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = _make_user()
    db = _make_db()
    _override_dependencies(db, user)

    rows = [
        _saved_row(document=SimpleNamespace(filename="paper-one.pdf")),
        _saved_row(document=SimpleNamespace(filename="paper-two.pdf")),
        _saved_row(),
    ]
    list_mock = AsyncMock(return_value=rows)
    monkeypatch.setattr(saved_quotes_service, "list_all_saved_quotes", list_mock)

    response = await client.get("/api/quotes")

    assert response.status_code == 200
    quotes = response.json()["quotes"]
    assert len(quotes) == 3
    # FIX-7-backend (Codex M3 r1 LOW): the board feed's response rows
    # carry document_filename, unlike the document-scoped endpoints.
    assert quotes[0]["document_filename"] == "paper-one.pdf"
    assert quotes[1]["document_filename"] == "paper-two.pdf"
    assert list_mock.await_args.kwargs["user_id"] == user.id


# -------------------------- PATCH note --------------------------

@pytest.mark.asyncio
async def test_patch_requires_auth(client: AsyncClient) -> None:
    response = await client.patch(f"/api/quotes/{uuid.uuid4()}", json={"note": "x"})
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_patch_404_when_not_owned(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = _make_user()
    db = _make_db()
    _override_dependencies(db, user)
    monkeypatch.setattr(
        saved_quotes_service, "get_owned_saved_quote", AsyncMock(return_value=None)
    )

    response = await client.patch(f"/api/quotes/{uuid.uuid4()}", json={"note": "x"})

    _assert_error(response, 404, "SAVED_QUOTE_NOT_FOUND")


@pytest.mark.asyncio
async def test_patch_updates_note_only(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = _make_user()
    db = _make_db()
    _override_dependencies(db, user)
    row = _saved_row(note=None)
    monkeypatch.setattr(saved_quotes_service, "get_owned_saved_quote", AsyncMock(return_value=row))

    async def _fake_update_note(_db, *, row, note):
        row.note = note
        return row

    monkeypatch.setattr(saved_quotes_service, "update_note", _fake_update_note)

    response = await client.patch(f"/api/quotes/{row.id}", json={"note": "cite this in intro"})

    assert response.status_code == 200
    assert response.json()["note"] == "cite this in intro"


# -------------------------- DELETE --------------------------

@pytest.mark.asyncio
async def test_delete_requires_auth(client: AsyncClient) -> None:
    response = await client.delete(f"/api/quotes/{uuid.uuid4()}")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_delete_404_when_not_owned(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = _make_user()
    db = _make_db()
    _override_dependencies(db, user)
    monkeypatch.setattr(
        saved_quotes_service, "get_owned_saved_quote", AsyncMock(return_value=None)
    )

    response = await client.delete(f"/api/quotes/{uuid.uuid4()}")

    _assert_error(response, 404, "SAVED_QUOTE_NOT_FOUND")


@pytest.mark.asyncio
async def test_delete_happy_path_returns_204(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = _make_user()
    db = _make_db()
    _override_dependencies(db, user)
    row = _saved_row()
    monkeypatch.setattr(saved_quotes_service, "get_owned_saved_quote", AsyncMock(return_value=row))
    delete_mock = AsyncMock()
    monkeypatch.setattr(saved_quotes_service, "delete_saved_quote", delete_mock)

    response = await client.delete(f"/api/quotes/{row.id}")

    assert response.status_code == 204
    delete_mock.assert_awaited_once()
    assert delete_mock.await_args.kwargs["row"] is row


# -------------------------- M3-B3: no re-verification on read --------------------------

class TestSnapshotAtSaveTimeNoReverificationOnRead:
    """M3-B3 (plan §8.1/§8.5): a saved quote's trust fields are snapshotted
    ONCE, at save time — display must read the STORED columns, never call
    verify_quote/verify_saved_quote/quote_search again. Both verification
    entry points are patched to raise if called at all, so any future
    change that accidentally re-verifies on a read path fails loudly here
    rather than silently degrading (extra LLM calls, extra cost, or a
    result that drifts from what the user actually saved) — this is a
    regression LOCK on an already-correct design, not a TDD-driven
    implementation change; B1's schema (source_chunk_id nullable, ON
    DELETE SET NULL) and B2's save-time-only construction of SavedQuote
    rows already make re-verification impossible by construction. The
    complementary "survives a real reparse" proof against real Postgres
    lives in test_saved_quotes_integration.py."""

    @pytest.mark.asyncio
    async def test_list_document_quotes_never_calls_verification(
        self, client: AsyncClient, monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        user = _make_user()
        doc = _make_doc(user)
        db = _make_db(get=AsyncMock(return_value=doc))
        _override_dependencies(db, user)

        def _must_not_be_called(*_a, **_k):
            raise AssertionError("GET must not re-verify saved quotes")

        monkeypatch.setattr(quotes_api.quote_search_service, "verify_saved_quote", _must_not_be_called)
        monkeypatch.setattr(quotes_api.quote_search_service, "quote_search", _must_not_be_called)
        rows = [_saved_row(document_id=doc.id, verification_tier="exact")]
        monkeypatch.setattr(
            saved_quotes_service, "list_saved_quotes_for_document", AsyncMock(return_value=rows)
        )

        response = await client.get(f"/api/documents/{doc.id}/quotes")

        assert response.status_code == 200
        assert response.json()["quotes"][0]["tier"] == "exact"  # the STORED value, verbatim

    @pytest.mark.asyncio
    async def test_list_all_quotes_never_calls_verification(
        self, client: AsyncClient, monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        user = _make_user()
        db = _make_db()
        _override_dependencies(db, user)

        def _must_not_be_called(*_a, **_k):
            raise AssertionError("the Evidence Board feed must not re-verify saved quotes")

        monkeypatch.setattr(quotes_api.quote_search_service, "verify_saved_quote", _must_not_be_called)
        monkeypatch.setattr(quotes_api.quote_search_service, "quote_search", _must_not_be_called)
        rows = [_saved_row(verification_tier="normalized", verification_score=97.5)]
        monkeypatch.setattr(saved_quotes_service, "list_all_saved_quotes", AsyncMock(return_value=rows))

        response = await client.get("/api/quotes")

        assert response.status_code == 200
        quote = response.json()["quotes"][0]
        assert quote["tier"] == "normalized"
        assert quote["score"] == 97.5
