from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Literal

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.query_router import QueryRoute
from app.services.rag_evaluator_service import (
    RetrievalEvaluation,
    rag_evaluator_service,
)
from app.services.retrieval_service import retrieval_service

RetrievalStrategy = Literal[
    "semantic_top_k",
    "semantic_top_k+lexical_correction",
    "lexical_correction",
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
            chunk_id = str(item.get("chunk_id") or "")
            if not chunk_id or chunk_id in seen:
                continue
            seen.add(chunk_id)
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

        lexical_top_k = max(top_k, 12 if route.coverage == "exhaustive_scan" else top_k)
        lexical = await retrieval_service.lexical_search(query, document_id, top_k=lexical_top_k, db=db)
        if initial:
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

        lexical_top_k = max(top_k, 14 if route.coverage == "exhaustive_scan" else top_k)
        lexical = await retrieval_service.lexical_search_multi(query, document_ids, top_k=lexical_top_k, db=db)
        if initial:
            merged = _merge_results(initial, lexical, top_k=max(top_k, lexical_top_k))
            strategy: RetrievalStrategy = "semantic_top_k+lexical_correction"
        else:
            merged = lexical[:lexical_top_k]
            strategy = "lexical_correction"
        final_eval = rag_evaluator_service.evaluate(query, merged, route, corrected=True)
        return CorrectiveRetrievalResult(retrieved=merged, evaluation=final_eval, strategy=strategy)


corrective_retrieval_service = CorrectiveRetrievalService()
