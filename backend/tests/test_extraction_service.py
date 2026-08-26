from __future__ import annotations

import csv
import io
import uuid
from contextlib import contextmanager
from unittest.mock import MagicMock

import pytest
from sqlalchemy.dialects import postgresql

from app.models.tables import Chunk
from app.services.extraction_service import (
    EXTRACTION_LEASE_SECONDS,
    TEMPLATES,
    _citation_from_chunk,
    _json_from_text,
    _reconcile_sync,
    _refund_predebit_sync,
    normalize_result,
    render_csv,
    render_markdown,
)


def test_extraction_lease_and_watchdog_cadence_exceed_broker_visibility() -> None:
    from app.workers.celery_app import celery_app

    visibility_timeout = celery_app.conf.broker_transport_options["visibility_timeout"]
    watchdog_schedule = celery_app.conf.beat_schedule[
        "requeue-stale-running-extractions"
    ]["schedule"]

    assert EXTRACTION_LEASE_SECONDS > visibility_timeout
    assert watchdog_schedule > visibility_timeout


def test_lock_busy_tokenized_recovery_raises_for_celery_retry(monkeypatch) -> None:
    from app.services import extraction_service

    @contextmanager
    def busy_lock(_job_id: str):
        yield False

    monkeypatch.setattr(extraction_service, "extraction_job_advisory_lock", busy_lock)

    with pytest.raises(RuntimeError, match="EXTRACTION_JOB_LOCK_BUSY"):
        extraction_service.run_extraction_job_sync(
            str(uuid.uuid4()),
            expected_claim_token=str(uuid.uuid4()),
        )


def test_lock_busy_untokenized_duplicate_is_a_noop(monkeypatch) -> None:
    from app.services import extraction_service

    @contextmanager
    def busy_lock(_job_id: str):
        yield False

    monkeypatch.setattr(extraction_service, "extraction_job_advisory_lock", busy_lock)

    extraction_service.run_extraction_job_sync(str(uuid.uuid4()))


def test_reconcile_sync_equal_cost_still_locks_and_stamps_marker() -> None:
    db = MagicMock()
    db.scalar.return_value = object()

    _reconcile_sync(
        db,
        user_id=uuid.uuid4(),
        ledger_id=uuid.uuid4(),
        pre_debited=25,
        actual_cost=25,
    )

    lock_statement = db.scalar.call_args.args[0]
    assert lock_statement._for_update_arg is not None
    assert db.execute.call_count == 1
    update_sql = str(
        db.execute.call_args.args[0].compile(dialect=postgresql.dialect())
    )
    assert "reconciled_at" in update_sql


def test_refund_predebit_sync_is_one_conditional_delete_when_already_settled() -> None:
    db = MagicMock()
    db.execute.return_value.scalar_one_or_none.return_value = None

    refunded = _refund_predebit_sync(
        db,
        user_id=uuid.uuid4(),
        pre_debited=25,
        ledger_id=uuid.uuid4(),
    )

    assert refunded is False
    assert db.execute.call_count == 1
    delete_sql = str(
        db.execute.call_args.args[0].compile(dialect=postgresql.dialect())
    )
    assert "reconciled_at IS NULL" in delete_sql
    assert "RETURNING credit_ledger.id" in delete_sql


def test_json_from_text_accepts_fenced_json() -> None:
    assert _json_from_text('```json\n{"summary": "ok"}\n```') == {"summary": "ok"}


def test_normalize_result_clamps_and_repairs_refs() -> None:
    raw = {
        "title": "Deal memo",
        "summary": "Short summary",
        "key_points": [
            {"text": "Supported by two fragments", "source_refs": [2, "2", 99, "bad", 3]},
            {"text": "Missing refs uses a safe fallback", "source_refs": []},
        ],
        "risks_or_open_questions": [{"text": "Needs diligence", "source_refs": [0, 1]}],
    }

    result = normalize_result("executive_summary", raw, max_ref=3)

    assert result["key_points"][0]["source_refs"] == [2, 3]
    assert result["key_points"][1]["source_refs"] == [1]
    assert result["risks_or_open_questions"][0]["source_refs"] == [1]


def test_render_markdown_escapes_table_pipes() -> None:
    markdown = render_markdown(
        TEMPLATES["key_facts"],
        {
            "facts": [
                {
                    "label": "Revenue | ARR",
                    "value": "$1,000",
                    "context": "Reported in table",
                    "source_refs": [1, 2],
                }
            ]
        },
    )

    assert "Revenue \\| ARR" in markdown
    assert "[1] [2]" in markdown


def test_render_csv_round_trips_commas_and_chinese_text() -> None:
    content = render_csv(
        "key_facts",
        {
            "facts": [
                {
                    "label": "收入",
                    "value": "$1,000",
                    "context": "同比增长, 12%",
                    "source_refs": [1, 2],
                }
            ]
        },
    )

    rows = list(csv.DictReader(io.StringIO(content)))
    assert rows == [
        {
            "label": "收入",
            "value": "$1,000",
            "context": "同比增长, 12%",
            "sources": "1 2",
        }
    ]


def test_citation_from_chunk_uses_most_specific_page_and_bbox_order() -> None:
    chunk = Chunk(
        id=uuid.uuid4(),
        document_id=uuid.uuid4(),
        page_start=4,
        page_end=5,
        section_title="Risk Factors",
        text="This is the cited passage.",
        bboxes=[
            {"page": 5, "x": 0.5, "y": 0.2, "w": 0.1, "h": 0.1},
            {"page": 4, "x": 0.2, "y": 0.3, "w": 0.1, "h": 0.1},
            {"page": 4, "x": 0.1, "y": 0.1, "w": 0.1, "h": 0.1},
            {"page": 4, "x": "bad", "y": 0.1, "w": 0.1, "h": 0.1},
        ],
    )

    citation = _citation_from_chunk(7, chunk, score=0.91234)

    assert citation["ref_index"] == 7
    assert citation["page"] == 4
    assert citation["confidence_score"] == 0.912
    assert citation["text_snippet"].startswith("Risk Factors:")
    assert [bbox["page"] for bbox in citation["bboxes"]] == [4, 4, 5]
