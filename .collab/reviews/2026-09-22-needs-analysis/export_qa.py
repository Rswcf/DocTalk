"""Read-only export of DocTalk's production Q&A for the owner-requested needs analysis (2026-09-22).

Writes to the directory given as the first argument, which must be OUTSIDE any git checkout (the repository is
public; the script refuses otherwise). Never commit or upload the output. No emails, names, filenames, storage keys or URLs; users and sessions are 8-character id prefixes.
Message text is exported in full because the analysis is about what users asked and what they got back.
"""
import asyncio
import datetime as dt
import json
import os
import re
import sys
from collections import defaultdict

import asyncpg

OWNER = "c142f3af-6e6b-488d-ba57-d91aa3e57cc7"
OUT = os.path.abspath(sys.argv[1])


def _inside_git_checkout(path):
    """The repository is public: refuse to write user conversations anywhere inside a git checkout."""
    probe = path
    while True:
        if os.path.exists(os.path.join(probe, ".git")):
            return True
        parent = os.path.dirname(probe)
        if parent == probe:
            return False
        probe = parent


if _inside_git_checkout(OUT):
    sys.exit(f"refusing to write inside a git checkout: {OUT} — pass a directory outside the repository")
DSN = re.sub(r"^postgres(?:ql)?(?:\+\w+)?://", "postgresql://", os.environ["DATABASE_URL"])
EVENTS = ("limit_hit", "paywall_opened", "upgrade_click", "checkout_created", "checkout_completed", "checkout_failed",
          "citation_clicked", "export_clicked", "share_created", "feedback_submitted", "quote_finder_chip_clicked",
          "quote_finder_panel_opened", "quote_search_submitted", "quote_search_completed", "quote_saved",
          "billing_view", "upgrade_nudge_shown", "subscription_cancel_requested", "refund_requested")


def iso(t):
    return t.isoformat() if t else None


def small_meta(meta):
    if not isinstance(meta, dict):
        return {}
    out = {}
    for k, v in meta.items():
        if isinstance(v, (bool, int, float)) or v is None:
            out[k] = v
        elif isinstance(v, str) and len(v) <= 200:
            out[k] = v
        else:
            out[k] = f"<{type(v).__name__}>"
    return out


def cited_pages(citations):
    pages = []
    if isinstance(citations, str):
        try:
            citations = json.loads(citations)
        except ValueError:
            return pages
    items = citations if isinstance(citations, list) else (citations or {}).get("citations", []) if isinstance(citations, dict) else []
    for c in items or []:
        if isinstance(c, dict):
            p = c.get("page") or c.get("page_number")
            if p is not None:
                pages.append(p)
    return pages


async def main():
    os.makedirs(OUT, exist_ok=True)
    con = await asyncpg.connect(DSN)
    await con.set_type_codec("jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog")
    await con.set_type_codec("json", encoder=json.dumps, decoder=json.loads, schema="pg_catalog")
    try:
        await con.execute("set default_transaction_read_only = on")
        users = {}
        for r in await con.fetch("select id, created_at, plan, credits_balance from users where id::text <> $1", OWNER):
            users[r["id"]] = {"uid": str(r["id"])[:8], "signup": iso(r["created_at"]), "plan": r["plan"],
                              "balance": r["credits_balance"], "events": [], "feedback": [], "ledger": defaultdict(int),
                              "usage": defaultdict(lambda: {"calls": 0, "prompt": 0, "completion": 0, "credits": 0})}
        docs = {}
        for r in await con.fetch("""select id, user_id, file_type, page_count, file_size, status, error_msg, parse_method,
                                           text_quality, ocr_languages, created_at, demo_slug, summary is not null has_summary,
                                           source_url is not null from_url
                                    from documents where user_id is null or user_id::text <> $1""", OWNER):
            docs[r["id"]] = {"doc": str(r["id"])[:8], "file_type": r["file_type"], "pages": r["page_count"],
                             "size_mb": round((r["file_size"] or 0) / 1e6, 1), "status": r["status"],
                             "error": (r["error_msg"] or "")[:80] or None, "parse_method": r["parse_method"],
                             "text_quality": r["text_quality"], "ocr_languages": r["ocr_languages"],
                             "created": iso(r["created_at"]), "demo_slug": r["demo_slug"], "has_summary": r["has_summary"],
                             "from_url": r["from_url"], "owner_uid": str(r["user_id"])[:8] if r["user_id"] else None}
        sessions = {}
        for r in await con.fetch("""select id, user_id, document_id, collection_id, domain_mode, created_at from sessions
                                    where user_id is null or user_id::text <> $1""", OWNER):
            d = docs.get(r["document_id"])
            sessions[r["id"]] = {"sid": str(r["id"])[:8], "uid": str(r["user_id"])[:8] if r["user_id"] else None,
                                 "anonymous": r["user_id"] is None, "doc": d["doc"] if d else None,
                                 "demo": bool(d and d["demo_slug"]), "demo_slug": d["demo_slug"] if d else None,
                                 "collection": r["collection_id"] is not None, "domain_mode": r["domain_mode"],
                                 "created": iso(r["created_at"]), "messages": []}
        for r in await con.fetch("""select session_id, role, content, citations, metadata_json, prompt_tokens, output_tokens,
                                           continuation_count, created_at
                                    from messages order by created_at, id"""):
            s = sessions.get(r["session_id"])
            if s is None:
                continue
            s["messages"].append({"role": r["role"], "t": iso(r["created_at"]), "text": r["content"],
                                  "cited_pages": cited_pages(r["citations"]), "meta": small_meta(r["metadata_json"]),
                                  "prompt_tokens": r["prompt_tokens"], "output_tokens": r["output_tokens"],
                                  "continuations": r["continuation_count"]})
        for r in await con.fetch("""select user_id, event_name, source, reason, created_at, metadata_json from product_events
                                    where user_id is not null and user_id::text <> $1 and event_name = any($2::text[])
                                    order by created_at""", OWNER, list(EVENTS)):
            u = users.get(r["user_id"])
            if u:
                meta = small_meta(r["metadata_json"])
                u["events"].append({"event": r["event_name"], "source": r["source"], "reason": r["reason"],
                                    "t": iso(r["created_at"]), "is_demo": meta.get("is_demo")})
        for r in await con.fetch("""select user_id, type, area, severity, selected_options, message, locale, plan, created_at
                                    from user_feedback where user_id is null or user_id::text <> $1""", OWNER):
            u = users.get(r["user_id"])
            item = {"type": r["type"], "area": r["area"], "severity": r["severity"], "options": r["selected_options"],
                    "message": r["message"], "locale": r["locale"], "plan": r["plan"], "t": iso(r["created_at"])}
            if u:
                u["feedback"].append(item)
            else:
                users.setdefault("anonymous-feedback", {"uid": "anon", "feedback": []})["feedback"].append(item)
        for r in await con.fetch("""select user_id, reason, sum(delta) total from credit_ledger where user_id::text <> $1
                                    group by user_id, reason""", OWNER):
            u = users.get(r["user_id"])
            if u:
                u["ledger"][r["reason"]] = int(r["total"])
        for r in await con.fetch("""select user_id, model, count(*) calls, sum(prompt_tokens) p, sum(completion_tokens) c,
                                           sum(cost_credits) cr
                                    from usage_records where user_id is not null and user_id::text <> $1
                                    group by user_id, model""", OWNER):
            u = users.get(r["user_id"])
            if u:
                u["usage"][r["model"]] = {"calls": r["calls"], "prompt": int(r["p"] or 0), "completion": int(r["c"] or 0),
                                          "credits": int(r["cr"] or 0)}
        # group sessions by user; anonymous sessions stay separate
        by_user = defaultdict(list)
        anon = []
        for s in sessions.values():
            if not s["messages"]:
                continue
            (anon if s["anonymous"] else by_user[s["uid"]]).append(s)
        out_users = []
        for key, u in users.items():
            if key == "anonymous-feedback":
                continue
            u["ledger"] = dict(u["ledger"])
            u["usage"] = {k: v for k, v in u["usage"].items()}
            u["documents"] = [d for d in docs.values() if d["owner_uid"] == u["uid"]]
            u["sessions"] = sorted(by_user.get(u["uid"], []), key=lambda s: s["created"] or "")
            out_users.append(u)
        out_users.sort(key=lambda u: u["signup"] or "")
        with open(os.path.join(OUT, "users.json"), "w", encoding="utf-8") as f:
            json.dump(out_users, f, ensure_ascii=False, indent=1)
        with open(os.path.join(OUT, "anonymous_demo_sessions.json"), "w", encoding="utf-8") as f:
            json.dump(sorted(anon, key=lambda s: s["created"] or ""), f, ensure_ascii=False, indent=1)
        with open(os.path.join(OUT, "anonymous_feedback.json"), "w", encoding="utf-8") as f:
            json.dump(users.get("anonymous-feedback", {}).get("feedback", []), f, ensure_ascii=False, indent=1)
        n_msgs = sum(len(s["messages"]) for u in out_users for s in u["sessions"])
        print(f"exported {len(out_users)} non-owner users, {sum(1 for u in out_users if u['sessions'])} with conversations, "
              f"{sum(len(u['sessions']) for u in out_users)} sessions, {n_msgs} messages; "
              f"{len(anon)} anonymous demo sessions ({sum(len(s['messages']) for s in anon)} messages); "
              f"{sum(len(u['feedback']) for u in out_users)} feedback items; exported at {dt.datetime.now(dt.timezone.utc):%Y-%m-%dT%H:%MZ}")
    finally:
        await con.close()


asyncio.run(main())
