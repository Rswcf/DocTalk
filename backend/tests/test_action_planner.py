from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.services import action_planner as action_planner_module
from app.services.action_planner import (
    ActionPlan,
    ActionPlanner,
    ChatAction,
    deterministic_plan,
)


def test_planner_routes_table_export_in_chinese() -> None:
    plan = deterministic_plan("请提取所有表格并导出 CSV")

    assert plan.action == ChatAction.EXPORT_TABLES
    assert plan.artifact_format == "csv"
    assert plan.confidence >= 0.8


def test_planner_routes_key_facts_as_deliverable() -> None:
    plan = deterministic_plan("找出所有公司目标价和评级，整理成表格")

    assert plan.action == ChatAction.EXTRACT_DELIVERABLE
    assert plan.template_key == "key_facts"


def test_planner_routes_executive_summary_as_deliverable() -> None:
    plan = deterministic_plan("Generate an executive summary")

    assert plan.action == ChatAction.EXTRACT_DELIVERABLE
    assert plan.template_key == "executive_summary"


def test_planner_keeps_plain_summary_on_rag_path() -> None:
    plan = deterministic_plan("请总结这篇文档的要点")

    assert plan.action == ChatAction.SUMMARIZE_DOCUMENT
    assert plan.uses_rag_answer_path


def test_planner_keeps_plain_academic_paper_question_on_rag_path() -> None:
    plan = deterministic_plan("What is the central argument or subject of this academic paper? Answer concisely and cite the source.")

    assert plan.action == ChatAction.CITATION_LOOKUP
    assert plan.uses_rag_answer_path


def test_planner_routes_explicit_evidence_table_deliverable() -> None:
    plan = deterministic_plan("Generate an academic evidence table with cited claims")

    assert plan.action == ChatAction.EXTRACT_DELIVERABLE
    assert plan.template_key == "evidence_table"


@pytest.mark.asyncio
async def test_planner_keeps_plain_greeting_on_rag_path(monkeypatch: pytest.MonkeyPatch) -> None:
    def _unexpected_client(_model: str):
        raise AssertionError("LLM planner should not run for high-confidence ordinary chat")

    planner = ActionPlanner()
    monkeypatch.setattr(planner, "_client_for_model", _unexpected_client)

    plan = await planner.plan("hello")

    assert plan.action == ChatAction.ANSWER_WITH_RAG
    assert plan.uses_rag_answer_path


def test_planner_compare_requires_document_slots() -> None:
    plan = deterministic_plan("和上一版做对比", is_collection=True)

    assert plan.action == ChatAction.COMPARE_DOCUMENTS
    assert plan.requires_confirmation is True
    assert "old_document_id" in plan.missing_slots


def test_planner_citation_lookup_stays_rag_path() -> None:
    plan = deterministic_plan("这句话在哪页？")

    assert plan.action == ChatAction.CITATION_LOOKUP
    assert plan.uses_rag_answer_path
    assert plan.quote_finder_hint is True
    assert plan.quote_finder_hint_topic == "这句话在哪页？"


@pytest.mark.parametrize(
    "message",
    [
        "Where does the paper discuss climate risk?",
        "Find me a quote about the study limitations.",
    ],
)
def test_planner_offers_quote_finder_hint_for_real_citation_phrasing(message: str) -> None:
    plan = deterministic_plan(message)

    assert plan.action == ChatAction.CITATION_LOOKUP
    assert plan.uses_rag_answer_path
    assert plan.quote_finder_hint is True
    assert plan.quote_finder_hint_topic == message


def test_planner_strict_original_text_quote_routes_to_verified_quote_search() -> None:
    """B5 (plan §8.4.3): "原文引用" is one of the REQUIRED strict ZH triggers
    for the verified quote-search pipeline, so a message combining a page
    lookup with an original-text-citation request now reclassifies from the
    old bare CITATION_LOOKUP into VERIFIED_QUOTE_SEARCH — both sit in
    uses_rag_answer_path, so this is a routing refinement, not a path change."""
    plan = deterministic_plan("这句话在哪页，有没有原文引用？")

    assert plan.action == ChatAction.VERIFIED_QUOTE_SEARCH
    assert plan.uses_rag_answer_path


@pytest.mark.asyncio
async def test_deepseek_planner_disables_thinking_and_requires_json(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    create = AsyncMock(
        return_value=SimpleNamespace(
            model="deepseek-flash",
            choices=[
                SimpleNamespace(
                    finish_reason="stop",
                    message=SimpleNamespace(
                        content=(
                            '{"action":"scan_tables","confidence":0.91,'
                            '"requires_confirmation":false,"missing_slots":[]}'
                        )
                    ),
                )
            ],
            usage=SimpleNamespace(
                prompt_tokens=30,
                completion_tokens=12,
                prompt_cache_hit_tokens=0,
                prompt_cache_miss_tokens=30,
            ),
        )
    )
    client = SimpleNamespace(
        chat=SimpleNamespace(completions=SimpleNamespace(create=create))
    )
    planner = ActionPlanner()
    monkeypatch.setattr(planner, "_client_for_model", lambda _model: client)
    monkeypatch.setattr(
        action_planner_module,
        "deterministic_plan",
        lambda *_args, **_kwargs: ActionPlan(
            action=ChatAction.CLARIFY,
            confidence=0.2,
            requires_confirmation=False,
        ),
    )
    monkeypatch.setattr(
        action_planner_module.settings,
        "MODE_MODELS",
        {"quick": "deepseek-flash", "balanced": "deepseek-v4-pro"},
    )
    monkeypatch.setattr(action_planner_module.settings, "ADAPTER_SECRET", "test-secret")

    plan = await planner.plan("inspect it", user_id="internal-user-123")

    assert plan.action == ChatAction.SCAN_TABLES
    kwargs = create.await_args.kwargs
    assert kwargs["response_format"] == {"type": "json_object"}
    assert kwargs["extra_body"]["thinking"] == {"type": "disabled"}
    assert kwargs["extra_body"]["user_id"].startswith("dt_")
    assert "internal-user-123" not in kwargs["extra_body"]["user_id"]


@pytest.mark.parametrize("message", ["Compare the two versions of this contract", "和上一版做对比"])
def test_planner_compares_only_in_collections(message: str) -> None:
    # A single-document session has nothing to compare against; the comparison tool's canned status used to
    # become the reply (in English or Chinese only). It now gets an ordinary cited answer.
    single = deterministic_plan(message, is_collection=False)
    assert single.action != ChatAction.COMPARE_DOCUMENTS
    assert single.uses_rag_answer_path
    assert deterministic_plan(message, is_collection=True).action == ChatAction.COMPARE_DOCUMENTS


@pytest.mark.parametrize(
    "message",
    [
        "Write an essay on the novel's main themes",
        "Create a course outline from this textbook",
        "Make study notes in my own words for chapter 2",
        "Make a quiz from this chapter",
        "根据这份文档写一份演示大纲",
    ],
)
def test_drafting_requests_reach_the_grounded_answer_path(message: str) -> None:
    plan = deterministic_plan(message)
    assert plan.uses_rag_answer_path, (message, plan.action)
    assert plan.action != ChatAction.VERIFIED_QUOTE_SEARCH
