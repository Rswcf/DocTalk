"""Observation-window readout for the v0.29.0 / v0.30.0 releases (read-only).

  DB="postgresql://...public..." python3 scripts/observation_window.py [T_B_ISO]

T_A = 2026-09-07T00:22:30Z is the v0.29.0 backend deploy (Railway SUCCESS). T_B is the
v0.30.0 backend deploy; pass it once known. [T_A, T_B) is the A+C-only window.

Criteria are pre-registered in `.collab/plans/2026-09-03-backlog-decision.md` §8.6.
At ~1 signup/day every criterion is an EXISTENCE threshold, not a rate. If non-owner
signups since T_A are < 10, extend the window rather than concluding anything.

NOT MEASURABLE HERE, by construction: `DOCUMENT_PAGE_LIMIT_EXCEEDED` and
`PDF_PASSWORD_PROTECTED` reject before the `documents` INSERT, and the upload path's
`limit_hit` event only carries file_size/upload_limit — so those read zero here no
matter what happens. Their instrument is Railway logs (documents.py response bodies).

There is no chip-SHOWN event, so Quote Finder CTR is unmeasurable. Do not add one now.
"""
import asyncio
import datetime as dt
import json
import os
import pathlib
import sys

import asyncpg

OWNER = "c142f3af-6e6b-488d-ba57-d91aa3e57cc7"  # internal/owner account, excluded everywhere
T_A = "2026-09-07T00:22:30Z"
T_B = sys.argv[1] if len(sys.argv) > 1 else "2026-09-09T09:27:27Z"  # v0.30.0 backend SUCCESS
SNAPSHOT = pathlib.Path(__file__).with_name("day0-error-docs.json")

# Marketing surfaces land on /billing and are NOT what A1 fixed. Everything else is
# treated as in-app. Inverted deliberately: the in-app set is 30+ and grows, so
# enumerating it would silently drop new sources from the numbers.
MARKETING = {"pricing", "pricing_hero", "hero", "final_cta", "public_header",
             "features_layout_translation"}


def head(s):
    print(f"\n{'=' * 72}\n{s}\n{'=' * 72}")


async def q(con, sql, *a):
    return await con.fetch(sql, *a)


async def one(con, sql, *a):
    return await con.fetchval(sql, *a)


async def main():
    con = await asyncpg.connect(os.environ["DB"])
    ta = dt.datetime.fromisoformat(T_A.replace("Z", "+00:00"))
    tb = dt.datetime.fromisoformat(T_B.replace("Z", "+00:00")) if T_B else None
    print(f"T_A = {T_A}   T_B = {T_B or '<v0.30.0 not deployed>'}")

    # ---------- sample size gate ----------
    head("0. SAMPLE SIZE — read this before any conclusion")
    n = await one(con, "select count(*) from users where id::text <> $1 and created_at >= $2",
                  OWNER, ta)
    print(f"  non-owner signups since T_A: {n}")
    print("  >>> n < 10: EXTEND the window. Do not conclude 'no effect' from this data."
          if n < 10 else "  n >= 10: criteria below are decidable.")

    # ---------- defect triggers ----------
    head("1. DEFECT TRIGGERS — act immediately, do not wait for the window to end")
    ic = await one(con, """select count(*) from product_events
        where event_name='upgrade_click' and created_at>=$2 and user_id::text is distinct from $1
          and coalesce(metadata_json->>'source','') <> all($3::text[])""",
                   OWNER, ta, list(MARKETING))
    cc = await one(con, """select count(*) from product_events
        where event_name='checkout_created' and created_at>=$2
          and user_id::text is distinct from $1""", OWNER, ta)
    cf = await one(con, """select count(*) from product_events
        where event_name='checkout_failed' and created_at>=$1""", ta)
    print(f"  in-app upgrade_click (non-owner): {ic}")
    print(f"  checkout_created (non-owner):     {cc}")
    print(f"  checkout_failed (any):            {cf}")
    if ic >= 1 and cc == 0:
        print("  *** DEFECT: intent without a checkout session. Read `checkout_attempts`. ***")
    if cf:
        print("  *** DEFECT: checkout_failed fired. Read its metadata_json. ***")

    # ---------- purchase wall ----------
    head("2. PURCHASE WALL (A1/A2) — existence check")
    for r in await q(con, """select coalesce(metadata_json->>'source','<none>') src, count(*) n
        from product_events where event_name='upgrade_click' and created_at>=$2
          and user_id::text is distinct from $1 group by 1 order by 2 desc""", OWNER, ta):
        kind = "marketing" if r["src"] in MARKETING else "IN-APP"
        print(f"  {r['src']:<34}{r['n']:>4}   {kind}")
    for e in ("checkout_created", "checkout_completed"):
        print(f"  {e:<34}{await one(con, 'select count(*) from product_events where event_name=$1 and created_at>=$2', e, ta):>4}")

    # ---------- domain mode trial ----------
    head("3. DOMAIN MODE TRIAL (A3) — the #1 intent source, never once used")
    t = await one(con, """select count(*) from feature_trial_usages
        where user_id::text <> $1 and created_at >= $2""", OWNER, ta)
    print(f"  non-owner trial claims since T_A: {t}   (base over 263 sessions: 0)")

    # ---------- quote finder ----------
    head("4. QUOTE FINDER (C1/C2) — base is 0 real searches, ever")
    for e in ("quote_finder_chip_clicked", "quote_finder_panel_opened"):
        print(f"  {e:<34}{await one(con, 'select count(*) from product_events where event_name=$1 and created_at>=$2 and user_id::text is distinct from $3', e, ta, OWNER):>4}")
    print(f"  {'non-owner quote_search (ledger)':<34}"
          f"{await one(con, 'select count(*) from credit_ledger where reason=$1 and created_at>=$2 and user_id::text <> $3', 'quote_search', ta, OWNER):>4}"
          "   <- true adoption")

    # ---------- first session (B1) ----------
    head("5. FIRST SESSION (B1) — cleanest baseline, coarsest resolution")
    if not tb:
        print("  T_B unknown; pass the v0.30.0 deploy time to enable the before/after.")
    else:
        for label, lo, hi in (("before", ta - dt.timedelta(days=60), tb), ("after", tb, None)):
            rows = await q(con, """select d.id from documents d
                where d.user_id is not null and d.user_id::text <> $1
                  and d.status='ready' and d.created_at >= $2
                  and ($3::timestamptz is null or d.created_at < $3)""", OWNER, lo, hi)
            ids = [r["id"] for r in rows]
            if not ids:
                print(f"  {label:<7} n=0")
                continue
            zero = await one(con, """select count(*) from documents d
                where d.id = any($1::uuid[]) and not exists (
                  select 1 from messages m join sessions s on s.id=m.session_id
                  where s.document_id=d.id and m.role='user')""", ids)
            print(f"  {label:<7} n={len(ids):<4} zero-message docs={zero}  "
                  f"({100*zero//max(1,len(ids))}%)   <- halving is the readable threshold")

    # ---------- parse failures (B2) ----------
    head("6. PARSE FAILURES (B2)")
    if SNAPSHOT.exists():
        snap = json.loads(SNAPSHOT.read_text())["error_document_ids"]
        recovered = await one(con, "select count(*) from documents where id::text = any($1::text[]) and status='ready'", snap)
        print(f"  day-0 error docs: {len(snap)}   now ready: {recovered}   <- any recovery = a dead end removed")
    else:
        print(f"  no snapshot at {SNAPSHOT} — day-0 set unknown, recovery unmeasurable")
    print(f"  new error docs since T_A: {await one(con, 'select count(*) from documents where status=$1 and created_at>=$2 and user_id::text <> $3', 'error', ta, OWNER)}")

    # ---------- nudge (B4) ----------
    head("7. UPGRADE NUDGE (B4) — base since the lifetime cap: 0")
    print(f"  upgrade_nudge_shown: {await one(con, 'select count(*) from product_events where event_name=$1 and created_at>=$2 and user_id::text is distinct from $3', 'upgrade_nudge_shown', ta, OWNER)}")
    for e in ("upgrade_click", "checkout_created"):
        print(f"  {e} @ dashboard_upgrade_reminder: {await one(con, 'select count(*) from product_events where event_name=$1 and created_at>=$2 and metadata_json->>$3=$4', e, ta, 'source', 'dashboard_upgrade_reminder')}")

    # ---------- day 2 ----------
    head("8. DAY-2 — a REPORTED RATE, not the decider (base 0.149 over active users)")
    d2 = await one(con, """
        with first as (select u.id, u.created_at from users u
                       where u.id::text <> $1 and u.created_at >= $2),
        acts as (select s.user_id uid, date(m.created_at) d from messages m
                 join sessions s on s.id=m.session_id
                 where m.role='user' and s.user_id is not null)
        select count(distinct f.id) from first f join acts a on a.uid=f.id
        where a.d > date(f.created_at) and a.d <= date(f.created_at) + 7""", OWNER, ta)
    print(f"  non-owner users active on a LATER day within 7: {d2}")
    print("  base rate: 0.149 over ever-active users (10/67), 0.059 over signups (10/170).")
    print("  >>> RETRACTED (§9.11/§9.12): a single day-2 return is NOT decisive — at p=0.149 it is")
    print("      what ~1 active user in 7 does anyway, and a zero read at n=10 happens 35% of the")
    print("      time when nothing changed. Deciding day-2 needs ~30 exposed users (~Feb 2027).")

    head("9. DAY-4 — THE DECIDER. True zero base: 0 of 67 users, ever")
    d4 = await q(con, """
        with acts as (select s.user_id uid, date(m.created_at) d from messages m
                      join sessions s on s.id=m.session_id
                      where m.role='user' and s.user_id is not null and s.user_id::text <> $1
                      group by 1,2),
        ranked as (select uid, d, row_number() over (partition by uid order by d) rn from acts)
        select uid::text, d from ranked where rn = 4 order by d""", OWNER)
    print(f"  users reaching a 4th distinct active day: {len(d4)}")
    for r in d4:
        print(f"    {r['uid'][:8]}  4th day = {r['d']}")
    print("  >>> >=1: read that user's whole history and decide immediately. This is the only")
    print("      metric where one positive read is unambiguous (0/67 over seven months).")
    print("      Caveat: 0/67 is compatible with a true rate up to ~4.5%, so a first read means")
    print("      \"the wall can be crossed, here is who and how\", never \"B worked\".")

    await con.close()

asyncio.run(main())
