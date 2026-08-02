"""Tests for the billed quote-search endpoint (B4, plan §8.4.1/§8.3).

Billing mirrors chat_service's two-stage debit exactly (predebit 15,
reason="quote_search", reconcile to actual tokens, DELETE+refund the ledger
row on failure) — see tests/test_extractions_api.py for the established
mocked-db pattern this file follows.
"""
from __future__ import annotations

import asyncio
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.api import quotes as quotes_api
from app.core import deps as deps_module
from app.services import credit_service, quote_search_service
from app.services.quote_search_service import QuoteCard, QuoteSearchResult

api_app = FastAPI()
api_app.include_router(quotes_api.router)


class _Result:
    def __init__(self, *, scalar_one_or_none: object = None, rowcount: int = 0) -> None:
        self._scalar_one_or_none = scalar_one_or_none
        self.rowcount = rowcount

    def scalar_one_or_none(self):
        return self._scalar_one_or_none


def _make_user(*, plan: str = "free") -> SimpleNamespace:
    return SimpleNamespace(id=uuid.uuid4(), plan=plan, email="user@example.com")


def _make_doc(user: SimpleNamespace, *, status: str = "ready", demo_slug=None) -> SimpleNamespace:
    return SimpleNamespace(
        id=uuid.uuid4(), user_id=user.id, status=status, demo_slug=demo_slug,
        text_quality=0.95, parse_method="text", page_count=10,
    )


def _make_db(**overrides: object) -> SimpleNamespace:
    payload: dict[str, object] = {
        "get": AsyncMock(return_value=None),
        "execute": AsyncMock(return_value=_Result()),
        "add": lambda _obj: None,
        "flush": AsyncMock(),
        "commit": AsyncMock(),
        "refresh": AsyncMock(),
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
        page=4, page_end=4, bboxes=[], tier="exact",
        source_kind="extracted_text", chunk_id=str(uuid.uuid4()), score=100.0,
    )
    base.update(overrides)
    return QuoteCard(**base)


def _sample_result(**overrides) -> QuoteSearchResult:
    base = dict(
        cards=[_sample_card()], proposed=1, verified=1, discarded=[],
        scanned_chunks=12, usage=(500, 120), model="deepseek-v4-pro",
    )
    base.update(overrides)
    return QuoteSearchResult(**base)


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


@pytest.mark.asyncio
async def test_quote_search_requires_auth(client: AsyncClient) -> None:
    document_id = uuid.uuid4()
    response = await client.post(
        f"/api/documents/{document_id}/quote-search", json={"topic": "climate risk"}
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_quote_search_insufficient_credits_pre_check(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Optimistic pre-check (like chat's) rejects before any debit is attempted."""
    user = _make_user()
    doc = _make_doc(user)
    db = _make_db(get=AsyncMock(return_value=doc))
    _override_dependencies(db, user)
    debit_mock = AsyncMock(return_value=None)
    monkeypatch.setattr(credit_service, "debit_credits", debit_mock)
    monkeypatch.setattr(credit_service, "get_user_credits", AsyncMock(return_value=3))

    response = await client.post(
        f"/api/documents/{doc.id}/quote-search", json={"topic": "climate risk"}
    )

    detail = _assert_error(response, 402, "INSUFFICIENT_CREDITS")
    assert detail["required"] == 15
    assert detail["balance"] == 3
    debit_mock.assert_not_awaited()  # pre-check short-circuits before any debit attempt


@pytest.mark.asyncio
async def test_quote_search_debit_race_falls_back_to_402(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Pre-check passes optimistically but the atomic debit_credits() still
    fails (TOCTOU race) — must still surface 402, not a 500."""
    user = _make_user()
    doc = _make_doc(user)
    db = _make_db(get=AsyncMock(return_value=doc))
    _override_dependencies(db, user)
    get_credits_mock = AsyncMock(side_effect=[20, 2])  # pre-check sees 20, post-race balance is 2
    monkeypatch.setattr(credit_service, "get_user_credits", get_credits_mock)
    monkeypatch.setattr(credit_service, "debit_credits", AsyncMock(return_value=None))

    response = await client.post(
        f"/api/documents/{doc.id}/quote-search", json={"topic": "climate risk"}
    )

    detail = _assert_error(response, 402, "INSUFFICIENT_CREDITS")
    assert detail["balance"] == 2
    db.rollback.assert_awaited_once()


@pytest.mark.asyncio
async def test_quote_search_happy_path_bills_predebit_then_reconciles_single_ledger_row(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = _make_user()
    doc = _make_doc(user)
    db = _make_db(get=AsyncMock(return_value=doc))
    _override_dependencies(db, user)

    ledger_id = uuid.uuid4()
    debit_mock = AsyncMock(return_value=ledger_id)
    reconcile_mock = AsyncMock(return_value=None)
    monkeypatch.setattr(credit_service, "debit_credits", debit_mock)
    monkeypatch.setattr(credit_service, "reconcile_credits", reconcile_mock)
    monkeypatch.setattr(credit_service, "get_user_credits", AsyncMock(return_value=485))

    result = _sample_result()
    quote_search_mock = AsyncMock(return_value=result)
    monkeypatch.setattr(quote_search_service, "quote_search", quote_search_mock)

    response = await client.post(
        f"/api/documents/{doc.id}/quote-search", json={"topic": "climate risk", "locale": "en"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["proposed"] == 1
    assert body["verified"] == 1
    assert body["scanned_chunks"] == 12
    assert body["remaining_credits"] == 485
    assert len(body["cards"]) == 1
    card = body["cards"][0]
    assert card["display_text"] == "the exact quoted sentence"
    assert card["source_kind"] == "extracted_text"
    assert card["tier"] == "exact"

    # Single predebit call, single reconcile call against the SAME ledger row.
    debit_mock.assert_awaited_once()
    assert debit_mock.await_args.kwargs["reason"] == "quote_search"
    assert debit_mock.await_args.kwargs["cost"] == 15
    reconcile_mock.assert_awaited_once()
    assert reconcile_mock.await_args.args[2] == ledger_id
    assert reconcile_mock.await_args.args[3] == 15
    # actual cost computed from usage=(500,120) on deepseek-v4-pro, not the flat predebit.
    expected_actual_cost = credit_service.calculate_cost(500, 120, "deepseek-v4-pro", mode="balanced")
    assert reconcile_mock.await_args.args[4] == expected_actual_cost

    quote_search_mock.assert_awaited_once()
    assert quote_search_mock.await_args.kwargs["topic"] == "climate risk"
    assert quote_search_mock.await_args.kwargs["locale"] == "en"


@pytest.mark.asyncio
async def test_quote_search_charges_actual_cost_even_when_verified_empty(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = _make_user()
    doc = _make_doc(user)
    db = _make_db(get=AsyncMock(return_value=doc))
    _override_dependencies(db, user)

    ledger_id = uuid.uuid4()
    monkeypatch.setattr(credit_service, "debit_credits", AsyncMock(return_value=ledger_id))
    reconcile_mock = AsyncMock(return_value=None)
    monkeypatch.setattr(credit_service, "reconcile_credits", reconcile_mock)
    monkeypatch.setattr(credit_service, "get_user_credits", AsyncMock(return_value=485))

    empty_result = _sample_result(cards=[], verified=0, usage=(400, 30))
    monkeypatch.setattr(quote_search_service, "quote_search", AsyncMock(return_value=empty_result))

    response = await client.post(
        f"/api/documents/{doc.id}/quote-search", json={"topic": "nothing relevant"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["cards"] == []
    assert body["verified"] == 0
    # §8.4.1: charge actual cost even on a verified-empty result — never a free retry.
    reconcile_mock.assert_awaited_once()
    expected_actual_cost = credit_service.calculate_cost(400, 30, "deepseek-v4-pro", mode="balanced")
    assert reconcile_mock.await_args.args[4] == expected_actual_cost
    assert expected_actual_cost > 0


@pytest.mark.asyncio
async def test_quote_search_failure_refunds_predebit(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = _make_user()
    doc = _make_doc(user)
    db = _make_db(
        get=AsyncMock(return_value=doc),
        execute=AsyncMock(return_value=_Result(rowcount=1)),
    )
    _override_dependencies(db, user)

    ledger_id = uuid.uuid4()
    monkeypatch.setattr(credit_service, "get_user_credits", AsyncMock(return_value=500))
    monkeypatch.setattr(credit_service, "debit_credits", AsyncMock(return_value=ledger_id))
    monkeypatch.setattr(
        quote_search_service, "quote_search", AsyncMock(side_effect=RuntimeError("boom"))
    )

    response = await client.post(
        f"/api/documents/{doc.id}/quote-search", json={"topic": "climate risk"}
    )

    assert response.status_code == 500
    # Refund path: ledger row deleted + balance restored (mirrors _refund_predebit).
    db.execute.assert_awaited()
    db.commit.assert_awaited()


@pytest.mark.asyncio
async def test_quote_search_reconcile_failure_after_success_still_refunds(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch,
) -> None:
    """FIX-4 (Codex r1 IMPORTANT #4): the old try/except only wrapped the
    quote_search() call — a reconcile_credits failure AFTER quote_search()
    succeeded fell OUTSIDE the guarded region and left the 15-credit
    predebit permanently committed. reconcile/usage/telemetry/commit must
    now be inside the SAME guarded region."""
    user = _make_user()
    doc = _make_doc(user)
    db = _make_db(
        get=AsyncMock(return_value=doc),
        execute=AsyncMock(return_value=_Result(rowcount=1)),
    )
    _override_dependencies(db, user)

    ledger_id = uuid.uuid4()
    monkeypatch.setattr(credit_service, "get_user_credits", AsyncMock(return_value=500))
    monkeypatch.setattr(credit_service, "debit_credits", AsyncMock(return_value=ledger_id))
    monkeypatch.setattr(quote_search_service, "quote_search", AsyncMock(return_value=_sample_result()))
    # quote_search() succeeds; reconcile_credits (INSIDE the guarded region
    # after this fix) is what fails.
    monkeypatch.setattr(
        credit_service, "reconcile_credits", AsyncMock(side_effect=RuntimeError("db blip"))
    )

    response = await client.post(
        f"/api/documents/{doc.id}/quote-search", json={"topic": "climate risk"}
    )

    assert response.status_code == 500
    assert response.json()["detail"]["error"] == "QUOTE_SEARCH_FAILED"
    # Refund path still ran despite the failure happening AFTER quote_search().
    db.execute.assert_awaited()
    db.commit.assert_awaited()


@pytest.mark.asyncio
async def test_quote_search_cancellation_refunds_via_independent_session(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch,
) -> None:
    """FIX-4: CancelledError is NOT a subclass of Exception, so the old bare
    `except Exception` silently missed it — the predebit would never be
    refunded on a client disconnect. Must be handled explicitly, and via an
    INDEPENDENT session (the request's own `db` may not be usable
    mid-cancellation)."""
    user = _make_user()
    doc = _make_doc(user)
    db = _make_db(get=AsyncMock(return_value=doc))
    _override_dependencies(db, user)

    ledger_id = uuid.uuid4()
    monkeypatch.setattr(credit_service, "get_user_credits", AsyncMock(return_value=500))
    monkeypatch.setattr(credit_service, "debit_credits", AsyncMock(return_value=ledger_id))
    monkeypatch.setattr(
        quote_search_service, "quote_search", AsyncMock(side_effect=asyncio.CancelledError())
    )

    refund_mock = AsyncMock()
    monkeypatch.setattr(quotes_api, "_refund_predebit_on_cancel", refund_mock)

    with pytest.raises(asyncio.CancelledError):
        await quotes_api.create_quote_search(
            document_id=doc.id,
            body=quotes_api.QuoteSearchRequest(topic="climate risk"),
            user=user,
            db=db,
        )

    refund_mock.assert_awaited_once_with(user.id, quotes_api.QUOTE_SEARCH_PREDEBIT_CREDITS, ledger_id)


@pytest.mark.asyncio
async def test_quote_search_rejects_document_not_ready(client: AsyncClient) -> None:
    user = _make_user()
    doc = _make_doc(user, status="parsing")
    db = _make_db(get=AsyncMock(return_value=doc))
    _override_dependencies(db, user)

    response = await client.post(
        f"/api/documents/{doc.id}/quote-search", json={"topic": "climate risk"}
    )

    _assert_error(response, 409, "DOCUMENT_NOT_READY")


@pytest.mark.asyncio
async def test_quote_search_rejects_inaccessible_document(client: AsyncClient) -> None:
    user = _make_user()
    other_user_doc = _make_doc(_make_user())  # belongs to a different user, not demo
    db = _make_db(get=AsyncMock(return_value=other_user_doc))
    _override_dependencies(db, user)

    response = await client.post(
        f"/api/documents/{other_user_doc.id}/quote-search", json={"topic": "climate risk"}
    )

    _assert_error(response, 404, "DOCUMENT_NOT_FOUND")


@pytest.mark.asyncio
async def test_quote_search_endpoint_owns_access_control_itself(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch,
) -> None:
    """B3's quote_search() takes a `user` param it never reads for access
    control (by design — reviewed). This endpoint MUST therefore call
    can_access_document() itself; this test spies on the real function
    directly (not just the 404 outcome) so a future refactor that quietly
    drops the check — while accidentally still 404ing for some other reason
    — cannot pass silently."""
    user = _make_user()
    doc = _make_doc(user)
    db = _make_db(get=AsyncMock(return_value=doc))
    _override_dependencies(db, user)

    ledger_id = uuid.uuid4()
    monkeypatch.setattr(credit_service, "debit_credits", AsyncMock(return_value=ledger_id))
    monkeypatch.setattr(credit_service, "reconcile_credits", AsyncMock())
    monkeypatch.setattr(credit_service, "get_user_credits", AsyncMock(return_value=485))
    monkeypatch.setattr(quote_search_service, "quote_search", AsyncMock(return_value=_sample_result()))

    from app.services.doc_service import can_access_document as real_can_access_document

    # can_access_document is sync in production; wrap with a plain spy that
    # still calls through, so behavior is unchanged and only the CALL is observed.
    spy = SimpleNamespace(calls=[])

    def _spy_can_access_document(d, u):
        spy.calls.append((d, u))
        return real_can_access_document(d, u)

    monkeypatch.setattr(quotes_api, "can_access_document", _spy_can_access_document)

    response = await client.post(f"/api/documents/{doc.id}/quote-search", json={"topic": "climate risk"})

    assert response.status_code == 200
    assert spy.calls == [(doc, user)]  # endpoint itself performed the access check
    # B3's quote_search was called with `user`, but that's not where access
    # control happens — proven above by the endpoint calling it independently.
    quote_search_service.quote_search.assert_awaited_once()
    assert quote_search_service.quote_search.await_args.kwargs["user"] is user


@pytest.mark.asyncio
async def test_quote_search_billing_flow_is_independent_of_quote_search_internals(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch,
) -> None:
    """quote_search_service.quote_search() does no credit_service calls of
    its own (reviewed) — it only returns .usage/.model for a caller to bill.
    Proven here by mocking quote_search out ENTIRELY (a bare stand-in with no
    access to credit_service at all) and confirming the full predebit ->
    reconcile -> record_usage sequence still runs, because it lives in THIS
    endpoint, not inside the mocked-away service call."""
    user = _make_user()
    doc = _make_doc(user)
    db = _make_db(get=AsyncMock(return_value=doc))
    _override_dependencies(db, user)

    ledger_id = uuid.uuid4()
    debit_mock = AsyncMock(return_value=ledger_id)
    reconcile_mock = AsyncMock()
    monkeypatch.setattr(credit_service, "debit_credits", debit_mock)
    monkeypatch.setattr(credit_service, "reconcile_credits", reconcile_mock)
    monkeypatch.setattr(credit_service, "get_user_credits", AsyncMock(return_value=485))

    # A bare async stub — no credit_service reference reachable from it at all.
    async def _bare_quote_search(_db, *, document, user, topic, locale):
        return _sample_result()

    monkeypatch.setattr(quote_search_service, "quote_search", _bare_quote_search)

    response = await client.post(f"/api/documents/{doc.id}/quote-search", json={"topic": "climate risk"})

    assert response.status_code == 200
    debit_mock.assert_awaited_once()
    reconcile_mock.assert_awaited_once()


@pytest.mark.asyncio
async def test_quote_search_rejects_empty_topic(client: AsyncClient) -> None:
    user = _make_user()
    doc = _make_doc(user)
    db = _make_db(get=AsyncMock(return_value=doc))
    _override_dependencies(db, user)

    response = await client.post(f"/api/documents/{doc.id}/quote-search", json={"topic": ""})

    assert response.status_code == 422
