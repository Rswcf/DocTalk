"""Production metrics dashboard (read-only). Run daily to watch the post-deploy trend.

  DB="postgresql://...public..." python3 scripts/prod_metrics.py [DEPLOY_DATE=2026-05-23]

Sections: Acquisition, DAU/WAU/MAU, Activation funnel, Conversion funnel,
Reliability (asst=0), Retrieval-feature usage (page-lookup / large-doc summary),
and a pre/post-deploy before/after for the funnel + reliability.
NOTE: the fixes deployed 2026-05-23..24, so "after" is still filling in — watch the
daily series over the coming days; the pre/post aggregate will become meaningful as
post-deploy traffic accumulates.
"""
import asyncio
import os
import sys
import datetime as dt

import asyncpg

OWNER = "c142f3af-6e6b-488d-ba57-d91aa3e57cc7"  # internal/owner account, excluded from user metrics
DEPLOY = sys.argv[1] if len(sys.argv) > 1 else "2026-05-23"


def bar(n, scale=1):
    return "█" * min(50, int(n / scale))


async def rows(con, sql, *a):
    try:
        return await con.fetch(sql, *a)
    except Exception as e:
        print("   ERR:", str(e)[:160]); return []


async def main():
    con = await asyncpg.connect(os.environ["DB"])
    print(f"DocTalk production metrics — deploy cutoff = {DEPLOY}  (now {dt.datetime.utcnow():%Y-%m-%d %H:%M} UTC)")
    print("=" * 78)

    # A. Acquisition
    print("\n## A. Signups / day (last 14d, owner excluded)")
    for r in await rows(con, """
      select date(created_at) d, count(*) n from users
      where id::text <> $1 and created_at > now()-interval '14 days'
      group by 1 order by 1 desc""", OWNER):
        print(f"   {r['d']}  {r['n']:>3}  {bar(r['n'])}")

    # B. DAU / WAU / MAU (distinct authed message senders)
    print("\n## B. DAU (distinct users sending a message) — last 14d")
    for r in await rows(con, """
      select date(m.created_at) d, count(distinct s.user_id) dau
      from messages m join sessions s on s.id=m.session_id
      where m.role='user' and s.user_id is not null and s.user_id::text <> $1
        and m.created_at > now()-interval '14 days'
      group by 1 order by 1 desc""", OWNER):
        print(f"   {r['d']}  DAU={r['dau']:>2}  {bar(r['dau'], 1)}")
    g = await rows(con, """
      select
       (select count(distinct s.user_id) from messages m join sessions s on s.id=m.session_id
         where m.role='user' and s.user_id is not null and s.user_id::text<>$1 and m.created_at>now()-interval '7 days') wau,
       (select count(distinct s.user_id) from messages m join sessions s on s.id=m.session_id
         where m.role='user' and s.user_id is not null and s.user_id::text<>$1 and m.created_at>now()-interval '30 days') mau""", OWNER)
    if g: print(f"   WAU={g[0]['wau']}  MAU={g[0]['mau']}")

    # C. Activation funnel (all-time, owner excluded)
    print("\n## C. Activation funnel (all users, owner excluded)")
    f = await rows(con, """
      with u as (select id from users where id::text<>$1),
      up as (select distinct user_id from documents where user_id is not null and demo_slug is null and user_id::text<>$1),
      msg as (select distinct s.user_id from messages m join sessions s on s.id=m.session_id where m.role='user' and s.user_id is not null and s.user_id::text<>$1),
      eng as (select s.user_id from messages m join sessions s on s.id=m.session_id where m.role='user' and s.user_id is not null and s.user_id::text<>$1 group by s.user_id having count(*)>=3)
      select (select count(*) from u) signed_up,(select count(*) from up) uploaded,(select count(*) from msg) messaged,(select count(*) from eng) engaged""", OWNER)
    if f:
        d=f[0]; su=max(1,d['signed_up'])
        for k in ('signed_up','uploaded','messaged','engaged'):
            print(f"   {k:<10} {d[k]:>3}  {100*d[k]//su:>3}%  {bar(d[k],max(1,su/40))}")

    # D. Conversion funnel — pre vs post deploy (distinct users per event)
    print(f"\n## D. Conversion funnel (distinct users) — BEFORE vs AFTER {DEPLOY}")
    for ev in ('paywall_opened','upgrade_click','checkout_created','checkout_completed'):
        r = await rows(con, """
          select sum((created_at < $2)::int) before, sum((created_at >= $2)::int) after_,
                 count(distinct user_id) filter (where created_at<$2) u_before,
                 count(distinct user_id) filter (where created_at>=$2) u_after
          from product_events where event_name=$1""", ev, dt.date.fromisoformat(DEPLOY))
        if r: print(f"   {ev:<20} before(users)={r[0]['u_before'] or 0:>3}   after(users)={r[0]['u_after'] or 0:>3}")

    # E. Reliability (asst=0) — pre/post
    print(f"\n## E. Reliability — chat sent vs completed, and asst=0 sessions (BEFORE vs AFTER {DEPLOY})")
    r = await rows(con, """
      select
        sum((event_name='chat_message_sent' and created_at<$1)::int) sent_b,
        sum((event_name='chat_message_completed' and created_at<$1)::int) comp_b,
        sum((event_name='chat_message_sent' and created_at>=$1)::int) sent_a,
        sum((event_name='chat_message_completed' and created_at>=$1)::int) comp_a
      from product_events where event_name in ('chat_message_sent','chat_message_completed')""", dt.date.fromisoformat(DEPLOY))
    if r:
        d=r[0]
        print(f"   sent/completed  BEFORE {d['sent_b'] or 0}/{d['comp_b'] or 0}   AFTER {d['sent_a'] or 0}/{d['comp_a'] or 0}  (gap = failed streams)")
    z = await rows(con, """
      with s as (select s.id, min(m.created_at) t, sum((m.role='user')::int) u, sum((m.role='assistant')::int) a
                 from sessions s join messages m on m.session_id=s.id where s.user_id::text<>$1 group by s.id)
      select sum((t<$2)::int) before, sum((t>=$2)::int) after_ from s where u>0 and a=0""", OWNER, dt.datetime.fromisoformat(DEPLOY))
    if z: print(f"   asst=0 sessions (user msg, no answer)  BEFORE={z[0]['before'] or 0}  AFTER={z[0]['after_'] or 0}  (should trend to 0)")

    # F. Retrieval-feature usage (the fixes in action) per day
    print("\n## F. Retrieval strategy usage (last 14d) — page_lookup & summary = the new paths")
    for r in await rows(con, """
      select date(created_at) d,
        sum((metadata_json->>'retrieval_strategy'='page_lookup')::int) page_lookup,
        sum((metadata_json->>'retrieval_strategy' like '%summary%' or metadata_json->>'retrieval_strategy' like '%map_reduce%')::int) summary,
        count(*) total
      from product_events where event_name='rag_verification_completed' and created_at>now()-interval '14 days'
      group by 1 order by 1 desc""", ):
        print(f"   {r['d']}  page_lookup={r['page_lookup']}  summary={r['summary']}  total_answers={r['total']}")

    await con.close()

if __name__ == "__main__":
    asyncio.run(main())
