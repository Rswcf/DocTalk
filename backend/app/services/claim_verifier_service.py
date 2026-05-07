from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Literal

VerificationStatus = Literal["pass", "warn", "fail"]

_WORD_RE = re.compile(r"[a-zA-Z][a-zA-Z0-9_\-]{2,}|\b\d+(?:[.,]\d+)*(?:%|x|X)?\b")
_NUMBER_RE = re.compile(r"\b\d+(?:[.,]\d+)*(?:%|x|X)?\b")
_CJK_RE = re.compile(r"[\u4e00-\u9fff]")
_BULLET_OR_HEADING_RE = re.compile(r"^\s*(?:#{1,6}\s+|\*\*[^*]+\*\*:?\s*$)")
_NUMBERED_LIST_PREFIX_RE = re.compile(r"^\s*\d{1,3}[.)]\s+")
_GENERIC_WORDS = {
    "about",
    "also",
    "and",
    "answer",
    "are",
    "based",
    "because",
    "been",
    "being",
    "can",
    "cited",
    "could",
    "document",
    "documents",
    "evidence",
    "fragment",
    "fragments",
    "from",
    "has",
    "have",
    "however",
    "information",
    "into",
    "its",
    "may",
    "more",
    "not",
    "one",
    "only",
    "provided",
    "question",
    "report",
    "section",
    "should",
    "source",
    "sources",
    "than",
    "the",
    "their",
    "these",
    "therefore",
    "this",
    "that",
    "was",
    "were",
    "with",
    "would",
}


@dataclass(frozen=True)
class ClaimUnit:
    text: str
    start: int
    end: int


@dataclass(frozen=True)
class ClaimVerificationReport:
    status: VerificationStatus
    score: float
    claim_count: int
    cited_claim_count: int
    uncited_claim_count: int
    citation_count: int
    invalid_citation_count: int
    low_overlap_citation_count: int
    numeric_mismatch_citation_count: int
    reasons: tuple[str, ...]

    def to_payload(self) -> dict:
        return {
            "status": self.status,
            "score": round(self.score, 3),
            "claim_count": self.claim_count,
            "cited_claim_count": self.cited_claim_count,
            "uncited_claim_count": self.uncited_claim_count,
            "citation_count": self.citation_count,
            "invalid_citation_count": self.invalid_citation_count,
            "low_overlap_citation_count": self.low_overlap_citation_count,
            "numeric_mismatch_citation_count": self.numeric_mismatch_citation_count,
            "reasons": list(self.reasons),
        }


def _text_features(text: str) -> set[str]:
    lowered = text.lower()
    features = {
        token
        for token in _WORD_RE.findall(lowered)
        if token not in _GENERIC_WORDS and len(token) >= 3
    }
    cjk_chars = _CJK_RE.findall(text)
    features.update(cjk_chars)
    for index in range(len(cjk_chars) - 1):
        features.add(cjk_chars[index] + cjk_chars[index + 1])
    return features


def _numeric_features(text: str) -> set[str]:
    without_prefix = _NUMBERED_LIST_PREFIX_RE.sub("", text)
    return {
        token.lower().replace(",", "")
        for token in _NUMBER_RE.findall(without_prefix)
    }


def _claim_units(text: str) -> list[ClaimUnit]:
    units: list[ClaimUnit] = []
    cursor = 0
    for raw_line in text.splitlines(keepends=True):
        line_start = cursor
        cursor += len(raw_line)
        stripped = raw_line.strip()
        if len(stripped) < 24:
            continue
        if _BULLET_OR_HEADING_RE.match(stripped):
            continue
        if stripped.endswith(":") and len(stripped.split()) <= 8:
            continue
        end = line_start + len(raw_line.rstrip("\n\r"))
        units.append(ClaimUnit(text=stripped, start=line_start, end=end))

    if units:
        return units

    stripped = text.strip()
    if len(stripped) >= 24:
        return [ClaimUnit(text=stripped, start=0, end=len(text))]
    return []


def _unit_for_offset(units: list[ClaimUnit], offset: int) -> ClaimUnit | None:
    if not units:
        return None
    for unit in units:
        if unit.start <= offset <= unit.end + 2:
            return unit
    return min(units, key=lambda unit: min(abs(offset - unit.start), abs(offset - unit.end)))


def _citation_context(citation: dict) -> str:
    parts = [
        citation.get("table_context"),
        citation.get("context_text"),
        citation.get("text_snippet"),
    ]
    return " ".join(str(part or "") for part in parts)


def _safe_int(value: object, default: int = 0) -> int:
    try:
        return int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return default


class ClaimVerifierService:
    def verify(
        self,
        assistant_text: str,
        citations: list[dict],
        valid_ref_indexes: set[int],
        *,
        retrieved_count: int,
    ) -> ClaimVerificationReport:
        units = _claim_units(assistant_text or "")
        valid_refs = {int(ref) for ref in valid_ref_indexes if isinstance(ref, int)}
        citation_offsets = [
            _safe_int(citation.get("offset"), 0)
            for citation in citations
            if isinstance(citation, dict)
        ]
        cited_unit_indexes = {
            index
            for index, unit in enumerate(units)
            if any(unit.start <= offset <= unit.end + 2 for offset in citation_offsets)
        }
        invalid_citations = [
            citation
            for citation in citations
            if not isinstance(citation, dict)
            or _safe_int(citation.get("ref_index"), -1) not in valid_refs
        ]

        low_overlap_count = 0
        numeric_mismatch_count = 0
        for citation in citations:
            if not isinstance(citation, dict):
                continue
            citation_context = _citation_context(citation)
            context_features = _text_features(citation_context)
            if len(context_features) < 2:
                continue
            unit = _unit_for_offset(units, _safe_int(citation.get("offset"), 0))
            if unit is None:
                continue
            claim_features = _text_features(unit.text)
            if len(claim_features) >= 2 and not (claim_features & context_features):
                low_overlap_count += 1
            claim_numbers = _numeric_features(unit.text)
            if claim_numbers and not claim_numbers.issubset(_numeric_features(citation_context)):
                numeric_mismatch_count += 1

        claim_count = len(units)
        cited_claim_count = len(cited_unit_indexes)
        uncited_claim_count = max(0, claim_count - cited_claim_count)
        reasons: list[str] = []
        if claim_count > 0 and retrieved_count > 0 and not citations:
            reasons.append("no_citations_for_supported_answer")
        if uncited_claim_count > 0 and citations:
            reasons.append("uncited_claim_units")
        if invalid_citations:
            reasons.append("invalid_citation_refs")
        if low_overlap_count > 0:
            reasons.append("low_claim_source_overlap")
        if numeric_mismatch_count > 0:
            reasons.append("numeric_claim_source_mismatch")

        penalty = (
            uncited_claim_count * 0.22
            + len(invalid_citations) * 0.35
            + low_overlap_count * 0.18
            + numeric_mismatch_count * 0.28
        )
        score = max(0.0, min(1.0, 1.0 - penalty))
        if "no_citations_for_supported_answer" in reasons or invalid_citations:
            status: VerificationStatus = "fail"
        elif reasons:
            status = "warn"
        else:
            status = "pass"

        return ClaimVerificationReport(
            status=status,
            score=score,
            claim_count=claim_count,
            cited_claim_count=cited_claim_count,
            uncited_claim_count=uncited_claim_count,
            citation_count=len(citations),
            invalid_citation_count=len(invalid_citations),
            low_overlap_citation_count=low_overlap_count,
            numeric_mismatch_citation_count=numeric_mismatch_count,
            reasons=tuple(reasons),
        )


claim_verifier_service = ClaimVerifierService()
