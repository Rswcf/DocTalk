"""Tests for the Quote Finder verification gate (D1).

Trust contract: a quote card is shown only if the server can locate the
proposed quote in the stored source text. The DISPLAYED text is always the raw
source slice — never the LLM emission. Three tiers: exact substring, exact in
normalized space (projected back to raw), rapidfuzz alignment. Fuzzy auto-accept
is guarded by minimum length, length ratio, and document text quality.
"""
from __future__ import annotations

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services.quote_verification_service import verify_quote  # noqa: E402

SOURCE = (
    "Fluency is the most prized quality in translation today, and it renders "
    "the translator’s labour invisible to the reader. Publishers reward "
    "transparent prose above all else."
)


class TestExactTier:
    def test_exact_substring(self):
        v = verify_quote("the most prized quality in translation today", SOURCE)
        assert v.status == "exact"
        assert v.display_text == "the most prized quality in translation today"
        assert v.score == 100.0

    def test_display_is_source_slice_not_input_casing(self):
        # Exact substring match returns the source slice verbatim.
        v = verify_quote("Publishers reward transparent prose", SOURCE)
        assert v.status == "exact"
        assert v.display_text == "Publishers reward transparent prose"


class TestNormalizedTier:
    def test_straight_quote_matches_curly_source_and_displays_curly(self):
        # LLM emits a straight apostrophe; source has a curly one.
        v = verify_quote("the translator's labour invisible", SOURCE)
        assert v.status == "normalized"
        # Display preserves the source's curly apostrophe — verbatim.
        assert v.display_text == "the translator’s labour invisible"

    def test_whitespace_and_dash_variation(self):
        src = "a cost—benefit  analysis was done"
        v = verify_quote("cost-benefit analysis", src)
        assert v.status == "normalized"
        assert v.display_text == "cost—benefit  analysis"


class TestFuzzyTier:
    def test_minor_typo_long_quote_auto_accepts_and_displays_correct_source(self):
        # LLM drops a letter ('translaton') in a long quote; high similarity.
        proposed = "Fluency is the most prized quality in translaton today"
        v = verify_quote(proposed, SOURCE)
        assert v.status == "aligned"
        assert v.score >= 95.0
        # Display is the CORRECT source spelling, not the LLM's typo.
        assert "translation" in v.display_text
        assert "translaton" not in v.display_text

    def test_hallucinated_quote_is_dropped(self):
        v = verify_quote(
            "The author argues that machine translation will replace humans by 2030",
            SOURCE,
        )
        assert v.status == "dropped"
        assert v.display_text is None

    def test_empty_proposed_is_dropped(self):
        assert verify_quote("   ", SOURCE).status == "dropped"


class TestGuards:
    def test_short_fuzzy_match_is_flagged_not_auto_accepted(self):
        # A short near-match (below the min-length bar) must never auto-accept,
        # even at a high score — short phrases over-match.
        src = "The colour of the evening sky over the harbour."
        v = verify_quote("the color of th", src)
        assert v.status != "aligned"

    def test_low_text_quality_caps_fuzzy_to_flagged(self):
        proposed = "Fluency is the most prized quality in translaton today"
        v = verify_quote(proposed, SOURCE, text_quality=0.40)
        assert v.status == "flagged"

    def test_ocr_without_quality_caps_fuzzy_to_flagged(self):
        proposed = "Fluency is the most prized quality in translaton today"
        v = verify_quote(proposed, SOURCE, parse_method="ocr", text_quality=None)
        assert v.status == "flagged"

    def test_exact_tier_unaffected_by_low_quality(self):
        # Deterministic substring matches are safe even on low-quality docs.
        v = verify_quote(
            "the most prized quality in translation today", SOURCE, text_quality=0.10
        )
        assert v.status == "exact"


class TestOffsets:
    def test_offsets_point_at_display_slice(self):
        v = verify_quote("Publishers reward transparent prose", SOURCE)
        assert SOURCE[v.raw_start : v.raw_end] == v.display_text


class TestFullCoverage:
    # Codex M1 finding 1: a longer proposal whose extra text is invented must
    # not auto-accept just because a SUBSTRING matches the source verbatim.
    def test_hallucinated_suffix_not_aligned(self):
        # Codex probe: whole source verbatim + an invented clause. RapidFuzz
        # partial-aligns the source substring at score 100 and trims the
        # invention — must NOT auto-accept (the proposal is not verbatim).
        proposed = SOURCE + " This invented downstream claim is not in the paper."
        v = verify_quote(proposed, SOURCE)
        assert v.status != "aligned"

    def test_hallucinated_prefix_not_aligned(self):
        proposed = "The author concedes that machine translation is inevitable, yet " + SOURCE
        v = verify_quote(proposed, SOURCE)
        assert v.status != "aligned"

    def test_full_proposal_still_aligns(self):
        # The whole proposal is verbatim-ish (one typo) → still auto-accepts.
        proposed = "Fluency is the most prized quality in translaton today"
        assert verify_quote(proposed, SOURCE).status == "aligned"


class TestNormalizedBoundary:
    # Codex M1 finding 2: a normalized match must align to whole raw code
    # points, not end inside one code point's expansion (… → ...).
    def test_partial_ellipsis_expansion_not_normalized(self):
        v = verify_quote("wait..", "wait… really")
        assert v.status != "normalized"

    def test_partial_cjk_compat_expansion_not_normalized(self):
        v = verify_quote("A株式", "A㍿B")  # ㍿ NFKC-expands to 株式会社
        assert v.status != "normalized"

    def test_full_ellipsis_still_normalizes(self):
        v = verify_quote("wait...", "please wait… for the result")
        assert v.status == "normalized"
        assert v.display_text == "wait…"


class TestVerifiedFlag:
    # Codex M1 finding 3: flagged candidates must not be renderable as
    # verified quote cards. `verified` is the hard contract for callers.
    def test_exact_normalized_aligned_are_verified(self):
        assert verify_quote("Publishers reward transparent prose", SOURCE).verified is True
        assert verify_quote("the translator's labour invisible", SOURCE).verified is True

    def test_flagged_is_not_verified(self):
        proposed = "Fluency is the most prized quality in translaton today"
        v = verify_quote(proposed, SOURCE, text_quality=0.40)
        assert v.status == "flagged"
        assert v.verified is False

    def test_dropped_is_not_verified(self):
        assert verify_quote("   ", SOURCE).verified is False
