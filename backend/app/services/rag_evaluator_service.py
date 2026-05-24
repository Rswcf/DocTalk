from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Literal

from app.services.query_router import QueryIntent, QueryRoute

RetrievalStatus = Literal["sufficient", "weak", "empty"]


_LATIN_TOKEN_RE = re.compile(r"[a-zA-Z][a-zA-Z0-9_\-]{2,}")
_NUMBER_TOKEN_RE = re.compile(r"\b\d+(?:[.,]\d+)*(?:%|x|X)?\b")
_CJK_RE = re.compile(r"[\u4e00-\u9fff]")
_QUOTED_PHRASE_RE = re.compile(r"[\"'“”‘’]([^\"'“”‘’]{3,80})[\"'“”‘’]")

_STOPWORDS = {
    "about",
    "after",
    "again",
    "against",
    "also",
    "answer",
    "any",
    "are",
    "based",
    "can",
    "chapter",
    "contain",
    "contains",
    "could",
    "document",
    "does",
    "each",
    "every",
    "file",
    "find",
    "from",
    "give",
    "have",
    "here",
    "into",
    "list",
    "main",
    "mention",
    "page",
    "paper",
    "pdf",
    "please",
    "point",
    "points",
    "question",
    "report",
    "section",
    "show",
    "summarize",
    "summary",
    "table",
    "tell",
    "that",
    "the",
    "their",
    "there",
    "these",
    "this",
    "those",
    "what",
    "when",
    "where",
    "which",
    "with",
    "是否",
    "有没有",
    "哪些",
    "总结",
    "文档",
    "文件",
    "报告",
    "论文",
    "这篇",
    "这份",
    "这个",
}


@dataclass(frozen=True)
class QueryEvidenceTerms:
    lexical_terms: tuple[str, ...]
    exact_terms: tuple[str, ...]


@dataclass(frozen=True)
class RetrievalEvaluation:
    status: RetrievalStatus
    reason: str
    best_score: float
    query_terms: tuple[str, ...]
    matched_terms: tuple[str, ...]
    missing_terms: tuple[str, ...]
    should_correct: bool
    prompt_note: str


def _dedupe_preserve_order(values: list[str], *, limit: int) -> tuple[str, ...]:
    seen: set[str] = set()
    out: list[str] = []
    for value in values:
        normalized = value.strip()
        key = normalized.lower()
        if not normalized or key in seen:
            continue
        seen.add(key)
        out.append(normalized)
        if len(out) >= limit:
            break
    return tuple(out)


def extract_query_terms(query: str, *, limit: int = 10) -> QueryEvidenceTerms:
    """Extract evidence-bearing search terms from a user query.

    This intentionally favors exact identifiers, numbers, short phrases, and CJK
    bigrams over generic instruction words such as "summarize" or "document".
    """

    text = " ".join((query or "").split())
    if not text:
        return QueryEvidenceTerms(lexical_terms=(), exact_terms=())

    exact_candidates: list[str] = []
    exact_candidates.extend(match.group(1).strip() for match in _QUOTED_PHRASE_RE.finditer(text))
    exact_candidates.extend(_NUMBER_TOKEN_RE.findall(text))
    # Preserve mixed-case/product identifiers like MetaX, S-01, NET-30.
    exact_candidates.extend(
        token for token in re.findall(r"\b[A-Za-z]+[A-Za-z0-9_-]*\d+[A-Za-z0-9_-]*\b|\b[A-Z][A-Za-z]+[A-Z][A-Za-z0-9_-]*\b", text)
        if token.lower() not in _STOPWORDS
    )

    lexical_candidates: list[str] = []
    for token in _LATIN_TOKEN_RE.findall(text):
        lowered = token.lower()
        if lowered in _STOPWORDS or lowered.isdigit():
            continue
        lexical_candidates.append(token)

    cjk_chars = _CJK_RE.findall(text)
    for index in range(len(cjk_chars) - 1):
        bigram = cjk_chars[index] + cjk_chars[index + 1]
        if bigram not in _STOPWORDS:
            lexical_candidates.append(bigram)

    exact_terms = _dedupe_preserve_order(exact_candidates, limit=limit)
    lexical_terms = _dedupe_preserve_order([*exact_terms, *lexical_candidates], limit=limit)
    return QueryEvidenceTerms(lexical_terms=lexical_terms, exact_terms=exact_terms)


def _result_text(result: dict) -> str:
    return " ".join(
        str(part or "")
        for part in (
            result.get("section_title"),
            result.get("text"),
            result.get("document_filename"),
        )
    ).lower()


def _matched_terms(terms: tuple[str, ...], results: list[dict]) -> tuple[str, ...]:
    if not terms or not results:
        return ()
    haystack = "\n".join(_result_text(result) for result in results)
    return tuple(term for term in terms if term.lower() in haystack)


def _prompt_note(status: RetrievalStatus, reason: str, *, corrected: bool, route: QueryRoute) -> str:
    coverage_note = ""
    if route.coverage == "exhaustive_scan":
        coverage_note = (
            "The user asked for broad or existence-style coverage. Treat the sources as the searched evidence set, "
            "state limits clearly, and do not infer beyond cited text."
        )
    elif QueryIntent.TABLE_QUERY in route.intents:
        coverage_note = (
            "The user is asking about tables, figures, or metrics; prioritize structured table evidence, preserve row labels, "
            "units, periods, and currencies exactly, and cite the supporting source for each numeric claim."
        )
    elif QueryIntent.CITATION_LOOKUP in route.intents:
        coverage_note = "The user is asking for source location or quotation; prioritize exact cited evidence over broad explanation."

    if status == "empty":
        base = "No relevant document sources were found for this query. Say that the document evidence was not found instead of guessing."
    elif status == "weak":
        base = "Retrieved evidence may be incomplete or weak. Answer only what the cited sources support and call out missing evidence."
    else:
        base = "Retrieved evidence appears adequate. Keep every factual claim tied to the cited sources."

    correction_note = " Corrective lexical retrieval was applied." if corrected else ""
    return " ".join(part for part in (base, coverage_note, correction_note) if part).strip()


class RAGEvaluatorService:
    def evaluate(
        self,
        query: str,
        results: list[dict],
        route: QueryRoute,
        *,
        corrected: bool = False,
    ) -> RetrievalEvaluation:
        terms = extract_query_terms(query)
        query_terms = terms.lexical_terms
        exact_terms = terms.exact_terms
        matched = _matched_terms(query_terms, results)
        missing = tuple(term for term in query_terms if term not in matched)
        matched_exact = _matched_terms(exact_terms, results)
        best_score = max((float(result.get("score") or 0.0) for result in results), default=0.0)

        if not results:
            status: RetrievalStatus = "empty"
            reason = "no_retrieved_excerpts"
        elif exact_terms and len(matched_exact) < len(exact_terms):
            status = "weak"
            reason = "exact_terms_missing"
        elif route.coverage == "exhaustive_scan" and len(results) < 6:
            status = "weak"
            reason = "exhaustive_query_undercovered"
        elif query_terms and len(matched) == 0 and best_score < 0.45:
            status = "weak"
            reason = "low_score_no_term_overlap"
        elif best_score < 0.22:
            status = "weak"
            reason = "low_vector_score"
        else:
            status = "sufficient"
            reason = "evidence_sufficient"

        should_correct = status in {"empty", "weak"} or route.coverage == "exhaustive_scan" or any(
            intent in route.intents
            for intent in (QueryIntent.TABLE_QUERY, QueryIntent.CITATION_LOOKUP, QueryIntent.EXISTENCE_CHECK)
        )

        return RetrievalEvaluation(
            status=status,
            reason=reason,
            best_score=best_score,
            query_terms=query_terms,
            matched_terms=matched,
            missing_terms=missing,
            should_correct=should_correct and not corrected,
            prompt_note=_prompt_note(status, reason, corrected=corrected, route=route),
        )


rag_evaluator_service = RAGEvaluatorService()
