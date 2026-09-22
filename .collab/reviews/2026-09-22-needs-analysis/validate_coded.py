"""Validate a coded JSONL file against the needs-analysis codebook (01-plan-fable.md §2) — stdlib only.

    python3 <EXPORT_DIR>/prepass/validate_coded.py <coded.jsonl> <ids file> [--partial]

The record type is inferred from its fields: `turns` + `uid` -> conversation; `uid` without `turns` -> user;
`demo_slug` without `uid` -> anonymous session. With a uid list, a conversation file must hold exactly the
sessions those users own (sessions_mech.jsonl) and a user file exactly those uids; with a sid list, exactly those
sessions. --partial relaxes coverage (for the every-10-users runs) but still rejects unexpected ids.
Privacy: no 9-word window of summary/notes/doc_profile may occur verbatim in any message of the export, and no
20-character window may occur verbatim in a message written in a non-Latin script. Exits non-zero on any failure.
Lives in <EXPORT_DIR>/prepass/; reads ../users.json, ../anonymous_demo_sessions.json and ./sessions_mech.jsonl.
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
EXPORT = os.path.dirname(HERE)

E = {
    "era": {"E0_pre_R2", "E1_R2_latency", "E2_post_latency", "E3_post_TA"},
    "doc_size_band": {"xs", "s", "m", "l", "xl", "unknown"},
    "doc_type_coded": {"pdf_text", "pdf_scanned", "pdf_garbled", "docx", "pptx", "xlsx", "txt", "url", "demo", "none",
                       "unknown"},
    "jtbd": {"exam_study", "thesis_or_paper_writing", "literature_reading", "legal_contract_review",
             "finance_or_business_analysis", "technical_or_manual_lookup", "admin_or_personal_document", "translation",
             "writing_generation", "data_or_table_extraction", "product_evaluation", "offtopic_general", "unclear"},
    "jtbd_recurrence": {"recurring", "one_off", "unclear"},
    "persona": {"student", "graduate_researcher", "academic_staff", "legal_professional", "finance_professional",
                "business_professional", "engineer_or_developer", "educator", "general_consumer",
                "evaluator_or_competitor", "unknown"},
    "first_question_specificity": {"specific", "generic", "test"},
    "satisfied_first_answer": {"yes", "partial", "no", "missing", "unknown"},
    "qtype": {"factual_lookup", "locate_page_or_item", "verbatim_quote", "summarize_whole", "summarize_part",
              "explain_or_define", "analyze_or_evaluate", "compare_within_doc", "extract_table_or_numbers",
              "list_or_enumerate", "generate_or_write", "translate", "export_or_format", "meta_product",
              "offtopic_general", "followup_clarify", "complaint_or_correction", "greeting_or_test", "prompt_injection"},
    "answer": {"present", "missing"},
    "outcome": {"satisfied", "partial", "unsatisfied", "missing_answer", "unknown_terminal"},
    "outcome_evidence": {"explicit_complaint", "explicit_correction", "asked_refund_or_cancel", "repeat_same_question",
                         "rephrase_same_question", "mode_switch", "regenerate_or_continue", "abandoned_after",
                         "citation_click_in_window", "explicit_thanks", "asked_deeper_followup",
                         "switched_topic_normally", "none"},
    "failure": {"retrieval_miss_asserted", "not_found_unverifiable", "page_or_item_lookup_failed",
                "whole_doc_coverage_incomplete", "refusal_overrigid_scope", "refusal_injection_false_positive",
                "incorrect_or_hallucinated", "citation_wrong_or_missing", "wrong_answer_language",
                "missing_answer_no_reply", "truncated_or_cut_off", "parse_or_upload_failure", "garbled_or_ocr_text",
                "table_or_number_extraction_failed", "export_or_format_refused", "generation_refused",
                "jargon_or_confusing_ui", "slow_complaint", "other"},
    "capability": {"export_excel_csv", "export_pdf_docx", "download_answer", "write_or_draft", "rewrite_or_paraphrase",
                   "translate_document", "translate_answer", "summarize_whole_document", "compare_documents",
                   "multi_document_chat", "ocr_scanned", "table_extraction", "figures_or_images",
                   "outside_knowledge_or_web", "longer_or_more_detailed", "page_navigation", "verbatim_quotes_with_pages",
                   "citation_formatting", "integration_drive_zotero", "mobile_or_ui", "more_free_quota", "larger_file",
                   "other"},
    "overall_outcome": {"job_done", "job_partly_done", "job_failed", "evaluation_only", "unclear"},
    "wall_reaction": {"continued_same_session", "worked_around", "upgrade_click_no_checkout", "checkout_abandoned", "paid",
                      "left_within_10min", "left_later", "unknown"},
    "wtp": {"none", "nudge_only", "upgrade_click", "checkout_started", "paid", "paid_then_refunded"},
    "wtp_text": {"asked_price", "complained_price", "asked_refund", "asked_plan_difference", "said_would_pay_if"},
    "alternatives": {"chatgpt", "gemini", "notebooklm", "kimi", "doubao", "deepseek", "claude", "other"},
    "value_units": {"pages", "documents", "questions", "chapters", "exam_items", "credits", "file_size", "none"},
    "leave_reason": {"job_done_satisfied", "job_done_partial", "gave_up_after_failure", "blocked_by_wall",
                     "blocked_by_parse_error", "blocked_by_missing_answer", "evaluation_only",
                     "switched_to_alternative_stated", "unclear"},
    "anon_leave_reason": {"evaluation_only", "hit_demo_message_limit", "gave_up_after_failure", "unclear"},
    "appendix_b": {"B1_large_doc_coverage", "B2_page_or_citation_failure", "B3_export_refused", "B4_overrigid_persona",
                   "B5_scanned_or_nonlatin_garbled", "B6_no_reply_reliability", "B7_upload_or_ui_confusion",
                   "B8_done_once_no_hook", "none"},
    "confidence": {"high", "medium", "low"},
    "activation": {"chatted", "uploaded_only", "events_only", "nothing"},
    "activation_blocker": {"parse_error", "doc_ready_never_opened", "wall_before_first_message", "unclear", "na"},
    "need": {"page_cited_answers", "verbatim_quotes_with_pages", "large_document_coverage", "page_or_item_navigation",
             "whole_document_summary", "section_summary", "concept_explanation", "table_or_number_extraction",
             "scanned_or_garbled_text", "non_english_or_cross_lingual", "writing_or_drafting", "translation",
             "export_or_download", "multi_document", "fast_reliable_answer", "outside_document_knowledge", "other"},
    "segment": {"paid", "hit_wall", "real_work_no_wall", "light_use_no_wall", "uploaded_never_chatted", "never_started"},
    "hypothesis": {f"H{i}" for i in range(1, 11)},
    "intent": {"real_question_on_demo", "testing_capability", "offtopic_general", "asks_about_own_document",
               "prompt_injection_or_abuse", "greeting_or_empty"},
}
LANG = re.compile(r"^([a-z]{2,3}|unknown|mixed)$")
CONV_FIELDS = ["sid", "uid", "worker", "era", "demo", "doc", "doc_size_band", "doc_type_coded", "doc_lang",
               "question_langs", "cross_lingual", "jtbd", "jtbd_recurrence", "persona", "first_question_specificity",
               "satisfied_first_answer", "turns", "overall_outcome", "dominant_failure", "walls_in_session",
               "wall_reaction", "wtp_signals", "alternatives_mentioned", "value_units_mentioned", "last_turn_outcome",
               "leave_reason", "leave_reason_confidence", "appendix_b_reason", "summary", "confidence"]
TURN_FIELDS = ["i", "qtype", "lang", "answer", "answer_lang", "answer_matches_lang", "cited", "outcome",
               "outcome_evidence", "failure", "capability_request", "notes", "confidence"]
USER_FIELDS = ["uid", "worker", "segment", "activation", "activation_blocker", "persona", "jtbd_primary",
               "jtbd_recurrence", "doc_profile", "needs_met", "needs_unmet", "capability_requests", "walls", "wtp",
               "price_mentioned", "alternatives_mentioned", "returned_later_day", "returned_same_doc",
               "leave_reason_final", "leave_reason_confidence", "hypothesis_votes", "appendix_b_reason",
               "replay_candidates", "summary", "confidence"]
ANON_FIELDS = ["sid", "worker", "demo_slug", "era", "n_user_msgs", "question_langs", "intent", "turns", "own_doc_wish",
               "alternatives_mentioned", "prompt_injection", "leave_reason", "summary", "confidence"]
NON_LATIN = re.compile(r"[Ѐ-ӿ؀-ۿऀ-ॿ぀-ヿ㐀-䶿一-鿿가-힯]")


def load_messages():
    texts = []
    for u in json.load(open(os.path.join(EXPORT, "users.json"), encoding="utf-8")):
        for s in u.get("sessions", []):
            texts += [m.get("text") or "" for m in s["messages"]]
    for s in json.load(open(os.path.join(EXPORT, "anonymous_demo_sessions.json"), encoding="utf-8")):
        texts += [m.get("text") or "" for m in s["messages"]]
    return texts


def build_indexes(texts):
    words9, chars20 = set(), set()
    for t in texts:
        w = t.casefold().split()
        for k in range(len(w) - 8):
            words9.add(" ".join(w[k:k + 9]))
        letters = [c for c in t if c.isalpha()]
        if letters and sum(1 for c in letters if NON_LATIN.match(c)) / len(letters) > 0.3:
            norm = re.sub(r"\s+", " ", t.casefold()).strip()
            for k in range(len(norm) - 19):
                chars20.add(norm[k:k + 20])
    return words9, chars20


def leaks(text, words9, chars20):
    if not isinstance(text, str) or not text:
        return None
    w = text.casefold().split()
    for k in range(len(w) - 8):
        if " ".join(w[k:k + 9]) in words9:
            return f"9-word window copied from a message (starting at word {k + 1} of this field)"
    norm = re.sub(r"\s+", " ", text.casefold()).strip()
    for k in range(len(norm) - 19):
        if norm[k:k + 20] in chars20:
            return "20-character window copied from a non-Latin message"
    return None


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    partial = "--partial" in sys.argv
    if len(args) != 2:
        sys.exit(__doc__)
    coded_path, ids_path = args
    ids = [x.strip() for x in open(ids_path, encoding="utf-8") if x.strip()]
    sessions_mech = {}
    for line in open(os.path.join(HERE, "sessions_mech.jsonl"), encoding="utf-8"):
        m = json.loads(line)
        sessions_mech[m["sid"]] = m
    errors = []
    records = []
    for n, line in enumerate(open(coded_path, encoding="utf-8"), 1):
        if not line.strip():
            continue
        try:
            rec = json.loads(line)
        except ValueError as exc:
            errors.append(f"line {n}: not JSON ({exc})")
            continue
        if not isinstance(rec, dict):
            errors.append(f"line {n}: not a JSON object")
            continue
        records.append((n, rec))
    if not records:
        errors.append("file has no records")

    def kind(rec):
        if "turns" in rec and "uid" in rec:
            return "conversation"
        if "uid" in rec:
            return "user"
        if "demo_slug" in rec:
            return "anon"
        return None

    kinds = {kind(r) for _, r in records}
    if None in kinds or len(kinds) > 1:
        errors.append(f"cannot infer one record type (found {sorted(str(k) for k in kinds)})")
    rtype = next(iter(kinds)) if len(kinds) == 1 else None

    def enum(where, value, key, allow_none=True):
        if value is None and allow_none:
            return
        if value not in E[key]:
            errors.append(f"{where}: {value!r} is not a valid {key}")

    def enum_list(where, values, key):
        if not isinstance(values, list):
            errors.append(f"{where}: expected a list")
            return
        for v in values:
            enum(where, v, key, allow_none=False)

    def lang(where, value):
        if value is not None and not (isinstance(value, str) and LANG.match(value)):
            errors.append(f"{where}: {value!r} is not an ISO 639-1 code / unknown / mixed")

    def words(where, text, limit):
        if isinstance(text, str) and len(text.split()) > limit:
            errors.append(f"{where}: {len(text.split())} words (limit {limit})")

    def check_turns(where, rec, expected_n):
        turns = rec.get("turns")
        if not isinstance(turns, list):
            errors.append(f"{where}: turns is not a list")
            return
        if expected_n is not None and len(turns) != expected_n:
            errors.append(f"{where}: {len(turns)} turns, the session has {expected_n} user messages")
        for t in turns:
            tw = f"{where} turn {t.get('i')}"
            missing = [f for f in TURN_FIELDS if f not in t]
            if missing:
                errors.append(f"{tw}: missing {missing}")
            enum(tw, t.get("qtype"), "qtype")
            enum_list(tw, t.get("qtypes_extra", []), "qtype")
            enum(tw, t.get("answer"), "answer")
            enum(tw, t.get("outcome"), "outcome")
            enum_list(tw, t.get("outcome_evidence", []), "outcome_evidence")
            enum_list(tw, t.get("failure", []), "failure")
            enum_list(tw, t.get("capability_request", []), "capability")
            enum(tw, t.get("confidence"), "confidence")
            lang(tw, t.get("lang"))
            lang(tw, t.get("answer_lang"))
            words(tw + " notes", t.get("notes"), 20)

    seen = {}
    for n, rec in records:
        rid = rec.get("sid") if rtype in ("conversation", "anon") else rec.get("uid")
        where = f"line {n} ({rid})"
        seen[rid] = seen.get(rid, 0) + 1
        if rtype == "conversation":
            missing = [f for f in CONV_FIELDS if f not in rec]
            if missing:
                errors.append(f"{where}: missing {missing}")
            mech = sessions_mech.get(rec.get("sid"))
            if mech is None:
                errors.append(f"{where}: unknown sid")
            elif mech.get("uid") != rec.get("uid"):
                errors.append(f"{where}: sid belongs to {mech.get('uid')}, not {rec.get('uid')}")
            check_turns(where, rec, mech["n_user_msgs"] if mech else None)
            enum(where, rec.get("era"), "era")
            enum(where, rec.get("doc_size_band"), "doc_size_band")
            enum(where, rec.get("doc_type_coded"), "doc_type_coded")
            enum(where, rec.get("jtbd"), "jtbd")
            enum(where, rec.get("jtbd_recurrence"), "jtbd_recurrence")
            enum(where, rec.get("persona"), "persona")
            enum(where, rec.get("first_question_specificity"), "first_question_specificity")
            enum(where, rec.get("satisfied_first_answer"), "satisfied_first_answer")
            enum(where, rec.get("overall_outcome"), "overall_outcome")
            if rec.get("dominant_failure") not in (None, "none"):
                enum(where, rec.get("dominant_failure"), "failure")
            enum(where, rec.get("wall_reaction"), "wall_reaction")
            for v in rec.get("wtp_signals") or []:
                if v not in E["wtp"] | E["wtp_text"]:
                    errors.append(f"{where}: {v!r} is not a valid wtp signal")
            enum_list(where, rec.get("alternatives_mentioned", []), "alternatives")
            enum_list(where, rec.get("value_units_mentioned", []), "value_units")
            enum(where, rec.get("last_turn_outcome"), "outcome")
            enum(where, rec.get("leave_reason"), "leave_reason")
            enum(where, rec.get("leave_reason_confidence"), "confidence")
            enum(where, rec.get("appendix_b_reason"), "appendix_b")
            enum(where, rec.get("confidence"), "confidence")
            lang(where, rec.get("doc_lang"))
            for q in rec.get("question_langs") or []:
                lang(where, q)
            words(where + " summary", rec.get("summary"), 60)
        elif rtype == "user":
            missing = [f for f in USER_FIELDS if f not in rec]
            if missing:
                errors.append(f"{where}: missing {missing}")
            enum(where, rec.get("segment"), "segment")
            enum(where, rec.get("activation"), "activation")
            enum(where, rec.get("activation_blocker"), "activation_blocker")
            enum(where, rec.get("persona"), "persona")
            enum(where, rec.get("jtbd_primary"), "jtbd")
            enum(where, rec.get("jtbd_recurrence"), "jtbd_recurrence")
            enum_list(where, rec.get("needs_met", []), "need")
            enum_list(where, rec.get("needs_unmet", []), "need")
            enum_list(where, rec.get("capability_requests", []), "capability")
            for w in rec.get("walls") or []:
                if not isinstance(w, dict):
                    errors.append(f"{where}: wall entry is not an object")
                    continue
                enum(where + " wall", w.get("reaction"), "wall_reaction")
            enum(where, rec.get("wtp"), "wtp")
            enum_list(where, rec.get("alternatives_mentioned", []), "alternatives")
            enum(where, rec.get("leave_reason_final"), "leave_reason")
            enum(where, rec.get("leave_reason_confidence"), "confidence")
            enum_list(where, rec.get("hypothesis_votes", []), "hypothesis")
            enum(where, rec.get("appendix_b_reason"), "appendix_b")
            enum(where, rec.get("confidence"), "confidence")
            words(where + " summary", rec.get("summary"), 60)
            words(where + " doc_profile", rec.get("doc_profile"), 20)
        elif rtype == "anon":
            missing = [f for f in ANON_FIELDS if f not in rec]
            if missing:
                errors.append(f"{where}: missing {missing}")
            mech = sessions_mech.get(rec.get("sid"))
            if mech is None or mech.get("uid") is not None:
                errors.append(f"{where}: not an anonymous session in sessions_mech")
            check_turns(where, rec, mech["n_user_msgs"] if mech else None)
            enum(where, rec.get("era"), "era")
            enum(where, rec.get("intent"), "intent")
            enum_list(where, rec.get("alternatives_mentioned", []), "alternatives")
            enum(where, rec.get("leave_reason"), "anon_leave_reason")
            enum(where, rec.get("confidence"), "confidence")
            for q in rec.get("question_langs") or []:
                lang(where, q)
            words(where + " summary", rec.get("summary"), 60)

    # coverage
    if rtype == "conversation":
        expected = {sid for sid, m in sessions_mech.items() if m.get("uid") in set(ids)}
    else:
        expected = set(ids)
    for rid, count in seen.items():
        if count > 1:
            errors.append(f"{rid}: {count} records (expected one)")
        if rid not in expected:
            errors.append(f"{rid}: not expected for this id list")
    if not partial:
        for rid in sorted(expected - set(seen)):
            errors.append(f"{rid}: expected but missing")

    # privacy
    words9, chars20 = build_indexes(load_messages())

    def scan(where, obj):
        if isinstance(obj, dict):
            for k, v in obj.items():
                if k in ("notes", "summary", "doc_profile"):
                    hit = leaks(v, words9, chars20)
                    if hit:
                        errors.append(f"{where} {k}: {hit}")
                else:
                    scan(where, v)
        elif isinstance(obj, list):
            for v in obj:
                scan(where, v)

    for n, rec in records:
        scan(f"line {n}", rec)

    for e in errors:
        print("FAIL", e)
    print(f"{len(records)} records, type {rtype}, {len(errors)} problem(s){' (partial coverage)' if partial else ''}")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
