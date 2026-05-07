from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.services.rag_evaluator_service import extract_query_terms
from app.services.retrieval_service import _lexical_score, retrieval_service


class _Rows:
    def scalars(self):
        return []


@pytest.mark.asyncio
async def test_lexical_search_orders_by_weighted_match_before_page_limit() -> None:
    captured = {}

    async def execute(statement):
        captured["statement"] = statement
        return _Rows()

    db = SimpleNamespace(execute=AsyncMock(side_effect=execute))

    await retrieval_service.lexical_search("Does this agreement contain a non-compete clause?", "doc-id", 8, db)

    order_by = list(captured["statement"]._order_by_clauses)
    assert order_by
    assert "CASE" in str(order_by[0]).upper()
    assert "chunks.page_start" not in str(order_by[0])


@pytest.mark.asyncio
async def test_lexical_search_multi_orders_by_weighted_match_before_page_limit() -> None:
    captured = {}

    async def execute(statement):
        captured["statement"] = statement
        return _Rows()

    db = SimpleNamespace(execute=AsyncMock(side_effect=execute))

    await retrieval_service.lexical_search_multi(
        "Find MetaX 2028 revenue",
        ["doc-a", "doc-b"],
        8,
        db,
    )

    order_by = list(captured["statement"]._order_by_clauses)
    assert order_by
    assert "CASE" in str(order_by[0]).upper()
    assert "chunks.document_id" not in str(order_by[0])


def test_lexical_score_prefers_late_exact_hit_over_many_broad_hits() -> None:
    terms = extract_query_terms("Does this agreement contain a non-compete clause?").lexical_terms
    broad_score = _lexical_score("The agreement contains general operating obligations.", terms)
    exact_score = _lexical_score("The agreement contains a non-compete clause in section 8.", terms)

    assert exact_score > broad_score
