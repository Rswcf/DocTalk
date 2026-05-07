from __future__ import annotations

import re
from dataclasses import dataclass

from app.services.query_router import QueryIntent, QueryRoute


@dataclass(frozen=True)
class QueryPlanStep:
    label: str
    query: str
    purpose: str


@dataclass(frozen=True)
class QueryPlan:
    steps: tuple[QueryPlanStep, ...]
    needs_balanced_coverage: bool
    reason: str

    @property
    def is_active(self) -> bool:
        return len(self.steps) > 1 or self.needs_balanced_coverage


_MAX_PLAN_STEPS = 6
_CAPITALIZED_ENTITY_RE = re.compile(
    r"\b(?:[A-Z][A-Za-z0-9&.\-]*(?:\s+[A-Z][A-Za-z0-9&.\-]*){0,3})\b"
)
_COMPARE_SPLIT_RE = re.compile(
    r"\b(?:vs\.?|versus|compared\s+with|compared\s+to|against)\b|(?:和|与| versus )",
    flags=re.IGNORECASE,
)
_METRIC_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("revenue", re.compile(r"\brevenue|sales|收入|营收\b", flags=re.IGNORECASE)),
    ("profit", re.compile(r"\bprofit|net\s+income|operating\s+income|利润|净利润\b", flags=re.IGNORECASE)),
    ("margin", re.compile(r"\bmargin|gross\s+margin|operating\s+margin|利润率|毛利率\b", flags=re.IGNORECASE)),
    ("target-price", re.compile(r"\btarget\s+price|price\s+target|目标价\b", flags=re.IGNORECASE)),
    ("valuation", re.compile(r"\bvaluation|market\s+cap|p/s|p/e|估值|市值\b", flags=re.IGNORECASE)),
    ("eps", re.compile(r"\beps|earnings\s+per\s+share|每股收益\b", flags=re.IGNORECASE)),
    ("guidance", re.compile(r"\bguidance|forecast|outlook|指引|预测\b", flags=re.IGNORECASE)),
    ("risk", re.compile(r"\brisk|risks|downside|风险\b", flags=re.IGNORECASE)),
    ("methodology", re.compile(r"\bmethod|methodology|approach|方法|方法论\b", flags=re.IGNORECASE)),
    ("conclusion", re.compile(r"\bconclusion|finding|findings|takeaway|结论|发现\b", flags=re.IGNORECASE)),
)
_ENTITY_STOPWORDS = {
    "Compare",
    "Contrast",
    "Difference",
    "Differences",
    "What",
    "Which",
    "Does",
    "Do",
    "Did",
    "Is",
    "Are",
    "Was",
    "Were",
    "Who",
    "Why",
    "How",
    "When",
    "Where",
    "This",
    "These",
    "Document",
    "PDF",
    "Table",
    "Revenue",
    "Profit",
    "Margin",
    "Target Price",
    "Summary",
    "Executive Summary",
}


def _normalize_query(query: str) -> str:
    return " ".join((query or "").strip().split())


def _dedupe_preserve_order(values: list[str]) -> list[str]:
    seen: set[str] = set()
    deduped: list[str] = []
    for value in values:
        key = value.lower()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(value)
    return deduped


def _extract_entities(query: str) -> list[str]:
    entities: list[str] = []
    for match in _CAPITALIZED_ENTITY_RE.finditer(query):
        candidate = match.group(0).strip(" ,.;:!?()[]{}")
        candidate = re.sub(r"^(Compare|Contrast|Differences?|Which|What)\s+", "", candidate).strip()
        if len(candidate) < 2 or candidate in _ENTITY_STOPWORDS:
            continue
        if candidate.lower() in {item.lower() for item in _ENTITY_STOPWORDS}:
            continue
        entities.append(candidate)
    return _dedupe_preserve_order(entities)[:4]


def _extract_metrics(query: str) -> list[str]:
    metrics: list[str] = []
    for label, pattern in _METRIC_PATTERNS:
        if pattern.search(query):
            metrics.append(label)
    return metrics[:3]


def _split_compare_sides(query: str) -> list[str]:
    parts = [part.strip(" ,.;:!?()[]{}") for part in _COMPARE_SPLIT_RE.split(query) if part.strip()]
    if len(parts) < 2:
        return []
    cleaned: list[str] = []
    for part in parts:
        if len(part) < 2:
            continue
        cleaned.append(part[:120])
    return _dedupe_preserve_order(cleaned)[:3]


def _add_step(steps: list[QueryPlanStep], *, label: str, query: str, purpose: str) -> None:
    cleaned = _normalize_query(query)
    if not cleaned:
        return
    if any(step.query.lower() == cleaned.lower() for step in steps):
        return
    if len(steps) >= _MAX_PLAN_STEPS:
        return
    steps.append(QueryPlanStep(label=label, query=cleaned, purpose=purpose))


class QueryPlannerService:
    def plan(self, query: str, route: QueryRoute, *, document_count: int = 1) -> QueryPlan:
        normalized = _normalize_query(query)
        if not normalized:
            return QueryPlan(steps=(), needs_balanced_coverage=False, reason="empty")

        is_comparison = QueryIntent.COMPARISON in route.intents or route.needs_decomposition
        is_table = QueryIntent.TABLE_QUERY in route.intents
        is_exhaustive = QueryIntent.EXHAUSTIVE_SCAN in route.intents or route.coverage == "exhaustive_scan"
        entities = _extract_entities(normalized)
        metrics = _extract_metrics(normalized)
        compare_sides = _split_compare_sides(normalized) if is_comparison else []

        needs_planning = (
            is_comparison
            or is_exhaustive
            or (is_table and (len(entities) >= 2 or len(metrics) >= 2))
            or (len(entities) >= 2 and len(metrics) >= 1)
        )
        needs_balanced_coverage = bool(is_comparison and document_count > 1)
        if not needs_planning and not needs_balanced_coverage:
            return QueryPlan(
                steps=(QueryPlanStep(label="direct", query=normalized, purpose="direct-answer"),),
                needs_balanced_coverage=False,
                reason="direct",
            )

        steps: list[QueryPlanStep] = []
        _add_step(steps, label="direct", query=normalized, purpose="direct-answer")

        for idx, side in enumerate(compare_sides, start=1):
            _add_step(
                steps,
                label=f"comparison-side-{idx}",
                query=side,
                purpose="comparison-side-coverage",
            )

        if entities and metrics:
            for entity in entities:
                metric_text = " ".join(metrics)
                _add_step(
                    steps,
                    label="entity-metric",
                    query=f"{entity} {metric_text}",
                    purpose="entity-metric-coverage",
                )
        elif entities:
            for entity in entities:
                _add_step(
                    steps,
                    label="entity",
                    query=entity,
                    purpose="entity-coverage",
                )
        elif metrics:
            for metric in metrics:
                _add_step(
                    steps,
                    label="metric",
                    query=metric,
                    purpose="metric-coverage",
                )

        if is_exhaustive:
            _add_step(
                steps,
                label="exhaustive",
                query=normalized,
                purpose="broad-scan-coverage",
            )

        reason = "comparison" if is_comparison else "multi-hop"
        if needs_balanced_coverage:
            reason = f"{reason}+balanced-doc-coverage"
        return QueryPlan(
            steps=tuple(steps),
            needs_balanced_coverage=needs_balanced_coverage,
            reason=reason,
        )


query_planner_service = QueryPlannerService()
