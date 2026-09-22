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
The max-length checks use the slowest measured decode cut by a further quarter for provider load, plus the slowest
measured first token. Re-measure before raising a limit; these checks fail if a raise outruns the numbers.
"""
from __future__ import annotations

import inspect

import pytest

from app.core.config import Settings, settings
from app.core.model_profiles import MODEL_PROFILES
from app.services import chat_service

PROXY_S = 60.0
# Planner LLM fallback cap (the code default, so a local .env cannot move this test; if production overrides
# ACTION_PLANNER_TIMEOUT_SECONDS upward, re-run the numbers) + auth, retrieval and DB, not measured here: 4 s.
PLANNER_TIMEOUT_S = float(Settings.model_fields["ACTION_PLANNER_TIMEOUT_SECONDS"].default)
SETUP_S = PLANNER_TIMEOUT_S + 4.0
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


def test_everything_after_the_model_starts_ends_inside_the_proxy_budget() -> None:
    # The answer, a repair and citation focus all end within _MODEL_PHASE_BUDGET_S of the model starting: a repair
    # is cut at the remaining budget (chat_service._repair_timeout) and focus runs only while within its own window.
    assert SETUP_S + chat_service._MODEL_PHASE_BUDGET_S + POST_S + SAFETY_S <= PROXY_S
    assert chat_service._FOCUS_ELAPSED_BUDGET_S + chat_service._FOCUS_TIMEOUT_S <= chat_service._MODEL_PHASE_BUDGET_S


@pytest.mark.parametrize("mode", ["quick", "balanced"])
def test_a_full_repair_fits_its_cap_at_the_slowest_measured_speed(mode: str) -> None:
    # Without the load haircut: the cap must not abandon repairs that ordinary provider speed would finish.
    model = settings.MODE_MODELS[mode]
    tps, ttft = MEASURED[model]
    assert ttft + REPAIR_MAX_TOKENS / tps <= chat_service._REPAIR_MAX_S


def test_flash_answers_are_twice_as_long_as_before() -> None:
    # 4a: answers were cut at the old 3072-token Flash cap. 6144 was set when a near-max answer plus an unbounded
    # repair still had to fit; the repair is now bounded by the model-phase budget. Pro stays at 4096.
    assert MODEL_PROFILES["deepseek-flash"].max_tokens == 6144
    assert MODEL_PROFILES["deepseek-v4-flash"].max_tokens == MODEL_PROFILES["deepseek-flash"].max_tokens
    assert MODEL_PROFILES["deepseek-v4-pro"].max_tokens == 4096
