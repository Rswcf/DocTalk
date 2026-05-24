"""Unit tests for RRF fusion + dynamic-k retrieval breadth (Phase 1 B1/B2).

Pure-function tests (no infra). The data-driven fix: a 492-page PDF was answered
from ~8-12 chunks regardless of size; _dynamic_k scales the cap with document
size, and _rrf_fuse fuses dense+lexical+planned by reciprocal rank.
"""
from __future__ import annotations

from app.services.corrective_retrieval_service import _dynamic_k, _plan_limit, _rrf_fuse


# ---------------- dynamic-k ----------------
def test_dynamic_k_keeps_floor_when_size_unknown():
    # Backward-compatible: behaves like the old _plan_limit floor.
    assert _dynamic_k(8) == 12
    assert _dynamic_k(8, is_collection=True) == 14
    assert _plan_limit(8) == 12
    assert _plan_limit(8, is_collection=True) == 14


def test_dynamic_k_scales_with_large_documents():
    small = _dynamic_k(8, page_count=10)
    large = _dynamic_k(8, page_count=492)
    assert small == 12, "small docs keep the floor"
    assert large > small, "large docs must retrieve more"
    assert large == 24, "ceiling for a 492-page doc"


def test_dynamic_k_is_bounded():
    assert _dynamic_k(8, page_count=100000) == 24
    assert _dynamic_k(8, page_count=100000, is_collection=True) == 28
    # chunks_total is an alternative size signal
    assert _dynamic_k(8, chunks_total=3000) == 24


# ---------------- RRF fusion ----------------
def test_rrf_fuse_ranks_items_appearing_high_in_multiple_lists_first():
    dense = [{"chunk_id": "a"}, {"chunk_id": "b"}, {"chunk_id": "c"}]
    lexical = [{"chunk_id": "b"}, {"chunk_id": "d"}]
    fused = _rrf_fuse([dense, lexical], top_k=3)
    ids = [it["chunk_id"] for it in fused]
    # 'b' is rank2 in dense + rank1 in lexical -> highest combined RRF score.
    assert ids[0] == "b"
    assert set(ids) <= {"a", "b", "c", "d"}
    assert len(ids) == 3


def test_rrf_fuse_dedupes_and_respects_top_k():
    l1 = [{"chunk_id": "x"}, {"chunk_id": "y"}]
    l2 = [{"chunk_id": "x"}, {"chunk_id": "z"}]
    fused = _rrf_fuse([l1, l2], top_k=2)
    ids = [it["chunk_id"] for it in fused]
    assert ids[0] == "x"  # appears in both
    assert len(ids) == 2 and len(set(ids)) == 2


def test_rrf_fuse_handles_table_ids_and_empty():
    assert _rrf_fuse([], top_k=5) == []
    fused = _rrf_fuse([[{"table_id": "t1"}], [{"table_id": "t1"}, {"chunk_id": "c1"}]], top_k=5)
    keys = [it.get("table_id") or it.get("chunk_id") for it in fused]
    assert keys[0] == "t1" and "c1" in keys
