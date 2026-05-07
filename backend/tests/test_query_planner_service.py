from __future__ import annotations

from app.services.query_planner_service import query_planner_service
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


def test_direct_question_keeps_single_step_plan() -> None:
    plan = query_planner_service.plan(
        "What is Cambrian's rating?",
        _route(),
        document_count=1,
    )

    assert plan.is_active is False
    assert [step.label for step in plan.steps] == ["direct"]


def test_financial_comparison_decomposes_entities_and_metrics() -> None:
    plan = query_planner_service.plan(
        "Compare MetaX and Iluvatar revenue and target price.",
        _route(
            primary_intent=QueryIntent.COMPARISON,
            intents=(QueryIntent.COMPARISON, QueryIntent.TABLE_QUERY),
            needs_decomposition=True,
        ),
        document_count=1,
    )

    assert plan.is_active is True
    assert any(step.purpose == "entity-metric-coverage" for step in plan.steps)
    assert any("MetaX" in step.query for step in plan.steps)
    assert any("Iluvatar" in step.query for step in plan.steps)


def test_collection_comparison_requests_balanced_document_coverage() -> None:
    plan = query_planner_service.plan(
        "Compare the conclusions across these reports.",
        _route(
            primary_intent=QueryIntent.COMPARISON,
            intents=(QueryIntent.COMPARISON,),
            scope="collection",
            needs_decomposition=True,
        ),
        document_count=3,
    )

    assert plan.is_active is True
    assert plan.needs_balanced_coverage is True
    assert "balanced-doc-coverage" in plan.reason
