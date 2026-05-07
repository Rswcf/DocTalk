from __future__ import annotations

from app.services.query_router import QueryIntent, QueryRoute
from app.services.rag_evaluator_service import (
    extract_query_terms,
    rag_evaluator_service,
)


def _route(**kwargs) -> QueryRoute:
    return QueryRoute(
        primary_intent=kwargs.get("primary_intent", QueryIntent.LOCAL_QA),
        intents=kwargs.get("intents", (QueryIntent.LOCAL_QA,)),
        scope="single_doc",
        coverage=kwargs.get("coverage", "top_hits"),
        confidence=0.8,
    )


def test_extract_query_terms_prefers_numbers_and_product_identifiers() -> None:
    terms = extract_query_terms("Which company has 2028 revenue above RMB 718.00 for MetaX?")

    assert "2028" in terms.exact_terms
    assert "718.00" in terms.exact_terms
    assert "MetaX" in terms.exact_terms
    assert "document" not in terms.lexical_terms


def test_evaluate_empty_results_requests_correction() -> None:
    evaluation = rag_evaluator_service.evaluate(
        "Does this contract contain a non-compete clause?",
        [],
        _route(intents=(QueryIntent.EXISTENCE_CHECK,), coverage="exhaustive_scan"),
    )

    assert evaluation.status == "empty"
    assert evaluation.should_correct is True
    assert "not found" in evaluation.prompt_note


def test_evaluate_exact_terms_missing_marks_weak() -> None:
    evaluation = rag_evaluator_service.evaluate(
        "What is MetaX 2028 revenue?",
        [{"text": "The report discusses industry valuation and supply chains.", "score": 0.51}],
        _route(),
    )

    assert evaluation.status == "weak"
    assert evaluation.reason == "exact_terms_missing"
    assert evaluation.should_correct is True


def test_evaluate_partial_exact_terms_missing_marks_weak() -> None:
    evaluation = rag_evaluator_service.evaluate(
        "What is MetaX 2028 revenue?",
        [{"text": "MetaX valuation is discussed without a future-year figure.", "score": 0.7}],
        _route(),
    )

    assert evaluation.status == "weak"
    assert "2028" not in evaluation.matched_terms
    assert evaluation.should_correct is True


def test_evaluate_supported_exact_terms_is_sufficient() -> None:
    evaluation = rag_evaluator_service.evaluate(
        "What is MetaX 2028 revenue?",
        [{"text": "MetaX 2028 revenue is shown in the valuation table.", "score": 0.66}],
        _route(),
    )

    assert evaluation.status == "sufficient"
    assert evaluation.should_correct is False


def test_table_query_prompt_note_preserves_numeric_precision() -> None:
    evaluation = rag_evaluator_service.evaluate(
        "What is MetaX 2028 revenue?",
        [{"text": "Table p.7 #1\n| Company | 2028 Revenue |\n| MetaX | $42m |", "score": 0.92}],
        _route(primary_intent=QueryIntent.TABLE_QUERY, intents=(QueryIntent.TABLE_QUERY,)),
        corrected=True,
    )

    assert evaluation.status == "sufficient"
    assert "preserve row labels" in evaluation.prompt_note
    assert "numeric claim" in evaluation.prompt_note
