from __future__ import annotations

import uuid
from unittest.mock import AsyncMock

import pytest

import app.services.corrective_retrieval_service as corrective_module
from app.services.query_router import QueryIntent, QueryRoute


def _route(**kwargs) -> QueryRoute:
    return QueryRoute(
        primary_intent=kwargs.get("primary_intent", QueryIntent.LOCAL_QA),
        intents=kwargs.get("intents", (QueryIntent.LOCAL_QA,)),
        scope=kwargs.get("scope", "single_doc"),
        coverage=kwargs.get("coverage", "top_hits"),
        confidence=0.8,
    )


@pytest.mark.asyncio
async def test_empty_vector_results_fall_back_to_lexical(monkeypatch: pytest.MonkeyPatch) -> None:
    document_id = uuid.uuid4()
    lexical_chunk = {
        "chunk_id": uuid.uuid4(),
        "text": "MetaX 2028 revenue appears in this valuation table.",
        "page": 4,
        "page_end": 4,
        "bboxes": [],
        "score": 0.82,
    }
    vector_search = AsyncMock(return_value=[])
    lexical_search = AsyncMock(return_value=[lexical_chunk])

    monkeypatch.setattr(corrective_module.retrieval_service, "search", vector_search)
    monkeypatch.setattr(corrective_module.retrieval_service, "lexical_search", lexical_search)

    result = await corrective_module.corrective_retrieval_service.retrieve_single(
        "What is MetaX 2028 revenue?",
        _route(),
        document_id,
        top_k=8,
        db=object(),
    )

    vector_search.assert_awaited_once()
    lexical_search.assert_awaited_once()
    assert result.strategy == "lexical_correction"
    assert result.retrieved == [lexical_chunk]
    assert result.evaluation.status == "sufficient"


@pytest.mark.asyncio
async def test_sufficient_vector_results_skip_lexical(monkeypatch: pytest.MonkeyPatch) -> None:
    document_id = uuid.uuid4()
    vector_chunk = {
        "chunk_id": uuid.uuid4(),
        "text": "MetaX 2028 revenue appears in this valuation table.",
        "page": 4,
        "page_end": 4,
        "bboxes": [],
        "score": 0.82,
    }
    vector_search = AsyncMock(return_value=[vector_chunk])
    lexical_search = AsyncMock(return_value=[])

    monkeypatch.setattr(corrective_module.retrieval_service, "search", vector_search)
    monkeypatch.setattr(corrective_module.retrieval_service, "lexical_search", lexical_search)

    result = await corrective_module.corrective_retrieval_service.retrieve_single(
        "What is MetaX 2028 revenue?",
        _route(),
        document_id,
        top_k=8,
        db=object(),
    )

    assert result.strategy == "semantic_top_k"
    assert result.retrieved == [vector_chunk]
    lexical_search.assert_not_awaited()


@pytest.mark.asyncio
async def test_exhaustive_route_runs_correction_even_when_vector_has_hits(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    document_id = uuid.uuid4()
    weak_vector = {
        "chunk_id": uuid.uuid4(),
        "text": "The agreement contains general operating obligations.",
        "page": 2,
        "page_end": 2,
        "bboxes": [],
        "score": 0.58,
    }
    lexical_chunk = {
        "chunk_id": uuid.uuid4(),
        "text": "The agreement contains a non-compete clause in section 8.",
        "page": 8,
        "page_end": 8,
        "bboxes": [],
        "score": 0.88,
    }

    monkeypatch.setattr(corrective_module.retrieval_service, "search", AsyncMock(return_value=[weak_vector]))
    lexical_search = AsyncMock(return_value=[lexical_chunk])
    monkeypatch.setattr(corrective_module.retrieval_service, "lexical_search", lexical_search)

    result = await corrective_module.corrective_retrieval_service.retrieve_single(
        "Does this agreement contain a non-compete clause?",
        _route(intents=(QueryIntent.EXISTENCE_CHECK,), coverage="exhaustive_scan"),
        document_id,
        top_k=8,
        db=object(),
    )

    lexical_search.assert_awaited_once()
    assert result.strategy == "semantic_top_k+lexical_correction"
    assert [item["chunk_id"] for item in result.retrieved] == [
        weak_vector["chunk_id"],
        lexical_chunk["chunk_id"],
    ]


@pytest.mark.asyncio
async def test_table_query_merges_structured_table_evidence_first(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    document_id = uuid.uuid4()
    table_chunk_id = uuid.uuid4()
    vector_chunk = {
        "chunk_id": uuid.uuid4(),
        "text": "MetaX revenue is discussed in the report.",
        "page": 3,
        "page_end": 3,
        "bboxes": [],
        "score": 0.78,
    }
    table_evidence = {
        "chunk_id": table_chunk_id,
        "table_id": str(uuid.uuid4()),
        "text": "Table p.7 #1\n| Company | 2028 Revenue |\n| MetaX | $42m |",
        "page": 7,
        "page_end": 7,
        "bboxes": [],
        "score": 0.96,
        "retrieval_modality": "table",
    }

    monkeypatch.setattr(corrective_module.retrieval_service, "search", AsyncMock(return_value=[vector_chunk]))
    table_search = AsyncMock(return_value=[table_evidence])
    lexical_search = AsyncMock(return_value=[])
    monkeypatch.setattr(corrective_module.retrieval_service, "table_search", table_search)
    monkeypatch.setattr(corrective_module.retrieval_service, "lexical_search", lexical_search)

    result = await corrective_module.corrective_retrieval_service.retrieve_single(
        "What is MetaX 2028 revenue?",
        _route(primary_intent=QueryIntent.TABLE_QUERY, intents=(QueryIntent.TABLE_QUERY,)),
        document_id,
        top_k=8,
        db=object(),
    )

    table_search.assert_awaited_once()
    lexical_search.assert_awaited_once()
    assert lexical_search.await_args.kwargs["min_text_len"] == 20
    assert result.strategy == "semantic_top_k+table_evidence+lexical_correction"
    assert result.retrieved[0]["table_id"] == table_evidence["table_id"]
    assert result.retrieved[1]["chunk_id"] == vector_chunk["chunk_id"]
