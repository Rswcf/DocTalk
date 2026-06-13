"""Tests for the offset-preserving text normalizer (Quote Finder D2).

The normalizer folds quote/dash/ligature/width/whitespace variations so an
LLM-emitted quote can be matched against stored chunk text, while keeping an
index map so a match in normalized space projects back to RAW source offsets.
The displayed quote is ALWAYS the raw slice — so the map must be exact.
"""
from __future__ import annotations

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services.text_normalizer import normalize, raw_span  # noqa: E402


def _roundtrip(raw: str, query: str, *, fuzzy: bool = False) -> str:
    """Normalize raw, find `query` (normalized the same way) inside it, and
    return the RAW slice the match projects back to."""
    norm, to_raw = normalize(raw, fuzzy=fuzzy)
    qnorm, _ = normalize(query, fuzzy=fuzzy)
    idx = norm.find(qnorm)
    assert idx != -1, f"{qnorm!r} not found in {norm!r}"
    rs, re = raw_span(to_raw, len(raw), idx, idx + len(qnorm))
    return raw[rs:re]


class TestBasicInvariants:
    def test_plain_ascii_unchanged_identity_map(self):
        norm, to_raw = normalize("Hello world.")
        assert norm == "Hello world."
        assert to_raw == list(range(len("Hello world.")))

    def test_empty_string(self):
        norm, to_raw = normalize("")
        assert norm == ""
        assert to_raw == []


class TestWhitespace:
    def test_collapse_runs_and_newlines(self):
        norm, _ = normalize("a  \n\t b")
        assert norm == "a b"

    def test_nbsp_and_ideographic_space_collapse(self):
        norm, _ = normalize("a 　b")
        assert norm == "a b"

    def test_leading_trailing_preserved_as_single_space(self):
        # The normalizer does not strip ends (callers strip the raw slice);
        # it only collapses runs.
        norm, _ = normalize("  a  ")
        assert norm == " a "


class TestPunctuationFolding:
    def test_curly_quotes_fold_but_raw_slice_preserves_them(self):
        raw = "he said “hello” to her"
        got = _roundtrip(raw, '"hello"')
        assert got == "“hello”"

    def test_em_dash_and_en_dash_fold_to_hyphen(self):
        raw = "cost—benefit and risk–reward"
        assert _roundtrip(raw, "cost-benefit") == "cost—benefit"
        assert _roundtrip(raw, "risk-reward") == "risk–reward"

    def test_ellipsis_char_folds_to_three_dots(self):
        raw = "wait… really"
        assert _roundtrip(raw, "wait... really") == "wait… really"

    def test_apostrophe_variants(self):
        raw = "the translator’s invisibility"
        assert _roundtrip(raw, "translator's invisibility") == "translator’s invisibility"


class TestLigaturesAndWidth:
    def test_fi_ligature_folds_and_raw_slice_restores_ligature(self):
        raw = "the ﬁnal deﬁnition"  # ﬁnal, deﬁnition
        assert _roundtrip(raw, "final") == "ﬁnal"

    def test_fullwidth_digits_fold(self):
        raw = "page ３４"  # ３４
        assert _roundtrip(raw, "page 34") == "page ３４"


class TestSoftHyphenAndTatweel:
    def test_soft_hyphen_dropped_match_spans_it(self):
        raw = "eco­nomic growth"
        got = _roundtrip(raw, "economic")
        assert got == "eco­nomic"

    def test_tatweel_dropped(self):
        # Arabic kashida/tatweel elongation is decorative, dropped in base mode.
        raw = "كــتاب"  # كــتاب with tatweel
        norm, _ = normalize(raw)
        assert "ـ" not in norm


class TestFuzzyMode:
    def test_casefold_only_in_fuzzy(self):
        base, _ = normalize("ÉCOLE")
        fuzzy, _ = normalize("ÉCOLE", fuzzy=True)
        assert base == "ÉCOLE"
        assert fuzzy == "école"

    def test_arabic_tashkeel_stripped_in_fuzzy_only(self):
        raw = "الْكِتاب"  # with sukun+kasra marks
        base, _ = normalize(raw)
        fuzzy, _ = normalize(raw, fuzzy=True)
        assert "ْ" in base  # diacritics kept in base/exact tier
        assert "ْ" not in fuzzy and "ِ" not in fuzzy

    def test_fuzzy_slice_still_projects_to_raw(self):
        raw = "The École Normale"
        got = _roundtrip(raw, "école normale", fuzzy=True)
        assert got == "École Normale"


class TestRawSpanProjection:
    def test_span_at_string_end(self):
        raw = "alpha beta"
        norm, to_raw = normalize(raw)
        idx = norm.find("beta")
        rs, re = raw_span(to_raw, len(raw), idx, idx + 4)
        assert raw[rs:re] == "beta"
