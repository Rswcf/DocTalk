from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.api import users as users_api
from app.services.doc_service import can_access_document


def test_can_access_document_denies_ownerless_non_demo() -> None:
    doc = SimpleNamespace(demo_slug=None, user_id=None)

    assert can_access_document(doc, None) is False
    assert can_access_document(doc, SimpleNamespace(id=uuid.uuid4())) is False


def test_can_access_document_allows_demo_documents() -> None:
    doc = SimpleNamespace(demo_slug="alphabet-earnings", user_id=None)

    assert can_access_document(doc, None) is True


def test_can_access_document_requires_matching_owner() -> None:
    owner_id = uuid.uuid4()
    doc = SimpleNamespace(demo_slug=None, user_id=owner_id)

    assert can_access_document(doc, SimpleNamespace(id=owner_id)) is True
    assert can_access_document(doc, SimpleNamespace(id=uuid.uuid4())) is False


@pytest.mark.asyncio
async def test_delete_me_aborts_when_any_document_delete_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    user = SimpleNamespace(
        id=uuid.uuid4(),
        email="user@example.com",
        stripe_subscription_id=None,
    )
    db = SimpleNamespace(
        execute=AsyncMock(
            return_value=SimpleNamespace(
                all=lambda: [
                    SimpleNamespace(id=uuid.uuid4()),
                    SimpleNamespace(id=uuid.uuid4()),
                ]
            )
        ),
        rollback=AsyncMock(),
        delete=AsyncMock(),
        commit=AsyncMock(),
    )

    calls: list[uuid.UUID] = []

    async def fake_delete_document(document_id: uuid.UUID, _db) -> bool:
        calls.append(document_id)
        if len(calls) == 1:
            raise RuntimeError("storage unavailable")
        return True

    monkeypatch.setattr(users_api.doc_service, "delete_document", fake_delete_document)

    with pytest.raises(HTTPException) as exc:
        await users_api.delete_me(user=user, db=db)

    assert exc.value.status_code == 500
    assert calls
    db.rollback.assert_awaited_once()
    db.delete.assert_not_awaited()
    db.commit.assert_not_awaited()
