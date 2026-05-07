from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Literal

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.query_router import QueryIntent, QueryRoute
from app.services.rag_evaluator_service import (
    RetrievalEvaluation,
    rag_evaluator_service,
)
from app.services.retrieval_service import retrieval_service

RetrievalStrategy = Literal[
    "semantic_top_k",
    "semantic_top_k+lexical_correction",
    "lexical_correction",
    "semantic_top_k+table_evidence+lexical_correction",
    "table_evidence+lexical_correction",
]


@dataclass(frozen=True)
class CorrectiveRetrievalResult:
    retrieved: list[dict]
    evaluation: RetrievalEvaluation
    strategy: RetrievalStrategy


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


class CorrectiveRetrievalService:
    async def retrieve_single(
        self,
        query: str,
        route: QueryRoute,
        document_id: uuid.UUID,
        *,
        top_k: int,
        db: AsyncSession,
    ) -> CorrectiveRetrievalResult:
        initial = await retrieval_service.search(query, document_id, top_k=top_k, db=db)
        initial_eval = rag_evaluator_service.evaluate(query, initial, route)
        if not initial_eval.should_correct:
            return CorrectiveRetrievalResult(
                retrieved=initial,
                evaluation=initial_eval,
                strategy="semantic_top_k",
            )

        is_table_query = QueryIntent.TABLE_QUERY in route.intents
        table_evidence = (
            await retrieval_service.table_search(query, document_id, top_k=6, db=db)
            if is_table_query
            else []
        )
        lexical_top_k = max(top_k, 12 if route.coverage == "exhaustive_scan" else top_k)
        lexical = await retrieval_service.lexical_search(
            query,
            document_id,
            top_k=lexical_top_k,
            db=db,
            min_text_len=20 if is_table_query else 200,
        )
        if table_evidence:
            merged = _merge_results(table_evidence, initial, top_k=max(top_k, lexical_top_k, 12))
            merged = _merge_results(merged, lexical, top_k=max(top_k, lexical_top_k, 12))
            strategy: RetrievalStrategy = (
                "semantic_top_k+table_evidence+lexical_correction"
                if initial
                else "table_evidence+lexical_correction"
            )
        elif initial:
            merged = _merge_results(initial, lexical, top_k=max(top_k, lexical_top_k))
            strategy: RetrievalStrategy = "semantic_top_k+lexical_correction"
        else:
            merged = lexical[:lexical_top_k]
            strategy = "lexical_correction"
        final_eval = rag_evaluator_service.evaluate(query, merged, route, corrected=True)
        return CorrectiveRetrievalResult(retrieved=merged, evaluation=final_eval, strategy=strategy)

    async def retrieve_multi(
        self,
        query: str,
        route: QueryRoute,
        document_ids: list[uuid.UUID],
        *,
        top_k: int,
        db: AsyncSession,
    ) -> CorrectiveRetrievalResult:
        initial = await retrieval_service.search_multi(query, document_ids, top_k=top_k, db=db)
        initial_eval = rag_evaluator_service.evaluate(query, initial, route)
        if not initial_eval.should_correct:
            return CorrectiveRetrievalResult(
                retrieved=initial,
                evaluation=initial_eval,
                strategy="semantic_top_k",
            )

        is_table_query = QueryIntent.TABLE_QUERY in route.intents
        table_evidence = (
            await retrieval_service.table_search_multi(query, document_ids, top_k=8, db=db)
            if is_table_query
            else []
        )
        lexical_top_k = max(top_k, 14 if route.coverage == "exhaustive_scan" else top_k)
        lexical = await retrieval_service.lexical_search_multi(
            query,
            document_ids,
            top_k=lexical_top_k,
            db=db,
            min_text_len=20 if is_table_query else 200,
        )
        if table_evidence:
            merged = _merge_results(table_evidence, initial, top_k=max(top_k, lexical_top_k, 14))
            merged = _merge_results(merged, lexical, top_k=max(top_k, lexical_top_k, 14))
            strategy: RetrievalStrategy = (
                "semantic_top_k+table_evidence+lexical_correction"
                if initial
                else "table_evidence+lexical_correction"
            )
        elif initial:
            merged = _merge_results(initial, lexical, top_k=max(top_k, lexical_top_k))
            strategy: RetrievalStrategy = "semantic_top_k+lexical_correction"
        else:
            merged = lexical[:lexical_top_k]
            strategy = "lexical_correction"
        final_eval = rag_evaluator_service.evaluate(query, merged, route, corrected=True)
        return CorrectiveRetrievalResult(retrieved=merged, evaluation=final_eval, strategy=strategy)


corrective_retrieval_service = CorrectiveRetrievalService()
