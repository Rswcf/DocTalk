"""The citation repair must never push a finished answer past the 60 s proxy.

Everything after the model starts — the answer, a repair, citation focus — ends within _MODEL_PHASE_BUDGET_S. A
repair starts only with at least _REPAIR_MIN_S of that budget left and is abandoned at the remaining time (capped at
_REPAIR_MAX_S), keeping the unrepaired answer and its verification status. Before this, a near-max Pro answer plus
its repair took ~63 s at the median measured speed and the proxy cut the stream (tests/test_answer_length_budget.py).
"""
from __future__ import annotations

import asyncio
import inspect
import re
import sys
import uuid
from pathlib import Path
from types import SimpleNamespace

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import app.services.chat_service as chat_service_module  # noqa: E402


def test_a_repair_gets_the_remaining_budget_up_to_its_cap() -> None:
    budget = chat_service_module._MODEL_PHASE_BUDGET_S
    cap = chat_service_module._REPAIR_MAX_S
    assert chat_service_module._repair_timeout(0.0) == cap
    assert chat_service_module._repair_timeout(budget - cap + 3.0) == pytest.approx(cap - 3.0)


def test_a_repair_is_skipped_when_too_little_budget_remains() -> None:
    budget = chat_service_module._MODEL_PHASE_BUDGET_S
    floor = chat_service_module._REPAIR_MIN_S
    assert chat_service_module._repair_timeout(budget - floor) == pytest.approx(floor)
    assert chat_service_module._repair_timeout(budget - floor + 0.5) is None
    assert chat_service_module._repair_timeout(budget + 10.0) is None


def test_both_answer_paths_gate_the_repair_on_the_remaining_budget() -> None:
    source = inspect.getsource(chat_service_module)
    gates = re.findall(r"repair_timeout_s = _repair_timeout\(time\.time\(\) - llm_start\)", source)
    assert len(gates) == 2, "chat_stream and continue_stream must both gate the repair"
    assert source.count("timeout_s=repair_timeout_s,") == 2
    assert source.count('repair_metadata = {"repair_skipped": "time_budget"}') == 2


class _SlowCompletions:
    async def create(self, **_kwargs):
        await asyncio.sleep(5)
        raise AssertionError("the repair should have been abandoned")


@pytest.mark.asyncio
async def test_a_repair_that_outruns_its_time_is_abandoned_not_applied() -> None:
    chunk = chat_service_module._ChunkInfo(
        id=uuid.uuid4(), page_start=7, page_end=7, bboxes=[], text="MetaX 2028 revenue is RMB 7.8 billion.",
        section_title="Valuation", score=0.91,
    )
    chunk_map = {1: chunk}
    draft = "MetaX 2028 revenue is RMB 9.1 billion."
    citations = [chat_service_module._citation_payload(1, chunk, len(draft))]
    report = chat_service_module.claim_verifier_service.verify(draft, citations, {1}, retrieved_count=1)

    result = await chat_service_module._try_repair_rag_answer(
        client=SimpleNamespace(chat=SimpleNamespace(completions=_SlowCompletions())),
        model="deepseek-v4-pro",
        profile=chat_service_module.get_model_profile("deepseek-v4-pro"),
        user_message="What is MetaX 2028 revenue?",
        assistant_text=draft,
        citations=citations,
        chunk_map=chunk_map,
        numbered_chunks=["[1] MetaX 2028 revenue is RMB 7.8 billion."],
        verification=report.to_payload(),
        locale="en",
        timeout_s=0.05,
    )

    assert result.applied is False
    assert result.text == draft
    assert result.citations == citations
    assert result.metadata["repair_error"] == "repair_timeout"


def test_post_answer_statuses_carry_stable_codes_for_the_client() -> None:
    # The client shows these under the finished text while the stream is still open, in the user's language.
    source = inspect.getsource(chat_service_module)
    assert source.count('sse("tool_status", {"message": "Checking citation support...", "code": "checking_citations"})') == 2
    assert source.count('sse("tool_status", {"message": "Refining citations...", "code": "refining_citations"})') == 2
    # The whole-document summary's status shows before any text, also translated by the client.
    assert source.count('"code": "summarizing_sections"') == 1
