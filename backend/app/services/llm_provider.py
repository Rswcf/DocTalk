"""Shared OpenAI-compatible provider plumbing.

DeepSeek's API enables thinking by default. DocTalk's existing Flash and Pro
product modes are deterministic, non-thinking modes, so every direct DeepSeek
request receives the same explicit override here.
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import time
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any, Mapping

from openai import AsyncOpenAI, OpenAI

from app.core.config import settings

DEFAULT_MAX_RETRIES = 2


def is_deepseek_official_model(model: str) -> bool:
    """Return whether *model* must use the official DeepSeek endpoint."""
    return model in settings.DEEPSEEK_OFFICIAL_MODELS


def deepseek_user_id(user_id: object | None) -> str | None:
    """Build a stable, non-reversible provider user identifier.

    DeepSeek accepts a provider-side ``user_id`` for isolation and abuse
    investigation. Never send DocTalk's database UUID or user PII directly.
    """
    if user_id is None or not settings.ADAPTER_SECRET:
        return None
    digest = hmac.new(
        settings.ADAPTER_SECRET.encode("utf-8"),
        str(user_id).encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return f"dt_{digest[:48]}"


def apply_provider_options(
    create_kwargs: dict[str, Any],
    model: str,
    *,
    json_output: bool = False,
    user_id: object | None = None,
) -> None:
    """Apply the product contract for a provider request in place."""
    if not is_deepseek_official_model(model):
        return

    extra_body = dict(create_kwargs.get("extra_body") or {})
    extra_body["thinking"] = {"type": "disabled"}
    provider_user_id = deepseek_user_id(user_id)
    if provider_user_id:
        extra_body["user_id"] = provider_user_id
    create_kwargs["extra_body"] = extra_body
    if json_output:
        create_kwargs["response_format"] = {"type": "json_object"}


def create_async_llm_client(
    model: str,
    *,
    openrouter_headers: Mapping[str, str] | None = None,
) -> AsyncOpenAI:
    """Create an async client for the provider that owns *model*."""
    if is_deepseek_official_model(model):
        if not settings.DEEPSEEK_API_KEY:
            raise RuntimeError("DEEPSEEK_API_KEY is not configured")
        return AsyncOpenAI(
            api_key=settings.DEEPSEEK_API_KEY,
            base_url=settings.DEEPSEEK_BASE_URL,
            max_retries=DEFAULT_MAX_RETRIES,
        )
    if not settings.OPENROUTER_API_KEY:
        raise RuntimeError("OPENROUTER_API_KEY is not configured")
    return AsyncOpenAI(
        api_key=settings.OPENROUTER_API_KEY,
        base_url=settings.OPENROUTER_BASE_URL,
        default_headers=dict(openrouter_headers or {}),
        max_retries=DEFAULT_MAX_RETRIES,
    )


def create_sync_llm_client(model: str) -> OpenAI:
    """Create a synchronous client for worker-side model calls."""
    if is_deepseek_official_model(model):
        if not settings.DEEPSEEK_API_KEY:
            raise RuntimeError("DEEPSEEK_API_KEY is not configured")
        return OpenAI(
            api_key=settings.DEEPSEEK_API_KEY,
            base_url=settings.DEEPSEEK_BASE_URL,
            max_retries=DEFAULT_MAX_RETRIES,
        )
    if not settings.OPENROUTER_API_KEY:
        raise RuntimeError("OPENROUTER_API_KEY is not configured")
    return OpenAI(
        api_key=settings.OPENROUTER_API_KEY,
        base_url=settings.OPENROUTER_BASE_URL,
        max_retries=DEFAULT_MAX_RETRIES,
    )


def log_completion(
    log: logging.Logger,
    *,
    operation: str,
    requested_model: str,
    started_at: float,
    response: Any,
) -> None:
    """Emit comparable completion telemetry without logging prompt content."""
    usage = getattr(response, "usage", None)
    choices = getattr(response, "choices", None) or []
    finish_reason = getattr(choices[0], "finish_reason", None) if choices else None
    log.info(
        "llm.completion operation=%s requested_model=%s actual_model=%s "
        "latency_ms=%d finish_reason=%s prompt_tokens=%s completion_tokens=%s "
        "cache_hit_tokens=%s cache_miss_tokens=%s",
        operation,
        requested_model,
        getattr(response, "model", None),
        max(0, round((time.monotonic() - started_at) * 1000)),
        finish_reason,
        getattr(usage, "prompt_tokens", None),
        getattr(usage, "completion_tokens", None),
        getattr(usage, "prompt_cache_hit_tokens", None),
        getattr(usage, "prompt_cache_miss_tokens", None),
    )


def log_completion_error(
    log: logging.Logger,
    *,
    operation: str,
    requested_model: str,
    started_at: float,
    error: BaseException,
) -> None:
    """Emit failure telemetry without request or response content."""
    log.warning(
        "llm.error operation=%s requested_model=%s latency_ms=%d error_type=%s",
        operation,
        requested_model,
        max(0, round((time.monotonic() - started_at) * 1000)),
        type(error).__name__,
    )


@contextmanager
def completion_error_boundary(
    log: logging.Logger,
    *,
    operation: str,
    requested_model: str,
) -> Iterator[float]:
    """Log provider-call failures while leaving domain fallback behavior intact."""
    started_at = time.monotonic()
    try:
        yield started_at
    except Exception as error:
        log_completion_error(
            log,
            operation=operation,
            requested_model=requested_model,
            started_at=started_at,
            error=error,
        )
        raise
