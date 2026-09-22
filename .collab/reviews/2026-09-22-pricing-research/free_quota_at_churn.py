"""Pricing research (2026-09-22): where do DocTalk users stop, relative to the free quota and the walls?

The owner's hypothesis: a user's need is met inside the free allowance in one to three uses, they leave, and so
nobody ever needs to pay. "Nobody hits INSUFFICIENT_CREDITS" is consistent with that, so it cannot decide it.
This script prints the reads that can:

  1. every non-owner user in one bucket at their last activity (paid > hit a wall > real work, no wall >
     light use, no wall > uploaded, never chatted > never started);
  2. which walls the wall bucket hit;
  3. how episodic the real work is (first-to-last message span, active days);
  4. a hard-trial counterfactual: how many users a wall at message N+1 would have stopped, how many had
     clicked a citation before it, and how many would have met it on their first day;
  5. documents per user, and the credits users actually spent against the ~800 of month one.

READ-ONLY (the session sets default_transaction_read_only); prints counts, medians and 8-character user-id
prefixes only; no filenames, no message text, no emails.

    DATABASE_URL="$(railway variables --service Postgres --json | python3 -c 'import json,sys; print(json.load(sys.stdin)["DATABASE_PUBLIC_URL"])')" python3.12 .collab/reviews/2026-09-22-pricing-research/free_quota_at_churn.py | tee .collab/reviews/2026-09-22-pricing-research/free-quota-at-churn.txt
"""
import asyncio
import datetime as dt
import os
import re

import asyncpg

OWNER = "c142f3af-6e6b-488d-ba57-d91aa3e57cc7"
ERA = dt.datetime(2026, 6, 1, tzinfo=dt.timezone.utc)  # product changed a lot before June; both views print
DSN = re.sub(r"^postgres(?:ql)?(?:\+\w+)?://", "postgresql://", os.environ["DATABASE_URL"])

# One row per non-owner user with everything the buckets need. Demo documents are the seeded ones
# (demo_slug set); a session on a collection has no document and counts as own work.
PER_USER = """
with u as (
  select id, created_at, plan from users where id::text <> $1
),
own_docs as (
  select user_id, count(*) n from documents where demo_slug is null and user_id is not null group by user_id
),
msgs as (
  select s.user_id, m.created_at, coalesce(d.demo_slug is not null, false) is_demo
  from messages m join sessions s on s.id = m.session_id left join documents d on d.id = s.document_id
  where m.role = 'user' and s.user_id is not null
),
msg_agg as (
  select user_id, count(*) n, count(*) filter (where is_demo) n_demo,
         count(distinct (created_at at time zone 'UTC')::date) days, min(created_at) first_at, max(created_at) last_at
  from msgs group by user_id
),
ev as (
  select user_id,
         count(*) filter (where event_name = 'citation_clicked') cites,
         count(*) filter (where event_name in ('limit_hit', 'paywall_opened')) walls,
         count(*) filter (where event_name = 'upgrade_click') upgrades,
         count(*) filter (where event_name = 'checkout_created') checkouts,
         array_remove(array_agg(distinct coalesce(reason, metadata_json->>'reason'))
                      filter (where event_name in ('limit_hit', 'paywall_opened')), null) wall_reasons
  from product_events where user_id is not null group by user_id
),
ledger as (
  select user_id, coalesce(-sum(delta) filter (where delta < 0), 0) spent,
         bool_or(reason in ('purchase', 'plan_upgrade_supplement') or ref_type like 'stripe%') paid_ledger
  from credit_ledger group by user_id
)
select left(u.id::text, 8) uid, u.created_at signup, u.plan,
       coalesce(o.n, 0) own_docs, coalesce(m.n, 0) msgs, coalesce(m.n_demo, 0) demo_msgs, coalesce(m.days, 0) days,
       m.first_at, m.last_at, coalesce(e.cites, 0) cites, coalesce(e.walls, 0) walls, coalesce(e.upgrades, 0) upgrades,
       coalesce(e.checkouts, 0) checkouts, coalesce(e.wall_reasons, '{}') wall_reasons,
       coalesce(l.spent, 0) spent, coalesce(l.paid_ledger, false) or u.plan <> 'free' paid
from u left join own_docs o on o.user_id = u.id left join msg_agg m on m.user_id = u.id
       left join ev e on e.user_id = u.id left join ledger l on l.user_id = u.id
"""

# The (N+1)-th user message is the first one a hard trial of N messages would have refused.
TRIAL = """
with ranked as (
  select s.user_id, m.created_at, row_number() over (partition by s.user_id order by m.created_at, m.id) rn
  from messages m join sessions s on s.id = m.session_id
  where m.role = 'user' and s.user_id is not null and s.user_id::text <> $1
),
blocked as (select user_id, created_at t_block from ranked where rn = $2 + 1),
first_msg as (select user_id, min(created_at) t0 from ranked group by user_id)
select count(*) stopped,
       count(*) filter (where exists (select 1 from product_events e where e.user_id = b.user_id
                                      and e.event_name = 'citation_clicked' and e.created_at < b.t_block)) cited_before,
       count(*) filter (where (b.t_block at time zone 'UTC')::date = (f.t0 at time zone 'UTC')::date) on_day_one
from blocked b join first_msg f using (user_id)
"""

ORDER = ["paid", "hit a wall", "real work, no wall", "light use, no wall", "uploaded, never chatted", "never started"]


def bucket(r):
    if r["paid"]:
        return "paid"
    if r["walls"] > 0:
        return "hit a wall"
    if r["msgs"] >= 3 or r["cites"] > 0:
        return "real work, no wall"
    if r["msgs"] > 0:
        return "light use, no wall"
    if r["own_docs"] > 0:
        return "uploaded, never chatted"
    return "never started"


def median(values):
    values = sorted(values)
    if not values:
        return "-"
    mid = len(values) // 2
    return values[mid] if len(values) % 2 else (values[mid - 1] + values[mid]) / 2


def pct(values, q):
    values = sorted(values)
    return values[min(len(values) - 1, int(q * len(values)))] if values else "-"


def span_label(first, last):
    if first is None:
        return None
    span = last - first
    for limit, label in ((dt.timedelta(minutes=10), "<10 min"), (dt.timedelta(hours=1), "<1 h"),
                         (dt.timedelta(days=1), "<1 day"), (dt.timedelta(days=7), "<7 days")):
        if span < limit:
            return label
    return ">=7 days"


def print_buckets(title, rows):
    print(f"\n{title}: {len(rows)} users")
    print(f"  {'bucket':<26}{'users':>6}{'own docs':>9}{'med msgs':>9}{'med days':>9}{'med spent':>10}"
          f"{'demo-only':>10}{'upgrade clicks':>15}")
    for name in ORDER:
        group = [r for r in rows if bucket(r) == name]
        demo_only = sum(1 for r in group if r["msgs"] > 0 and r["msgs"] == r["demo_msgs"])
        print(f"  {name:<26}{len(group):>6}{sum(1 for r in group if r['own_docs']):>9}"
              f"{str(median([r['msgs'] for r in group])):>9}{str(median([r['days'] for r in group])):>9}"
              f"{str(median([r['spent'] for r in group])):>10}{demo_only:>10}{sum(r['upgrades'] for r in group):>15}")


async def main():
    con = await asyncpg.connect(DSN)
    try:
        await con.execute("set default_transaction_read_only = on")
        rows = await con.fetch(PER_USER, OWNER)
        print("Pricing research — free quota at churn (owner excluded; buckets are exclusive, first match wins)")
        print_buckets("1a. All non-owner users", rows)
        print_buckets(f"1b. Signed up since {ERA:%Y-%m-%d}", [r for r in rows if r["signup"] >= ERA])

        print("\n2. Walls hit (users per reason, wall bucket and paid users; a user can have several)")
        reasons = {}
        for r in rows:
            for reason in r["wall_reasons"]:
                reasons[reason] = reasons.get(reason, 0) + 1
        for reason, n in sorted(reasons.items(), key=lambda kv: -kv[1]):
            print(f"  {reason:<32}{n:>4}")
        print(f"  users with a checkout_created: {sum(1 for r in rows if r['checkouts'])}; paid: "
              f"{sum(1 for r in rows if r['paid'])}")

        print("\n3. How episodic is real work? (users with >= 3 messages or a citation click, any bucket)")
        worked = [r for r in rows if r["msgs"] >= 3 or r["cites"] > 0]
        spans = {}
        for r in worked:
            label = span_label(r["first_at"], r["last_at"]) or "no messages"
            spans[label] = spans.get(label, 0) + 1
        for label in ("<10 min", "<1 h", "<1 day", "<7 days", ">=7 days", "no messages"):
            print(f"  first-to-last message {label:<12}{spans.get(label, 0):>4}")
        for days, label in ((1, "1"), (2, "2"), (3, "3")):
            print(f"  active on {label} day(s): {sum(1 for r in worked if r['days'] == days)}")
        print(f"  active on >= 4 days: {sum(1 for r in worked if r['days'] >= 4)}")

        print("\n4. Hard-trial counterfactual: a wall at user message N+1 (demo and own messages both count)")
        print(f"  {'N':>4}{'stopped':>9}{'cited before the wall':>23}{'on day one':>12}")
        for n in (3, 5, 10, 20, 50):
            r = await con.fetchrow(TRIAL, OWNER, n)
            print(f"  {n:>4}{r['stopped']:>9}{r['cited_before']:>23}{r['on_day_one']:>12}")

        print("\n5a. Own documents per user")
        for n, label in ((0, "0"), (1, "1"), (2, "2")):
            print(f"  {label}: {sum(1 for r in rows if r['own_docs'] == n)}")
        print(f"  >= 3 (the Free cap): {sum(1 for r in rows if r['own_docs'] >= 3)}")

        chatted = [r["spent"] for r in rows if r["msgs"] > 0]
        print(f"\n5b. Credits spent, lifetime, users with >= 1 message (n = {len(chatted)}; month one grants ~800)")
        print(f"  p50 {pct(chatted, .5)}  p75 {pct(chatted, .75)}  p90 {pct(chatted, .9)}  "
              f"p95 {pct(chatted, .95)}  max {max(chatted) if chatted else '-'}")
        for limit in (25, 50, 100, 200, 300, 500, 800):
            print(f"  spent > {limit:<4}: {sum(1 for s in chatted if s > limit)}")

        print("\n6. 'Real work, no wall' users (the owner's hypothesis population), newest first, max 15")
        sample = sorted((r for r in rows if bucket(r) == "real work, no wall"), key=lambda r: r["signup"], reverse=True)
        for r in sample[:15]:
            print(f"  {r['uid']}  signup {r['signup']:%Y-%m-%d}  msgs {r['msgs']} (demo {r['demo_msgs']})  "
                  f"days {r['days']}  cites {r['cites']}  own docs {r['own_docs']}  spent {r['spent']}  "
                  f"span {span_label(r['first_at'], r['last_at'])}")
    finally:
        await con.close()


asyncio.run(main())
