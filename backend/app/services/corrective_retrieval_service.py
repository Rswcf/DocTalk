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


def _plan_limit(top_k: int, *, is_collection: bool = False) -> int:
    return max(int(top_k or 8), 14 if is_collection else 12)


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
    ) -> CorrectiveRetrievalResult:
        plan = query_planner_service.plan(query, route, document_count=1)
        initial = await retrieval_service.search(query, document_id, top_k=top_k, db=db)
        initial_eval = rag_evaluator_service.evaluate(query, initial, route)
        is_table_query = QueryIntent.TABLE_QUERY in route.intents
        table_evidence = (
            await retrieval_service.table_search(query, document_id, top_k=6, db=db)
            if is_table_query
            else []
        )
        planned = await self._planned_single(plan, route, document_id, db=db)
        if not initial_eval.should_correct and not table_evidence and not planned:
            return CorrectiveRetrievalResult(
                retrieved=initial,
                evaluation=initial_eval,
                strategy="semantic_top_k",
                plan=plan,
            )

        lexical_top_k = max(top_k, 12 if route.coverage == "exhaustive_scan" else top_k)
        should_run_lexical = initial_eval.should_correct or is_table_query
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
        result_limit = _plan_limit(max(top_k, lexical_top_k))
        merged = _merge_results(table_evidence, initial, top_k=result_limit) if table_evidence else initial[:result_limit]
        merged = _merge_results(merged, planned, top_k=result_limit)
        merged = _merge_results(merged, lexical, top_k=result_limit)
        strategy = _strategy_name(
            initial=initial,
            table_evidence=table_evidence,
            balanced=[],
            planned=planned,
            lexical=lexical,
            lexical_attempted=should_run_lexical,
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
        result_limit = _plan_limit(max(top_k, lexical_top_k), is_collection=True)
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
