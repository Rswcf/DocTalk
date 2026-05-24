"""Baseline tests for Group L (persona/jargon) and Group P (page lookup).

From the 2026-05-23 funnel review + consensus plan (Phase 1 items C1 + B4).
These encode DESIRED post-fix behavior; they FAIL on the current build (baseline)
and PASS after the fix. No infra required.

Run: SKIP_INTEGRATION=1 python3 -m pytest tests/test_retrieval_persona_baseline.py -v
"""
from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

import app.services.chat_service as chat_service_module
from app.core.model_profiles import get_rules_for_model
from app.services.query_router import QueryIntent, query_router

# Internal-term leakage the paying user (and U13/U21/...) hit verbatim, across locales.
# Fix C1: replace "fragment(s)" with "document/sources" in all user-facing prompt text.
_BANNED = ("fragment",)

# Visible model ids (config.MODE_MODELS values) + the demo model.
_MODELS = ["deepseek-v4-flash", "deepseek-v4-pro"]


# ---------------- Group L: persona / no internal jargon -----------------------
def test_citation_contract_has_no_fragment_jargon():
    """TC-L1a: the citation contract must not leak the word 'fragment' to the model/user.

    BASELINE: FAILS — _citation_contract() currently says 'document fragments'.
    """
    text = chat_service_module._citation_contract().lower()
    leaked = [w for w in _BANNED if w in text]
    assert not leaked, f"citation contract leaks internal jargon {leaked}: {text!r}"


@pytest.mark.parametrize("model_id", _MODELS)
def test_model_rules_have_no_fragment_jargon(model_id):
    """TC-L1b: per-model RAG rules must not say 'fragment'.

    BASELINE: FAILS — PROMPT_RULES say 'Only answer based on the fragments above'.
    """
    rules = get_rules_for_model(model_id).lower()
    leaked = [w for w in _BANNED if w in rules]
    assert not leaked, f"model {model_id} rules leak internal jargon {leaked}"


# ---------------- Group P: page / positional lookup ---------------------------
@pytest.mark.parametrize(
    "query,expected_page",
    [
        ("what is on page 350 of the document", 350),
        ("co je na straně 350 v dokumentu", 350),  # paying user's actual Czech query
        ("show me page 18", 18),
    ],
)
def test_specific_page_query_is_routed_to_page_lookup(query, expected_page):
    """TC-P: a query naming a specific page number must trigger a direct page lookup
    (fetch Page.content by number) rather than ordinary semantic top-k.

    BASELINE: FAILS — query_router has no PAGE_LOOKUP intent and extracts no page_ref,
    so 'what is on page 350' falls into section/semantic routing and the LLM answers
    'the fragments do not contain page 350' (the exact paying-user failure).
    """
    page_intent = getattr(QueryIntent, "PAGE_LOOKUP", None)
    result = query_router.route(query)
    page_ref = getattr(result, "page_ref", None)
    assert page_intent is not None, "QueryIntent.PAGE_LOOKUP not defined (B4 not implemented)"
    assert result.primary_intent == page_intent, (
        f"'{query}' routed to {result.primary_intent}, expected PAGE_LOOKUP"
    )
    assert page_ref == expected_page, f"page number not extracted (got {page_ref!r})"


# ---------------- Group P: page-lookup execution helper -----------------------
class _Scalars:
    def __init__(self, items):
        self._items = items

    def __iter__(self):
        return iter(self._items)

    def all(self):
        return self._items


class _Result:
    def __init__(self, items):
        self._items = items

    def scalars(self):
        return _Scalars(self._items)


@pytest.mark.asyncio
async def test_fetch_page_chunks_returns_items_for_overlapping_page():
    """TC-P-exec: _fetch_page_chunks turns chunks overlapping page N into retrieval items.

    Direct positional retrieval is what lets PAGE_LOOKUP answer 'what is on page 350'
    instead of the semantic 'the excerpts do not contain page 350'.
    """
    doc_id = uuid.uuid4()
    chunk = SimpleNamespace(
        id=uuid.uuid4(), document_id=doc_id, chunk_index=42,
        text="Question 80: Peripheral nerve injuries ...", page_start=349, page_end=351,
        bboxes=[], section_title="Q80",
    )
    db = SimpleNamespace(execute=AsyncMock(return_value=_Result([chunk])))

    items = await chat_service_module._fetch_page_chunks(db, doc_id, 350)

    assert items, "page lookup returned no items for an overlapping chunk"
    assert items[0]["page"] == 349 and items[0]["page_end"] == 351
    assert "Question 80" in items[0]["text"]
    assert str(items[0].get("document_id")) == str(doc_id)
