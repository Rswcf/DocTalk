from __future__ import annotations

import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Literal


class QueryIntent(str, Enum):
    DOCUMENT_SUMMARY = "document_summary"
    SECTION_SUMMARY = "section_summary"
    LOCAL_QA = "local_qa"
    TABLE_QUERY = "table_query"
    COMPARISON = "comparison"
    CITATION_LOOKUP = "citation_lookup"
    EXISTENCE_CHECK = "existence_check"
    EXHAUSTIVE_SCAN = "exhaustive_scan"
    PAGE_LOOKUP = "page_lookup"


QueryScope = Literal["single_doc", "collection", "unknown"]
QueryCoverage = Literal["whole_doc", "section", "top_hits", "exhaustive_scan"]


@dataclass(frozen=True)
class QueryRoute:
    """Structured route decision for document chat.

    The first implementation is deterministic and intentionally conservative.
    The schema is broader than M1 needs so later phases can add LLM routing,
    planner output, and tool-specific execution without changing chat contracts.
    """

    primary_intent: QueryIntent
    intents: tuple[QueryIntent, ...]
    scope: QueryScope
    coverage: QueryCoverage
    confidence: float
    needs_decomposition: bool = False
    modality: tuple[str, ...] = ("text",)
    reason: str = ""
    rewritten_queries: tuple[str, ...] = field(default_factory=tuple)
    # Specific page number for positional ("what is on page N") lookups.
    page_ref: int | None = None


_WHOLE_DOCUMENT_MARKERS = (
    # English
    r"\bwhole\s+(document|doc|pdf|paper|report|file)\b",
    r"\bentire\s+(document|doc|pdf|paper|report|file)\b",
    r"\bthis\s+(document|doc|pdf|paper|report|file)\b",
    r"\bthe\s+(document|doc|pdf|paper|report|file)\b",
    # Chinese / Japanese / Korean
    r"(整篇|全文|这篇|本文|整份|这份|整个)(文档|文件|论文|报告|pdf|PDF)?",
    r"(この|本|全体|全文).*(文書|論文|レポート|資料)",
        r"(전체|이)\s*(문서|논문|보고서|자료)",
        # Romance / German common forms
        r"\b(todo|este|el)\s+(documento|pdf|informe|art[ií]culo)\b",
        r"\b(r[eé]sum[eé]|résumé|resumen|zusammenfassung)\b",
        r"\b(dieses|das|gesamte)\s+(dokument|pdf|papier|bericht)\b",
        r"\b(este|todo|o)\s+(documento|relat[oó]rio|pdf|artigo)\b",
        r"\b(questo|intero|il)\s+(documento|pdf|rapporto|articolo)\b",
        r"(المستند|الوثيقة|التقرير|هذا الملف|هذا المستند)",
        r"(इस|पूरे|यह)\s*(दस्तावेज़|दस्तावेज|रिपोर्ट|पीडीएफ)",
)

_SUMMARY_MARKERS = (
    r"\bsummar(y|ize|ise|ise)\b",
    r"\bkey\s+(points|takeaways|findings|ideas|insights)\b",
    r"\bmain\s+(points|idea|ideas|argument|findings|conclusions)\b",
    r"\bexecutive\s+summary\b",
    r"\boverview\b",
    r"\bbrief(ing)?\b",
    r"\btldr\b",
    r"\btl;dr\b",
    r"总结",
    r"概括",
    r"要点",
    r"摘要",
    r"重点",
    r"主要内容",
    r"主旨",
    r"结论",
    r"まとめ",
    r"要約",
    r"概要",
    r"핵심",
    r"요약",
        r"resumen",
        r"résumé",
        r"zusammenfassung",
        r"resuma",
        r"resumo",
        r"riassum",
        r"riassunto",
        r"(لخص|ملخص|تلخيص)",
        r"(सारांश|संक्षेप|सार)",
)

_SECTION_HINTS = (
    r"\b(section|chapter|part|page|pages|risk factors?|methodology|methods?|conclusion|appendix)\b",
    r"(第.+章|第.+节|风险|方法|结论|附录|页面|第.+页)",
)

_TABLE_MARKERS = (
    r"\b(table|tables|spreadsheet|csv|excel|row|rows|column|columns|cell|cells)\b",
    r"\b(amount|metric|revenue|valuation|eps|margin|profit|target\s+price|share\s+price|market\s+cap)\b",
    r"\b(growth|forecast|guidance|ebitda|capex|cash\s+flow|net\s+income|operating\s+income)\b",
    r"[$€£¥]\s?\d|\b\d+(?:[.,]\d+)*(?:%|x|X)\b|\b\d+(?:[.,]\d+)*\s?(percent|million|billion|bn|m|k|rmb|usd|eur)\b",
    r"(表格|数据|数字|金额|收入|估值|利润|利润率|毛利率|目标价|股价|市值|导出|CSV|Excel|行|列|单元格)",
)

_COMPARE_MARKERS = (
    r"\b(compare|contrast|difference|diff|versus|vs\.?|changed?|changes?)\b",
    r"(比较|对比|区别|差异|变化|不同|diff)",
)

_EXISTENCE_MARKERS = (
    r"\b(is there|are there|does it mention|whether|if there is|contains?)\b",
    r"(有没有|是否|是不是|是否提到|是否包含|有无)",
)

_EXHAUSTIVE_MARKERS = (
    r"\b(all|every|list all|find all|extract all)\b",
    r"(所有|全部|每个|列出全部|找出所有|提取所有)",
)

_CITATION_MARKERS = (
    r"\b(where|which page|quote|source|citation|cite|original text|verbatim)\b",
    r"(在哪页|原文|引用|出处|来源|定位|高亮)",
)


# Positional "what is on page N" detection across DocTalk locales (+ Czech, the
# paying user's language). Pure semantic top-k can't resolve a page number, so a
# specific page reference routes to a direct Page.content lookup (B4).
_PAGE_REF_PATTERNS = (
    # Latin scripts: page-word then number — page 350 / página 12 / seite 5 /
    # straně 350 (cs) / pag. 7 / str. 7
    re.compile(
        r"\b(?:pages?|pg|p\.|p[áa]ginas?|p[áa]g\.?|seiten?|stran\w{0,4}|str\.)"
        r"\s*[:#nº\.]*\s*(\d{1,4})",
        re.IGNORECASE,
    ),
    # Arabic / Hindi page words
    re.compile(r"(?:صفحة|الصفحة|पृष्ठ|पेज)\s*[:#]?\s*(\d{1,4})"),
    # CJK: 第N页 / N页 / N頁 / Nページ / N쪽 / N페이지
    re.compile(r"第\s*(\d{1,4})\s*[页頁]"),
    re.compile(r"(\d{1,4})\s*(?:页|頁|ページ|쪽|페이지)"),
)


def _detect_page_ref(text: str) -> int | None:
    for pattern in _PAGE_REF_PATTERNS:
        match = pattern.search(text)
        if not match:
            continue
        try:
            page = int(match.group(1))
        except (TypeError, ValueError, IndexError):
            continue
        if 1 <= page <= 9999:
            return page
    return None


# Generic words that don't make a page query "about a topic": question lead-ins,
# articles/prepositions, "show me", "content", and document words — multilingual.
_PAGE_LOOKUP_FILLER = re.compile(
    r"\b(what|whats|what's|which|is|are|was|on|in|at|the|a|an|this|that|here|show|me|my|"
    r"give|get|see|go|to|from|open|tell|us|of|for|please|display|read|view|whole|entire|"
    r"content|contents|text|say|says|there|"
    r"document|documents|doc|docs|pdf|file|files|"
    r"que|qu[ée]|hay|en|la|el|los|las|del|de|muestra|dame|documento|archivo|p[áa]gina|"
    r"co|je|na|ve?|str[aá]n\w*|dokument\w*|"
    r"seite|der|die|das|im|dokument|datei|"
    r"内容|有什么|是什么|什么|这|那|在|里|上|的|看|显示|打开|文档|文件|页|頁|ページ|쪽|페이지|"
    r"page|pages|pg)\b",
    re.IGNORECASE,
)


def _strip_filler_keep_acronyms(match: re.Match) -> str:
    """Strip a filler word — UNLESS it's written as an all-caps Latin acronym
    (≥2 letters, e.g. US / IN / DE / LA / CO). Those collide with lowercase filler
    words ("us", "in", "de", "la", "co") under IGNORECASE, but as acronyms they are
    real topics; erasing them would falsely mark "US on page 12" as a pure page lookup
    and suppress its semantic fallback. Title-case ("What") and lowercase stay filler;
    CJK filler (never ASCII) is always stripped, as before.
    """
    token = match.group(0)
    if token.isascii() and token.isalpha() and token.isupper() and len(token) >= 2:
        return token
    return " "


def _is_pure_page_query(text: str, page_ref: int) -> bool:
    """True when the query is essentially JUST a page reference ("what is on page N",
    "page N of the document"), with NO semantic topic. A page+topic query — even a short
    one like "AI on page 12" or "Q3 on page 5" — is NOT pure and must keep its
    semantic-retrieval fallback if the exact page chunk is missing. We bias toward
    "mixed" (any leftover content token → not pure) because a false "pure" wrongly
    suppresses the fallback, whereas a false "mixed" only adds a harmless fallback.
    """
    residue = text
    for pat in _PAGE_REF_PATTERNS:
        residue = pat.sub(" ", residue)
    residue = re.sub(rf"\b0*{page_ref}\b", " ", residue)
    residue = _PAGE_LOOKUP_FILLER.sub(_strip_filler_keep_acronyms, residue)
    # Any remaining alphanumeric / CJK token is a topic → not a pure page lookup.
    return not re.findall(r"[0-9A-Za-zÀ-￿]+", residue)


def _matches_any(text: str, patterns: tuple[str, ...]) -> bool:
    return any(re.search(pattern, text, flags=re.IGNORECASE) for pattern in patterns)


def _route_scope(*, is_collection: bool) -> QueryScope:
    return "collection" if is_collection else "single_doc"


class QueryRouter:
    def route(
        self,
        query: str,
        *,
        is_collection: bool = False,
        domain_mode: str | None = None,
    ) -> QueryRoute:
        normalized = " ".join((query or "").strip().split())
        if not normalized:
            return QueryRoute(
                primary_intent=QueryIntent.LOCAL_QA,
                intents=(QueryIntent.LOCAL_QA,),
                scope=_route_scope(is_collection=is_collection),
                coverage="top_hits",
                confidence=0.2,
                reason="empty query",
            )

        intents: list[QueryIntent] = []
        modality = {"text"}
        needs_decomposition = False
        coverage: QueryCoverage = "top_hits"
        confidence = 0.6
        reason = "default local question"

        has_summary = _matches_any(normalized, _SUMMARY_MARKERS)
        has_whole_doc = _matches_any(normalized, _WHOLE_DOCUMENT_MARKERS)
        has_section = _matches_any(normalized, _SECTION_HINTS)
        has_table = _matches_any(normalized, _TABLE_MARKERS)
        has_compare = _matches_any(normalized, _COMPARE_MARKERS)
        has_existence = _matches_any(normalized, _EXISTENCE_MARKERS)
        has_exhaustive = _matches_any(normalized, _EXHAUSTIVE_MARKERS)
        has_citation = _matches_any(normalized, _CITATION_MARKERS)

        page_ref = _detect_page_ref(normalized)
        has_page_lookup = page_ref is not None and not has_summary and not has_exhaustive
        # A "pure" page lookup is just a page reference with no semantic topic
        # ("what is on page N"). Page+topic ("requirements on page 12") is NOT pure —
        # it must keep its semantic-retrieval fallback on a page-chunk miss.
        pure_page = has_page_lookup and _is_pure_page_query(normalized, page_ref)

        # Short-circuit only for a PURE page lookup with no table/comparison intent.
        if pure_page and not has_table and not has_compare:
            return QueryRoute(
                primary_intent=QueryIntent.PAGE_LOOKUP,
                intents=(QueryIntent.PAGE_LOOKUP,),
                scope=_route_scope(is_collection=is_collection),
                coverage="section",
                confidence=0.9,
                reason="specific page reference",
                rewritten_queries=(normalized,),
                page_ref=page_ref,
            )

        if has_summary and has_whole_doc and not has_section:
            intents.append(QueryIntent.DOCUMENT_SUMMARY)
            coverage = "whole_doc"
            confidence = 0.92
            reason = "whole-document summary markers"
        elif has_summary and not has_section and not has_table and not has_compare:
            intents.append(QueryIntent.DOCUMENT_SUMMARY)
            coverage = "whole_doc"
            confidence = 0.78
            reason = "generic summary marker in document chat"
        elif has_summary and has_section:
            intents.append(QueryIntent.SECTION_SUMMARY)
            coverage = "section"
            confidence = 0.82
            reason = "section summary markers"

        if has_table:
            intents.append(QueryIntent.TABLE_QUERY)
            modality.add("table")
            confidence = max(confidence, 0.78)
            reason = "table or numeric markers" if not intents else reason

        if has_compare or (is_collection and has_summary):
            intents.append(QueryIntent.COMPARISON)
            needs_decomposition = True
            confidence = max(confidence, 0.76)
            reason = "comparison or collection synthesis markers" if not intents else reason

        if has_existence:
            intents.append(QueryIntent.EXISTENCE_CHECK)
            coverage = "exhaustive_scan"
            confidence = max(confidence, 0.75)
            reason = "existence-check markers" if not intents else reason

        if has_exhaustive:
            intents.append(QueryIntent.EXHAUSTIVE_SCAN)
            coverage = "exhaustive_scan"
            confidence = max(confidence, 0.8)
            reason = "exhaustive scan markers" if not intents else reason

        if has_citation:
            intents.append(QueryIntent.CITATION_LOOKUP)
            confidence = max(confidence, 0.74)
            reason = "citation lookup markers" if not intents else reason

        if has_page_lookup:
            intents.insert(0, QueryIntent.PAGE_LOOKUP)
            coverage = "section"
            confidence = max(confidence, 0.9)
            reason = "specific page reference" if reason == "default local question" else reason
            # Page+topic (not pure) must carry LOCAL_QA so the chat layer knows it has a
            # semantic target and keeps the fallback when the exact page chunk is missing.
            if not pure_page and QueryIntent.LOCAL_QA not in intents:
                intents.append(QueryIntent.LOCAL_QA)

        if not intents:
            intents.append(QueryIntent.LOCAL_QA)

        primary = intents[0]
        if has_page_lookup:
            primary = QueryIntent.PAGE_LOOKUP
        elif QueryIntent.DOCUMENT_SUMMARY in intents:
            primary = QueryIntent.DOCUMENT_SUMMARY
        elif QueryIntent.SECTION_SUMMARY in intents:
            primary = QueryIntent.SECTION_SUMMARY
        elif QueryIntent.COMPARISON in intents and is_collection:
            primary = QueryIntent.COMPARISON
        elif QueryIntent.TABLE_QUERY in intents and not has_summary:
            primary = QueryIntent.TABLE_QUERY

        if domain_mode in {"legal", "academic"} and QueryIntent.EXISTENCE_CHECK in intents:
            coverage = "exhaustive_scan"
            confidence = max(confidence, 0.8)

        deduped = tuple(dict.fromkeys(intents))
        return QueryRoute(
            primary_intent=primary,
            intents=deduped,
            scope=_route_scope(is_collection=is_collection),
            coverage=coverage,
            confidence=min(confidence, 0.99),
            needs_decomposition=needs_decomposition,
            modality=tuple(sorted(modality)),
            reason=reason,
            rewritten_queries=(normalized,),
            page_ref=page_ref if has_page_lookup else None,
        )


query_router = QueryRouter()
