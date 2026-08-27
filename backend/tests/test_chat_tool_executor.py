from __future__ import annotations

import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.services.action_planner import ActionPlan, ChatAction
from app.services.chat_tool_executor import chat_tool_executor


class _Result:
    def __init__(self, scalars_all: list[object] | None = None) -> None:
        self._scalars_all = scalars_all or []

    def scalars(self):
        return iter(self._scalars_all)


def _make_user(plan: str = "plus") -> SimpleNamespace:
    return SimpleNamespace(id=uuid.uuid4(), plan=plan, email="user@example.com")


def _make_doc(user: SimpleNamespace) -> SimpleNamespace:
    return SimpleNamespace(
        id=uuid.uuid4(),
        user_id=user.id,
        status="ready",
        demo_slug=None,
        filename="report.pdf",
    )


@pytest.mark.asyncio
async def test_executor_returns_existing_table_export_artifact() -> None:
    user = _make_user("plus")
    doc = _make_doc(user)
    table = SimpleNamespace(
        id=uuid.uuid4(),
        document_id=doc.id,
        page=2,
        table_index=0,
        cells={"rows": [["Company", "Rating"], ["MetaX", "Equal-weight"]]},
        confidence=0.91,
        method="pymupdf",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db = SimpleNamespace(
        get=AsyncMock(return_value=doc),
        execute=AsyncMock(return_value=_Result([table])),
    )
    plan = ActionPlan(
        action=ChatAction.EXPORT_TABLES,
        confidence=0.9,
        requires_confirmation=False,
        artifact_format="csv",
        user_visible_status="I am preparing CSV export.",
    )

    result = await chat_tool_executor.execute(
        plan,
        user=user,
        db=db,
        document_id=doc.id,
        collection_doc_ids=[],
        locale="en",
        domain_mode=None,
    )

    assert result.artifact is not None
    payload = result.artifact.to_payload()
    assert payload["artifact_type"] == "table_export"
    assert payload["status"] == "succeeded"
    assert payload["download_urls"][0]["url"].endswith("/tables/export")


@pytest.mark.asyncio
async def test_executor_gates_existing_table_csv_export_for_free_user() -> None:
    user = _make_user("free")
    doc = _make_doc(user)
    table = SimpleNamespace(
        id=uuid.uuid4(),
        document_id=doc.id,
        page=2,
        table_index=0,
        cells={"rows": [["Company", "Rating"], ["MetaX", "Equal-weight"]]},
        confidence=0.91,
        method="pymupdf",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db = SimpleNamespace(
        get=AsyncMock(return_value=doc),
        execute=AsyncMock(return_value=_Result([table])),
    )
    plan = ActionPlan(
        action=ChatAction.EXPORT_TABLES,
        confidence=0.9,
        requires_confirmation=False,
        artifact_format="csv",
        user_visible_status="I am preparing CSV export.",
    )

    result = await chat_tool_executor.execute(
        plan,
        user=user,
        db=db,
        document_id=doc.id,
        collection_doc_ids=[],
        locale="en",
        domain_mode=None,
    )

    assert result.artifact is not None
    payload = result.artifact.to_payload()
    assert payload["download_urls"] == []
    assert payload["required_plan"] == "plus"


@pytest.mark.asyncio
async def test_executor_asks_for_compare_document_selection() -> None:
    user = _make_user("pro")
    plan = ActionPlan(
        action=ChatAction.COMPARE_DOCUMENTS,
        confidence=0.86,
        requires_confirmation=True,
        missing_slots=("old_document_id", "new_document_id"),
    )

    result = await chat_tool_executor.execute(
        plan,
        user=user,
        db=SimpleNamespace(),
        document_id=None,
        collection_doc_ids=[uuid.uuid4(), uuid.uuid4()],
        locale="en",
        domain_mode=None,
    )

    assert "which two versions" in result.message
    assert result.artifact is None


@pytest.mark.asyncio
async def test_chat_native_extraction_predebit_is_created_with_lease(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.services import credit_service
    from app.workers.extraction_worker import run_extraction_job

    user = _make_user("plus")
    doc = _make_doc(user)
    added: list[object] = []
    db = SimpleNamespace(
        get=AsyncMock(return_value=doc),
        add=added.append,
        flush=AsyncMock(),
        commit=AsyncMock(),
        refresh=AsyncMock(),
    )
    monkeypatch.setattr(
        credit_service,
        "debit_credits",
        AsyncMock(return_value=uuid.uuid4()),
    )
    monkeypatch.setattr(run_extraction_job, "delay", lambda *_args: None)

    result = await chat_tool_executor.execute(
        ActionPlan(
            action=ChatAction.EXTRACT_DELIVERABLE,
            confidence=1.0,
            requires_confirmation=False,
            template_key="executive_summary",
        ),
        user=user,
        db=db,
        document_id=doc.id,
        collection_doc_ids=[],
        locale="en",
        domain_mode=None,
    )

    assert result.artifact is not None
    assert result.artifact.status == "queued"
    created_job = next(
        row for row in added if getattr(row, "job_type", None) == "extraction"
    )
    assert created_job.worker_lease_expires_at > datetime.now(timezone.utc)
