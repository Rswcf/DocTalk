from __future__ import annotations

import asyncio
import json
import logging
import re
from dataclasses import dataclass
from enum import Enum
from typing import Any

from openai import AsyncOpenAI

from app.core.config import settings

logger = logging.getLogger(__name__)


class ChatAction(str, Enum):
    ANSWER_WITH_RAG = "answer_with_rag"
    SUMMARIZE_DOCUMENT = "summarize_document"
    EXTRACT_DELIVERABLE = "extract_deliverable"
    SCAN_TABLES = "scan_tables"
    EXPORT_TABLES = "export_tables"
    CREATE_QUESTION_TEMPLATE = "create_question_template"
    RUN_QUESTION_TEMPLATE = "run_question_template"
    COMPARE_DOCUMENTS = "compare_documents"
    CITATION_LOOKUP = "citation_lookup"
    CLARIFY = "clarify"


@dataclass(frozen=True)
class ActionPlan:
    action: ChatAction
    confidence: float
    requires_confirmation: bool
    missing_slots: tuple[str, ...] = ()
    scope: str = "current_document"
    document_ids: tuple[str, ...] = ()
    artifact_format: str | None = None
    template_key: str | None = None
    user_visible_status: str = ""
    reason: str = ""

    @property
    def uses_rag_answer_path(self) -> bool:
        return self.action in {
            ChatAction.ANSWER_WITH_RAG,
            ChatAction.SUMMARIZE_DOCUMENT,
            ChatAction.CITATION_LOOKUP,
        }


_TABLE_RE = re.compile(
    r"\b(table|tables|csv|excel|spreadsheet|row|rows|column|columns)\b"
    r"|表格|数据表|CSV|Excel|导出表|提取表",
    re.IGNORECASE,
)
_EXPORT_RE = re.compile(r"\b(export|download|csv|excel|xlsx)\b|导出|下载|CSV|Excel|表格文件", re.IGNORECASE)
_SUMMARY_RE = re.compile(r"\b(summarize|summary|brief|overview|tldr|executive summary)\b|总结|摘要|概括|要点", re.IGNORECASE)
_FACT_RE = re.compile(
    r"\b(key facts|figures|metrics|target price|rating|eps|revenue|valuation|facts)\b"
    r"|目标价|评级|收入|估值|利润|指标|关键事实|数字|金额",
    re.IGNORECASE,
)
_EVIDENCE_RE = re.compile(r"\b(evidence table|clauses?|legal|academic|claims?)\b|证据表|条款|法律|学术|论据", re.IGNORECASE)
_COMPARE_RE = re.compile(r"\b(compare|contrast|diff|difference|version|old version|previous)\b|对比|比较|差异|旧版|上一版|版本", re.IGNORECASE)
_TEMPLATE_RE = re.compile(r"\b(template|checklist|question list|run the same questions)\b|模板|清单|检查清单|同样的问题", re.IGNORECASE)
_CITATION_RE = re.compile(r"\b(where|which page|citation|source|quote|verbatim)\b|在哪页|引用|出处|来源|原文|定位", re.IGNORECASE)
_CJK_RE = re.compile(r"[\u3400-\u9fff]")


def _status(query: str, english: str, chinese: str) -> str:
    return chinese if _CJK_RE.search(query or "") else english


def deterministic_plan(message: str, *, is_collection: bool = False) -> ActionPlan:
    text = " ".join((message or "").strip().split())
    if not text:
        return ActionPlan(
            action=ChatAction.ANSWER_WITH_RAG,
            confidence=0.2,
            requires_confirmation=False,
            user_visible_status="",
            reason="empty message",
        )

    has_table = bool(_TABLE_RE.search(text))
    has_export = bool(_EXPORT_RE.search(text))
    has_summary = bool(_SUMMARY_RE.search(text))
    has_fact = bool(_FACT_RE.search(text))
    has_evidence = bool(_EVIDENCE_RE.search(text))
    has_compare = bool(_COMPARE_RE.search(text))
    has_template = bool(_TEMPLATE_RE.search(text))
    has_citation = bool(_CITATION_RE.search(text))
    wants_deliverable = bool(
        re.search(r"\b(all|extract|list|find all|make|create|generate|table)\b|所有|全部|提取|列出|找出|整理|生成|做成", text, re.IGNORECASE)
    )

    if has_compare:
        return ActionPlan(
            action=ChatAction.COMPARE_DOCUMENTS,
            confidence=0.86,
            requires_confirmation=True,
            missing_slots=("old_document_id", "new_document_id"),
            scope="collection" if is_collection else "current_document",
            user_visible_status=_status(
                text,
                "I need the two document versions before running a cited comparison.",
                "我需要先确认要对比的两份文档，然后再生成带引用的差异报告。",
            ),
            reason="document comparison markers",
        )

    if has_template:
        return ActionPlan(
            action=ChatAction.CREATE_QUESTION_TEMPLATE,
            confidence=0.84,
            requires_confirmation=True,
            missing_slots=("template_questions",),
            scope="collection" if is_collection else "current_document",
            user_visible_status=_status(
                text,
                "Tell me the checklist questions to save or run.",
                "请告诉我要保存或执行的检查清单问题。",
            ),
            reason="question template markers",
        )

    if has_table and has_export:
        return ActionPlan(
            action=ChatAction.EXPORT_TABLES,
            confidence=0.9,
            requires_confirmation=False,
            artifact_format="csv",
            user_visible_status=_status(
                text,
                "I am preparing the document tables for CSV export.",
                "我会把文档中的表格整理为可导出的 CSV。",
            ),
            reason="table export markers",
        )

    if has_fact and wants_deliverable:
        return ActionPlan(
            action=ChatAction.EXTRACT_DELIVERABLE,
            confidence=0.84,
            requires_confirmation=False,
            template_key="key_facts",
            artifact_format="md",
            user_visible_status=_status(
                text,
                "I am extracting key facts and figures with citations.",
                "我会提取关键事实和数字，并保留引用来源。",
            ),
            reason="key facts extraction markers",
        )

    if has_table and re.search(r"\b(all|extract|scan|find all)\b|所有|全部|提取|扫描|列出", text, re.IGNORECASE):
        return ActionPlan(
            action=ChatAction.SCAN_TABLES,
            confidence=0.86,
            requires_confirmation=False,
            user_visible_status=_status(
                text,
                "I am scanning the document for structured tables.",
                "我会扫描文档并提取结构化表格。",
            ),
            reason="table scan markers",
        )

    if has_evidence:
        return ActionPlan(
            action=ChatAction.EXTRACT_DELIVERABLE,
            confidence=0.84,
            requires_confirmation=False,
            template_key="evidence_table",
            artifact_format="md",
            user_visible_status=_status(
                text,
                "I am building a cited evidence table.",
                "我会生成一份带引用的证据表。",
            ),
            reason="evidence table markers",
        )

    if has_summary and re.search(r"\bexecutive\s+summary|deliverable|briefing\b|交付|简报", text, re.IGNORECASE):
        return ActionPlan(
            action=ChatAction.EXTRACT_DELIVERABLE,
            confidence=0.8,
            requires_confirmation=False,
            template_key="executive_summary",
            artifact_format="md",
            user_visible_status=_status(
                text,
                "I am creating a cited executive summary deliverable.",
                "我会生成一份带引用的 executive summary。",
            ),
            reason="executive summary deliverable markers",
        )

    if has_citation:
        return ActionPlan(
            action=ChatAction.CITATION_LOOKUP,
            confidence=0.78,
            requires_confirmation=False,
            user_visible_status="",
            reason="citation lookup markers",
        )

    if has_summary:
        return ActionPlan(
            action=ChatAction.SUMMARIZE_DOCUMENT,
            confidence=0.78,
            requires_confirmation=False,
            user_visible_status="",
            reason="summary markers",
        )

    return ActionPlan(
        action=ChatAction.ANSWER_WITH_RAG,
        confidence=0.62,
        requires_confirmation=False,
        user_visible_status="",
        reason="ordinary document question",
    )


def _coerce_action(value: Any) -> ChatAction | None:
    try:
        return ChatAction(str(value))
    except Exception:
        return None


def _json_from_text(text: str) -> dict[str, Any]:
    content = (text or "").strip()
    if content.startswith("```"):
        content = re.sub(r"^```(?:json)?\s*", "", content)
        content = re.sub(r"\s*```$", "", content)
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", content, flags=re.DOTALL)
        if not match:
            raise
        data = json.loads(match.group(0))
    if not isinstance(data, dict):
        raise ValueError("Planner response must be a JSON object")
    return data


class ActionPlanner:
    def _client_for_model(self, model: str) -> AsyncOpenAI | None:
        if model in settings.DEEPSEEK_OFFICIAL_MODELS and settings.DEEPSEEK_API_KEY:
            return AsyncOpenAI(api_key=settings.DEEPSEEK_API_KEY, base_url=settings.DEEPSEEK_BASE_URL)
        if settings.OPENROUTER_API_KEY:
            return AsyncOpenAI(api_key=settings.OPENROUTER_API_KEY, base_url=settings.OPENROUTER_BASE_URL)
        return None

    async def plan(
        self,
        message: str,
        *,
        is_collection: bool = False,
        locale: str | None = None,
    ) -> ActionPlan:
        deterministic = deterministic_plan(message, is_collection=is_collection)
        if deterministic.action in {
            ChatAction.ANSWER_WITH_RAG,
            ChatAction.SUMMARIZE_DOCUMENT,
            ChatAction.CITATION_LOOKUP,
        } and deterministic.confidence >= 0.6:
            return deterministic
        if deterministic.confidence >= 0.78:
            return deterministic

        if not settings.ACTION_PLANNER_USE_LLM:
            return deterministic
        model = settings.MODE_MODELS.get("quick", settings.LLM_MODEL)
        client = self._client_for_model(model)
        if client is None:
            return deterministic

        system = (
            "You classify a user's document-chat request into one product action. "
            "Return ONLY compact JSON with keys: action, confidence, "
            "requires_confirmation, missing_slots, scope, document_ids, "
            "artifact_format, template_key, user_visible_status. "
            "Allowed actions: answer_with_rag, summarize_document, extract_deliverable, "
            "scan_tables, export_tables, create_question_template, run_question_template, "
            "compare_documents, citation_lookup, clarify. "
            "Use tools only when the user asks for a deliverable, export, table scan, "
            "template/checklist workflow, or document version comparison. "
            "For ordinary questions, summaries, and source/page lookups, use the RAG actions."
        )
        user = (
            f"Locale: {locale or 'unknown'}\n"
            f"Scope: {'collection' if is_collection else 'single document'}\n"
            f"Request: {message}"
        )
        try:
            response = await asyncio.wait_for(
                client.chat.completions.create(
                    model=model,
                    temperature=0,
                    max_tokens=220,
                    messages=[
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                ),
                timeout=float(settings.ACTION_PLANNER_TIMEOUT_SECONDS or 3.0),
            )
            text = response.choices[0].message.content if response.choices else ""
            raw = _json_from_text(text or "")
            action = _coerce_action(raw.get("action"))
            if action is None:
                return deterministic
            confidence = float(raw.get("confidence") or 0)
            if confidence < 0.68:
                return deterministic
            missing = raw.get("missing_slots")
            docs = raw.get("document_ids")
            return ActionPlan(
                action=action,
                confidence=max(0.0, min(1.0, confidence)),
                requires_confirmation=bool(raw.get("requires_confirmation")),
                missing_slots=tuple(str(item) for item in missing if isinstance(item, str)) if isinstance(missing, list) else (),
                scope=str(raw.get("scope") or ("collection" if is_collection else "current_document")),
                document_ids=tuple(str(item) for item in docs if isinstance(item, str)) if isinstance(docs, list) else (),
                artifact_format=str(raw.get("artifact_format")) if raw.get("artifact_format") else None,
                template_key=str(raw.get("template_key")) if raw.get("template_key") else deterministic.template_key,
                user_visible_status=str(raw.get("user_visible_status") or deterministic.user_visible_status),
                reason="llm planner",
            )
        except Exception as exc:
            logger.info("Action planner LLM fallback failed: %s", exc)
            return deterministic


action_planner = ActionPlanner()
