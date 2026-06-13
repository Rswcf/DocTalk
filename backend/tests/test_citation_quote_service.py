"""Phase 1: post-generation quote extraction for cross-lingual citation focus.

When lexical focus fails (cross-lingual / paraphrase), the LLM names the
verbatim supporting sentence (in the SOURCE language) for each citation; we
verify it against the cited chunk and use the verified slice as focus_snippet.
The LLM is mocked here; verify_quote runs for real.
"""
from __future__ import annotations

import json
import sys
import types
from pathlib import Path
from unittest.mock import AsyncMock

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services.citation_quote_service import extract_focus_quotes  # noqa: E402

CHUNK_EN = (
    "The committee met in March. Goldman Sachs is piloting its first autonomous "
    "coder in a major AI milestone for Wall Street. Cash reserves declined."
)


def _client(content: str) -> AsyncMock:
    resp = types.SimpleNamespace(
        choices=[types.SimpleNamespace(message=types.SimpleNamespace(content=content))],
        usage=types.SimpleNamespace(prompt_tokens=10, completion_tokens=5),
    )
    client = types.SimpleNamespace()
    client.chat = types.SimpleNamespace()
    client.chat.completions = types.SimpleNamespace(create=AsyncMock(return_value=resp))
    return client


@pytest.mark.asyncio
async def test_cross_lingual_quote_verified():
    # Chinese answer cites an English source; LLM returns the English sentence.
    client = _client(json.dumps({
        "1": "Goldman Sachs is piloting its first autonomous coder in a major AI milestone for Wall Street."
    }))
    out = await extract_focus_quotes(
        answer="高盛正在试点其首个自主编码器[1]。",
        citations=[{"ref_index": 1, "chunk_id": "c1"}],
        chunk_texts={1: CHUNK_EN},
        client=client,
        model="deepseek-v4-flash",
    )
    assert out[1] == (
        "Goldman Sachs is piloting its first autonomous coder in a major AI milestone for Wall Street."
    )


@pytest.mark.asyncio
async def test_hallucinated_quote_dropped():
    client = _client(json.dumps({"1": "The CEO announced a merger with a rival firm."}))
    out = await extract_focus_quotes(
        answer="某声明[1]。",
        citations=[{"ref_index": 1, "chunk_id": "c1"}],
        chunk_texts={1: CHUNK_EN},
        client=client,
        model="deepseek-v4-flash",
    )
    assert 1 not in out  # not verbatim in source → dropped → keep whole-chunk


@pytest.mark.asyncio
async def test_gating_skips_llm_when_all_have_focus():
    client = _client("{}")
    out = await extract_focus_quotes(
        answer="x[1]",
        citations=[{"ref_index": 1, "chunk_id": "c1", "focus_snippet": "already precise"}],
        chunk_texts={1: CHUNK_EN},
        client=client,
        model="deepseek-v4-flash",
    )
    assert out == {}
    client.chat.completions.create.assert_not_awaited()


@pytest.mark.asyncio
async def test_no_text_citations_skips_llm():
    client = _client("{}")
    out = await extract_focus_quotes(
        answer="x",
        citations=[],
        chunk_texts={},
        client=client,
        model="deepseek-v4-flash",
    )
    assert out == {}
    client.chat.completions.create.assert_not_awaited()


@pytest.mark.asyncio
async def test_tolerates_markdown_fenced_json():
    client = _client("```json\n{\"1\": \"Cash reserves declined.\"}\n```")
    out = await extract_focus_quotes(
        answer="储备下降[1]。",
        citations=[{"ref_index": 1, "chunk_id": "c1"}],
        chunk_texts={1: CHUNK_EN},
        client=client,
        model="deepseek-v4-flash",
    )
    assert out[1] == "Cash reserves declined."


@pytest.mark.asyncio
async def test_table_modality_skipped():
    # H8: table/summary citations have no clean sentence → never extract.
    client = _client("{}")
    out = await extract_focus_quotes(
        answer="see table[1]",
        citations=[{"ref_index": 1, "chunk_id": "c1", "retrieval_modality": "table"}],
        chunk_texts={1: CHUNK_EN},
        client=client,
        model="deepseek-v4-flash",
    )
    assert out == {}
    client.chat.completions.create.assert_not_awaited()


@pytest.mark.asyncio
async def test_summary_modality_skipped():
    client = _client("{}")
    out = await extract_focus_quotes(
        answer="overview[1]",
        citations=[{"ref_index": 1, "chunk_id": "c1", "retrieval_modality": "summary"}],
        chunk_texts={1: CHUNK_EN},
        client=client,
        model="deepseek-v4-flash",
    )
    assert out == {}
    client.chat.completions.create.assert_not_awaited()


@pytest.mark.asyncio
async def test_extra_body_forwarded_to_llm():
    # DeepSeek thinking-disabled (cheap) options must reach the extraction call.
    client = _client(json.dumps({"1": "Cash reserves declined."}))
    await extract_focus_quotes(
        answer="x[1]",
        citations=[{"ref_index": 1, "chunk_id": "c1"}],
        chunk_texts={1: CHUNK_EN},
        client=client,
        model="deepseek-v4-flash",
        extra_body={"thinking": {"type": "disabled"}},
    )
    kwargs = client.chat.completions.create.await_args.kwargs
    assert kwargs.get("extra_body") == {"thinking": {"type": "disabled"}}


@pytest.mark.asyncio
async def test_llm_error_returns_empty_not_raises():
    client = types.SimpleNamespace()
    client.chat = types.SimpleNamespace()
    client.chat.completions = types.SimpleNamespace(create=AsyncMock(side_effect=RuntimeError("boom")))
    out = await extract_focus_quotes(
        answer="x[1]",
        citations=[{"ref_index": 1, "chunk_id": "c1"}],
        chunk_texts={1: CHUNK_EN},
        client=client,
        model="deepseek-v4-flash",
    )
    assert out == {}  # graceful: never breaks the answer over a focus nicety
