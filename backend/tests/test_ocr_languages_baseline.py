"""Phase 2 C4 baseline: OCR must cover DocTalk's locales, not just eng+chi_sim.

Scanned/non-Latin PDFs parsed to garbage because Tesseract only had eng+chi_sim
(U13 Urdu "coded/encrypted text", U40 Arabic, U38 scanned). This locks the
language-resolution logic; the Dockerfile must also install the matching packs.

RED on current build (resolve_ocr_languages does not exist / default too narrow).
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


def test_resolve_ocr_languages_exists_and_covers_all_locales():
    resolve = getattr(ps, "resolve_ocr_languages", None)
    assert resolve is not None, "parse_service.resolve_ocr_languages not implemented (C4)"
    default = resolve()
    codes = set(default.split("+"))
    missing = [c for c in _LOCALE_CODES.values() if c not in codes]
    assert not missing, f"default OCR languages missing locale packs: {missing}"


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
