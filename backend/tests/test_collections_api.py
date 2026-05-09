from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.api.collections import create_collection_session
from app.models.tables import ChatSession


@pytest.mark.asyncio
async def test_create_collection_session_preserves_owner_id() -> None:
    user_id = uuid.uuid4()
    collection_id = uuid.uuid4()
    collection = SimpleNamespace(id=collection_id, user_id=user_id)
    added: list[object] = []

    async def refresh(obj: object) -> None:
        obj.id = uuid.uuid4()
        obj.title = None
        obj.created_at = SimpleNamespace(isoformat=lambda: "2026-05-09T00:00:00+00:00")

    db = SimpleNamespace(
        get=AsyncMock(return_value=collection),
        add=lambda obj: added.append(obj),
        commit=AsyncMock(),
        refresh=AsyncMock(side_effect=refresh),
    )

    response = await create_collection_session(
        collection_id=collection_id,
        user=SimpleNamespace(id=user_id),
        db=db,
    )

    assert response["collection_id"] == str(collection_id)
    assert len(added) == 1
    assert isinstance(added[0], ChatSession)
    assert added[0].collection_id == collection_id
    assert added[0].user_id == user_id
    db.commit.assert_awaited_once()
