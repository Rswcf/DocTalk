"""Quote Finder verification gate (D1) — "LLM proposes, verifier disposes,
source displays."

The LLM only *proposes* a quote string. This service locates that string in the
stored source text (the cited chunk's text, ± retrieved neighbours) and returns
the RAW source slice for display. The LLM emission is never shown. Three tiers:

1. ``exact``      — exact substring of the raw source.
2. ``normalized`` — exact substring after identical offset-preserving
   normalization (folds quote/dash/ligature/width/whitespace variation),
   projected back to raw offsets.
3. ``aligned``    — rapidfuzz ``partial_ratio_alignment`` locates the best
   window; auto-accepted only above ``auto_cutoff`` AND past the length /
   length-ratio / document-quality guards. ``flagged`` when a fuzzy match is
   credible but a guard withholds auto-accept; ``dropped`` below ``flag_cutoff``
   or when the proposal cannot be located.

Guards (plan §8.1): short quotes over-match under fuzzy alignment, and a
garbled (OCR / low ``text_quality``) source cannot anchor a verbatim guarantee,
so fuzzy auto-accept is withheld in those cases. Deterministic substring tiers
(exact / normalized) are always trusted regardless of document quality.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from rapidfuzz import fuzz

from app.services.text_normalizer import normalize, raw_span, span_on_raw_boundaries

# Default thresholds — see plan §8.4(5).
AUTO_CUTOFF = 95.0  # fuzzy score at/above which we may auto-accept
FLAG_CUTOFF = 90.0  # below this a fuzzy match is dropped entirely
MIN_CHARS = 40      # shorter quotes never auto-accept on fuzzy alone
MIN_TOKENS = 8
LEN_RATIO_LO = 0.6  # matched-slice length vs proposed length sanity band
LEN_RATIO_HI = 1.67
MIN_COVERAGE = 0.95  # fraction of the PROPOSED quote that must align (anti-trim)
LOW_QUALITY_THRESHOLD = 0.75

_VERIFIED_STATUSES = ("exact", "normalized", "aligned")


@dataclass
class QuoteVerification:
    status: str  # exact | normalized | aligned | flagged | dropped
    display_text: Optional[str]  # raw source slice, or None when dropped
    raw_start: Optional[int]
    raw_end: Optional[int]
    score: float
    reason: Optional[str] = None

    @property
    def verified(self) -> bool:
        """Hard caller contract: render as a quote card ONLY when True.
        ``flagged`` carries display text for an optional confirmation UI but is
        never a verified quote; ``dropped`` carries nothing."""
        return self.status in _VERIFIED_STATUSES


_DROPPED = QuoteVerification(
    status="dropped", display_text=None, raw_start=None, raw_end=None, score=0.0
)


def _quality_caps_fuzzy(text_quality: Optional[float], parse_method: Optional[str]) -> bool:
    """A garbled source cannot back a verbatim guarantee via fuzzy matching."""
    if text_quality is not None and text_quality < LOW_QUALITY_THRESHOLD:
        return True
    if parse_method == "ocr" and text_quality is None:
        return True
    return False


def verify_quote(
    proposed: str,
    source_text: str,
    *,
    text_quality: Optional[float] = None,
    parse_method: Optional[str] = None,
    auto_cutoff: float = AUTO_CUTOFF,
    flag_cutoff: float = FLAG_CUTOFF,
    min_chars: int = MIN_CHARS,
    min_tokens: int = MIN_TOKENS,
) -> QuoteVerification:
    proposed = (proposed or "").strip()
    if not proposed or not source_text:
        return QuoteVerification("dropped", None, None, None, 0.0, "empty")

    # Tier 1: exact substring of the raw source.
    idx = source_text.find(proposed)
    if idx != -1:
        return QuoteVerification(
            "exact", source_text[idx : idx + len(proposed)], idx, idx + len(proposed), 100.0
        )

    # Tier 2: exact substring in normalized space, projected back to raw.
    # The match must span WHOLE raw code points — a match ending inside one
    # code point's expansion (… → ...) is not a real source substring.
    src_norm, src_map = normalize(source_text)
    pq_norm, _ = normalize(proposed)
    if pq_norm:
        nidx = src_norm.find(pq_norm)
        while nidx != -1:
            nend = nidx + len(pq_norm)
            if span_on_raw_boundaries(src_map, nidx, nend):
                rs, re = raw_span(src_map, len(source_text), nidx, nend)
                return QuoteVerification(
                    "normalized", source_text[rs:re].strip(), rs, re, 100.0
                )
            nidx = src_norm.find(pq_norm, nidx + 1)

    # Tier 3: rapidfuzz alignment over the fuzzy normalization.
    src_fnorm, src_fmap = normalize(source_text, fuzzy=True)
    pq_fnorm, _ = normalize(proposed, fuzzy=True)
    if not pq_fnorm or not src_fnorm:
        return _DROPPED

    align = fuzz.partial_ratio_alignment(pq_fnorm, src_fnorm, score_cutoff=flag_cutoff)
    if align is None:
        return _DROPPED

    rs, re = raw_span(src_fmap, len(source_text), align.dest_start, align.dest_end)
    display = source_text[rs:re].strip()
    if not display:
        return _DROPPED

    too_short = len(proposed) < min_chars or len(proposed.split()) < min_tokens
    ratio = len(display) / len(proposed)
    ratio_ok = LEN_RATIO_LO <= ratio <= LEN_RATIO_HI
    capped = _quality_caps_fuzzy(text_quality, parse_method)
    # Coverage = fraction of the PROPOSED quote that aligned. partial_ratio can
    # score 100 over only a substring of the proposal, silently trimming
    # invented prefix/suffix text. A verbatim guarantee requires (nearly) the
    # whole proposal to be found.
    coverage = (align.src_end - align.src_start) / len(pq_fnorm) if pq_fnorm else 0.0
    covered = coverage >= MIN_COVERAGE

    would_auto = align.score >= auto_cutoff and ratio_ok and covered
    if would_auto and not too_short and not capped:
        return QuoteVerification("aligned", display, rs, re, float(align.score))

    reason = (
        "low_quality" if capped else "too_short" if too_short
        else "coverage" if not covered
        else "len_ratio" if not ratio_ok else "below_auto"
    )
    return QuoteVerification("flagged", display, rs, re, float(align.score), reason)
