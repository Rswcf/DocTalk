from __future__ import annotations

import uuid

from app.api.search import _merge_search_results


def test_merge_search_results_backfills_without_duplicates() -> None:
    first_chunk = uuid.uuid4()
    second_chunk = uuid.uuid4()
    primary = [
        {
            "chunk_id": first_chunk,
            "text": "semantic result",
            "page": 1,
            "bboxes": [],
            "score": 0.71,
        }
    ]
    fallback = [
        {
            "chunk_id": first_chunk,
            "text": "duplicate lexical result",
            "page": 1,
            "bboxes": [],
            "score": 0.92,
        },
        {
            "chunk_id": second_chunk,
            "text": "lexical backfill",
            "page": 2,
            "bboxes": [],
            "score": 0.88,
        },
    ]

    merged = _merge_search_results(primary, fallback, top_k=2)

    assert [item["chunk_id"] for item in merged] == [first_chunk, second_chunk]


def test_merge_search_results_uses_lexical_when_semantic_empty() -> None:
    chunk_id = uuid.uuid4()

    merged = _merge_search_results(
        [],
        [
            {
                "chunk_id": chunk_id,
                "text": "semiconductor exact hit",
                "page": 1,
                "bboxes": [],
                "score": 0.91,
            }
        ],
        top_k=1,
    )

    assert len(merged) == 1
    assert merged[0]["chunk_id"] == chunk_id

