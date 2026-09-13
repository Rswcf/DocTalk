from __future__ import annotations

import logging
import re
import time
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from app.core.config import MODEL_TO_MODE, settings
from app.core.model_profiles import get_model_profile
from app.services import llm_provider
from app.services.credit_service import CREDIT_RATES, calculate_cost


def test_current_and_legacy_flash_are_official_models() -> None:
    assert "deepseek-flash" in settings.DEEPSEEK_OFFICIAL_MODELS
    assert "deepseek-v4-flash" in settings.DEEPSEEK_OFFICIAL_MODELS
    assert llm_provider.is_deepseek_official_model("deepseek-flash")
    assert llm_provider.is_deepseek_official_model("deepseek-v4-flash")


def test_active_model_defaults_use_canonical_flash() -> None:
    assert settings.MODE_MODELS["quick"] == "deepseek-flash"
    assert settings.MODE_MODELS["balanced"] == "deepseek-v4-pro"
    assert settings.DEMO_LLM_MODEL == "deepseek-flash"
    assert settings.RETAINPDF_TRANSLATION_MODEL == "deepseek-flash"


def test_provider_options_merge_json_and_anonymized_user(
    monkeypatch,
) -> None:
    monkeypatch.setattr(settings, "ADAPTER_SECRET", "provider-pseudonym-secret")
    kwargs = {"extra_body": {"existing": "value"}}

    llm_provider.apply_provider_options(
        kwargs,
        "deepseek-flash",
        json_output=True,
        user_id="private-database-id",
    )

    assert kwargs["extra_body"]["existing"] == "value"
    assert kwargs["extra_body"]["thinking"] == {"type": "disabled"}
    provider_user_id = kwargs["extra_body"]["user_id"]
    assert re.fullmatch(r"dt_[0-9a-f]{48}", provider_user_id)
    assert "private-database-id" not in provider_user_id
    assert kwargs["response_format"] == {"type": "json_object"}


def test_anonymized_user_is_stable_and_scoped(monkeypatch) -> None:
    monkeypatch.setattr(settings, "ADAPTER_SECRET", "stable-secret")
    first = llm_provider.deepseek_user_id("user-a")
    assert first == llm_provider.deepseek_user_id("user-a")
    assert first != llm_provider.deepseek_user_id("user-b")


def test_openrouter_request_is_not_modified(monkeypatch) -> None:
    monkeypatch.setattr(settings, "DEEPSEEK_OFFICIAL_MODELS", ["deepseek-flash"])
    kwargs = {"temperature": 0}

    llm_provider.apply_provider_options(
        kwargs,
        "openai/gpt-5.2",
        json_output=True,
        user_id="user-a",
    )

    assert kwargs == {"temperature": 0}


def test_async_client_uses_official_endpoint_and_explicit_retries(monkeypatch) -> None:
    factory = MagicMock(return_value=object())
    monkeypatch.setattr(llm_provider, "AsyncOpenAI", factory)
    monkeypatch.setattr(settings, "DEEPSEEK_API_KEY", "configured")

    llm_provider.create_async_llm_client("deepseek-flash")

    assert factory.call_args.kwargs["base_url"] == settings.DEEPSEEK_BASE_URL
    assert factory.call_args.kwargs["max_retries"] == 2


def test_flash_profile_and_legacy_credit_rate_match() -> None:
    assert get_model_profile("deepseek-flash") == get_model_profile(
        "deepseek-v4-flash"
    )
    assert CREDIT_RATES["deepseek-flash"] == CREDIT_RATES["deepseek-v4-flash"]
    assert calculate_cost(1000, 1000, "deepseek-flash") == calculate_cost(
        1000, 1000, "deepseek-v4-flash"
    )
    assert MODEL_TO_MODE["deepseek-v4-flash"] == "quick"


def test_completion_telemetry_records_provider_facts(caplog) -> None:
    response = SimpleNamespace(
        model="deepseek-flash",
        choices=[SimpleNamespace(finish_reason="stop")],
        usage=SimpleNamespace(
            prompt_tokens=12,
            completion_tokens=4,
            prompt_cache_hit_tokens=8,
            prompt_cache_miss_tokens=4,
        ),
    )

    with caplog.at_level(logging.INFO):
        llm_provider.log_completion(
            logging.getLogger("provider-contract-test"),
            operation="contract_test",
            requested_model="deepseek-v4-flash",
            started_at=time.monotonic(),
            response=response,
        )

    assert "requested_model=deepseek-v4-flash" in caplog.text
    assert "actual_model=deepseek-flash" in caplog.text
    assert "finish_reason=stop" in caplog.text
    assert "cache_hit_tokens=8" in caplog.text
    assert "cache_miss_tokens=4" in caplog.text


def test_completion_error_boundary_logs_failure_without_swallowing_it(caplog) -> None:
    with caplog.at_level(logging.WARNING), pytest.raises(TimeoutError):
        with llm_provider.completion_error_boundary(
            logging.getLogger("provider-contract-test"),
            operation="contract_test",
            requested_model="deepseek-flash",
        ):
            raise TimeoutError("provider timed out")

    assert "llm.error operation=contract_test" in caplog.text
    assert "requested_model=deepseek-flash" in caplog.text
    assert "error_type=TimeoutError" in caplog.text
