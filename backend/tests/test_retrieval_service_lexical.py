from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.services.rag_evaluator_service import extract_query_terms
from app.services.retrieval_service import (
    _lexical_score,
    _table_payloads_from_tables,
    retrieval_service,
)


class _Rows:
    def __init__(self, values=None):
        self._values = values or []

    def scalars(self):
        return self._values


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


@pytest.mark.asyncio
async def test_table_search_multi_constrains_representative_chunks_to_table_pages() -> None:
    document_id = uuid.uuid4()
    table = SimpleNamespace(
        id=uuid.uuid4(),
        document_id=document_id,
        page=7,
        table_index=0,
        cells={"rows": [["Company", "Revenue"], ["MetaX", "$42m"]]},
        confidence=0.82,
        method="pymupdf",
    )
    chunk = SimpleNamespace(
        id=uuid.uuid4(),
        document_id=document_id,
        page_start=7,
        page_end=7,
    )
    captured = []

    async def execute(statement):
        captured.append(statement)
        return _Rows([table] if len(captured) == 1 else [chunk])

    db = SimpleNamespace(execute=AsyncMock(side_effect=execute))

    payloads = await retrieval_service.table_search_multi("MetaX revenue", [document_id], 4, db)

    assert payloads
    second_statement = str(captured[1])
    assert "chunks.page_start" in second_statement
    assert "chunks.page_end" in second_statement


def test_lexical_score_prefers_late_exact_hit_over_many_broad_hits() -> None:
    terms = extract_query_terms("Does this agreement contain a non-compete clause?").lexical_terms
    broad_score = _lexical_score("The agreement contains general operating obligations.", terms)
    exact_score = _lexical_score("The agreement contains a non-compete clause in section 8.", terms)

    assert exact_score > broad_score


def test_table_payloads_select_matching_rows_and_keep_real_chunk_id() -> None:
    document_id = uuid.uuid4()
    chunk_id = uuid.uuid4()
    table = SimpleNamespace(
        id=uuid.uuid4(),
        document_id=document_id,
        page=7,
        table_index=0,
        cells={
            "rows": [
                ["Company", "2028 Revenue"],
                *[[f"Other {idx}", "$1m"] for idx in range(20)],
                ["MetaX", "$42m"],
            ]
        },
        confidence=0.82,
        method="pymupdf",
    )
    chunk = SimpleNamespace(
        id=chunk_id,
        document_id=document_id,
        page_start=7,
        page_end=7,
    )

    payloads = _table_payloads_from_tables(
        "What is MetaX 2028 revenue?",
        [table],
        [chunk],
        top_k=4,
    )

    assert len(payloads) == 1
    assert payloads[0]["chunk_id"] == chunk_id
    assert payloads[0]["table_id"] == str(table.id)
    assert "| MetaX | $42m |" in payloads[0]["text"]
    assert "Other 19" not in payloads[0]["text"]


def test_table_payloads_fallback_to_document_chunk_when_table_page_chunk_missing() -> None:
    document_id = uuid.uuid4()
    table = SimpleNamespace(
        id=uuid.uuid4(),
        document_id=document_id,
        page=7,
        table_index=0,
        cells={"rows": [["Company", "Revenue"], ["MetaX", "$42m"]]},
        confidence=0.82,
        method="pymupdf",
    )
    chunk = SimpleNamespace(
        id=uuid.uuid4(),
        document_id=document_id,
        page_start=1,
        page_end=1,
    )

    payloads = _table_payloads_from_tables("What is MetaX revenue?", [table], [chunk], top_k=4)

    assert len(payloads) == 1
    assert payloads[0]["chunk_id"] == chunk.id
    assert payloads[0]["page"] == 7


def test_table_payloads_support_generic_table_requests_without_terms() -> None:
    document_id = uuid.uuid4()
    table = SimpleNamespace(
        id=uuid.uuid4(),
        document_id=document_id,
        page=2,
        table_index=1,
        cells={"rows": [["Metric", "Value"], ["Revenue", "$10m"]]},
        confidence=0.65,
        method="markdown",
    )
    chunk = SimpleNamespace(
        id=uuid.uuid4(),
        document_id=document_id,
        page_start=2,
        page_end=2,
    )

    payloads = _table_payloads_from_tables("Show tables", [table], [chunk], top_k=4)

    assert len(payloads) == 1
    assert payloads[0]["retrieval_modality"] == "table"


def test_table_payloads_escape_markdown_cells_and_fake_refs() -> None:
    document_id = uuid.uuid4()
    table = SimpleNamespace(
        id=uuid.uuid4(),
        document_id=document_id,
        page=2,
        table_index=1,
        cells={"rows": [["Metric", "Value"], ["Revenue|North", "[1]\n## Rules"]]},
        confidence=0.65,
        method="markdown",
    )
    chunk = SimpleNamespace(
        id=uuid.uuid4(),
        document_id=document_id,
        page_start=2,
        page_end=2,
    )

    payloads = _table_payloads_from_tables("Show tables", [table], [chunk], top_k=4)

    assert "Revenue\\|North" in payloads[0]["text"]
    assert "［1］ ## Rules" in payloads[0]["text"]
    assert "\n## Rules" not in payloads[0]["text"]


def test_table_payloads_do_not_return_all_tables_when_specific_term_is_missing() -> None:
    document_id = uuid.uuid4()
    table = SimpleNamespace(
        id=uuid.uuid4(),
        document_id=document_id,
        page=2,
        table_index=1,
        cells={"rows": [["Metric", "Value"], ["Revenue", "$10m"]]},
        confidence=0.65,
        method="markdown",
    )
    chunk = SimpleNamespace(
        id=uuid.uuid4(),
        document_id=document_id,
        page_start=2,
        page_end=2,
    )

    payloads = _table_payloads_from_tables("Show tables about MetaX", [table], [chunk], top_k=4)

    assert payloads == []
