"""Un-gated channel readout 2026-10-14 — traffic plan v2 Step 3 (the 10-13 read, one day late).

READ-ONLY: the session runs with default_transaction_read_only = on and issues SELECTs only.
Plan: .collab/plans/2026-10-10-traffic-plan-v2.md §2 (synthesis rule) and §3 Step 3.
Source: product_events.metadata_json (ref_host, utm_source, utm_medium, landing_path) on the three attributed
events, live since Release A (2026-09-30 21:59:43Z). Pre-sign-in events carry no user_id; the owner's signed-in
events are excluded. Prints counts only: no emails, no user ids, no content.

Usage: DATABASE_URL=... python3 -I readout_1014.py
"""
import asyncio
import datetime as dt
import os
import re

import asyncpg

DSN = re.sub(r"^postgres(?:ql)?(?:\+\w+)?://", "postgresql://", os.environ["DATABASE_URL"])
OWNER = "c142f3af-6e6b-488d-ba57-d91aa3e57cc7"
UTC = dt.timezone.utc
T_RELEASE_A = dt.datetime(2026, 9, 30, 21, 59, 43, tzinfo=UTC)   # attribution live
T_RELEASE_B = dt.datetime(2026, 10, 10, 7, 13, 36, tzinfo=UTC)   # closes the C-9 baseline window
LISTICLES = [
    "/blog/chatpdf-alternatives-2026",
    "/blog/best-ai-pdf-tools-2026",
    "/blog/best-ai-tools-academic-research-2026",
]
EVENTS = ["landing_cta_clicked", "auth_modal_opened", "auth_provider_clicked"]

# §2 channel mapping. AI first, so gemini.google.com is not counted as Google.
CHANNEL = r"""
  case
    when coalesce(e.metadata_json->>'utm_source', '') ~* '^(chatgpt\.com|chatgpt|openai|perplexity|copilot|gemini|claude)'
      or coalesce(e.metadata_json->>'ref_host', '') ~* '(^|\.)(chatgpt\.com|openai\.com|perplexity\.ai|copilot\.microsoft\.com|gemini\.google\.com|claude\.ai)$'
      then 'ai'
    when coalesce(e.metadata_json->>'ref_host', '') ~* '(^|\.)google\.[a-z.]+$' then 'google'
    when coalesce(e.metadata_json->>'ref_host', '') ~* '(^|\.)bing\.com$' then 'bing'
    when coalesce(e.metadata_json->>'ref_host', '') <> '' or coalesce(e.metadata_json->>'utm_source', '') <> ''
      then 'referral'
    else 'unattributed'
  end"""

BASE = """
  from product_events e
  where e.event_name = any($1::text[])
    and e.created_at >= $2
    and (e.user_id is null or e.user_id::text <> $3)"""


def head(s):
    print(f"\n{'=' * 72}\n{s}\n{'=' * 72}")


def table(rows, cols):
    print("\t".join(cols))
    for r in rows:
        print("\t".join("" if r[c] is None else str(r[c]) for c in cols))


async def main():
    con = await asyncpg.connect(DSN)
    try:
        await con.execute("set default_transaction_read_only = on")
        await con.execute("set statement_timeout = '60s'")
        async with con.transaction(readonly=True):
            now = await con.fetchval("select now()")
            print(f"# Un-gated channel readout, run at {now:%Y-%m-%d %H:%M:%SZ} (read-only). Owner excluded.")
            print(f"# Window start = Release A {T_RELEASE_A:%Y-%m-%d %H:%M:%SZ}. Weeks are ISO weeks (Monday).")

            head("1. Attributed events by ISO week x channel (all three events)")
            rows = await con.fetch(f"""
              select to_char(date_trunc('week', e.created_at), 'YYYY-MM-DD') wk, {CHANNEL} ch, count(*) n
              {BASE} group by 1, 2 order by 1, 2""", EVENTS, T_RELEASE_A, OWNER)
            weeks = sorted({r["wk"] for r in rows})
            chans = ["ai", "google", "bing", "referral", "unattributed"]
            grid = {(r["wk"], r["ch"]): r["n"] for r in rows}
            print("wk\t" + "\t".join(chans) + "\ttotal\tattributed\tai_share_of_attributed")
            for w in weeks:
                vals = [grid.get((w, c), 0) for c in chans]
                attributed = sum(vals[:4])
                share = f"{vals[0] / attributed:.0%}" if attributed else "-"
                print(f"{w}\t" + "\t".join(map(str, vals)) + f"\t{sum(vals)}\t{attributed}\t{share}")

            head("2. Same grid per event name")
            rows = await con.fetch(f"""
              select e.event_name ev, to_char(date_trunc('week', e.created_at), 'YYYY-MM-DD') wk, {CHANNEL} ch,
                     count(*) n
              {BASE} group by 1, 2, 3 order by 1, 2, 3""", EVENTS, T_RELEASE_A, OWNER)
            for ev in EVENTS:
                print(f"\n-- {ev}")
                g = {(r["wk"], r["ch"]): r["n"] for r in rows if r["ev"] == ev}
                print("wk\t" + "\t".join(chans) + "\ttotal")
                for w in weeks:
                    vals = [g.get((w, c), 0) for c in chans]
                    print(f"{w}\t" + "\t".join(map(str, vals)) + f"\t{sum(vals)}")

            head("3. ref_host and utm_source values (whole window)")
            rows = await con.fetch(f"""
              select coalesce(e.metadata_json->>'ref_host', '(none)') ref_host,
                     coalesce(e.metadata_json->>'utm_source', '(none)') utm_source,
                     coalesce(e.metadata_json->>'utm_medium', '(none)') utm_medium,
                     {CHANNEL} ch, count(*) n
              {BASE} group by 1, 2, 3, 4 order by n desc, 1 limit 40""", EVENTS, T_RELEASE_A, OWNER)
            table(rows, ["n", "ch", "ref_host", "utm_source", "utm_medium"])

            head("4. landing_path by channel (whole window, top 40)")
            rows = await con.fetch(f"""
              select coalesce(e.metadata_json->>'landing_path', '(none)') landing_path, {CHANNEL} ch, count(*) n
              {BASE} group by 1, 2 order by n desc, 1 limit 40""", EVENTS, T_RELEASE_A, OWNER)
            table(rows, ["n", "ch", "landing_path"])

            head("5. C-9 baseline (plan v2 §2): AI-referred events landing on the three listicles")
            print("# metric: events with ref_host or utm_source = chatgpt.com AND landing_path in the three listicle paths")
            for label, start, end in (("baseline 09-30 21:59Z -> 10-10 07:13Z", T_RELEASE_A, T_RELEASE_B),
                                      ("after Release B (interim, NOT the 11-07 read)", T_RELEASE_B, now)):
                n = await con.fetchval(f"""
                  select count(*) {BASE}
                    and e.created_at < $4
                    and (coalesce(e.metadata_json->>'ref_host', '') ~* '(^|\\.)chatgpt\\.com$'
                         or coalesce(e.metadata_json->>'utm_source', '') ~* '^chatgpt\\.com$')
                    and e.metadata_json->>'landing_path' = any($5::text[])""",
                    EVENTS, start, OWNER, end, LISTICLES)
                days = (end - start).total_seconds() / 86400
                print(f"{label}: {n} events over {days:.1f} d = {n / days * 7:.2f}/week")
            n_any = await con.fetchval(f"""
              select count(*) {BASE}
                and (coalesce(e.metadata_json->>'ref_host', '') ~* '(^|\\.)chatgpt\\.com$'
                     or coalesce(e.metadata_json->>'utm_source', '') ~* '^chatgpt\\.com$')""",
                EVENTS, T_RELEASE_A, OWNER)
            print(f"context: chatgpt.com events on any landing path, whole window: {n_any}")

            head("6. SQL-1 refresh: weekly signups since 2026-09-21 (activated = >=1 document or >=1 user message)")
            rows = await con.fetch("""
              with u as (
                select u.id, u.created_at,
                       exists (select 1 from documents d where d.user_id = u.id) uploaded,
                       exists (select 1 from messages m join sessions s on s.id = m.session_id
                               where s.user_id = u.id and m.role = 'user') messaged,
                       (select string_agg(distinct a.provider, ',') from accounts a where a.user_id = u.id) providers
                from users u
                where u.created_at >= '2026-09-21' and u.id::text <> $1)
              select to_char(date_trunc('week', created_at), 'YYYY-MM-DD') wk, count(*) signups,
                     count(*) filter (where uploaded or messaged) activated,
                     count(*) filter (where providers like '%google%') google,
                     count(*) filter (where providers like '%microsoft%') microsoft,
                     count(*) filter (where providers is null) magic_link
              from u group by 1 order by 1""", OWNER)
            table(rows, ["wk", "signups", "activated", "google", "microsoft", "magic_link"])

            head("7. Anonymous demo sessions per ISO week since 2026-09-21 (sessions.user_id is null)")
            rows = await con.fetch("""
              select to_char(date_trunc('week', s.created_at), 'YYYY-MM-DD') wk, count(*) sessions,
                     count(*) filter (where exists (select 1 from messages m
                                                    where m.session_id = s.id and m.role = 'user')) with_question
              from sessions s where s.user_id is null and s.created_at >= '2026-09-21'
              group by 1 order by 1""")
            table(rows, ["wk", "sessions", "with_question"])
    finally:
        await con.close()


asyncio.run(main())
