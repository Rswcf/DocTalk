"""Checkpoint readout 2026-09-22 — the overdue 2026-09-21 checkpoint of
.collab/plans/2026-09-03-backlog-decision.md §8.6. READ-ONLY (SELECT only).

Part 1 runs backend/scripts/observation_window.py unchanged (OW_PATH overrides the path).
Part 2 runs, by hand, the amendments the plan specified but never applied to the script:
§9.8 (refined defect trigger, active-user denominator, refreshed intent rates), §9.11/§9.13 (day-2 anchored on
the first active day, 7-day cap and uncapped), §9.18 item 6 (purchase-by-limit chain split at T_copy, day-4
capped flag, Quote Finder among citation clickers) and §9.11's historical returner read.
Owner excluded everywhere. Prints counts and 8-character user-id prefixes only (no emails, no content).
"""
import asyncio
import datetime as dt
import math
import os
import pathlib
import re
import runpy
import sys

DSN = re.sub(r"^postgres(?:ql)?(?:\+\w+)?://", "postgresql://", os.environ["DATABASE_URL"])

print("#" * 72 + "\n# PART 1 — observation_window.py as shipped (unchanged)\n" + "#" * 72)
os.environ["DB"] = DSN
sys.argv = ["observation_window.py"]
try:
    runpy.run_path(os.environ.get("OW_PATH", str(pathlib.Path(__file__).resolve().parents[3] / "backend/scripts/observation_window.py")),
                   run_name="__main__")
except SystemExit:
    pass
except Exception as e:  # keep going: part 2 is independent
    print(f"!! observation_window.py failed: {type(e).__name__}: {e}")

import asyncpg  # noqa: E402

OWNER = "c142f3af-6e6b-488d-ba57-d91aa3e57cc7"
UTC = dt.timezone.utc
T_A = dt.datetime(2026, 9, 7, 0, 22, 30, tzinfo=UTC)
T_B = dt.datetime(2026, 9, 9, 9, 27, 27, tzinfo=UTC)
T_COPY = dt.datetime(2026, 9, 10, 10, 46, 35, tzinfo=UTC)
NOW = dt.datetime.now(UTC)
MARKETING = ["pricing", "pricing_hero", "hero", "final_cta", "public_header", "features_layout_translation"]
SIGNUP_INTENT = ["demo_share_attempt"]
BASE_P = 0.149  # §9.12 reconciled day-2 base (10/67)

DAYS_CTE = """
  days as (
    select s.user_id uid, date(m.created_at) d
    from messages m join sessions s on s.id = m.session_id
    where m.role = 'user' and s.user_id is not null and s.user_id::text <> $1
    group by 1, 2)"""


def head(s):
    print(f"\n{'=' * 72}\n{s}\n{'=' * 72}")


def tail_ge(k, n, p):
    """P(X >= k), X ~ Binomial(n, p)."""
    return sum(math.comb(n, i) * p**i * (1 - p) ** (n - i) for i in range(k, n + 1)) if n else float("nan")


async def section(title, fn, con):
    head(title)
    try:
        await fn(con)
    except Exception as e:
        print(f"  !! section failed: {type(e).__name__}: {e}")


async def defect_trigger(con):
    rows = await con.fetch("""
        select e.user_id::text uid, e.created_at, coalesce(e.source, e.metadata_json->>'source') src, u.plan plan_now,
          exists (select 1 from checkout_attempts a where a.user_id = e.user_id
                  and a.started_at between e.created_at - interval '5 seconds'
                                       and e.created_at + interval '60 seconds') attempted,
          exists (select 1 from product_events b where b.user_id = e.user_id and b.event_name = 'billing_view'
                  and b.created_at between e.created_at and e.created_at + interval '60 seconds') fell_back
        from product_events e join users u on u.id = e.user_id
        where e.event_name = 'upgrade_click' and e.created_at >= $1
          and e.user_id is not null and e.user_id::text <> $2
          and coalesce(e.source, e.metadata_json->>'source', '') <> all($3::text[])
          and coalesce(e.source, e.metadata_json->>'source', '') <> all($4::text[])
        order by e.created_at""", T_A, OWNER, MARKETING, SIGNUP_INTENT)
    seen = {}
    for r in rows:
        kind = ("works" if r["attempted"] else
                "fallback (plan not loaded)" if (r["plan_now"] == "free" and r["fell_back"]) else
                "DEFECT" if r["plan_now"] == "free" else f"not free now ({r['plan_now']})")
        key = (r["uid"], r["created_at"].replace(minute=0, second=0, microsecond=0))
        seen.setdefault(key, kind)
        print(f"  {r['uid'][:8]} {r['created_at']:%Y-%m-%d %H:%M} src={r['src']:<28} plan_now={r['plan_now']:<6} "
              f"attempted={r['attempted']!s:<5} fell_back={r['fell_back']!s:<5} -> {kind}")
    if not rows:
        print("  no authenticated non-owner in-app upgrade_click since T_A")
    counts = {}
    for k in seen.values():
        counts[k] = counts.get(k, 0) + 1
    print(f"  deduped per user-hour: {counts or '{}'}")


async def denominator(con):
    r = await con.fetchrow("""
        select count(distinct s.user_id) filter (where u.created_at >= $1) new_users,
               count(distinct s.user_id) filter (where u.created_at <  $1) returning_users
        from messages m join sessions s on s.id = m.session_id join users u on u.id = s.user_id
        where m.role = 'user' and m.created_at >= $1 and s.user_id::text <> $2""", T_A, OWNER)
    print(f"  active non-owner users since T_A: new={r['new_users']}  returning={r['returning_users']}")


async def day2(con):
    sql = f"""with {DAYS_CTE},
        firsts as (select uid, min(d) first_day from days group by 1)
        select count(*) filter (where exists (select 1 from days x where x.uid = f.uid
                  and x.d > f.first_day and x.d <= f.first_day + 7)) returned_7d,
               count(*) filter (where exists (select 1 from days x where x.uid = f.uid
                  and x.d > f.first_day)) returned_any,
               count(*) exposed
        from firsts f where f.first_day >= $2::date and f.first_day <= $3::date"""
    base = await con.fetchrow(sql, OWNER, dt.date(2026, 2, 1), (T_A - dt.timedelta(days=7)).date())
    win_hi = (NOW - dt.timedelta(days=7)).date()
    win = await con.fetchrow(sql, OWNER, T_A.date(), win_hi)
    print(f"  base   (first active 2026-02-01..{(T_A - dt.timedelta(days=7)).date()}): "
          f"returned<=7d {base['returned_7d']}/{base['exposed']}   uncapped {base['returned_any']}/{base['exposed']}")
    print(f"  window (first active {T_A.date()}..{win_hi}, >=7d exposure):   "
          f"returned<=7d {win['returned_7d']}/{win['exposed']}   uncapped {win['returned_any']}/{win['exposed']}")
    if win["exposed"]:
        print(f"  binomial tail P(X >= {win['returned_7d']} | n={win['exposed']}, p={BASE_P}) = "
              f"{tail_ge(win['returned_7d'], win['exposed'], BASE_P):.3f}   (§9.11: decides nothing below ~30 exposed)")


async def day4(con):
    rows = await con.fetch(f"""with {DAYS_CTE},
        ranked as (select uid, d, row_number() over (partition by uid order by d) rn from days)
        select r4.uid::text uid, (select r1.d from ranked r1 where r1.uid = r4.uid and r1.rn = 1) d1, r4.d d4,
          exists (select 1 from product_events p where p.user_id = r4.uid and p.event_name = 'limit_hit'
                  and coalesce(p.reason, p.metadata_json->>'reason') = 'session_limit') capped
        from ranked r4 where r4.rn = 4 and r4.d >= $2::date order by r4.d""", OWNER, T_A.date())
    for r in rows:
        print(f"  {r['uid'][:8]}  1st {r['d1']}  4th {r['d4']}  4th>=T_B={r['d4'] >= T_B.date()}  ever capped={r['capped']}")
    print(f"  users whose 4th distinct active day is >= T_A: {len(rows)}   (base: 0 of 67 over seven months)")


async def by_limit(con):
    rows = await con.fetch("""
        with lh as (
          select p.user_id, p.created_at t, coalesce(p.reason, p.metadata_json->>'reason', '?') reason
          from product_events p
          where p.event_name = 'limit_hit' and p.created_at >= $1
            and p.user_id is not null and p.user_id::text <> $2)
        select reason, (t >= $3) post_copy, count(*) hits, count(distinct user_id) users,
          count(distinct user_id) filter (where exists (select 1 from product_events u where u.user_id = lh.user_id
              and u.event_name = 'upgrade_click' and u.created_at between lh.t and lh.t + interval '10 minutes')) clicked,
          count(distinct user_id) filter (where exists (select 1 from checkout_attempts a where a.user_id = lh.user_id
              and a.started_at between lh.t and lh.t + interval '15 minutes')) attempted,
          count(distinct user_id) filter (where exists (select 1 from product_events c where c.user_id = lh.user_id
              and c.event_name = 'checkout_created' and c.created_at between lh.t and lh.t + interval '15 minutes')) created,
          count(distinct user_id) filter (where exists (select 1 from product_events c where c.user_id = lh.user_id
              and c.event_name = 'checkout_completed' and c.created_at >= lh.t)) completed
        from lh group by 1, 2 order by 1, 2""", T_A, OWNER, T_COPY)
    print(f"  {'reason':<22}{'T_copy':<8}{'hits':>5}{'users':>6}{'click':>6}{'attempt':>8}{'created':>8}{'paid':>5}")
    for r in rows:
        print(f"  {r['reason']:<22}{'post' if r['post_copy'] else 'pre':<8}{r['hits']:>5}{r['users']:>6}"
              f"{r['clicked']:>6}{r['attempted']:>8}{r['created']:>8}{r['completed']:>5}")
    if not rows:
        print("  no authenticated non-owner limit_hit since T_A")
    anon = await con.fetch("""select coalesce(reason, metadata_json->>'reason', '?') reason, count(*) n
        from product_events where event_name = 'limit_hit' and created_at >= $1 and user_id is null
        group by 1 order by 2 desc""", T_A)
    print("  anonymous limit_hit since T_A (cannot chain to checkout): "
          + (", ".join(f"{r['reason']}={r['n']}" for r in anon) or "none"))


async def quote_finder(con):
    r = await con.fetchrow("""
        with cc as (select distinct user_id from product_events where event_name = 'citation_clicked'
                    and created_at >= $1 and user_id is not null and user_id::text <> $2)
        select (select count(*) from cc) clickers,
          (select count(distinct p.user_id) from product_events p join cc using (user_id)
             where p.event_name in ('quote_finder_chip_clicked', 'quote_finder_panel_opened') and p.created_at >= $1) touched,
          (select count(distinct l.user_id) from credit_ledger l join cc using (user_id)
             where l.reason = 'quote_search' and l.created_at >= $1) searched""", T_A, OWNER)
    print(f"  non-owner citation_clicked users since T_A: {r['clickers']}   of them touched Quote Finder "
          f"(chip/panel): {r['touched']}   searched: {r['searched']}")


async def intent_rates(con):
    lo = NOW - dt.timedelta(days=90)
    inapp = await con.fetchval("""select count(distinct user_id) from product_events
        where event_name = 'upgrade_click' and created_at >= $1 and user_id is not null and user_id::text <> $2
          and coalesce(source, metadata_json->>'source', '') <> all($3::text[])
          and coalesce(source, metadata_json->>'source', '') <> all($4::text[])""", lo, OWNER, MARKETING, SIGNUP_INTENT)
    dm = await con.fetchval("""select count(distinct user_id) from product_events
        where event_name = 'upgrade_click' and created_at >= $1 and created_at < $2 and user_id is not null
          and user_id::text <> $3 and coalesce(source, metadata_json->>'source') = 'domain_mode_selector'""", lo, T_A, OWNER)
    cc = await con.fetchval("""select count(distinct user_id) from product_events
        where event_name = 'citation_clicked' and created_at >= $1 and user_id is not null and user_id::text <> $2""",
                            lo, OWNER)
    print(f"  last 90 days ({lo:%Y-%m-%d}..now), authenticated non-owners, distinct users:")
    print(f"    in-app upgrade_click: {inapp}  (~{inapp / 3:.1f}/month; §9.4 holds 09-28 unless below ~2/month)")
    print(f"    upgrade_click source=domain_mode_selector, pre-T_A: {dm}")
    print(f"    citation_clicked: {cc}")


async def returners(con):
    rows = await con.fetch(f"""with {DAYS_CTE},
        firsts as (select uid, min(d) first_day from days group by 1),
        ret as (select f.uid, f.first_day, min(x.d) ret_day from firsts f join days x on x.uid = f.uid
                and x.d > f.first_day and x.d <= f.first_day + 7
                where f.first_day >= $2::date and f.first_day < $3::date group by 1, 2)
        select r.uid::text uid, r.first_day, r.ret_day,
          (select count(distinct x.d) from days x where x.uid = r.uid) active_days,
          (select count(*) from messages m join sessions s on s.id = m.session_id
             where s.user_id = r.uid and m.role = 'user' and date(m.created_at) = r.ret_day) ret_msgs,
          exists (select 1 from sessions s1 join messages m1 on m1.session_id = s1.id
                  where s1.user_id = r.uid and date(m1.created_at) = r.ret_day and s1.document_id in (
                    select s0.document_id from sessions s0 join messages m0 on m0.session_id = s0.id
                    where s0.user_id = r.uid and date(m0.created_at) = r.first_day)) same_doc,
          (select count(*) from product_events p where p.user_id = r.uid and p.event_name = 'citation_clicked') cites,
          (select count(*) from product_events p where p.user_id = r.uid and p.event_name like 'quote%') quote_ev,
          (select count(*) from documents d where d.user_id = r.uid) uploads,
          exists (select 1 from product_events p where p.user_id = r.uid and p.event_name = 'limit_hit') hit_limit,
          (select split_part(lower(u.email), '@', 1) ~ '^(bas|mel|ric|mca)' from users u where u.id = r.uid) paper_cohort
        from ret r order by r.first_day""", OWNER, dt.date(2026, 2, 1), T_A.date())
    print(f"  {'user':<9}{'first':<12}{'return':<12}{'days':>5}{'retmsg':>7}{'samedoc':>8}{'cites':>6}{'quote':>6}"
          f"{'docs':>5}{'limit':>6}{'paper':>6}")
    for r in rows:
        print(f"  {r['uid'][:8]:<9}{r['first_day']!s:<12}{r['ret_day']!s:<12}{r['active_days']:>5}{r['ret_msgs']:>7}"
              f"{r['same_doc']!s:>8}{r['cites']:>6}{r['quote_ev']:>6}{r['uploads']:>5}{r['hit_limit']!s:>6}{r['paper_cohort']!s:>6}")
    print(f"  pre-T_A returners within 7 days of their first active day: {len(rows)}")


async def main():
    con = await asyncpg.connect(DSN)
    try:
        await con.execute("set default_transaction_read_only = on")
        print("\n" + "#" * 72 + f"\n# PART 2 — amendments run by hand   (readout at {NOW:%Y-%m-%dT%H:%MZ})\n" + "#" * 72)
        await section("§9.8.1 refined defect trigger — authenticated in-app upgrade_click since T_A", defect_trigger, con)
        await section("§9.8.2 active-user denominator since T_A", denominator, con)
        await section("§9.11/§9.13 day-2 anchored on the first active day (reported rate, not a decider)", day2, con)
        await section("§9.11 day-4 decider, with §9.18 'ever capped'", day4, con)
        await section("§9.18.6 purchase — by limit (limit_hit -> click 10 min -> attempt -> created -> paid)", by_limit, con)
        await section("§9.18.6 Quote Finder among citation clickers", quote_finder, con)
        await section("§9.8.4 refreshed intent rates", intent_rates, con)
        await section("§9.11 historical returner read (first active 2026-02-01..T_A, returned within 7 days)", returners, con)
    finally:
        await con.close()


asyncio.run(main())
