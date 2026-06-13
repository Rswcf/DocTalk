"""Regression tests for chunk-text fidelity (Quote Finder M1, Codex r2 catch).

The split→rejoin path mutated source wording: `_split_into_sentences` split on
every ASCII period and `_join_text_units` then re-inserted a space, turning
`U.S.`→`U. S.`, `3.14`→`3. 14`, `e.g.`→`e. g.`. Because the verifier displays
the chunk-text slice, a thesis writer would see the corrupted form in a "quote".
An ASCII period is a sentence boundary only when followed by whitespace / EOS.
"""
from __future__ import annotations

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services.parse_service import ParseService  # noqa: E402


class TestSentenceFidelity:
    def setup_method(self):
        self.svc = ParseService()

    def _roundtrip(self, text: str) -> str:
        return self.svc._join_text_units(self.svc._split_into_sentences(text))

    def test_us_abbreviation_not_spaced(self):
        out = self._roundtrip("The U.S. economy grew last year.")
        assert "U.S." in out
        assert "U. S." not in out

    def test_decimal_not_spaced(self):
        out = self._roundtrip("Pi is about 3.14 in value.")
        assert "3.14" in out
        assert "3. 14" not in out

    def test_eg_abbreviation_not_spaced(self):
        out = self._roundtrip("See e.g. the appendix for details.")
        assert "e.g." in out
        assert "e. g." not in out

    def test_filename_not_spaced(self):
        out = self._roundtrip("Open config.txt and edit it.")
        assert "config.txt" in out

    def test_real_sentence_boundary_still_splits(self):
        units = self.svc._split_into_sentences("First sentence. Second sentence.")
        assert len(units) == 2

    def test_real_boundary_rejoin_keeps_the_space(self):
        out = self._roundtrip("First sentence. Second sentence.")
        assert out == "First sentence. Second sentence."

    def test_cjk_delimiter_still_splits(self):
        units = self.svc._split_into_sentences("第一句。第二句。")
        assert len(units) == 2

    def test_question_and_exclamation_still_split(self):
        units = self.svc._split_into_sentences("Really? Yes! Done.")
        assert len(units) == 3

    # Codex M1 finding 4: split→rejoin must not synthesize spaces that were not
    # in the source — neither after CJK sentence punctuation nor after no-space
    # ASCII ? / !.
    def test_cjk_sentence_boundary_no_spurious_space(self):
        text = "第一句。第二句。"
        out = self._roundtrip(text)
        assert out == text
        assert "。 " not in out

    def test_japanese_sentence_boundary_no_spurious_space(self):
        text = "これは一文目。これは二文目。"
        assert self._roundtrip(text) == text

    def test_ascii_question_without_space_preserved(self):
        out = self._roundtrip("Why?Because it matters.")
        assert out == "Why?Because it matters."

    def test_cjk_with_real_following_latin_keeps_no_space(self):
        # After a CJK full stop the source has no space; rejoin must not add one.
        text = "结论。Method works."
        assert self._roundtrip(text) == text
