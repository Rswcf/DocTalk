from __future__ import annotations

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.api.admin import _metadata_number, admin_rag_quality


class _ScalarRows:
    def __init__(self, rows: list[object]) -> None:
        self._rows = rows

    def all(self) -> list[object]:
        return self._rows


class _RowsResult:
    def __init__(self, rows: list[object]) -> None:
        self._rows = rows

    def scalars(self) -> _ScalarRows:
        return _ScalarRows(self._rows)


def _event(status: str, *, score: float, created_at: datetime, **metadata: object) -> SimpleNamespace:
    return SimpleNamespace(
        reason=status,
        created_at=created_at,
        metadata_json={
            "status": status,
            "score": score,
            "claim_count": metadata.pop("claim_count", 1),
            "citation_count": metadata.pop("citation_count", 1),
            **metadata,
        },
    )


def test_metadata_number_parses_numeric_strings_and_rejects_bad_values() -> None:
    assert _metadata_number({"score": "0.82"}, "score") == 0.82
    assert _metadata_number({"score": 1}, "score") == 1.0
    assert _metadata_number({"score": None}, "score") == 0.0
    assert _metadata_number({"score": "not-a-number"}, "score") == 0.0


@pytest.mark.asyncio
async def test_admin_rag_quality_aggregates_recent_events() -> None:
    now = datetime.now(timezone.utc)
    rows = [
        _event(
            "pass",
            score=0.94,
            created_at=now,
            retrieval_strategy="semantic_top_k+lexical_correction",
            route="local_qa",
            uncited_claim_count=0,
            invalid_citation_count=0,
            low_overlap_citation_count=0,
        ),
        _event(
            "warn",
            score=0.64,
            created_at=now - timedelta(minutes=5),
            retrieval_strategy="semantic_top_k+table",
            route="comparison",
            uncited_claim_count=2,
            invalid_citation_count=0,
            low_overlap_citation_count=1,
            numeric_mismatch_citation_count=1,
        ),
        _event(
            "fail",
            score=0.2,
            created_at=now - timedelta(minutes=10),
            retrieval_strategy="semantic_top_k",
            route="summary",
            uncited_claim_count=1,
            invalid_citation_count=1,
            low_overlap_citation_count=0,
            numeric_mismatch_citation_count=0,
        ),
    ]
    db = SimpleNamespace(execute=AsyncMock(return_value=_RowsResult(rows)))

    payload = await admin_rag_quality(_admin=SimpleNamespace(id="admin"), db=db, days=7)

    assert payload["days"] == 7
    assert payload["evaluated_answers"] == 3
    assert payload["average_score"] == 0.593
    assert payload["pass_rate"] == 0.333
    assert payload["warn_rate"] == 0.333
    assert payload["fail_rate"] == 0.333
    assert payload["uncited_claims"] == 3
    assert payload["invalid_citations"] == 1
    assert payload["low_overlap_citations"] == 1
    assert payload["numeric_mismatch_citations"] == 1
    assert payload["health_label"] == "Needs attention"
    assert payload["issue_breakdown"][0]["label"] == "Answer includes statements without citations"
    assert payload["issue_breakdown"][0]["count"] == 3
    assert payload["strategy_breakdown"][0]["label"] == "Fallback keyword search after weak match"
    assert payload["sample_limit"] == 1000
    assert payload["is_sampled"] is False
    assert payload["recent"][0]["strategy"] == "semantic_top_k+lexical_correction"
    assert payload["recent"][0]["status_label"] == "Grounded"
    assert payload["recent"][1]["route_label"] == "Comparison question"
    assert payload["recent"][1]["main_issue"]["label"] == "Answer includes statements without citations"


@pytest.mark.asyncio
async def test_admin_rag_quality_handles_empty_window() -> None:
    db = SimpleNamespace(execute=AsyncMock(return_value=_RowsResult([])))

    payload = await admin_rag_quality(_admin=SimpleNamespace(id="admin"), db=db, days=30)

    assert payload["evaluated_answers"] == 0
    assert payload["average_score"] == 0.0
    assert payload["pass_rate"] == 0.0
    assert payload["status_counts"] == {"pass": 0, "warn": 0, "fail": 0, "unknown": 0}
    assert payload["health_label"] == "No answers evaluated yet"
    assert payload["issue_breakdown"][0]["count"] == 0
    assert payload["strategy_breakdown"] == []
    assert payload["is_sampled"] is False
    assert payload["recent"] == []
