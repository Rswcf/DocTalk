"""Per-model configuration profiles for the chat service.

Each supported LLM model gets a ModelProfile that controls:
- API parameters (temperature, max_tokens)
- Feature flags (cache_control, stream_options)
- Prompt style variant (rules section wording)
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ModelProfile:
    """Configuration profile for a specific LLM model."""

    temperature: float = 0.3
    max_tokens: int = 2048
    supports_cache_control: bool = False
    supports_stream_options: bool = True
    prompt_style: str = "default"


# ---------------------------------------------------------------------------
# Prompt style rule templates
# ---------------------------------------------------------------------------
PROMPT_RULES: dict[str, str] = {
    # Standard rules — MiniMax, Kimi, GPT-5.2, Gemini Pro
    "default": (
        "1. Only answer based on the fragments above. Do not fabricate information.\n"
        "2. After key statements, cite sources with [n] (n = fragment number).\n"
        "3. You may cite multiple fragments, e.g. [1][3].\n"
        "4. Always extract as much relevant information as possible from the fragments. "
        "Focus on what IS available rather than what is missing. "
        "Only say the information was not found if the fragments are truly unrelated to the question.\n"
        "5. If the question asks about a specific topic that is genuinely NOT covered in any of the fragments, "
        "clearly state: \"This information is not present in the provided document.\"\n"
        "6. Use Markdown: **bold** for emphasis, bullet lists for multiple points.\n"
        "7. Your response language MUST match the language of the user's question.\n"
    ),
    # DeepSeek — avoid negative-framing over-compliance
    "positive_framing": (
        "1. Only answer based on the fragments above. Do not fabricate information.\n"
        "2. After key statements, cite sources with [n] (n = fragment number).\n"
        "3. You may cite multiple fragments, e.g. [1][3].\n"
        "4. Your primary goal is to extract and present ALL useful information from the fragments. "
        "Be thorough — cover every relevant detail you find.\n"
        "5. Only say information is unavailable if the fragments are genuinely unrelated to the question.\n"
        "6. When a question is about a topic completely absent from ALL fragments, "
        "state that this specific information is not available in the document.\n"
        "7. Use Markdown: **bold** for emphasis, bullet lists for multiple points.\n"
        "8. Your response language MUST match the language of the user's question.\n"
    ),
}

# Collection-session variants add a "mention which document" rule.
COLLECTION_EXTRA_RULES: dict[str, str] = {
    "default": (
        "4b. When relevant, mention which document the information comes from.\n"
    ),
    "positive_framing": (
        "4b. When relevant, mention which document the information comes from.\n"
    ),
}

# ---------------------------------------------------------------------------
# Model registry
# ---------------------------------------------------------------------------

MODEL_PROFILES: dict[str, ModelProfile] = {
    "deepseek/deepseek-v3.2": ModelProfile(
        temperature=0.1,
        max_tokens=4096,
        supports_cache_control=False,
        supports_stream_options=True,
        prompt_style="positive_framing",
    ),
    "openai/gpt-5.2": ModelProfile(
        temperature=0.0,
        max_tokens=4096,
        supports_cache_control=False,
        supports_stream_options=True,
        prompt_style="default",
    ),
    "qwen/qwen3-30b-a3b": ModelProfile(
        temperature=0.2,
        max_tokens=4096,
        supports_cache_control=False,
        supports_stream_options=True,
        prompt_style="default",
    ),
    "mistralai/mistral-medium-3": ModelProfile(
        temperature=0.2,
        max_tokens=4096,
        supports_cache_control=False,
        supports_stream_options=True,
        prompt_style="default",
    ),
    "mistralai/mistral-medium-3.1": ModelProfile(
        temperature=0.2,
        max_tokens=4096,
        supports_cache_control=False,
        supports_stream_options=True,
        prompt_style="default",
    ),
    "mistralai/mistral-large-2512": ModelProfile(
        temperature=0.2,
        max_tokens=4096,
        supports_cache_control=False,
        supports_stream_options=True,
        prompt_style="default",
    ),
}

# Fallback for unknown models
_DEFAULT_PROFILE = ModelProfile()


def get_model_profile(model_id: str) -> ModelProfile:
    """Return the profile for *model_id*, falling back to defaults."""
    return MODEL_PROFILES.get(model_id, _DEFAULT_PROFILE)


def get_rules_for_model(
    model_id: str,
    *,
    is_collection: bool = False,
) -> str:
    """Return the rendered rules block for the given model."""
    profile = get_model_profile(model_id)
    style = profile.prompt_style
    rules = PROMPT_RULES.get(style, PROMPT_RULES["default"])
    if is_collection:
        extra = COLLECTION_EXTRA_RULES.get(style, COLLECTION_EXTRA_RULES["default"])
        rules += extra
    return rules
