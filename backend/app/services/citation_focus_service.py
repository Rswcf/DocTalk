"""Sentence-level citation focus (precise-citations Phase 1).

A chat citation today highlights the whole cited chunk (150–300 tokens). When
the answer is supported by a single sentence, that is too coarse. Given the
cited chunk and the answer claim near the citation, pick the one sentence that
best supports the claim so the UI can highlight just it.

Conservative by design: return ``None`` (caller keeps the whole-chunk
highlight) unless one sentence CLEARLY dominates. Wrong-sentence highlighting
would be worse than today's whole-chunk highlight, so we only narrow when the
signal is unambiguous. Self-contained (no import from chat_service) to avoid a
circular import; the feature extraction mirrors chat_service._text_features.
"""
from __future__ import annotations

import re
from typing import List, Optional

_LATIN_WORD_RE = re.compile(r"[a-z]{2,}|\d+")  # content words (≥2 letters) or numbers
_NUMERIC_RE = re.compile(r"\d+")
_CJK_RE = re.compile(r"[一-鿿]")
# ASCII .?! is a boundary only before whitespace/EOS (mirrors parse_service);
# CJK 。！？； always end a sentence (no inter-sentence spaces in CJK).
_SENT_SPLIT_RE = re.compile(r"(?<=[.!?])\s+|(?<=[。！？；])")

# Low-signal function words excluded from overlap scoring so a sentence cannot
# dominate purely by sharing generic predicate/filler words with the claim.
_STOPWORDS = {
    "the", "and", "for", "are", "was", "were", "but", "not", "you", "all",
    "any", "can", "had", "has", "have", "her", "his", "its", "our", "out",
    "that", "this", "with", "from", "they", "them", "their", "there", "then",
    "than", "what", "when", "which", "who", "whom", "will", "would", "could",
    "should", "into", "onto", "over", "under", "about", "above", "below",
    "been", "being", "does", "did", "done", "such", "also", "more", "most",
    "some", "only", "very", "just", "like", "how", "why", "where",
    # common short function words
    "it", "is", "as", "at", "by", "of", "on", "in", "to", "or", "an", "be",
    "we", "he", "if", "so", "do", "no", "up", "me", "us", "my",
}


def _features(text: str) -> set[str]:
    lowered = text.lower()
    feats = {w for w in _LATIN_WORD_RE.findall(lowered) if w not in _STOPWORDS}
    cjk = _CJK_RE.findall(text)
    feats.update(cjk)
    for i in range(len(cjk) - 1):
        feats.add(cjk[i] + cjk[i + 1])
    return feats


def _numeric_tokens(text: str) -> set[str]:
    return set(_NUMERIC_RE.findall(text))


def _split_sentences(text: str) -> List[str]:
    return [s for s in (seg.strip() for seg in _SENT_SPLIT_RE.split(text)) if s]


def current_claim(buffer: str) -> str:
    """The claim a citation refers to = the CURRENT sentence segment of the
    answer buffer, not the whole rolling window. Returns the last non-empty
    sentence so `[n]` right after a period still maps to the finished sentence,
    while a new sentence's citation maps to the new sentence."""
    segs = _split_sentences(buffer)
    return segs[-1] if segs else ""


def focus_sentence(
    chunk_text: str,
    claim_text: str,
    *,
    min_overlap: int = 2,
    max_sentence_ratio: float = 0.7,
    dominance: float = 1.5,
) -> Optional[str]:
    """Best-supported sentence of ``chunk_text`` for ``claim_text``, verbatim,
    or ``None`` to keep the whole-chunk highlight."""
    if not chunk_text or not claim_text:
        return None
    sentences = _split_sentences(chunk_text)
    if len(sentences) < 2:
        return None
    claim_feats = _features(claim_text)
    if not claim_feats:
        return None

    scored = sorted(
        ((len(claim_feats & _features(s)), s) for s in sentences),
        key=lambda x: x[0],
        reverse=True,
    )
    best_overlap, best = scored[0]
    runner = scored[1][0] if len(scored) > 1 else 0
    if best_overlap < min_overlap:
        return None
    if runner > 0 and best_overlap < runner * dominance:
        return None  # ambiguous — don't guess
    # Numeric/date consistency: if the claim names numbers (years, percents,
    # currency, page-like), the focused sentence MUST contain all of them —
    # else a sentence sharing only predicate words could be highlighted while
    # its number contradicts the claim (worse than the whole-chunk highlight).
    claim_nums = _numeric_tokens(claim_text)
    if claim_nums and not claim_nums <= _numeric_tokens(best):
        return None
    # Only narrow when it actually narrows: the sentence must be meaningfully
    # shorter than the whole chunk (script-agnostic — CJK chars are dense, so a
    # char floor would mis-fire). Otherwise the whole-chunk highlight is fine.
    if len(best) > len(chunk_text) * max_sentence_ratio:
        return None
    return best
