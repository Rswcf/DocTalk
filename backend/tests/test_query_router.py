from __future__ import annotations

from app.services.query_router import QueryIntent, query_router


def test_routes_english_whole_document_summary() -> None:
    route = query_router.route("Summarize the key points of this document")

    assert route.primary_intent == QueryIntent.DOCUMENT_SUMMARY
    assert route.coverage == "whole_doc"
    assert route.scope == "single_doc"
    assert route.confidence >= 0.9


def test_routes_chinese_whole_document_summary() -> None:
    route = query_router.route("请总结这篇文档的要点")

    assert route.primary_intent == QueryIntent.DOCUMENT_SUMMARY
    assert route.coverage == "whole_doc"


def test_routes_generic_summary_in_document_chat_to_whole_document() -> None:
    route = query_router.route("总结一下")

    assert route.primary_intent == QueryIntent.DOCUMENT_SUMMARY
    assert route.coverage == "whole_doc"
    assert route.confidence >= 0.75


def test_routes_japanese_whole_document_summary() -> None:
    route = query_router.route("この文書全体の要約をしてください")

    assert route.primary_intent == QueryIntent.DOCUMENT_SUMMARY
    assert route.coverage == "whole_doc"


def test_routes_spanish_whole_document_summary() -> None:
    route = query_router.route("Dame un resumen de este documento")

    assert route.primary_intent == QueryIntent.DOCUMENT_SUMMARY
    assert route.coverage == "whole_doc"


def test_routes_german_whole_document_summary() -> None:
    route = query_router.route("Gib mir eine Zusammenfassung dieses Dokuments")

    assert route.primary_intent == QueryIntent.DOCUMENT_SUMMARY
    assert route.coverage == "whole_doc"


def test_routes_portuguese_whole_document_summary() -> None:
    route = query_router.route("Resuma este documento")

    assert route.primary_intent == QueryIntent.DOCUMENT_SUMMARY
    assert route.coverage == "whole_doc"


def test_routes_italian_whole_document_summary() -> None:
    route = query_router.route("Riassumi questo documento")

    assert route.primary_intent == QueryIntent.DOCUMENT_SUMMARY
    assert route.coverage == "whole_doc"


def test_routes_arabic_whole_document_summary() -> None:
    route = query_router.route("لخص هذا المستند")

    assert route.primary_intent == QueryIntent.DOCUMENT_SUMMARY
    assert route.coverage == "whole_doc"


def test_routes_hindi_whole_document_summary() -> None:
    route = query_router.route("इस दस्तावेज़ का सारांश दें")

    assert route.primary_intent == QueryIntent.DOCUMENT_SUMMARY
    assert route.coverage == "whole_doc"


def test_routes_section_summary_separately_from_whole_document() -> None:
    route = query_router.route("Summarize the risk factors section")

    assert route.primary_intent == QueryIntent.SECTION_SUMMARY
    assert route.coverage == "section"


def test_routes_table_numeric_query() -> None:
    route = query_router.route("Which company has the highest 2028 revenue in the table?")

    assert QueryIntent.TABLE_QUERY in route.intents
    assert "table" in route.modality


def test_routes_financial_metric_question_to_table_query() -> None:
    route = query_router.route("What is the RMB 718 target price based on?")

    assert route.primary_intent == QueryIntent.TABLE_QUERY
    assert QueryIntent.TABLE_QUERY in route.intents


def test_plain_page_number_lookup_does_not_become_table_query() -> None:
    route = query_router.route("What is on page 5?")

    assert QueryIntent.TABLE_QUERY not in route.intents


def test_page_lookup_keeps_table_intent_when_query_mentions_table() -> None:
    route = query_router.route("show table on page 8")

    assert route.primary_intent == QueryIntent.PAGE_LOOKUP
    assert route.page_ref == 8
    assert QueryIntent.TABLE_QUERY in route.intents


def test_page_lookup_keeps_comparison_intent_when_query_mentions_comparison() -> None:
    route = query_router.route("compare revenue on page 5 and page 6")

    assert route.primary_intent == QueryIntent.PAGE_LOOKUP
    assert route.page_ref == 5
    assert QueryIntent.COMPARISON in route.intents


def test_routes_existence_query_as_exhaustive_scan_candidate() -> None:
    route = query_router.route("Does this contract contain a non-compete clause?", domain_mode="legal")

    assert QueryIntent.EXISTENCE_CHECK in route.intents
    assert route.coverage == "exhaustive_scan"


def test_routes_collection_summary_as_decomposition_candidate() -> None:
    route = query_router.route("Summarize these documents and compare their conclusions", is_collection=True)

    assert QueryIntent.COMPARISON in route.intents
    assert route.needs_decomposition is True
    assert route.scope == "collection"


def test_plain_lookup_remains_local_qa() -> None:
    route = query_router.route("What is Cambrian's rating?")

    assert route.primary_intent == QueryIntent.LOCAL_QA
    assert route.coverage == "top_hits"


def test_pure_vs_mixed_page_lookup_r2a():
    """R2a: pure page lookup → (PAGE_LOOKUP,) [no fallback]; page+topic → carries
    LOCAL_QA [keeps semantic fallback on a page-chunk miss]. (Codex r2a r2 blocker)"""
    from app.services.query_router import QueryIntent, query_router

    for pure_q in ("what is on page 350", "page 350", "第350页有什么",
                   "what is on page 350 of the document", "show me page 7",
                   "What is on page 5", "co je na straně 350 v dokumentu"):
        assert query_router.route(pure_q).intents == (QueryIntent.PAGE_LOOKUP,), pure_q

    # Short topics — incl. all-caps acronyms that collide with lowercase filler
    # words (US/IN/DE/LA/CO ~ us/in/de/la/co) — must stay mixed (Codex r2a r3+r4).
    for mixed_q in ("requirements on page 12", "does page 12 mention requirements",
                    "concepto de cohesión en la página 14",
                    "AI on page 12", "Q3 on page 5", "IP on page 9", "税 第12页",
                    "US on page 12", "IN on page 12", "DE on page 12",
                    "LA on page 12", "CO on page 12"):
        r = query_router.route(mixed_q)
        assert r.primary_intent == QueryIntent.PAGE_LOOKUP, mixed_q
        assert r.intents != (QueryIntent.PAGE_LOOKUP,), mixed_q
        assert QueryIntent.LOCAL_QA in r.intents, mixed_q
