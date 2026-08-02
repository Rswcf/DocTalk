"""Tests for minimal per-user biblio + APA in-text formatter (B6, plan §8.4
point 4 / D6).

document_biblio is keyed by (document_id, user_id) in spirit: one SYSTEM row
per document (user_id IS NULL, auto-detected default) and a separate row per
user who edits it (user_id = that user). A user's PUT must NEVER mutate the
system row or another user's row — required because Document.user_id is
nullable and demo docs are shared across users.
"""
from __future__ import annotations

import sys
import uuid
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from sqlalchemy.exc import IntegrityError

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services import biblio_service  # noqa: E402
from app.services.biblio_service import (  # noqa: E402
    SYSTEM_SOURCE,
    USER_SOURCE,
    format_apa_intext,
    get_biblio_for_user,
    get_or_seed_system_biblio,
    upsert_user_biblio,
)


def _dup_key_error() -> IntegrityError:
    return IntegrityError(statement=None, params=None, orig=Exception("duplicate key value"))

# ---------------------------------------------------------------------------
# format_apa_intext — pure function
# ---------------------------------------------------------------------------

class TestFormatApaIntext:
    def test_single_author_year_page(self):
        biblio = {"author": [{"family": "Smith", "given": "J."}], "issued": {"year": 2021}}
        assert format_apa_intext(biblio, 12) == "(Smith, 2021, p. 12)"

    def test_two_authors(self):
        biblio = {
            "author": [{"family": "Smith"}, {"family": "Jones"}],
            "issued": {"year": 2019},
        }
        assert format_apa_intext(biblio, 5) == "(Smith & Jones, 2019, p. 5)"

    def test_three_or_more_authors_uses_et_al(self):
        biblio = {
            "author": [{"family": "Smith"}, {"family": "Jones"}, {"family": "Lee"}],
            "issued": {"year": 2020},
        }
        assert format_apa_intext(biblio, 3) == "(Smith et al., 2020, p. 3)"

    def test_missing_year_uses_nd(self):
        biblio = {"author": [{"family": "Smith"}]}
        assert format_apa_intext(biblio, 7) == "(Smith, n.d., p. 7)"

    def test_missing_author_falls_back_to_title(self):
        biblio = {"title": "Annual Report", "issued": {"year": 2022}}
        assert format_apa_intext(biblio, 1) == "(Annual Report, 2022, p. 1)"

    def test_missing_author_and_year_degrades_gracefully(self):
        biblio = {"title": "Annual Report"}
        assert format_apa_intext(biblio, 1) == "(Annual Report, n.d., p. 1)"

    def test_no_page_omits_page_fragment(self):
        biblio = {"author": [{"family": "Smith"}], "issued": {"year": 2021}}
        assert format_apa_intext(biblio, None) == "(Smith, 2021)"

    def test_completely_empty_biblio_still_returns_a_string(self):
        assert format_apa_intext({}, None) == "(n.a., n.d.)"


# ---------------------------------------------------------------------------
# get_or_seed_system_biblio / get_biblio_for_user / upsert_user_biblio
# ---------------------------------------------------------------------------

def _document(**overrides):
    base = dict(
        id=uuid.uuid4(), filename="Smith - Annual Report (2021).pdf",
        file_type="pdf", storage_key="documents/x/file.pdf", converted_storage_key=None,
    )
    base.update(overrides)
    return SimpleNamespace(**base)


def _user(**overrides):
    base = dict(id=uuid.uuid4())
    base.update(overrides)
    return SimpleNamespace(**base)


def _fake_db(execute_results, **overrides):
    """execute_results: list of scalar_one_or_none() return values, consumed
    in call order. `overrides` lets race tests replace commit/rollback with
    AsyncMocks that raise (FIX-9)."""
    results = list(execute_results)

    async def execute(_stmt):
        value = results.pop(0)
        return SimpleNamespace(scalar_one_or_none=lambda: value)

    added = []

    def add(obj):
        added.append(obj)

    payload: dict[str, object] = dict(
        execute=AsyncMock(side_effect=execute), add=add, added=added,
        commit=AsyncMock(), rollback=AsyncMock(),
    )
    payload.update(overrides)
    return SimpleNamespace(**payload)


class TestGetOrSeedSystemBiblio:
    @pytest.mark.asyncio
    async def test_seeds_a_new_system_row_when_none_exists(self, monkeypatch):
        monkeypatch.setattr(biblio_service, "_enrich_from_pdf_metadata", AsyncMock(side_effect=lambda _doc, csl: csl))
        document = _document()
        db = _fake_db([None])  # no existing system row

        row = await get_or_seed_system_biblio(db, document)

        assert row.document_id == document.id
        assert row.user_id is None
        assert row.source == SYSTEM_SOURCE
        assert row in db.added
        db.commit.assert_awaited_once()
        # Filename heuristic seeded something sensible.
        assert row.csl_json.get("title")

    @pytest.mark.asyncio
    async def test_returns_existing_system_row_without_reseeding(self, monkeypatch):
        enrich_mock = AsyncMock(side_effect=lambda _doc, csl: csl)
        monkeypatch.setattr(biblio_service, "_enrich_from_pdf_metadata", enrich_mock)
        document = _document()
        existing = SimpleNamespace(document_id=document.id, user_id=None, csl_json={"title": "Existing"}, source=SYSTEM_SOURCE)
        db = _fake_db([existing])

        row = await get_or_seed_system_biblio(db, document)

        assert row is existing
        db.commit.assert_not_awaited()
        enrich_mock.assert_not_awaited()


class TestGetOrSeedSystemBiblioConcurrentFirstAccess:
    """FIX-9 (Codex r1 MINOR #9): two concurrent first-accesses to a
    never-seeded document both SELECT None, then both attempt to INSERT —
    the partial unique index stops the loser's commit. Must recover, not
    surface a raw 500."""

    @pytest.mark.asyncio
    async def test_integrity_error_on_commit_returns_the_winners_row(self, monkeypatch):
        monkeypatch.setattr(biblio_service, "_enrich_from_pdf_metadata", AsyncMock(side_effect=lambda _doc, csl: csl))
        document = _document()
        winner_row = SimpleNamespace(
            document_id=document.id, user_id=None, csl_json={"title": "Winner seeded first"}, source=SYSTEM_SOURCE,
        )
        db = _fake_db(
            [None, winner_row],  # 1st SELECT: no row yet. 2nd SELECT (post-rollback): winner's row.
            commit=AsyncMock(side_effect=_dup_key_error()),
        )

        row = await get_or_seed_system_biblio(db, document)

        assert row is winner_row
        db.rollback.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_integrity_error_with_no_winner_row_reraises(self, monkeypatch):
        """Not the anticipated race (e.g. a genuine constraint/DB failure) —
        must propagate, never swallow silently."""
        monkeypatch.setattr(biblio_service, "_enrich_from_pdf_metadata", AsyncMock(side_effect=lambda _doc, csl: csl))
        document = _document()
        db = _fake_db(
            [None, None],  # 1st SELECT: no row. 2nd SELECT (post-rollback): still none — unexplained.
            commit=AsyncMock(side_effect=_dup_key_error()),
        )

        with pytest.raises(IntegrityError):
            await get_or_seed_system_biblio(db, document)

        db.rollback.assert_awaited_once()


class TestGetBiblioForUser:
    @pytest.mark.asyncio
    async def test_returns_users_own_row_when_present(self, monkeypatch):
        document = _document()
        user = _user()
        user_row = SimpleNamespace(document_id=document.id, user_id=user.id, csl_json={"title": "My edit"}, source=USER_SOURCE)
        db = _fake_db([user_row])  # first execute() finds the user row -> short-circuits

        row = await get_biblio_for_user(db, document, user)

        assert row is user_row

    @pytest.mark.asyncio
    async def test_falls_back_to_seeded_system_row_when_user_has_none(self, monkeypatch):
        monkeypatch.setattr(biblio_service, "_enrich_from_pdf_metadata", AsyncMock(side_effect=lambda _doc, csl: csl))
        document = _document()
        user = _user()
        # 1st execute: no user row. 2nd execute (inside get_or_seed_system_biblio): no system row either.
        db = _fake_db([None, None])

        row = await get_biblio_for_user(db, document, user)

        assert row.user_id is None
        assert row.source == SYSTEM_SOURCE


class TestUpsertUserBiblio:
    @pytest.mark.asyncio
    async def test_creates_a_new_user_row_never_touching_system_row(self):
        document = _document()
        user = _user()
        system_row = SimpleNamespace(
            document_id=document.id, user_id=None, csl_json={"title": "System default"}, source=SYSTEM_SOURCE,
        )
        db = _fake_db([None])  # no existing user row

        new_csl = {"title": "My custom title", "author": [{"family": "Doe"}]}
        row = await upsert_user_biblio(db, document, user, new_csl)

        assert row.document_id == document.id
        assert row.user_id == user.id
        assert row.source == USER_SOURCE
        assert row.csl_json == new_csl
        assert row in db.added
        # System row object was never touched by this call.
        assert system_row.csl_json == {"title": "System default"}

    @pytest.mark.asyncio
    async def test_second_call_updates_the_same_user_row_not_a_duplicate(self):
        document = _document()
        user = _user()
        existing = SimpleNamespace(document_id=document.id, user_id=user.id, csl_json={"title": "Old"}, source=USER_SOURCE)
        db = _fake_db([existing])

        updated_csl = {"title": "New title"}
        row = await upsert_user_biblio(db, document, user, updated_csl)

        assert row is existing
        assert row.csl_json == updated_csl
        assert row.source == USER_SOURCE
        assert db.added == []  # no new row created
        db.commit.assert_awaited_once()


class TestUpsertUserBiblioConcurrentFirstWrite:
    """FIX-9 (Codex r1 MINOR #9): two concurrent first PUTs from the SAME
    user for the SAME document (double-click, two tabs) both SELECT None,
    then both attempt to INSERT — the partial unique index stops the
    loser's commit. Must retry as an UPDATE against the winner's row, so
    the caller's intended edit still lands rather than silently vanishing."""

    @pytest.mark.asyncio
    async def test_integrity_error_on_insert_retries_as_update_on_winners_row(self, monkeypatch):
        document = _document()
        user = _user()
        winner_row = SimpleNamespace(
            document_id=document.id, user_id=user.id, csl_json={"title": "Winner's first write"}, source=USER_SOURCE,
        )
        commit_calls = {"n": 0}

        async def commit():
            commit_calls["n"] += 1
            if commit_calls["n"] == 1:
                raise _dup_key_error()

        db = _fake_db(
            [None, winner_row],  # 1st SELECT: no user row yet. 2nd SELECT (post-rollback): winner's row.
            commit=AsyncMock(side_effect=commit),
        )

        my_csl = {"title": "My intended edit"}
        row = await upsert_user_biblio(db, document, user, my_csl)

        assert row is winner_row
        # The retry updates the winner's row to MY caller's intended content
        # — never silently keeps the winner's write instead.
        assert row.csl_json == my_csl
        assert row.source == USER_SOURCE
        db.rollback.assert_awaited_once()
        assert commit_calls["n"] == 2  # failed insert attempt + successful update retry

    @pytest.mark.asyncio
    async def test_integrity_error_with_no_winner_row_reraises(self):
        document = _document()
        user = _user()
        db = _fake_db(
            [None, None],  # 1st SELECT: no row. 2nd SELECT (post-rollback): still none — unexplained.
            commit=AsyncMock(side_effect=_dup_key_error()),
        )

        with pytest.raises(IntegrityError):
            await upsert_user_biblio(db, document, user, {"title": "x"})

        db.rollback.assert_awaited_once()


# ---------------------------------------------------------------------------
# API layer: GET/PUT /api/documents/{id}/biblio
# ---------------------------------------------------------------------------

import pytest_asyncio  # noqa: E402
from fastapi import FastAPI  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402

from app.api import quotes as quotes_api  # noqa: E402
from app.core import deps as deps_module  # noqa: E402

api_app = FastAPI()
api_app.include_router(quotes_api.router)


def _make_user(**overrides):
    base = dict(id=uuid.uuid4())
    base.update(overrides)
    return SimpleNamespace(**base)


def _make_doc(user, **overrides):
    base = dict(id=uuid.uuid4(), user_id=user.id, demo_slug=None)
    base.update(overrides)
    return SimpleNamespace(**base)


def _make_api_db(**overrides):
    payload = {"get": AsyncMock(return_value=None)}
    payload.update(overrides)
    return SimpleNamespace(**payload)


def _override_dependencies(db, user) -> None:
    async def _get_db():
        yield db

    async def _require_auth():
        return user

    api_app.dependency_overrides[deps_module.get_db_session] = _get_db
    api_app.dependency_overrides[deps_module.require_auth] = _require_auth


@pytest.fixture(autouse=True)
def _clear_biblio_dependency_overrides():
    api_app.dependency_overrides.clear()
    yield
    api_app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def api_client():
    async with AsyncClient(transport=ASGITransport(app=api_app), base_url="http://test") as ac:
        yield ac


class TestBiblioEndpoints:
    @pytest.mark.asyncio
    async def test_get_requires_auth(self, api_client: AsyncClient) -> None:
        response = await api_client.get(f"/api/documents/{uuid.uuid4()}/biblio")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_get_rejects_inaccessible_document(self, api_client: AsyncClient, monkeypatch) -> None:
        user = _make_user()
        other_doc = _make_doc(_make_user())
        db = _make_api_db(get=AsyncMock(return_value=other_doc))
        _override_dependencies(db, user)

        response = await api_client.get(f"/api/documents/{other_doc.id}/biblio")

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_get_returns_seeded_system_default(self, api_client: AsyncClient, monkeypatch) -> None:
        user = _make_user()
        doc = _make_doc(user)
        db = _make_api_db(get=AsyncMock(return_value=doc))
        _override_dependencies(db, user)

        seeded_row = SimpleNamespace(csl_json={"title": "Auto-detected"}, source=SYSTEM_SOURCE)
        get_mock = AsyncMock(return_value=seeded_row)
        monkeypatch.setattr(quotes_api.biblio_service, "get_biblio_for_user", get_mock)

        response = await api_client.get(f"/api/documents/{doc.id}/biblio")

        assert response.status_code == 200
        body = response.json()
        assert body["csl_json"] == {"title": "Auto-detected"}
        assert body["source"] == "system"
        get_mock.assert_awaited_once()
        assert get_mock.await_args.args[2] is user

    @pytest.mark.asyncio
    async def test_put_writes_user_row(self, api_client: AsyncClient, monkeypatch) -> None:
        user = _make_user()
        doc = _make_doc(user)
        db = _make_api_db(get=AsyncMock(return_value=doc))
        _override_dependencies(db, user)

        updated_row = SimpleNamespace(
            csl_json={"title": "My custom title", "author": [{"family": "Doe"}]}, source=USER_SOURCE,
        )
        upsert_mock = AsyncMock(return_value=updated_row)
        monkeypatch.setattr(quotes_api.biblio_service, "upsert_user_biblio", upsert_mock)

        response = await api_client.put(
            f"/api/documents/{doc.id}/biblio",
            json={"csl_json": {"title": "My custom title", "author": [{"family": "Doe"}]}},
        )

        assert response.status_code == 200
        body = response.json()
        assert body["source"] == "user"
        assert body["csl_json"]["title"] == "My custom title"
        upsert_mock.assert_awaited_once()
        assert upsert_mock.await_args.args[2] is user
        assert upsert_mock.await_args.args[3] == {"title": "My custom title", "author": [{"family": "Doe"}]}

    @pytest.mark.asyncio
    async def test_put_rejects_missing_csl_json(self, api_client: AsyncClient, monkeypatch) -> None:
        """FIX-9 (Codex r1 MINOR #9): csl_json is now a REQUIRED field — a
        missing/omitted body must 422, never silently upsert {} and wipe the
        caller's saved biblio."""
        user = _make_user()
        doc = _make_doc(user)
        db = _make_api_db(get=AsyncMock(return_value=doc))
        _override_dependencies(db, user)
        upsert_mock = AsyncMock()
        monkeypatch.setattr(quotes_api.biblio_service, "upsert_user_biblio", upsert_mock)

        response = await api_client.put(f"/api/documents/{doc.id}/biblio", json={})

        assert response.status_code == 422
        upsert_mock.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_put_rejects_oversized_payload(self, api_client: AsyncClient) -> None:
        user = _make_user()
        doc = _make_doc(user)
        db = _make_api_db(get=AsyncMock(return_value=doc))
        _override_dependencies(db, user)

        huge = {"title": "x" * 30_000}
        response = await api_client.put(f"/api/documents/{doc.id}/biblio", json={"csl_json": huge})

        assert response.status_code == 400
        assert response.json()["detail"]["error"] == "BIBLIO_TOO_LARGE"
