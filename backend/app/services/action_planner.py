from __future__ import annotations

import asyncio
import dataclasses
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
    VERIFIED_QUOTE_SEARCH = "verified_quote_search"
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
    # FIX3-B (Codex r3 #5, NOT ADDRESSED): set when the strict quote trigger
    # matched but a negation/metalinguistic token was ALSO present anywhere
    # in the message, so auto-routing to VERIFIED_QUOTE_SEARCH was
    # deliberately suppressed (see deterministic_plan). The frontend uses
    # this to offer a manual "Try Quote Finder" chip — never to
    # auto-route or bill on this signal alone.
    quote_finder_hint: bool = False
    quote_finder_hint_topic: str | None = None

    @property
    def uses_rag_answer_path(self) -> bool:
        return self.action in {
            ChatAction.ANSWER_WITH_RAG,
            ChatAction.SUMMARIZE_DOCUMENT,
            ChatAction.CITATION_LOOKUP,
            ChatAction.VERIFIED_QUOTE_SEARCH,
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

# Strict verbatim-quote intent (plan \u00a78.4.3) \u2014 DELIBERATELY SEPARATE from
# _CITATION_RE above. _CITATION_RE is broad ("where/source/quote/verbatim")
# and routes to the ordinary RAG answer path (CITATION_LOOKUP already sits in
# uses_rag_answer_path); it must keep matching ordinary citation-quality
# questions ("where is this discussed?", "what page is this on?") unchanged.
# This matcher is narrow on purpose: only unambiguous direct-quote requests
# ("direct quote", "verbatim", "exact quotation", "word for word", "quote ...
# with page") should route to the verified quote-search pipeline. Bare
# "quote"/"citation"/"source" must NOT match here \u2014 those stay on the normal
# RAG path per the strict-intent-only routing decision (plan \u00a78.4 point 3).
_STRICT_QUOTE_RE = re.compile(
    r"\bdirect\s+quotes?\b"
    r"|\bexact\s+quotations?\b"
    r"|\bverbatim\b"
    r"|\bword[\s-]for[\s-]word\b"
    r"|\u9010\u5b57\u5f15\u7528|\u539f\u6587\u5f15\u7528|\u4e00\u5b57\u4e0d\u5dee"
    r"|\bcita\s+textual\b|\bcopia\s+tal\s+cual\b|\btextualmente\b",
    re.IGNORECASE,
)
# "quote ... with page" / "page ... quote" \u2014 a bounded window so it doesn't
# also fire on unrelated quote-mention-somewhere-near-a-page-mention text.
_STRICT_QUOTE_WITH_PAGE_RE = re.compile(
    r"\bquote\b[^.?!\n]{0,60}\bpage\b|\bpage\b[^.?!\n]{0,60}\bquote\b",
    re.IGNORECASE,
)

# FIX-5 (Codex r1 #5) -> FIX2-C (Codex r2 #5) -> FIX3-B (Codex r3 #5 +
# New Breakage #1, NOT ADDRESSED): three rounds tried to make the matcher
# SMART about which target a negation/metalinguistic marker attaches to \u2014
# a bounded proximity window (FIX-5), then nearest-distance-to-a-
# paraphrase-token (FIX2-C). r3 found the distance heuristic STILL
# misroutes on coordinated predicates, clause boundaries, and a negated
# metalinguistic action followed by an affirmative quote request ("Do not
# translate it; quote the clause verbatim.") \u2014 no local heuristic reliably
# resolves every such case, and FIX2-C's own heuristic introduced NEW
# coordinated-negation false positives across en/zh/es (r3's "New Breakage
# #1").
#
# FIX3-B replaces the heuristic entirely with a DETERMINISTIC-SAFE POLICY:
# route to the BILLED verified quote-search pipeline ONLY when the strict
# trigger matches AND the message contains ZERO negation/metalinguistic
# tokens ANYWHERE \u2014 whole-message presence, never proximity, never "which
# target". Any negation/metalinguistic token present alongside a trigger
# match means: do NOT auto-route \u2014 instead the ordinary RAG/citation path
# runs, and the returned ActionPlan carries quote_finder_hint=True (+ the
# message as quote_finder_hint_topic) so the frontend can offer a manual
# "Try Quote Finder" chip. This is a deliberate ASYMMETRIC-LOSS trade: a
# false POSITIVE here costs real money and an unverified/wrong answer; a
# false NEGATIVE costs the user exactly one click on a chip. Even r2's
# genuinely-affirmative "Give me a direct quote, without paraphrasing."-
# style probes now deliberately do NOT auto-route \u2014 they get the chip, not
# silence, and never a blind bill.
_NEGATION_RE = re.compile(
    r"\b(don'?t|do\s+not|does\s?n'?t|should\s?n'?t|should\s+not|never|without)\b"
    r"|\u4e0d\u8981|\u65e0\u9700|\u522b|\u4e0d\u7528|\u4e0d\u9700\u8981"
    r"|\bno\b",
    re.IGNORECASE,
)
_METALINGUISTIC_RE = re.compile(
    r"\btranslat\w*\b"
    r"|\bmean(?:s|ing)?\b"  # NOT a bare "what does" \u2014 "what does it SAY" is a genuine request
    r"|\u7ffb\u8bd1|\u662f\u4ec0\u4e48\u610f\u601d|\u4ec0\u4e48\u610f\u601d"
    r"|qu[\u00e9e]\s+significa|significad\w*",
    re.IGNORECASE,
)

# Mirrors quote_search_service.MAX_TOPIC_CHARS (FIX-7) \u2014 same defensive
# reasoning: never carry an unbounded user message into a downstream field.
_QUOTE_FINDER_HINT_TOPIC_MAX_CHARS = 300


def _has_strict_trigger(text: str) -> bool:
    return bool(_STRICT_QUOTE_RE.search(text)) or bool(_STRICT_QUOTE_WITH_PAGE_RE.search(text))


def _has_suppressing_token(text: str) -> bool:
    """Whole-message presence check \u2014 ANY negation OR metalinguistic token
    anywhere, regardless of what it grammatically attaches to. See the
    FIX3-B block comment above for why this replaces the prior windowed/
    distance-based approach entirely."""
    return bool(_NEGATION_RE.search(text)) or bool(_METALINGUISTIC_RE.search(text))


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

    strict_trigger_matched = _has_strict_trigger(text)
    # FIX3-B (Codex r3 #5, NOT ADDRESSED): suppress auto-routing (but
    # signal a hint) when ANY negation/metalinguistic token is present
    # anywhere alongside a trigger match — deliberately not "which token
    # it targets." See the block comment above _NEGATION_RE for the full
    # rationale.
    quote_finder_hint = strict_trigger_matched and _has_suppressing_token(text)

    # Strict verbatim-quote intent (§8.4.3) — checked first: narrow and
    # unambiguous, so it takes priority over the broader table/compare/
    # template markers below rather than risking being shadowed by them.
    if strict_trigger_matched and not quote_finder_hint:
        return ActionPlan(
            action=ChatAction.VERIFIED_QUOTE_SEARCH,
            confidence=0.88,
            requires_confirmation=False,
            user_visible_status="",
            reason="strict verbatim-quote markers",
        )

    plan = _fallthrough_plan(text, is_collection=is_collection)
    if quote_finder_hint:
        # Attached to WHATEVER the fallthrough resolves to (almost always
        # citation_lookup or the ordinary_document_question default, since
        # a quote trigger rarely also matches table/compare/template
        # vocabulary) rather than threading the hint through every
        # individual branch above.
        return dataclasses.replace(
            plan,
            quote_finder_hint=True,
            quote_finder_hint_topic=text[:_QUOTE_FINDER_HINT_TOPIC_MAX_CHARS],
        )
    return plan


def _fallthrough_plan(text: str, *, is_collection: bool) -> ActionPlan:
    """Every NON-strict-quote branch of deterministic_plan — extracted so
    FIX3-B's quote_finder_hint (see deterministic_plan) can be attached
    uniformly to whatever this resolves to, without threading it through
    each individual return statement below."""
    has_table = bool(_TABLE_RE.search(text))
    has_export = bool(_EXPORT_RE.search(text))
    has_summary = bool(_SUMMARY_RE.search(text))
    has_fact = bool(_FACT_RE.search(text))
    has_evidence = bool(_EVIDENCE_RE.search(text))
    has_compare = bool(_COMPARE_RE.search(text))
    has_template = bool(_TEMPLATE_RE.search(text))
    has_citation = bool(_CITATION_RE.search(text))
    wants_direct_chat_answer = bool(
        re.search(
            r"\b(answer directly|directly in chat|do not start|do not create|no separate)\b"
            r"|直接在聊天|不要启动|不要生成.*任务|不要.*结构化",
            text,
            re.IGNORECASE,
        )
    )
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

    if wants_direct_chat_answer:
        return ActionPlan(
            action=ChatAction.CITATION_LOOKUP if has_citation else ChatAction.ANSWER_WITH_RAG,
            confidence=0.82,
            requires_confirmation=False,
            user_visible_status="",
            reason="explicit direct chat answer requested",
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

    if has_evidence and wants_deliverable:
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
