from __future__ import annotations

import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from app.core.config import settings
from app.models.tables import FeatureTrialUsage
from app.services.domain_mode_access import enforce_domain_mode_access


class _Rows:
    def __init__(self, rows: list[tuple[int]]) -> None:
        self._rows = rows

    def all(self) -> list[tuple[int]]:
        return self._rows


def test_owner_foreign_keys_are_set_null_not_cascade() -> None:
    ondelete_by_target = {
        foreign_key.target_fullname: foreign_key.ondelete
        for foreign_key in FeatureTrialUsage.__table__.foreign_keys
    }

    assert ondelete_by_target["sessions.id"] == "SET NULL"
    assert ondelete_by_target["document_jobs.id"] == "SET NULL"
    assert ondelete_by_target["users.id"] == "CASCADE"


def _db(*, scalar_side_effect: list[object], occupied: list[int] | None = None):
    added: list[object] = []
    return SimpleNamespace(
        scalar=AsyncMock(side_effect=scalar_side_effect),
        execute=AsyncMock(return_value=_Rows([(slot,) for slot in (occupied or [])])),
        add=added.append,
        flush=AsyncMock(),
        commit=AsyncMock(),
        added=added,
    )


@pytest.mark.asyncio
async def test_free_claim_uses_first_open_slot_and_commits(monkeypatch: pytest.MonkeyPatch) -> None:
    user = SimpleNamespace(id=uuid.uuid4(), plan="free")
    session_id = uuid.uuid4()
    db = _db(scalar_side_effect=[user.id, None], occupied=[0])
    monkeypatch.setattr(settings, "FREE_DOMAIN_MODE_TRIALS", 2)

    await enforce_domain_mode_access(
        db,
        user,
        "legal",
        owning_session_id=session_id,
        commit_claim=True,
    )

    assert len(db.added) == 1
    assert db.added[0].slot_index == 1
    assert db.added[0].owning_session_id == session_id
    db.flush.assert_awaited_once()
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_existing_session_owner_remains_allowed_without_new_slot() -> None:
    user = SimpleNamespace(id=uuid.uuid4(), plan="free")
    db = _db(scalar_side_effect=[user.id, uuid.uuid4()])

    await enforce_domain_mode_access(
        db,
        user,
        "academic",
        owning_session_id=uuid.uuid4(),
        commit_claim=True,
    )

    assert db.added == []
    db.execute.assert_not_awaited()
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_free_claim_is_denied_when_every_configured_slot_is_occupied(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = SimpleNamespace(id=uuid.uuid4(), plan="free")
    db = _db(scalar_side_effect=[user.id, None], occupied=[0, 1])
    monkeypatch.setattr(settings, "FREE_DOMAIN_MODE_TRIALS", 2)

    with pytest.raises(HTTPException) as exc_info:
        await enforce_domain_mode_access(
            db,
            user,
            "legal",
            owning_job_id=uuid.uuid4(),
        )

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail["error"] == "DOMAIN_MODE_REQUIRES_PLUS"
    assert db.added == []


@pytest.mark.asyncio
async def test_paid_and_omitted_mode_paths_do_not_touch_trial_storage() -> None:
    db = _db(scalar_side_effect=[])

    await enforce_domain_mode_access(db, SimpleNamespace(id=uuid.uuid4(), plan="plus"), "legal")
    await enforce_domain_mode_access(db, SimpleNamespace(id=uuid.uuid4(), plan="free"), None)

    db.scalar.assert_not_awaited()
    db.execute.assert_not_awaited()
    assert db.added == []


def test_orphaned_trial_release_is_correlated_to_ledger_transaction_time() -> None:
    from sqlalchemy.dialects import postgresql

    from app.services.domain_mode_access import release_orphaned_extraction_trial_sync

    db = MagicMock()
    db.scalar.return_value = uuid.uuid4()
    db.execute.return_value.scalar_one_or_none.return_value = uuid.uuid4()
    ledger_created_at = datetime.now(timezone.utc)

    assert release_orphaned_extraction_trial_sync(
        db,
        user_id=uuid.uuid4(),
        ledger_created_at=ledger_created_at,
    ) is True

    statement = db.execute.call_args.args[0]
    sql = str(
        statement.compile(
            dialect=postgresql.dialect(),
            compile_kwargs={"literal_binds": True},
        )
    )
    assert "owning_session_id IS NULL" in sql
    assert "owning_job_id IS NULL" in sql
    assert "created_at =" in sql
