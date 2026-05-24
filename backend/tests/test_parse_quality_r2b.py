"""R2b unit tests — Unicode-aware text quality, the two-tier low-quality OCR gate, and
the OSD/locale-narrowed OCR language resolver. No external deps (pure functions)."""
from app.services.parse_service import (
    BlockInfo,
    PageInfo,
    detect_low_quality_text,
    resolve_ocr_languages,
    text_quality_score,
)


def _pages(text: str) -> list[PageInfo]:
    return [PageInfo(page_number=1, width_pt=612.0, height_pt=792.0, rotation=0,
                     blocks=[BlockInfo(page=1, text=text, bbox=(0, 0, 1, 1), font_size=12.0)])]


# Real U13 garbage sample (broken-font extraction): mostly symbols, short tokens.
GARBAGE = "p vZ° ° | » ¨ ¤] ¨] CÙWŠò z{Û?! 6 g3 3 \\ \\ v v ¬ ¬ ¨ ß ì ì ä ® ¬ ™ t ™ ¬] z{g"
GOOD_EN = "The quick brown fox jumps over the lazy dog and then returns home for supper."
GOOD_CJK = "这是一个关于人工智能与机器学习的文档内容详细介绍说明部分章节"  # no spaces
GOOD_CZECH = "Příliš žluťoučký kůň úpěl ďábelské ódy v rozsáhlém dokumentu."


def test_text_quality_score_separates_garbage_from_good():
    assert text_quality_score(_pages(GOOD_EN)) >= 0.9
    assert text_quality_score(_pages(GOOD_CJK)) >= 0.9       # CJK letters count
    assert text_quality_score(_pages(GOOD_CZECH)) >= 0.9     # diacritics NOT penalised
    assert text_quality_score(_pages(GARBAGE)) < 0.7
    assert text_quality_score(_pages("")) == 1.0             # empty is detect_scanned's job


def test_low_quality_gate_pdf_only():
    # non-PDF never flagged (no broken-font layer; not OCR-able via fitz)
    flagged, _ = detect_low_quality_text(_pages(GARBAGE), file_type="docx")
    assert flagged is False


def test_low_quality_gate_flags_garbage_keeps_good():
    assert detect_low_quality_text(_pages(GARBAGE), file_type="pdf")[0] is True
    assert detect_low_quality_text(_pages(GOOD_EN), file_type="pdf")[0] is False
    assert detect_low_quality_text(_pages(GOOD_CZECH), file_type="pdf")[0] is False


def test_low_quality_gate_cjk_safe():
    # good no-space CJK must NOT be flagged (tier-0 q>=0.75 short-circuits before token check)
    assert detect_low_quality_text(_pages(GOOD_CJK), file_type="pdf")[0] is False
    # no-space U+FFFD/PUA garbage (one giant token) MUST be flagged via tier-1 (q<0.50)
    assert detect_low_quality_text(_pages("�" * 800), file_type="pdf")[0] is True
    assert detect_low_quality_text(_pages("" * 800), file_type="pdf")[0] is True


def test_resolve_ocr_languages_script_primary_locale_refines():
    # U13: Arabic script + ur locale → urd first; NO eng (it injects Latin noise into
    # non-Latin OCR — validated), so the set is the script family only.
    langs = resolve_ocr_languages("ur", script="Arabic").split("+")
    assert langs[0] == "urd" and "eng" not in langs and len(langs) <= 2
    # en-locale user, Arabic-script doc → OSD wins: Arabic langs, never eng
    langs2 = resolve_ocr_languages("en", script="Arabic").split("+")
    assert langs2[0] in ("ara", "urd") and "eng" not in langs2


def test_resolve_ocr_languages_latin_is_narrow():
    # Latin script → single locale language (+nothing); no sibling-language noise
    assert resolve_ocr_languages("de", script="Latin") == "deu"
    assert resolve_ocr_languages("en", script="Latin") == "eng"


def test_resolve_ocr_languages_no_signal_falls_back_full_set():
    full = resolve_ocr_languages(None, None)
    assert "eng" in full  # last-resort installed set, not empty
