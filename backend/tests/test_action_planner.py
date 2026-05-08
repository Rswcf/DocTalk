from __future__ import annotations

import pytest

from app.services.action_planner import ActionPlanner, ChatAction, deterministic_plan


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
    plan = deterministic_plan("这句话在哪页，有没有原文引用？")

    assert plan.action == ChatAction.CITATION_LOOKUP
    assert plan.uses_rag_answer_path
