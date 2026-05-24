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
        needs_decomposition=kwargs.get("needs_decomposition", False),
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
async def test_sufficient_vector_results_plain_qa_runs_low_cost_lexical_for_rrf(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
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
    lexical_search.assert_awaited_once()
    assert lexical_search.await_args.kwargs["top_k"] <= 6
    assert lexical_search.await_args.kwargs["min_text_len"] == 200


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


@pytest.mark.asyncio
async def test_planned_single_comparison_adds_subquery_evidence_even_when_vector_is_sufficient(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    document_id = uuid.uuid4()
    initial = {
        "chunk_id": uuid.uuid4(),
        "text": "MetaX and Iluvatar are discussed in the semiconductor report.",
        "page": 1,
        "page_end": 1,
        "bboxes": [],
        "score": 0.91,
    }
    metax = {
        "chunk_id": uuid.uuid4(),
        "text": "MetaX revenue guidance is listed in the valuation section.",
        "page": 6,
        "page_end": 6,
        "bboxes": [],
        "score": 0.84,
    }
    iluvatar = {
        "chunk_id": uuid.uuid4(),
        "text": "Iluvatar target price appears in the comparable companies table.",
        "page": 7,
        "page_end": 7,
        "bboxes": [],
        "score": 0.82,
    }
    search = AsyncMock(side_effect=[[initial], [metax], [iluvatar]])
    lexical_search = AsyncMock(return_value=[])
    monkeypatch.setattr(corrective_module.retrieval_service, "search", search)
    monkeypatch.setattr(corrective_module.retrieval_service, "table_search", AsyncMock(return_value=[]))
    monkeypatch.setattr(corrective_module.retrieval_service, "lexical_search", lexical_search)

    result = await corrective_module.corrective_retrieval_service.retrieve_single(
        "Compare MetaX and Iluvatar revenue and target price.",
        _route(
            primary_intent=QueryIntent.COMPARISON,
            intents=(QueryIntent.COMPARISON, QueryIntent.TABLE_QUERY),
            needs_decomposition=True,
        ),
        document_id,
        top_k=8,
        db=object(),
    )

    assert search.await_count >= 3
    assert result.plan and result.plan.is_active
    assert "planned_multi_hop" in result.strategy
    assert {item["chunk_id"] for item in result.retrieved} >= {
        initial["chunk_id"],
        metax["chunk_id"],
        iluvatar["chunk_id"],
    }


@pytest.mark.asyncio
async def test_collection_comparison_adds_balanced_per_document_evidence(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    doc_a = uuid.uuid4()
    doc_b = uuid.uuid4()
    initial = {
        "chunk_id": uuid.uuid4(),
        "document_id": doc_a,
        "text": "Report A discusses lower revenue growth.",
        "page": 2,
        "page_end": 2,
        "bboxes": [],
        "score": 0.9,
    }
    balanced_a = {
        "chunk_id": uuid.uuid4(),
        "text": "Report A conclusion favors Cambrian.",
        "page": 8,
        "page_end": 8,
        "bboxes": [],
        "score": 0.82,
    }
    balanced_b = {
        "chunk_id": uuid.uuid4(),
        "text": "Report B conclusion favors Iluvatar.",
        "page": 9,
        "page_end": 9,
        "bboxes": [],
        "score": 0.81,
    }

    monkeypatch.setattr(corrective_module.retrieval_service, "search_multi", AsyncMock(return_value=[initial]))
    monkeypatch.setattr(corrective_module.retrieval_service, "lexical_search_multi", AsyncMock(return_value=[]))
    search = AsyncMock(side_effect=[[balanced_a], [balanced_b]])
    monkeypatch.setattr(corrective_module.retrieval_service, "search", search)

    result = await corrective_module.corrective_retrieval_service.retrieve_multi(
        "Compare the conclusions across these reports.",
        _route(
            primary_intent=QueryIntent.COMPARISON,
            intents=(QueryIntent.COMPARISON,),
            scope="collection",
            needs_decomposition=True,
        ),
        [doc_a, doc_b],
        top_k=8,
        db=object(),
    )

    assert search.await_count == 2
    assert result.plan and result.plan.needs_balanced_coverage
    assert "balanced_compare" in result.strategy
    assert any(item.get("document_id") == doc_b for item in result.retrieved)


@pytest.mark.asyncio
async def test_collection_comparison_preserves_one_item_per_document_before_extra_hits(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    document_ids = [uuid.uuid4() for _ in range(8)]
    per_doc_results = []
    for index, document_id in enumerate(document_ids, start=1):
        per_doc_results.append(
            [
                {
                    "chunk_id": uuid.uuid4(),
                    "text": f"Required comparison evidence for document {index}.",
                    "page": 1,
                    "page_end": 1,
                    "bboxes": [],
                    "score": 0.9,
                },
                {
                    "chunk_id": uuid.uuid4(),
                    "text": f"Extra comparison evidence for document {index}.",
                    "page": 2,
                    "page_end": 2,
                    "bboxes": [],
                    "score": 0.8,
                },
            ]
        )

    monkeypatch.setattr(corrective_module.retrieval_service, "search_multi", AsyncMock(return_value=[]))
    monkeypatch.setattr(corrective_module.retrieval_service, "lexical_search_multi", AsyncMock(return_value=[]))
    search = AsyncMock(side_effect=per_doc_results)
    monkeypatch.setattr(corrective_module.retrieval_service, "search", search)

    result = await corrective_module.corrective_retrieval_service.retrieve_multi(
        "Compare the conclusions across these reports.",
        _route(
            primary_intent=QueryIntent.COMPARISON,
            intents=(QueryIntent.COMPARISON,),
            scope="collection",
            needs_decomposition=True,
        ),
        document_ids,
        top_k=8,
        db=object(),
    )

    returned_doc_ids = {item.get("document_id") for item in result.retrieved}
    assert set(document_ids).issubset(returned_doc_ids)
    assert len(result.retrieved) <= 14


@pytest.mark.asyncio
async def test_collection_table_comparison_keeps_table_evidence_before_balanced_extras(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    document_ids = [uuid.uuid4() for _ in range(8)]
    table_id = str(uuid.uuid4())
    table_evidence = {
        "chunk_id": uuid.uuid4(),
        "table_id": table_id,
        "document_id": document_ids[-1],
        "text": "Table p.5 #1\n| Report | Revenue |\n| 8 | $10m |",
        "page": 5,
        "page_end": 5,
        "bboxes": [],
        "score": 0.96,
        "retrieval_modality": "table",
    }
    per_doc_results = [
        [
            {
                "chunk_id": uuid.uuid4(),
                "text": f"Required comparison evidence for document {index}.",
                "page": 1,
                "page_end": 1,
                "bboxes": [],
                "score": 0.9,
            },
            {
                "chunk_id": uuid.uuid4(),
                "text": f"Extra comparison evidence for document {index}.",
                "page": 2,
                "page_end": 2,
                "bboxes": [],
                "score": 0.8,
            },
        ]
        for index in range(1, 9)
    ]

    monkeypatch.setattr(corrective_module.retrieval_service, "search_multi", AsyncMock(return_value=[]))
    monkeypatch.setattr(corrective_module.retrieval_service, "lexical_search_multi", AsyncMock(return_value=[]))
    monkeypatch.setattr(corrective_module.retrieval_service, "table_search_multi", AsyncMock(return_value=[table_evidence]))
    monkeypatch.setattr(corrective_module.retrieval_service, "search", AsyncMock(side_effect=per_doc_results))

    result = await corrective_module.corrective_retrieval_service.retrieve_multi(
        "Compare revenue across these reports.",
        _route(
            primary_intent=QueryIntent.COMPARISON,
            intents=(QueryIntent.COMPARISON, QueryIntent.TABLE_QUERY),
            scope="collection",
            needs_decomposition=True,
        ),
        document_ids,
        top_k=8,
        db=object(),
    )

    assert any(item.get("table_id") == table_id for item in result.retrieved)
    assert set(document_ids).issubset({item.get("document_id") for item in result.retrieved})
