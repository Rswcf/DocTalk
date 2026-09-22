"""P0 — deterministic pre-pass for the needs analysis (01-plan-fable.md §3.1). No LLM, stdlib + the churn builder.

    python3 .collab/reviews/2026-09-22-needs-analysis/prepass.py <EXPORT_DIR>      (run from the repository root)

Reads <EXPORT_DIR>/users.json and anonymous_demo_sessions.json; writes everything under <EXPORT_DIR>/prepass/ —
which must be outside the repository (the export holds real conversations; the repository is public).
Segments come from the churn read's own bucket function (churn_from_export.build_users -> U.bucket()), so the
counts reconcile with ../2026-09-22-pricing-research/free-quota-at-churn.txt.
"""
import datetime as dt
import importlib.util
import json
import os
import shutil
import sys
from collections import Counter

REPO_DIR = os.path.dirname(os.path.abspath(__file__))
EXPORT = os.path.abspath(sys.argv[1])
OUT = os.path.join(EXPORT, "prepass")
CALIBRATION_USERS = ["755788ef", "58688124"]
SEGMENT = {"paid": "paid", "hit a wall": "hit_wall", "real work, no wall": "real_work_no_wall",
           "light use, no wall": "light_use_no_wall", "uploaded, never chatted": "uploaded_never_chatted",
           "never started": "never_started"}
UPGRADE_AFTER = dt.timedelta(minutes=10)
CHECKOUT_AFTER = dt.timedelta(minutes=60)


def inside_git_checkout(path):
    probe = path
    while True:
        if os.path.exists(os.path.join(probe, ".git")):
            return True
        parent = os.path.dirname(probe)
        if parent == probe:
            return False
        probe = parent


if inside_git_checkout(EXPORT):
    sys.exit(f"refusing: {EXPORT} is inside a git checkout")

spec = importlib.util.spec_from_file_location("cfe", ".collab/reviews/2026-09-22-pricing-research/churn_from_export.py")
cfe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cfe)

P = lambda s: dt.datetime.fromisoformat(s) if s else None  # noqa: E731


def era(t):
    d = t.date()
    if d < dt.date(2026, 5, 24):
        return "E0_pre_R2"
    if d < dt.date(2026, 8, 8):
        return "E1_R2_latency"
    if d < dt.date(2026, 9, 7):
        return "E2_post_latency"
    return "E3_post_TA"


def size_band(pages):
    if pages is None:
        return "unknown"
    for limit, band in ((10, "xs"), (40, "s"), (100, "m"), (300, "l")):
        if pages <= limit:
            return band
    return "xl"


def session_mech(s, uid, docs_by_prefix, events):
    msgs = sorted(s["messages"], key=lambda m: m["t"])
    answered, cited, continued, gaps = [], [], [], []
    for k, m in enumerate(msgs):
        if m["role"] != "user":
            continue
        reply = None
        for nxt in msgs[k + 1:]:
            if nxt["role"] == "user":
                break
            if nxt["role"] == "assistant":
                reply = nxt
                break
        answered.append(reply is not None)
        cited.append(len(reply["cited_pages"]) if reply else 0)
        continued.append(bool(reply and (reply.get("continuations") or 0) > 0))
        if reply:
            gaps.append((P(reply["t"]) - P(m["t"])).total_seconds() / 60)
    first_t, last_t = P(msgs[0]["t"]), P(msgs[-1]["t"])
    lo, hi = first_t - dt.timedelta(minutes=2), last_t + dt.timedelta(minutes=30)
    doc = docs_by_prefix.get(s["doc"]) if s.get("doc") else None
    walls = []
    for e in events:
        t = P(e["t"])
        if e["event"] in ("limit_hit", "paywall_opened") and lo <= t <= hi:
            walls.append({"reason": e["reason"], "is_demo": e.get("is_demo"), "t": e["t"],
                          "followed_by_upgrade_click": any(x["event"] == "upgrade_click" and t < P(x["t"]) <= t + UPGRADE_AFTER
                                                           for x in events),
                          "followed_by_checkout": any(x["event"] == "checkout_created" and t < P(x["t"]) <= t + CHECKOUT_AFTER
                                                      for x in events)})
    return {
        "sid": s["sid"], "uid": uid, "demo": bool(s["demo"]), "demo_slug": s.get("demo_slug"), "doc": s.get("doc"),
        "doc_status": doc["status"] if doc else ("ready" if s["demo"] else None),
        "doc_error": doc["error"] if doc else None, "doc_file_type": doc["file_type"] if doc else ("pdf" if s["demo"] else None),
        "doc_pages": doc["pages"] if doc else None, "doc_size_band": size_band(doc["pages"] if doc else None),
        "doc_parse_method": doc["parse_method"] if doc else None, "doc_text_quality": doc["text_quality"] if doc else None,
        "doc_has_summary": doc["has_summary"] if doc else None, "collection": bool(s.get("collection")),
        "era": era(P(s["created"]) if s.get("created") else first_t),
        "n_user_msgs": sum(1 for m in msgs if m["role"] == "user"),
        "n_assistant_msgs": sum(1 for m in msgs if m["role"] == "assistant"),
        "n_unanswered": answered.count(False), "answered_flags": answered, "cited_counts": cited,
        "continuation_flags": continued,
        "has_action_meta": any(m["role"] == "assistant" and ("action_plan" in (m.get("meta") or {}) or "artifacts" in (m.get("meta") or {}))
                               for m in msgs),
        "first_t": msgs[0]["t"], "last_t": msgs[-1]["t"],
        "span_minutes": round((last_t - first_t).total_seconds() / 60, 1),
        "max_gap_minutes": round(max(gaps), 1) if gaps else None,
        "citation_clicks_in_window": sum(1 for e in events if e["event"] == "citation_clicked" and lo <= P(e["t"]) <= hi),
        "walls_in_window": walls,
    }


def chars(user_entry):
    return sum(len(m.get("text") or "") for s in user_entry["sessions"] for m in s["messages"])


def main():
    users_json = json.load(open(os.path.join(EXPORT, "users.json"), encoding="utf-8"))
    anon_json = json.load(open(os.path.join(EXPORT, "anonymous_demo_sessions.json"), encoding="utf-8"))
    uids = [u["uid"] for u in users_json]
    sids = [s["sid"] for u in users_json for s in u["sessions"]] + [s["sid"] for s in anon_json]
    assert len(set(uids)) == len(uids), "uid prefix collision"
    assert len(set(sids)) == len(sids), "sid prefix collision"
    buckets = {u.uid: SEGMENT[u.bucket()] for u in cfe.build_users(users_json)}

    if os.path.exists(OUT):
        shutil.rmtree(OUT)
    for sub in ("slices/W1", "slices/W2", "slices/W3", "slices/W4", "calibration/anon"):
        os.makedirs(os.path.join(OUT, sub))

    sessions_mech, users_mech, entries = [], {}, {}
    for u in users_json:
        docs_by_prefix = {d["doc"]: d for d in u["documents"]}
        events = u.get("events", [])
        sess = sorted(u["sessions"], key=lambda s: s["created"] or "")
        mechs, prev_doc = [], None
        for k, s in enumerate(sess, 1):
            m = session_mech(s, u["uid"], docs_by_prefix, events)
            m["session_index_for_user"] = k
            m["same_doc_as_previous_session"] = bool(prev_doc and s.get("doc") == prev_doc)
            prev_doc = s.get("doc")
            mechs.append(m)
        user_msgs = sorted((P(m["t"]), s.get("doc")) for s in sess for m in s["messages"] if m["role"] == "user")
        days = sorted({t.date() for t, _ in user_msgs})
        d0 = days[0] if days else None
        doc_days = {}
        for t, doc in user_msgs:
            doc_days.setdefault(doc, set()).add(t.date())
        ledger = u.get("ledger") or {}
        um = {
            "uid": u["uid"], "signup": u["signup"], "plan": u["plan"], "balance": u["balance"], "segment": buckets[u["uid"]],
            "n_docs": len(u["documents"]), "n_error_docs": sum(1 for d in u["documents"] if d["status"] == "error"),
            "doc_pages_max": max((d["pages"] for d in u["documents"] if d["pages"]), default=None),
            "doc_types": sorted({d["file_type"] for d in u["documents"] if d["file_type"]}),
            "n_sessions": len(sess), "n_demo_sessions": sum(1 for s in sess if s["demo"]),
            "n_user_msgs": len(user_msgs), "n_unanswered": sum(m["n_unanswered"] for m in mechs),
            "active_days": len(days),
            "span_days": round((user_msgs[-1][0] - user_msgs[0][0]).total_seconds() / 86400, 2) if user_msgs else None,
            "returned_later_day": bool(d0 and any(d0 < d <= d0 + dt.timedelta(days=7) for d in days)),
            "returned_same_doc": any(doc is not None and len(ds) >= 2 for doc, ds in doc_days.items()),
            "citation_clicks": sum(1 for e in events if e["event"] == "citation_clicked"),
            "walls": [{"reason": e["reason"], "is_demo": e.get("is_demo"), "t": e["t"]} for e in events
                      if e["event"] in ("limit_hit", "paywall_opened")],
            "upgrade_clicks": [{"source": e["source"], "reason": e["reason"], "t": e["t"]} for e in events
                               if e["event"] == "upgrade_click"],
            "checkout_created": sum(1 for e in events if e["event"] == "checkout_created"),
            "checkout_completed": sum(1 for e in events if e["event"] == "checkout_completed"),
            "credits_spent_chat": -min(0, ledger.get("chat", 0)),
            "credits_spent_other": -sum(v for k, v in ledger.items() if k != "chat" and v < 0),
            "usage_by_model": u.get("usage") or {},
            "eras_active": sorted({m["era"] for m in mechs}),
        }
        users_mech[u["uid"]] = um
        sessions_mech += mechs
        entries[u["uid"]] = (u, mechs)

    anon_mech = {}
    for s in anon_json:
        m = session_mech(s, None, {}, [])
        m["session_index_for_user"] = None
        m["same_doc_as_previous_session"] = None
        anon_mech[s["sid"]] = m
        sessions_mech.append(m)

    # assignment (§3.1): deep set D = >= 3 user messages, snake-dealt by transcript size; calibration users excluded
    deep = [u for u in users_json if users_mech[u["uid"]]["n_user_msgs"] >= 3]
    deep_assign = sorted((u for u in deep if u["uid"] not in CALIBRATION_USERS), key=chars, reverse=True)
    pattern = ["W1", "W2", "W2", "W1"]
    for k, u in enumerate(deep_assign):
        users_mech[u["uid"]]["assignment"] = pattern[k % 4]
    for u in users_json:
        um = users_mech[u["uid"]]
        if u["uid"] in CALIBRATION_USERS:
            um["assignment"] = "calibration"
        elif "assignment" not in um:
            has_something = um["n_user_msgs"] > 0 or um["n_docs"] > 0 or um["walls"] or um["upgrade_clicks"] or um["citation_clicks"]
            um["assignment"] = "W3" if has_something else "none"
    anon_sorted = sorted(anon_json, key=lambda s: (-sum(1 for m in s["messages"] if m["role"] == "user"),
                                                   -sum(len(m.get("text") or "") for m in s["messages"])))
    anon_calibration = [s["sid"] for s in anon_sorted[:2]]

    def write_jsonl(name, rows):
        with open(os.path.join(OUT, name), "w", encoding="utf-8") as f:
            for r in rows:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")

    write_jsonl("users_mech.jsonl", [users_mech[u["uid"]] for u in users_json])
    write_jsonl("sessions_mech.jsonl", sessions_mech)

    def slice_payload(uid):
        u, mechs = entries[uid]
        return {**u, "mech": {"user": users_mech[uid], "sessions": mechs}}

    assignments = {"W1": [], "W2": [], "W3": []}
    for u in deep_assign:
        assignments[users_mech[u["uid"]]["assignment"]].append(u["uid"])
    assignments["W3"] = [u["uid"] for u in users_json if users_mech[u["uid"]]["assignment"] == "W3"]
    for w, ids in assignments.items():
        for uid in ids:
            json.dump(slice_payload(uid), open(os.path.join(OUT, "slices", w, f"{uid}.json"), "w", encoding="utf-8"),
                      ensure_ascii=False, indent=1)
        open(os.path.join(OUT, f"assign_{w}.txt"), "w").write("".join(f"{x}\n" for x in ids))
    anon_assign = [s["sid"] for s in anon_json if s["sid"] not in anon_calibration]
    for s in anon_json:
        target = os.path.join(OUT, "calibration", "anon") if s["sid"] in anon_calibration else os.path.join(OUT, "slices", "W4")
        json.dump({**s, "mech": anon_mech[s["sid"]]}, open(os.path.join(target, f"{s['sid']}.json"), "w", encoding="utf-8"),
                  ensure_ascii=False, indent=1)
    open(os.path.join(OUT, "assign_W4.txt"), "w").write("".join(f"{x}\n" for x in anon_assign))
    for uid in CALIBRATION_USERS:
        json.dump(slice_payload(uid), open(os.path.join(OUT, "calibration", f"{uid}.json"), "w", encoding="utf-8"),
                  ensure_ascii=False, indent=1)
    open(os.path.join(OUT, "calibration", "ids.txt"), "w").write("".join(f"{x}\n" for x in CALIBRATION_USERS))
    open(os.path.join(OUT, "calibration", "anon_ids.txt"), "w").write("".join(f"{x}\n" for x in anon_calibration))
    shutil.copy(os.path.join(REPO_DIR, "validate_coded.py"), os.path.join(OUT, "validate_coded.py"))
    os.makedirs(os.path.join(EXPORT, "coded"), exist_ok=True)

    # summary (counts only)
    seg = Counter(um["segment"] for um in users_mech.values())
    reg_sessions = [m for m in sessions_mech if m["uid"]]
    lines = ["# Pre-pass summary (counts only)", "",
             f"- users: {len(users_json)}; segments: " + ", ".join(f"{k} {seg[k]}" for k in SEGMENT.values()),
             f"- users with >= 1 user message: {sum(1 for um in users_mech.values() if um['n_user_msgs'])}; "
             f"returned_later_day: {sum(1 for um in users_mech.values() if um['returned_later_day'])}; "
             f"active_days >= 2: {sum(1 for um in users_mech.values() if um['active_days'] >= 2)}; "
             f"returned_same_doc: {sum(1 for um in users_mech.values() if um['returned_same_doc'])}",
             f"- registered sessions: {len(reg_sessions)} (demo {sum(1 for m in reg_sessions if m['demo'])}); by era: "
             + ", ".join(f"{k} {v}" for k, v in sorted(Counter(m['era'] for m in reg_sessions).items())),
             f"- unanswered user messages: {sum(m['n_unanswered'] for m in reg_sessions)} registered, "
             f"{sum(m['n_unanswered'] for m in anon_mech.values())} anonymous; by era: "
             + ", ".join(f"{k} {v}" for k, v in sorted(Counter(m['era'] for m in reg_sessions for _ in range(m['n_unanswered'])).items())),
             f"- deep set (>= 3 user messages): {len(deep)} users, {sum(users_mech[u['uid']]['n_user_msgs'] for u in deep)} user messages",
             ]
    for w in ("W1", "W2", "W3"):
        ids = assignments[w]
        lines.append(f"- {w}: {len(ids)} users, {sum(users_mech[x]['n_sessions'] for x in ids)} sessions, "
                     f"{sum(users_mech[x]['n_user_msgs'] for x in ids)} user messages, "
                     f"{sum(chars(entries[x][0]) for x in ids)} transcript characters")
    lines += [f"- W4: {len(anon_assign)} anonymous sessions (+ {len(anon_calibration)} calibration: {', '.join(anon_calibration)}); "
              f"single-message sessions {sum(1 for m in anon_mech.values() if m['n_user_msgs'] == 1)}",
              f"- calibration users: {', '.join(CALIBRATION_USERS)} (excluded from every assignment)",
              f"- mechanical only (nothing to code): {sum(1 for um in users_mech.values() if um['assignment'] == 'none')} users",
              "- windows: a wall's followed_by_upgrade_click = an upgrade_click within 10 min after it; "
              "followed_by_checkout = a checkout_created within 60 min after it; session window = first message - 2 min "
              "to last message + 30 min.",
              "- era by session creation date (UTC): E0 < 05-24, E1 < 08-08, E2 < 09-07, E3 after."]
    open(os.path.join(OUT, "prepass_summary.md"), "w").write("\n".join(lines) + "\n")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
