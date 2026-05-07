from __future__ import annotations

from app.services.claim_verifier_service import claim_verifier_service


def test_verified_answer_passes_with_valid_overlapping_citation() -> None:
    report = claim_verifier_service.verify(
        "MetaX 2028 revenue is listed as RMB 7.8 billion in the valuation table.",
        [
            {
                "ref_index": 1,
                "offset": 40,
                "table_context": "Table p.7 | Company | 2028 Revenue | MetaX | RMB 7.8 billion |",
            }
        ],
        {1},
        retrieved_count=1,
    )

    assert report.status == "pass"
    assert report.claim_count == 1
    assert report.cited_claim_count == 1
    assert report.invalid_citation_count == 0
    assert report.low_overlap_citation_count == 0


def test_supported_answer_without_citations_fails() -> None:
    report = claim_verifier_service.verify(
        "MetaX 2028 revenue is listed as RMB 7.8 billion in the valuation table.",
        [],
        {1},
        retrieved_count=1,
    )

    assert report.status == "fail"
    assert "no_citations_for_supported_answer" in report.reasons
    assert report.uncited_claim_count == 1


def test_invalid_citation_reference_fails() -> None:
    report = claim_verifier_service.verify(
        "MetaX 2028 revenue is listed as RMB 7.8 billion in the valuation table.",
        [
            {
                "ref_index": 9,
                "offset": 72,
                "table_context": "Table p.7 | Company | 2028 Revenue | MetaX | RMB 7.8 billion |",
            }
        ],
        {1},
        retrieved_count=1,
    )

    assert report.status == "fail"
    assert report.invalid_citation_count == 1
    assert "invalid_citation_refs" in report.reasons


def test_uncited_claim_units_warn_when_other_claim_has_citation() -> None:
    answer = (
        "MetaX 2028 revenue is listed as RMB 7.8 billion in the valuation table.\n"
        "Iluvatar is described as having stronger visibility but lower near-term margins."
    )
    report = claim_verifier_service.verify(
        answer,
        [
            {
                "ref_index": 1,
                "offset": 40,
                "table_context": "Table p.7 | Company | 2028 Revenue | MetaX | RMB 7.8 billion |",
            }
        ],
        {1},
        retrieved_count=2,
    )

    assert report.status == "warn"
    assert report.claim_count == 2
    assert report.cited_claim_count == 1
    assert report.uncited_claim_count == 1
    assert "uncited_claim_units" in report.reasons


def test_low_overlap_citation_warns() -> None:
    report = claim_verifier_service.verify(
        "MetaX 2028 revenue is listed as RMB 7.8 billion in the valuation table.",
        [
            {
                "ref_index": 1,
                "offset": 40,
                "context_text": "The risk section discusses export restrictions and supply chain delays.",
            }
        ],
        {1},
        retrieved_count=1,
    )

    assert report.status == "warn"
    assert report.low_overlap_citation_count == 1
    assert "low_claim_source_overlap" in report.reasons


def test_numeric_mismatch_citation_warns_even_with_shared_entity_terms() -> None:
    report = claim_verifier_service.verify(
        "MetaX 2028 revenue is listed as RMB 7.8 billion in the valuation table.",
        [
            {
                "ref_index": 1,
                "offset": 40,
                "table_context": "Table p.7 | Company | 2028 Revenue | MetaX | RMB 4.2 billion |",
            }
        ],
        {1},
        retrieved_count=1,
    )

    assert report.status == "warn"
    assert report.numeric_mismatch_citation_count == 1
    assert "numeric_claim_source_mismatch" in report.reasons


def test_general_answer_without_retrieved_evidence_is_not_penalized() -> None:
    report = claim_verifier_service.verify(
        "I need a little more context before I can answer that question accurately.",
        [],
        set(),
        retrieved_count=0,
    )

    assert report.status == "pass"
    assert report.reasons == ()
