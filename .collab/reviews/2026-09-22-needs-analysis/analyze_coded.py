"""§4 tables of the needs analysis (01-plan-fable.md §4) from the coded JSONL + the pre-pass files. Aggregates only.

    python3 .collab/reviews/2026-09-22-needs-analysis/analyze_coded.py <EXPORT_DIR> [canonical calibration worker, default W1]

Prints markdown (counts; rates only where the denominator is >= 10; cells under five are counts, never rates).
Writes the replay-candidate list (ids only) to <EXPORT_DIR>/coded/replay_candidates.jsonl — outside the repo.
"""
import datetime as dt
import importlib.util
import json
import os
import sys
from collections import Counter, defaultdict

EXPORT = os.path.abspath(sys.argv[1])
CANON = sys.argv[2] if len(sys.argv) > 2 else "W1"
PRE, CODED = os.path.join(EXPORT, "prepass"), os.path.join(EXPORT, "coded")

spec = importlib.util.spec_from_file_location("cfe", ".collab/reviews/2026-09-22-pricing-research/churn_from_export.py")
cfe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cfe)

# prices per 1M tokens, fetched 2026-09-22: DeepSeek official page (V4, peak cache-miss / off-peak cache-hit) and
# OpenRouter's public models API (legacy models, embeddings)
PRICE = {
    "deepseek-v4-flash": {"hi": (0.30, 1.20), "lo": (0.003, 0.60)},
    "deepseek-v4-pro": {"hi": (1.32, 3.96), "lo": (0.022, 1.98)},
    "deepseek/deepseek-v3.2": {"hi": (0.269, 0.40), "lo": (0.1345, 0.40)},
    "mistralai/mistral-medium-3.1": {"hi": (0.40, 2.00), "lo": (0.04, 2.00)},
}
EMBED_PER_M = 0.02
CREDIT_PRICE = {"Plus": 9.99 / 3000, "Pro": 19.99 / 9000, "Boost": 3.99 / 500}
MAY_B = {"B1_large_doc_coverage": "~10-12", "B2_page_or_citation_failure": "~6", "B3_export_refused": "~5",
         "B4_overrigid_persona": "~5", "B5_scanned_or_nonlatin_garbled": "2+", "B6_no_reply_reliability": "4",
         "B7_upload_or_ui_confusion": "2", "B8_done_once_no_hook": "~15-18"}
EXISTS = {"export_excel_csv": "exists", "export_pdf_docx": "exists", "download_answer": "exists", "write_or_draft": "refused",
          "rewrite_or_paraphrase": "partly", "translate_document": "exists", "translate_answer": "exists",
          "summarize_whole_document": "partly", "compare_documents": "exists", "multi_document_chat": "exists",
          "ocr_scanned": "exists", "table_extraction": "exists", "figures_or_images": "missing",
          "outside_knowledge_or_web": "missing", "longer_or_more_detailed": "exists", "page_navigation": "exists",
          "verbatim_quotes_with_pages": "exists", "citation_formatting": "partly", "integration_drive_zotero": "missing",
          "mobile_or_ui": "n/a", "more_free_quota": "n/a", "larger_file": "exists", "other": "n/a"}
HARD = {"locate_page_or_item", "verbatim_quote", "summarize_whole", "extract_table_or_numbers"}


def jl(path):
    return [json.loads(x) for x in open(path, encoding="utf-8") if x.strip()] if os.path.exists(path) else []


def table(title, rows, header):
    print(f"\n**{title}**\n")
    print("| " + " | ".join(header) + " |")
    print("|" + "---|" * len(header))
    for r in rows:
        print("| " + " | ".join(str(x) for x in r) + " |")


def xtab(title, pairs, row_name, col_name):
    rows_k = sorted({a for a, _ in pairs}, key=str)
    cols_k = sorted({b for _, b in pairs}, key=str)
    c = Counter(pairs)
    table(title, [[r] + [c[(r, k)] or "" for k in cols_k] + [sum(c[(r, k)] for k in cols_k)] for r in rows_k],
          [f"{row_name} \\ {col_name}"] + [str(k) for k in cols_k] + ["total"])


def main():
    users_mech = {u["uid"]: u for u in jl(os.path.join(PRE, "users_mech.jsonl"))}
    sess_mech = {s["sid"]: s for s in jl(os.path.join(PRE, "sessions_mech.jsonl"))}
    cal_ids = [x.strip() for x in open(os.path.join(PRE, "calibration", "ids.txt")) if x.strip()]
    workers = ["W1", "W2", "W3"]
    cal_users = {w: {r["uid"]: r for r in jl(os.path.join(CODED, f"{w}_calibration_users.jsonl"))} for w in workers}
    cal_convs = {w: {r["sid"]: r for r in jl(os.path.join(CODED, f"{w}_calibration_conversations.jsonl"))} for w in workers}
    users_coded = {r["uid"]: r for w in workers for r in jl(os.path.join(CODED, f"{w}_users.jsonl"))}
    convs = {r["sid"]: r for w in workers for r in jl(os.path.join(CODED, f"{w}_conversations.jsonl"))}
    for uid in cal_ids:
        if uid in cal_users[CANON]:
            users_coded[uid] = cal_users[CANON][uid]
    for sid, r in cal_convs[CANON].items():
        convs[sid] = r
    anon = {r["sid"]: r for r in jl(os.path.join(CODED, "W4_anon_sessions.jsonl")) + jl(os.path.join(CODED, "W4_calibration.jsonl"))}

    print("# Needs analysis — §4 tables (Claude, computed from the coded records; aggregates only)")

    # 4.1 coverage and calibration
    expected_users = [u for u, m in users_mech.items() if m.get("assignment") in ("W1", "W2", "W3", "calibration")]
    expected_sessions = [s for s, m in sess_mech.items() if m["uid"] in set(expected_users)]
    table("4.1 Coverage", [["registered users to code", len(expected_users), len(set(expected_users) & set(users_coded))],
                           ["their sessions", len(expected_sessions), len(set(expected_sessions) & set(convs))],
                           ["anonymous sessions", sum(1 for m in sess_mech.values() if m["uid"] is None), len(anon)]],
          ["unit", "expected", "coded"])
    rows = []
    for uid in cal_ids:
        for w in workers:
            u = cal_users[w].get(uid)
            if not u:
                rows.append([uid, w, "missing", "", "", "", ""])
                continue
            cs = [c for c in cal_convs[w].values() if c["uid"] == uid]
            first = sorted(cs, key=lambda c: sess_mech[c["sid"]]["first_t"])[0] if cs else None
            rows.append([uid, w, first["turns"][0]["outcome"] if first and first["turns"] else "",
                         "; ".join(sorted({c.get("dominant_failure") or "none" for c in cs})),
                         u.get("leave_reason_final"), u.get("appendix_b_reason"), ",".join(u.get("hypothesis_votes") or [])])
    table("4.1 Calibration codings side by side (payer ground truth: retrieval miss asserted, jargon, over-rigid refusal, refund asked, B1)",
          rows, ["uid", "coder", "first-turn outcome", "dominant failures", "leave reason", "appendix B", "hypotheses"])
    fields = ["outcome", "failure"]
    agree = Counter()
    for sid in {s for w in workers for s in cal_convs[w]}:
        codings = [cal_convs[w].get(sid) for w in workers]
        if not all(codings):
            continue
        for i in range(len(codings[0]["turns"])):
            for f in fields:
                vals = [json.dumps(c["turns"][i].get(f), sort_keys=True) if i < len(c["turns"]) else None for c in codings]
                agree[(f, len(set(vals)) == 1)] += 1
    table("4.1 Turn-level agreement of the three coders on the calibration sessions",
          [[f, agree[(f, True)], agree[(f, True)] + agree[(f, False)]] for f in fields], ["field", "all three agree", "turns"])

    # helpers
    def last_session(uid):
        cs = [c for c in convs.values() if c["uid"] == uid]
        return max(cs, key=lambda c: sess_mech[c["sid"]]["last_t"]) if cs else None

    coded_users = [users_coded[u] for u in expected_users if u in users_coded]

    # 4.2 hypotheses
    votes = Counter(h for u in coded_users for h in u.get("hypothesis_votes") or [])
    table("4.2 Hypothesis votes (users; several per user)", [[h, votes[h]] for h in sorted(votes, key=lambda x: int(x[1:]))],
          ["hypothesis", "users"])
    xtab("4.2 Hypothesis votes × segment", [(h, users_mech[u["uid"]]["segment"]) for u in coded_users for h in u.get("hypothesis_votes") or []],
         "hypothesis", "segment")
    xtab("4.2 Hypothesis votes × era of last activity",
         [(h, sess_mech[last_session(u["uid"])["sid"]]["era"] if last_session(u["uid"]) else "no session")
          for u in coded_users for h in u.get("hypothesis_votes") or []], "hypothesis", "era")
    xtab("4.2 overall_outcome × era (sessions)", [(c["overall_outcome"], sess_mech[c["sid"]]["era"]) for c in convs.values()],
         "outcome", "era")
    xtab("4.2 leave_reason × era (sessions)", [(c["leave_reason"], sess_mech[c["sid"]]["era"]) for c in convs.values()],
         "leave reason", "era")
    xtab("4.2 leave_reason_final × segment (users)", [(u.get("leave_reason_final"), users_mech[u["uid"]]["segment"]) for u in coded_users],
         "leave reason", "segment")
    b_now = Counter(u.get("appendix_b_reason") for u in coded_users)
    table("4.2 May's churn reasons: now (coded users) vs May (47 users)",
          [[k, b_now[k], MAY_B.get(k, "")] for k in list(MAY_B) + ["none"]], ["reason", "now", "May"])

    # 4.3 needs and failures
    xtab("4.3 dominant_failure × doc_size_band (sessions)", [(c.get("dominant_failure") or "none", sess_mech[c["sid"]]["doc_size_band"])
                                                           for c in convs.values()], "failure", "size")
    turn_rows = [(c, t) for c in convs.values() for t in c["turns"]]
    xtab("4.3 failure × doc_type_coded (turns)", [(f, c.get("doc_type_coded")) for c, t in turn_rows for f in t.get("failure") or []],
         "failure", "doc type")
    xtab("4.3 failure × cross_lingual (turns)", [(f, c.get("cross_lingual")) for c, t in turn_rows for f in t.get("failure") or []],
         "failure", "cross-lingual")
    xtab("4.3 failure × era (turns)", [(f, sess_mech[c["sid"]]["era"]) for c, t in turn_rows for f in t.get("failure") or []],
         "failure", "era")
    xtab("4.3 needs_unmet × persona (users)", [(n, u.get("persona")) for u in coded_users for n in u.get("needs_unmet") or []],
         "need", "persona")
    xtab("4.3 needs_unmet × jtbd_primary (users)", [(n, u.get("jtbd_primary")) for u in coded_users for n in u.get("needs_unmet") or []],
         "need", "jtbd")
    met = Counter(n for u in coded_users for n in u.get("needs_met") or [])
    unmet = Counter(n for u in coded_users for n in u.get("needs_unmet") or [])
    table("4.3 Needs met vs unmet (users)", [[n, met[n], unmet[n]] for n in sorted(set(met) | set(unmet), key=lambda k: -(met[k] + unmet[k]))],
          ["need", "met", "unmet"])
    creq_turn = Counter(r for _, t in turn_rows for r in t.get("capability_request") or [])
    creq_user = Counter(r for u in coded_users for r in u.get("capability_requests") or [])
    table("4.3 Capability requests — discoverability gap vs capability gap",
          [[k, EXISTS.get(k, "?"), creq_turn[k], creq_user[k]] for k in sorted(set(creq_turn) | set(creq_user), key=lambda k: -creq_user[k])],
          ["request", "exists today", "turns", "users"])
    q_all = Counter(t.get("qtype") for _, t in turn_rows)
    clickers = {u for u, m in users_mech.items() if m["citation_clicks"] > 0}
    q_clk = Counter(t.get("qtype") for c, t in turn_rows if c["uid"] in clickers)
    table("4.3 qtype — all turns vs turns of citation-clicking users (H10: none of them has a quote_* event)",
          [[k, q_all[k], q_clk[k]] for k in sorted(q_all, key=lambda k: -q_all[k])], ["qtype", "all turns", "citation clickers"])

    # 4.4 satisfaction and return
    def first_session(uid):
        cs = [c for c in convs.values() if c["uid"] == uid]
        return min(cs, key=lambda c: sess_mech[c["sid"]]["first_t"]) if cs else None

    chatted = [u for u in coded_users if users_mech[u["uid"]]["n_user_msgs"] > 0]
    xtab("4.4 satisfied_first_answer (first session) × returned_later_day (users)",
         [(first_session(u["uid"])["satisfied_first_answer"] if first_session(u["uid"]) else None, users_mech[u["uid"]]["returned_later_day"])
          for u in chatted], "first answer", "returned")
    xtab("4.4 overall_outcome of the last session × returned_later_day (users)",
         [(last_session(u["uid"])["overall_outcome"] if last_session(u["uid"]) else None, users_mech[u["uid"]]["returned_later_day"])
          for u in chatted], "outcome", "returned")
    xtab("4.4 jtbd_recurrence × returned_later_day (users)", [(u.get("jtbd_recurrence"), users_mech[u["uid"]]["returned_later_day"]) for u in chatted],
         "recurrence", "returned")
    xtab("4.4 jtbd_primary × returned_later_day (users)", [(u.get("jtbd_primary"), users_mech[u["uid"]]["returned_later_day"]) for u in chatted],
         "jtbd", "returned")

    def band(n):
        return "1" if n == 1 else "2" if n == 2 else "3-5" if n <= 5 else "6+"

    xtab("4.4 first_question_specificity × user-message band (sessions)",
         [(c.get("first_question_specificity"), band(sess_mech[c["sid"]]["n_user_msgs"])) for c in convs.values()], "first question", "messages")
    lt = Counter(c.get("last_turn_outcome") for c in convs.values())
    table("4.4 Last-turn outcome of every session (how much of 'episodic' is unread)", [[k, v] for k, v in lt.most_common()],
          ["last turn", "sessions"])
    # the churn read's §9 cell: own document · cited · span < 1 day
    churn = {u.uid: u for u in cfe.build_users(json.load(open(os.path.join(EXPORT, "users.json"), encoding="utf-8")))}
    cell = [uid for uid, u in churn.items() if u.real_work and u.n_msgs > u.n_demo and u.cites and u.span is not None
            and u.span < dt.timedelta(days=1)]
    rel = Counter()
    for uid in cell:
        uc = users_coded.get(uid)
        lr = uc.get("leave_reason_final") if uc else "not coded"
        conf = uc.get("leave_reason_confidence") if uc else ""
        rel[(lr, conf)] += 1
    table(f"4.4 The owner's cell (own document · cited · < 1 day; {len(cell)} users) by coded final leave reason — decides Read A/B",
          [[lr, conf, n] for (lr, conf), n in sorted(rel.items(), key=lambda kv: -kv[1])], ["leave_reason_final", "confidence", "users"])

    # 4.5 walls and willingness to pay
    wall_pairs = [(w.get("reason"), w.get("reaction"), w.get("is_demo")) for u in coded_users for w in u.get("walls") or []]
    xtab("4.5 wall reason × reaction (coded user walls)", [(r, x) for r, x, _ in wall_pairs], "reason", "reaction")
    xtab("4.5 wall reason × demo flag", [(r, d) for r, _, d in wall_pairs], "reason", "is_demo")
    xtab("4.5 wtp level × last-session outcome (users)",
         [(u.get("wtp"), last_session(u["uid"])["overall_outcome"] if last_session(u["uid"]) else "no session") for u in coded_users],
         "wtp", "outcome")
    vu = Counter(v for c in convs.values() for v in c.get("value_units_mentioned") or [])
    alt = Counter(a for c in convs.values() for a in c.get("alternatives_mentioned") or []) + \
        Counter(a for r in anon.values() for a in r.get("alternatives_mentioned") or [])
    table("4.5 Price, units and alternatives", [["users who mentioned price", sum(1 for u in coded_users if u.get("price_mentioned"))],
                                                ["value units mentioned (sessions)", dict(vu) or "none"],
                                                ["alternatives named (registered + anonymous sessions)", dict(alt) or "none"]],
          ["measure", "value"])
    replay = []
    for c, t in turn_rows:
        if t.get("replay_candidate"):
            m = sess_mech[c["sid"]]
            replay.append({"uid": c["uid"], "sid": c["sid"], "i": t["i"], "era": m["era"], "doc": m["doc"],
                           "doc_size_band": m["doc_size_band"], "doc_status": m["doc_status"], "failure": t.get("failure"),
                           "replayable": m["doc_status"] == "ready" and not m["demo"]})
    with open(os.path.join(CODED, "replay_candidates.jsonl"), "w", encoding="utf-8") as f:
        for r in replay:
            f.write(json.dumps(r) + "\n")
    xtab("4.5 Replay candidates (turns) × era", [(r["era"], r["replayable"]) for r in replay], "era", "replayable")

    # 4.6 anonymous demo
    xtab("4.6 intent × demo document (anonymous sessions)", [(r.get("intent"), r.get("demo_slug")) for r in anon.values()], "intent", "document")
    first_out = Counter(r["turns"][0]["outcome"] if r.get("turns") else None for r in anon.values())
    fails = Counter(f for r in anon.values() for t in r.get("turns") or [] for f in t.get("failure") or [])
    table("4.6 Anonymous demo", [["sessions", len(anon)], ["end at one message", sum(1 for r in anon.values() if r.get("n_user_msgs") == 1)],
                                 ["first-turn outcome", dict(first_out)], ["own_doc_wish", sum(1 for r in anon.values() if r.get("own_doc_wish"))],
                                 ["prompt injection", sum(1 for r in anon.values() if r.get("prompt_injection"))],
                                 ["failures (turns)", dict(fails) or "none"]], ["measure", "value"])

    # 4.7 cost to serve
    def usd(usage, bound):
        total = 0.0
        for model, v in (usage or {}).items():
            p_in, p_out = PRICE.get(model, PRICE["deepseek-v4-flash"])[bound]
            total += v["prompt"] / 1e6 * p_in + v["completion"] / 1e6 * p_out
        return total

    per_user = {u: (usd(m["usage_by_model"], "hi"), usd(m["usage_by_model"], "lo"), sum(v["calls"] for v in (m["usage_by_model"] or {}).values()))
                for u, m in users_mech.items()}
    active = [u for u in users_mech if per_user[u][2] > 0]
    tot_hi, tot_lo, calls = sum(per_user[u][0] for u in active), sum(per_user[u][1] for u in active), sum(per_user[u][2] for u in active)
    by_seg = defaultdict(lambda: [0.0, 0])
    for u in active:
        by_seg[users_mech[u]["segment"]][0] += per_user[u][0]
        by_seg[users_mech[u]["segment"]][1] += 1
    by_out = defaultdict(lambda: [0.0, 0])
    for u in active:
        ls = last_session(u)
        key = ls["overall_outcome"] if ls else "not coded"
        by_out[key][0] += per_user[u][0]
        by_out[key][1] += 1
    users_json = json.load(open(os.path.join(EXPORT, "users.json"), encoding="utf-8"))
    pages_all = [d["pages"] or 0 for u in users_json for d in u["documents"]]
    pages_ocr = sum(d["pages"] or 0 for u in users_json for d in u["documents"] if d.get("parse_method") == "ocr")
    pages_err = sum(d["pages"] or 0 for u in users_json for d in u["documents"] if d["status"] == "error")
    anon_json = json.load(open(os.path.join(EXPORT, "anonymous_demo_sessions.json"), encoding="utf-8"))
    anon_p = sum(m.get("prompt_tokens") or 0 for s in anon_json for m in s["messages"])
    anon_c = sum(m.get("output_tokens") or 0 for s in anon_json for m in s["messages"])
    flash_hi = PRICE["deepseek-v4-flash"]["hi"]
    table("4.7 Cost to serve (USD; upper bound = peak cache-miss, lower bound = off-peak cache-hit)", [
        ["all registered non-owner users, lifetime LLM", f"{tot_hi:.2f}", f"{tot_lo:.2f}"],
        ["per active user", f"{tot_hi / max(len(active), 1):.3f}", f"{tot_lo / max(len(active), 1):.3f}"],
        ["per answer (all models)", f"{tot_hi / max(calls, 1):.4f}", f"{tot_lo / max(calls, 1):.4f}"],
        ["anonymous demo at Flash price (unbilled)", f"{anon_p / 1e6 * flash_hi[0] + anon_c / 1e6 * flash_hi[1]:.2f}", ""],
        ["embeddings for all own documents (pages × 600 tokens)", f"{sum(pages_all) * 600 / 1e6 * EMBED_PER_M:.3f}", ""],
        ["pages OCR'd (self-hosted, no per-page price)", pages_ocr, ""],
        ["pages in error documents (sunk parse cost)", pages_err, ""],
    ], ["item", "upper", "lower"])
    table("4.7 LLM cost by segment and by last-session outcome (upper bound)",
          [[f"segment {k}", v[1], f"{v[0]:.3f}"] for k, v in sorted(by_seg.items())] +
          [[f"outcome {k}", v[1], f"{v[0]:.3f}"] for k, v in sorted(by_out.items(), key=lambda kv: str(kv[0]))], ["group", "users", "USD"])
    model_rows = []
    agg = defaultdict(lambda: {"calls": 0, "prompt": 0, "completion": 0, "credits": 0})
    for m in users_mech.values():
        for model, v in (m["usage_by_model"] or {}).items():
            for k in agg[model]:
                agg[model][k] += v[k]
    for model, v in agg.items():
        p_in, p_out = PRICE.get(model, PRICE["deepseek-v4-flash"])["hi"]
        cost = v["prompt"] / 1e6 * p_in + v["completion"] / 1e6 * p_out
        per_credit = cost / max(v["credits"], 1)
        model_rows.append([model, v["calls"], round(v["credits"] / max(v["calls"], 1), 1), f"{cost / max(v['calls'], 1):.4f}",
                           f"{per_credit:.5f}"] + [f"{(1 - per_credit / p) * 100:.0f}%" for p in CREDIT_PRICE.values()])
    table("4.7 Per model: credits and USD per answer, LLM margin at each credit price", model_rows,
          ["model", "calls", "credits/answer", "USD/answer (upper)", "USD/credit"] + [f"margin at {k}" for k in CREDIT_PRICE])
    turns_all = [t for _, t in turn_rows]
    hard_share = sum(1 for t in turns_all if t.get("qtype") in HARD) / max(len(turns_all), 1)
    fp_in, fp_out = PRICE["deepseek-v4-flash"]["hi"]
    pp_in, pp_out = PRICE["deepseek-v4-pro"]["hi"]
    base = 8164 / 1e6 * fp_in + 1041 / 1e6 * fp_out
    scen_a = 4 * 8164 / 1e6 * fp_in + 1041 / 1e6 * fp_out
    map_in = 289 * 600 / 1e6 * fp_in + 20 * 300 / 1e6 * fp_out
    scen_b = map_in + (6000 / 1e6 * fp_in + 1500 / 1e6 * fp_out)
    pro_ans = 10297 / 1e6 * pp_in + 799 / 1e6 * pp_out
    scen_c = hard_share * pro_ans + (1 - hard_share) * base
    table("4.7 Capability-upgrade cost per answer (upper bound) against what a Flash answer earns on Plus (~11.2 credits)", [
        ["today (Flash, 8.2k in / 1.0k out)", f"{base:.4f}", f"{11.2 * CREDIT_PRICE['Plus']:.3f}"],
        ["(a) 4× retrieval context on Flash", f"{scen_a:.4f}", ""],
        ["(b) whole-document map-reduce over a p90 document (289 pages)", f"{scen_b:.4f}", ""],
        [f"(c) Pro for hard question types (observed share {hard_share:.0%})", f"{scen_c:.4f}", ""],
    ], ["scenario", "USD per answer", "Plus revenue per Flash answer"])
    print(f"\nPrices: DeepSeek https://api-docs.deepseek.com/quick_start/pricing and OpenRouter https://openrouter.ai/api/v1/models "
          f"(+ /api/v1/embeddings/models), accessed 2026-09-22. Replay list written outside the repo ({len(replay)} turns).")


if __name__ == "__main__":
    main()
