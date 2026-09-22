"""A full-length chat answer must finish inside the 60 s proxy budget (design 07 §1.5 4a-i, criterion 10).

The Vercel proxy aborts a chat stream at 60 s (frontend/src/app/api/proxy/[...path]/route.ts). Before the model
starts: auth, the planner (its LLM fallback is capped at ACTION_PLANNER_TIMEOUT_SECONDS) and retrieval. After
it: citation focus, only while the model phase is within _FOCUS_ELAPSED_BUDGET_S and capped at _FOCUS_TIMEOUT_S;
then persistence and settlement. A complete answer (finish_reason "stop") that fails claim verification also
gets one non-streaming repair call of at most 2048 tokens; a cut answer ("length") never does.

Measured 2026-09-22 against api.deepseek.com with the production request shape (thinking disabled, temperature
0.1, streaming, ~9.2k-token prompt), 5 runs per model at 3000 and 6000 output tokens:

  deepseek-flash   decode 256.5 / 403.2 / 419.2 / 419.3 / 427.9 tok/s, first token 1.74-3.68 s
  deepseek-v4-pro  decode 122.4 / 129.2 / 129.6 / 145.5 / 146.1 tok/s, first token 2.79-4.56 s

The provider accepted max_tokens up to 393216 on both models, so its output limit is not the binding constraint.
Every check uses the slowest measured decode cut by a further quarter for provider load, plus the slowest
measured first token. Re-measure before raising a limit; these checks fail if a raise outruns the numbers.
"""
from __future__ import annotations

import inspect

import pytest

from app.core.config import settings
from app.core.model_profiles import MODEL_PROFILES
from app.services import chat_service

PROXY_S = 60.0
# Planner LLM fallback (capped) + auth, retrieval and DB, which were not measured here: 4 s allowed.
SETUP_S = float(settings.ACTION_PLANNER_TIMEOUT_SECONDS) + 4.0
POST_S = 1.0  # persistence and settlement
SAFETY_S = 2.0
LOAD_HAIRCUT = 0.75
REPAIR_MAX_TOKENS = 2048
MEASURED = {
    # model: (slowest decode tok/s, slowest first token s)
    "deepseek-flash": (256.5, 3.68),
    "deepseek-v4-pro": (122.4, 4.56),
}


def _model_seconds(model: str, tokens: int) -> float:
    tps, ttft = MEASURED[model]
    return ttft + tokens / (tps * LOAD_HAIRCUT)


def _total_seconds(model_phase_s: float) -> float:
    focus_s = chat_service._FOCUS_TIMEOUT_S if model_phase_s <= chat_service._FOCUS_ELAPSED_BUDGET_S else 0.0
    return SETUP_S + model_phase_s + focus_s + POST_S + SAFETY_S


def test_the_repair_call_is_still_capped_at_2048_tokens() -> None:
    source = inspect.getsource(chat_service._try_repair_rag_answer)
    assert f'min(int(getattr(profile, "max_tokens", 2048) or 2048), {REPAIR_MAX_TOKENS})' in source


@pytest.mark.parametrize("mode", ["quick", "balanced"])
def test_a_max_length_answer_fits_the_proxy_budget(mode: str) -> None:
    model = settings.MODE_MODELS[mode]
    total = _total_seconds(_model_seconds(model, MODEL_PROFILES[model].max_tokens))

    assert total <= PROXY_S, f"{model}: {total:.1f}s for a max-length answer"


def test_a_near_max_flash_answer_that_needs_repair_fits_the_proxy_budget() -> None:
    model = settings.MODE_MODELS["quick"]
    phase = _model_seconds(model, MODEL_PROFILES[model].max_tokens) + _model_seconds(model, REPAIR_MAX_TOKENS)

    assert _total_seconds(phase) <= PROXY_S, f"{model}: {_total_seconds(phase):.1f}s with a repair"


@pytest.mark.xfail(strict=True, reason=(
    "Pre-existing, not caused by the Flash raise: under provider load a near-max Pro answer plus its repair call "
    "can outrun the proxy. Needs a repair time guard (like citation focus has) - reported for Codex / owner."
))
def test_a_near_max_pro_answer_that_needs_repair_fits_the_proxy_budget() -> None:
    model = settings.MODE_MODELS["balanced"]
    phase = _model_seconds(model, MODEL_PROFILES[model].max_tokens) + _model_seconds(model, REPAIR_MAX_TOKENS)

    assert _total_seconds(phase) <= PROXY_S


def test_flash_answers_are_twice_as_long_as_before() -> None:
    # 4a: answers were cut at the old 3072-token Flash cap. 6144 is the largest multiple of 512 whose repair path
    # still fits the budget above; Pro stays at 4096 (already at the edge of it).
    assert MODEL_PROFILES["deepseek-flash"].max_tokens == 6144
    assert MODEL_PROFILES["deepseek-v4-flash"].max_tokens == MODEL_PROFILES["deepseek-flash"].max_tokens
    assert MODEL_PROFILES["deepseek-v4-pro"].max_tokens == 4096
