"""Tests for sentence-level citation focus (precise-citations Phase 1).

Given a cited chunk and the answer claim near the citation, pick the single
chunk sentence that best supports the claim — so the UI can highlight that
sentence instead of the whole chunk. Conservative: return None (keep the
whole-chunk highlight) unless one sentence clearly dominates, so precision
only improves, never regresses.
"""
from __future__ import annotations

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services.citation_focus_service import focus_sentence  # noqa: E402

CHUNK = (
    "The committee met in March. Fluency renders the translator invisible to "
    "the reader. Publishers in turn reward transparent prose above all else. "
    "These trends accelerated after 1990."
)


class TestFocus:
    def test_picks_the_supporting_sentence(self):
        claim = "Why does fluency make the translator invisible?"
        got = focus_sentence(CHUNK, claim)
        assert got == "Fluency renders the translator invisible to the reader."

    def test_returned_sentence_is_verbatim_substring_of_chunk(self):
        got = focus_sentence(CHUNK, "how do publishers reward transparent prose")
        assert got is not None
        assert got in CHUNK

    def test_no_overlap_returns_none(self):
        assert focus_sentence(CHUNK, "quantum chromodynamics lattice gauge") is None

    def test_ambiguous_claim_returns_none(self):
        # A claim that overlaps two sentences roughly equally → don't guess.
        claim = "translator invisible publishers transparent prose reward reader"
        assert focus_sentence(CHUNK, claim) is None

    def test_small_chunk_returns_none(self):
        assert focus_sentence("Fluency matters.", "why does fluency matter") is None

    def test_single_sentence_chunk_returns_none(self):
        big_one = "Fluency renders the translator invisible to the reader " * 4 + "."
        assert focus_sentence(big_one, "fluency translator invisible") is None

    def test_empty_inputs_return_none(self):
        assert focus_sentence("", "claim") is None
        assert focus_sentence(CHUNK, "") is None


class TestNumericSafety:
    # Codex finding 1: a sentence sharing generic predicate words must NOT be
    # focused when its number/date contradicts the claim — a wrong narrow
    # highlight is worse than the whole-chunk highlight.
    def test_year_contradiction_returns_none(self):
        got = focus_sentence(
            "The report was published in 2023. The company generated 2024 "
            "revenue from subscriptions.",
            "The report was published in 2024",
        )
        assert got is None

    def test_percent_contradiction_returns_none(self):
        got = focus_sentence(
            "Revenue rose to 8 percent. Margin was 12 percent.",
            "Revenue rose to 12 percent",
        )
        assert got is None

    def test_matching_number_still_focuses(self):
        got = focus_sentence(
            "Revenue rose to 8 percent in the quarter. Margin was flat overall.",
            "By how much did revenue rise to 8 percent",
        )
        assert got == "Revenue rose to 8 percent in the quarter."


class TestStopwords:
    def test_shared_stopwords_alone_do_not_focus(self):
        # Two sentences share only function words with the claim → no clear
        # content winner → None.
        chunk = "It was the case that this happened. They went to the store later."
        assert focus_sentence(chunk, "was it the case that this is what they had") is None


class TestCurrentClaim:
    # Codex finding 2: the claim for a citation is the CURRENT sentence segment,
    # not the whole rolling buffer.
    def test_current_claim_returns_last_segment(self):
        from app.services.citation_focus_service import current_claim

        buf = "Revenue rose to 8 percent year over year. Margin fell sharply"
        assert current_claim(buf) == "Margin fell sharply"

    def test_current_claim_keeps_finished_sentence_when_at_boundary(self):
        from app.services.citation_focus_service import current_claim

        buf = "Revenue rose to 8 percent."
        assert current_claim(buf) == "Revenue rose to 8 percent."


class TestCJK:
    CHUNK_ZH = (
        "委员会于三月开会。流畅的译文让译者对读者隐身。出版社因此奖励透明的散文。"
        "这些趋势在一九九零年后加速。"
    )

    def test_picks_supporting_cjk_sentence(self):
        got = focus_sentence(self.CHUNK_ZH, "为什么流畅让译者隐身")
        assert got == "流畅的译文让译者对读者隐身。"
        assert got in self.CHUNK_ZH
