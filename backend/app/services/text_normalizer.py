"""Offset-preserving text normalization for the Quote Finder verifier (D2).

The verifier matches an LLM-emitted quote against stored chunk text. Both
sides are normalized with the IDENTICAL pipeline so quote/dash/ligature/width/
whitespace variants align; a parallel index map then projects a match in
normalized space back to RAW source offsets. The displayed quote is always the
raw slice — never the normalized text and never the LLM emission — so the map
must be exact.

Two levels, selected by ``fuzzy``:

* base (``fuzzy=False``)  — used by the exact-normalized tier. Folds only what
  copy-paste / PDF extraction routinely varies (NFKC per code point, invisible
  formatting chars, quote/dash/ellipsis, CJK width + corner quotes, whitespace
  runs). Case and diacritics are PRESERVED.
* fuzzy (``fuzzy=True``) — base plus ``casefold`` and combining-mark (Mn)
  stripping (Arabic tashkeel etc.). Used only by the rapidfuzz alignment tier.

All transforms are per-code-point so ``norm_to_raw[i]`` is the raw index that
produced ``norm[i]``. A single raw code point may expand to several normalized
chars (e.g. the ﬁ ligature → ``fi``, the … ellipsis → ``...``); every emitted
char maps back to that one raw index.
"""
from __future__ import annotations

import unicodedata
from typing import List, Tuple

# Punctuation folds applied per code point (after NFKC). NFKC already handles
# full-width forms and NBSP, so this table only covers what NFKC leaves alone:
# curly quotes, dash variants, the ellipsis char, and CJK corner quotes.
_FOLD_MAP = {
    "“": '"',  # “ left double quote
    "”": '"',  # ” right double quote
    "„": '"',  # „ low double quote
    "«": '"',  # « guillemet
    "»": '"',  # »
    "‘": "'",  # ‘ left single quote
    "’": "'",  # ’ right single quote / apostrophe
    "‚": "'",  # ‚
    "′": "'",  # ′ prime
    "–": "-",  # – en dash
    "—": "-",  # — em dash
    "‐": "-",  # ‐ hyphen
    "‑": "-",  # ‑ non-breaking hyphen
    "‒": "-",  # ‒ figure dash
    "―": "-",  # ― horizontal bar
    "…": "...",  # … ellipsis
    "「": '"',  # 「 corner bracket
    "」": '"',  # 」
    "『": '"',  # 『 white corner bracket
    "』": '"',  # 』
}

# Invisible / decorative code points dropped in every mode.
_DROP = {
    "­",  # soft hyphen
    "ـ",  # Arabic tatweel / kashida
    "﻿",  # zero-width no-break space / BOM
    "​",  # zero-width space
}


def _fold_codepoint(ch: str, *, fuzzy: bool) -> str | None:
    """Return the normalized form of a single raw code point.

    ``None`` signals "this is whitespace" (collapsed by the caller). ``""``
    signals "drop entirely". Otherwise a 1+ char string is returned.
    """
    if ch in _DROP:
        return ""
    if ch.isspace():
        return None

    # NFKC per code point: folds ligatures (ﬁ→fi), full-width (３→3), NBSP, etc.
    folded = unicodedata.normalize("NFKC", ch)

    out: List[str] = []
    for c in folded:
        if c in _DROP:
            continue
        if c in _FOLD_MAP:
            out.append(_FOLD_MAP[c])
            continue
        if fuzzy and unicodedata.category(c) == "Mn":
            # Combining mark (Arabic tashkeel, residual European accents):
            # stripped only in the fuzzy tier.
            continue
        out.append(c.casefold() if fuzzy else c)
    return "".join(out)


def normalize(text: str, *, fuzzy: bool = False) -> Tuple[str, List[int]]:
    """Normalize ``text`` and return ``(norm_text, norm_to_raw)``.

    ``norm_to_raw[i]`` is the index in ``text`` of the raw code point that
    produced ``norm_text[i]``. Whitespace runs collapse to a single space that
    maps to the first whitespace code point of the run.
    """
    out_chars: List[str] = []
    out_map: List[int] = []
    prev_space = False

    for raw_i, ch in enumerate(text):
        folded = _fold_codepoint(ch, fuzzy=fuzzy)
        if folded is None:  # whitespace
            if prev_space:
                continue
            out_chars.append(" ")
            out_map.append(raw_i)
            prev_space = True
            continue
        if folded == "":  # dropped
            continue
        prev_space = False
        for c in folded:
            out_chars.append(c)
            out_map.append(raw_i)

    return "".join(out_chars), out_map


def span_on_raw_boundaries(
    norm_to_raw: List[int], norm_start: int, norm_end: int
) -> bool:
    """True iff ``[norm_start, norm_end)`` begins and ends at raw code-point
    boundaries — i.e. the match spans WHOLE raw code points, not part of one
    code point's multi-char expansion (… → ``...``, ﬁ → ``fi``, ㍿ → 株式会社).

    A normalized match that ends inside an expansion does not correspond to a
    real source substring, so the exact-normalized tier must reject it.
    """
    n = len(norm_to_raw)
    if norm_start >= norm_end or norm_start < 0 or norm_end > n:
        return False
    start_ok = norm_start == 0 or norm_to_raw[norm_start] != norm_to_raw[norm_start - 1]
    end_ok = norm_end == n or norm_to_raw[norm_end] != norm_to_raw[norm_end - 1]
    return start_ok and end_ok


def raw_span(
    norm_to_raw: List[int], raw_len: int, norm_start: int, norm_end: int
) -> Tuple[int, int]:
    """Project a half-open normalized span ``[norm_start, norm_end)`` back to a
    half-open RAW span. ``raw_len`` is ``len(original_text)``."""
    if norm_start >= norm_end or not norm_to_raw:
        return (0, 0)
    raw_start = norm_to_raw[norm_start]
    raw_end = norm_to_raw[norm_end - 1] + 1
    return (raw_start, min(raw_end, raw_len))
