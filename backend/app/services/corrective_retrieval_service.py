from __future__ import annotations

import uuid
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.query_planner_service import (
    QueryPlan,
    QueryPlanStep,
    query_planner_service,
)
from app.services.query_router import QueryIntent, QueryRoute
from app.services.rag_evaluator_service import (
    RetrievalEvaluation,
    rag_evaluator_service,
)
from app.services.retrieval_service import retrieval_service

RetrievalStrategy = str


@dataclass(frozen=True)
class CorrectiveRetrievalResult:
    retrieved: list[dict]
    evaluation: RetrievalEvaluation
    strategy: RetrievalStrategy
    plan: QueryPlan | None = None


def _merge_results(primary: list[dict], secondary: list[dict], *, top_k: int) -> list[dict]:
    merged: list[dict] = []
    seen: set[str] = set()

    def add_items(items: list[dict]) -> None:
        for item in items:
            dedupe_key = str(item.get("table_id") or item.get("chunk_id") or "")
            if not dedupe_key or dedupe_key in seen:
                continue
            seen.add(dedupe_key)
            merged.append(item)

    add_items(primary)
    add_items(secondary)
    return merged[: int(top_k or 8)]


def _strategy_name(
    *,
    initial: list[dict],
    table_evidence: list[dict],
    balanced: list[dict],
    planned: list[dict],
    lexical: list[dict],
    lexical_attempted: bool = False,
) -> RetrievalStrategy:
    parts: list[str] = []
    if initial:
        parts.append("semantic_top_k")
    if table_evidence:
        parts.append("table_evidence")
    if balanced:
        parts.append("balanced_compare")
    if planned:
        parts.append("planned_multi_hop")
    if lexical or lexical_attempted:
        parts.append("lexical_correction")
    return "+".join(parts) if parts else "semantic_top_k"


def _annotate_step(items: list[dict], step: QueryPlanStep) -> list[dict]:
    annotated: list[dict] = []
    for item in items:
        copied = dict(item)
        copied["retrieval_plan_step"] = step.label
        copied["retrieval_plan_purpose"] = step.purpose
        annotated.append(copied)
    return annotated


def _annotate_doc(items: list[dict], document_id: uuid.UUID, *, label: str, purpose: str) -> list[dict]:
    annotated: list[dict] = []
    for item in items:
        copied = dict(item)
        copied["document_id"] = copied.get("document_id") or document_id
        copied["retrieval_plan_step"] = label
        copied["retrieval_plan_purpose"] = purpose
        annotated.append(copied)
    return annotated


def _dynamic_k(
    base_top_k: int,
    *,
    page_count: int | None = None,
    chunks_total: int | None = None,
    is_collection: bool = False,
) -> int:
    """Scale retrieval/merge breadth with document size (B2).

    Production review (2026-05-23): a 492-page PDF was answered from ~8-12 chunks
    regardless of size. The floor preserves prior behaviour (12 single / 14
    collection) when size is unknown; large documents get a higher ceiling.
    """
    floor = 14 if is_collection else 12
    ceil = 28 if is_collection else 24
    k = max(int(base_top_k or 8), floor)
    pages = int(page_count or 0)
    if pages > 0:
        k = max(k, min(ceil, floor + pages // 40))
    chunks = int(chunks_total or 0)
    if chunks > 0:
        k = max(k, min(ceil, floor + chunks // 60))
    return min(k, ceil)


def _rrf_fuse(result_lists: list[list[dict]], *, top_k: int, k: int = 60) -> list[dict]:
    """Reciprocal Rank Fusion of several ranked lists (B1 hybrid fusion).

    Items ranked highly across multiple retrievers (dense, lexical, planned) rise
    to the top. Dedupe by table_id/chunk_id; keep the first-seen payload.
    """
    scores: dict[str, float] = {}
    best: dict[str, dict] = {}
    for items in result_lists:
        for rank, item in enumerate(items):
            key = str(item.get("table_id") or item.get("chunk_id") or "")
            if not key:
                continue
            scores[key] = scores.get(key, 0.0) + 1.0 / (k + rank + 1)
            best.setdefault(key, item)

    def _key(it: dict) -> str:
        return str(it.get("table_id") or it.get("chunk_id") or "")

    ranked = sorted(best.values(), key=lambda it: scores[_key(it)], reverse=True)
    return ranked[: int(top_k or 8)]


def _plan_limit(
    top_k: int,
    *,
    is_collection: bool = False,
    page_count: int | None = None,
    chunks_total: int | None = None,
) -> int:
    return _dynamic_k(
        top_k, page_count=page_count, chunks_total=chunks_total, is_collection=is_collection
    )


class CorrectiveRetrievalService:
    async def _planned_single(
        self,
        plan: QueryPlan,
        route: QueryRoute,
        document_id: uuid.UUID,
        *,
        db: AsyncSession,
    ) -> list[dict]:
        if not plan.is_active:
            return []
        is_table_query = QueryIntent.TABLE_QUERY in route.intents
        planned: list[dict] = []
        for step in plan.steps[1:]:
            if is_table_query:
                table_items = await retrieval_service.table_search(
                    step.query,
                    document_id,
                    top_k=2,
                    db=db,
                )
                planned = _merge_results(planned, _annotate_step(table_items, step), top_k=_plan_limit(8))
            semantic = await retrieval_service.search(step.query, document_id, top_k=2, db=db)
            planned = _merge_results(planned, _annotate_step(semantic, step), top_k=_plan_limit(8))
            lexical = await retrieval_service.lexical_search(
                step.query,
                document_id,
                top_k=2,
                db=db,
                min_text_len=20 if is_table_query else 200,
            )
            planned = _merge_results(planned, _annotate_step(lexical, step), top_k=_plan_limit(8))
        return planned

    async def _planned_multi(
        self,
        query: str,
        plan: QueryPlan,
        route: QueryRoute,
        document_ids: list[uuid.UUID],
        *,
        db: AsyncSession,
    ) -> tuple[list[dict], list[dict], list[dict]]:
        if not plan.is_active:
            return [], [], []
        is_table_query = QueryIntent.TABLE_QUERY in route.intents
        planned: list[dict] = []
        for step in plan.steps[1:]:
            if is_table_query:
                table_items = await retrieval_service.table_search_multi(
                    step.query,
                    document_ids,
                    top_k=3,
                    db=db,
                )
                planned = _merge_results(planned, _annotate_step(table_items, step), top_k=_plan_limit(8, is_collection=True))
            semantic = await retrieval_service.search_multi(step.query, document_ids, top_k=3, db=db)
            planned = _merge_results(planned, _annotate_step(semantic, step), top_k=_plan_limit(8, is_collection=True))
            lexical = await retrieval_service.lexical_search_multi(
                step.query,
                document_ids,
                top_k=3,
                db=db,
                min_text_len=20 if is_table_query else 200,
            )
            planned = _merge_results(planned, _annotate_step(lexical, step), top_k=_plan_limit(8, is_collection=True))

        balanced_required: list[dict] = []
        balanced_extra: list[dict] = []
        if plan.needs_balanced_coverage:
            for index, document_id in enumerate(document_ids[:8], start=1):
                label = f"balanced-doc-{index}"
                semantic = await retrieval_service.search(query, document_id, top_k=2, db=db)
                annotated = _annotate_doc(
                    semantic,
                    document_id,
                    label=label,
                    purpose="per-document-comparison-coverage",
                )
                if annotated:
                    balanced_required.append(annotated[0])
                    balanced_extra.extend(annotated[1:])
        return planned, balanced_required, balanced_extra

    async def retrieve_single(
        self,
        query: str,
        route: QueryRoute,
        document_id: uuid.UUID,
        *,
        top_k: int,
        db: AsyncSession,
        doc_pages: int | None = None,
    ) -> CorrectiveRetrievalResult:
        plan = query_planner_service.plan(query, route, document_count=1)
        wide_k = _dynamic_k(top_k, page_count=doc_pages)
        initial = await retrieval_service.search(query, document_id, top_k=wide_k, db=db)
        initial_eval = rag_evaluator_service.evaluate(query, initial, route)
        is_table_query = QueryIntent.TABLE_QUERY in route.intents
        is_plain_qa_route = (
            route.primary_intent == QueryIntent.LOCAL_QA
            and route.coverage == "top_hits"
            and not is_table_query
        )
        table_evidence = (
            await retrieval_service.table_search(query, document_id, top_k=6, db=db)
            if is_table_query
            else []
        )
        planned = await self._planned_single(plan, route, document_id, db=db)
        if not initial_eval.should_correct and not table_evidence and not planned and not is_plain_qa_route:
            return CorrectiveRetrievalResult(
                retrieved=initial,
                evaluation=initial_eval,
                strategy="semantic_top_k",
                plan=plan,
            )

        should_run_lexical = initial_eval.should_correct or is_table_query or is_plain_qa_route
        lexical_top_k = wide_k
        if is_plain_qa_route and not initial_eval.should_correct and not is_table_query:
            lexical_top_k = min(6, max(3, int(top_k or 8)))
        elif route.coverage == "exhaustive_scan":
            lexical_top_k = max(lexical_top_k, 12)
        lexical = (
            await retrieval_service.lexical_search(
                query,
                document_id,
                top_k=lexical_top_k,
                db=db,
                min_text_len=20 if is_table_query else 200,
            )
            if should_run_lexical
            else []
        )
        result_limit = _plan_limit(max(wide_k, lexical_top_k), page_count=doc_pages)
        merged = _merge_results(table_evidence, initial, top_k=result_limit) if table_evidence else initial[:result_limit]
        merged = _merge_results(merged, planned, top_k=result_limit)
        merged = _merge_results(merged, lexical, top_k=result_limit)
        # Plain QA (no table/exhaustive/comparison priority): re-rank by RRF so
        # chunks ranked highly across dense+lexical+planned rise to the top.
        if is_plain_qa_route:
            fused = _rrf_fuse([initial, planned, lexical], top_k=result_limit)
            if fused:
                merged = fused
        strategy = _strategy_name(
            initial=initial,
            table_evidence=table_evidence,
            balanced=[],
            planned=planned,
            lexical=lexical,
            lexical_attempted=initial_eval.should_correct or is_table_query,
        )
        final_eval = rag_evaluator_service.evaluate(query, merged, route, corrected=True)
        return CorrectiveRetrievalResult(retrieved=merged, evaluation=final_eval, strategy=strategy, plan=plan)

    async def retrieve_multi(
        self,
        query: str,
        route: QueryRoute,
        document_ids: list[uuid.UUID],
        *,
        top_k: int,
        db: AsyncSession,
        doc_pages: int | None = None,
    ) -> CorrectiveRetrievalResult:
        plan = query_planner_service.plan(query, route, document_count=len(document_ids))
        initial = await retrieval_service.search_multi(query, document_ids, top_k=top_k, db=db)
        initial_eval = rag_evaluator_service.evaluate(query, initial, route)
        is_table_query = QueryIntent.TABLE_QUERY in route.intents
        table_evidence = (
            await retrieval_service.table_search_multi(query, document_ids, top_k=8, db=db)
            if is_table_query
            else []
        )
        planned, balanced_required, balanced_extra = await self._planned_multi(query, plan, route, document_ids, db=db)
        balanced_all = [*balanced_required, *balanced_extra]
        if not initial_eval.should_correct and not table_evidence and not planned and not balanced_all:
            return CorrectiveRetrievalResult(
                retrieved=initial,
                evaluation=initial_eval,
                strategy="semantic_top_k",
                plan=plan,
            )

        lexical_top_k = max(top_k, 14 if route.coverage == "exhaustive_scan" else top_k)
        should_run_lexical = initial_eval.should_correct or is_table_query
        lexical = (
            await retrieval_service.lexical_search_multi(
                query,
                document_ids,
                top_k=lexical_top_k,
                db=db,
                min_text_len=20 if is_table_query else 200,
            )
            if should_run_lexical
            else []
        )
        result_limit = _plan_limit(max(top_k, lexical_top_k), is_collection=True, page_count=doc_pages)
        merged = (
            _merge_results(balanced_required, table_evidence, top_k=result_limit)
            if balanced_required
            else table_evidence[:result_limit]
        )
        merged = _merge_results(merged, balanced_extra, top_k=result_limit)
        merged = _merge_results(merged, initial, top_k=result_limit)
        merged = _merge_results(merged, planned, top_k=result_limit)
        merged = _merge_results(merged, lexical, top_k=result_limit)
        strategy = _strategy_name(
            initial=initial,
            table_evidence=table_evidence,
            balanced=balanced_all,
            planned=planned,
            lexical=lexical,
            lexical_attempted=should_run_lexical,
        )
        final_eval = rag_evaluator_service.evaluate(query, merged, route, corrected=True)
        return CorrectiveRetrievalResult(retrieved=merged, evaluation=final_eval, strategy=strategy, plan=plan)


corrective_retrieval_service = CorrectiveRetrievalService()
