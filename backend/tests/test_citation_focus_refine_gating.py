"""Gating tests for chat_service._refine_citation_focus (2026-07-04 fix batch).

Contract: the post-generation focus call (1) never fires for anonymous/demo
traffic, (2) is skipped near the 60s proxy budget, (3) surfaces usage tokens
for cost reconciliation.
"""
from __future__ import annotations

import json
import sys
import types
import uuid
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services.chat_service import _ChunkInfo, _refine_citation_focus  # noqa: E402

CHUNK = (
    "The committee met in March. Goldman Sachs is piloting its first autonomous "
    "coder in a major AI milestone for Wall Street. Cash reserves declined."
)


def _chunk_map():
    return {
        1: _ChunkInfo(
            id=uuid.uuid4(), page_start=1, page_end=1,
            bboxes=[{"x": 0.1, "y": 0.1, "w": 0.5, "h": 0.05, "page": 1}],
            text=CHUNK,
        )
    }


def _fake_client(content: str):
    resp = types.SimpleNamespace(
        choices=[types.SimpleNamespace(message=types.SimpleNamespace(content=content))],
        usage=types.SimpleNamespace(prompt_tokens=42, completion_tokens=7),
    )
    client = types.SimpleNamespace()
    client.chat = types.SimpleNamespace()
    client.chat.completions = types.SimpleNamespace(create=AsyncMock(return_value=resp))
    return client


@pytest.mark.asyncio
async def test_anonymous_user_never_calls_llm():
    client = _fake_client("{}")
    with patch("app.services.chat_service._get_llm_client", return_value=client):
        changed, model, pt, ct = await _refine_citation_focus(
            answer="x[1]",
            citations=[{"ref_index": 1, "chunk_id": "c1"}],
            chunk_map=_chunk_map(),
            fallback_model="deepseek-v4-flash",
            user=None,
        )
    assert (changed, model, pt, ct) == (False, "", 0, 0)
    client.chat.completions.create.assert_not_awaited()


@pytest.mark.asyncio
async def test_elapsed_over_budget_skips():
    client = _fake_client("{}")
    fake_user = types.SimpleNamespace(id=uuid.uuid4())
    with patch("app.services.chat_service._get_llm_client", return_value=client):
        changed, model, pt, ct = await _refine_citation_focus(
            answer="x[1]",
            citations=[{"ref_index": 1, "chunk_id": "c1"}],
            chunk_map=_chunk_map(),
            fallback_model="deepseek-v4-flash",
            user=fake_user,
            elapsed_seconds=46.0,
        )
    assert (changed, model, pt, ct) == (False, "", 0, 0)
    client.chat.completions.create.assert_not_awaited()


@pytest.mark.asyncio
async def test_authenticated_returns_usage_for_accounting():
    quote = "Goldman Sachs is piloting its first autonomous coder in a major AI milestone for Wall Street."
    client = _fake_client(json.dumps({"1": quote}))
    fake_user = types.SimpleNamespace(id=uuid.uuid4())
    with patch("app.services.chat_service._get_llm_client", return_value=client):
        citations = [{"ref_index": 1, "chunk_id": "c1"}]
        changed, model, pt, ct = await _refine_citation_focus(
            answer="高盛正在试点自主编码器[1]。",
            citations=citations,
            chunk_map=_chunk_map(),
            fallback_model="deepseek-v4-flash",
            user=fake_user,
            elapsed_seconds=3.0,
        )
    assert changed is True
    assert citations[0]["focus_snippet"] == quote
    assert (pt, ct) == (42, 7)
    assert model  # the flash model id used
