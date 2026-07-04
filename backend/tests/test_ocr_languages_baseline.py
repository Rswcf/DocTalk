"""OCR language-resolution contract (R2b policy, updated 2026-07-04).

History: originally locked a kitchen-sink default (all 11 locale packs) after
U13/U40/U38 garbage parses. R2b then proved the kitchen-sink set is itself the
failure mode — Tesseract hallucinates cross-script glyphs (U13: urd alone=0.99
clean vs multi-set=0.60-0.77 with 16-39% Latin noise). Current policy (see
.claude/rules/backend.md): NARROW sets — script-primary, ≤3 languages, NO eng
for non-Latin scripts, eng-only fallback when script+locale unknown. This file
now locks THAT contract; per-locale coverage is asserted by the parametrized
locale-priority test below.
"""
from __future__ import annotations

import pytest

from app.core.config import settings
from app.services import parse_service as ps

# The 11 product locales -> expected Tesseract traineddata codes.
_LOCALE_CODES = {
    "en": "eng", "zh": "chi_sim", "ja": "jpn", "ko": "kor", "es": "spa",
    "de": "deu", "fr": "fra", "pt": "por", "it": "ita", "ar": "ara", "hi": "hin",
}


def test_resolve_ocr_languages_default_is_narrow_not_kitchen_sink():
    """No script + no locale → eng alone, NEVER the full installed set.

    The kitchen-sink set causes cross-script hallucination (R2b/U13); the
    worker's adopt-only-if-better guard handles the non-Latin miss safely.
    """
    resolve = getattr(ps, "resolve_ocr_languages", None)
    assert resolve is not None, "parse_service.resolve_ocr_languages missing"
    default = resolve()
    codes = default.split("+")
    assert codes == ["eng"], f"default must be narrow eng-only, got {default!r}"


def test_resolve_ocr_languages_non_latin_script_excludes_eng():
    # eng in a non-Latin set interleaves spurious Latin glyphs (U13 evidence).
    resolve = ps.resolve_ocr_languages
    for script in ("Arabic", "Han"):
        result = resolve(None, script)
        assert "eng" not in result.split("+"), (
            f"{script} set must not include eng, got {result!r}"
        )


def test_resolve_ocr_languages_capped_at_three():
    resolve = ps.resolve_ocr_languages
    for locale in _LOCALE_CODES:
        for script in (None, "Latin", "Arabic", "Han"):
            assert len(resolve(locale, script).split("+")) <= 3


@pytest.mark.parametrize("locale,code", list(_LOCALE_CODES.items()))
def test_resolve_ocr_languages_prioritises_document_locale(locale, code):
    resolve = getattr(ps, "resolve_ocr_languages", None)
    assert resolve is not None, "parse_service.resolve_ocr_languages not implemented (C4)"
    result = resolve(locale)
    assert result.split("+")[0] == code, (
        f"locale {locale} should put {code} first for OCR accuracy, got {result!r}"
    )


def test_resolve_ocr_languages_respects_config_without_forced_union(
    monkeypatch: pytest.MonkeyPatch,
):
    resolve = getattr(ps, "resolve_ocr_languages", None)
    assert resolve is not None, "parse_service.resolve_ocr_languages not implemented (C4)"

    monkeypatch.setattr(settings, "OCR_LANGUAGES", "eng")

    assert resolve() == "eng"
    assert resolve("ja") == "eng"
