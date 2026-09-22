"""§8.6 defect trigger follow-up (2026-09-22): the readout printed
"DEFECT: checkout_failed fired" (5 rows since T_A). The frontend emits it when createSubscription() throws
(`frontend/src/lib/billing.ts:63`) with only {plan, period, source, reason}, so the error itself is not in the
event. This lists every checkout_failed, checkout_created and checkout_attempts row since T_A. For each row it
shows whether the user is the owner and what the nearest attempt looked like. It also runs Fable's two
follow-ups from §9.25: (a) a control on the zero-active read — user-role messages by owner / non-owner /
anonymous, the 16 days before T_A against since — and (b) the one purchase chain (the upload_error/file_size
user): signup date, what the attempt offered, the limit_hit source, and whether they came back. Since Fable's
ratification (§9.26) it also runs the four gate checks on the zero-active read, plus the residual pending-sentinel
count and the monthly-allowance/balance reads. READ-ONLY; prints 8-character user-id prefixes and no PII.

    DATABASE_URL="$(railway variables --service Postgres --json | python3 -c 'import json,sys; print(json.load(sys.stdin)["DATABASE_PUBLIC_URL"])')" python3.12 .collab/reviews/2026-09-22-checkpoint-readout/defect_checkout_failed.py | tee .collab/reviews/2026-09-22-checkpoint-readout/defect-checkout-failed.txt
"""
import asyncio
import datetime as dt
import os
import re

import asyncpg

OWNER = "c142f3af-6e6b-488d-ba57-d91aa3e57cc7"
T_A = dt.datetime(2026, 9, 7, 0, 22, 30, tzinfo=dt.timezone.utc)
DSN = re.sub(r"^postgres(?:ql)?(?:\+\w+)?://", "postgresql://", os.environ["DATABASE_URL"])


async def main():
    con = await asyncpg.connect(DSN)
    try:
        await con.execute("set default_transaction_read_only = on")
        print(f"since T_A = {T_A:%Y-%m-%dT%H:%MZ}; owner rows marked OWNER\n")
        print("checkout_failed:")
        for r in await con.fetch("""
            select p.created_at, p.user_id::text = $2 owner, left(p.user_id::text, 8) uid,
                   coalesce(p.source, p.metadata_json->>'source') src, coalesce(p.reason, p.metadata_json->>'reason') reason,
                   p.plan, p.billing,
                   exists (select 1 from product_events u where u.user_id = p.user_id and u.event_name = 'upgrade_click'
                           and u.created_at between p.created_at - interval '30 seconds' and p.created_at) clicked_first,
                   (select a.status from checkout_attempts a where a.user_id = p.user_id
                      and a.started_at between p.created_at - interval '2 minutes' and p.created_at + interval '1 minute'
                    order by a.started_at desc limit 1) attempt_status
            from product_events p where p.event_name = 'checkout_failed' and p.created_at >= $1
            order by p.created_at""", T_A, OWNER):
            print(f"  {r['created_at']:%m-%d %H:%M:%S}  {'OWNER' if r['owner'] else (r['uid'] or 'anon'):<8}  src={r['src']}"
                  f"  reason={r['reason']}  plan={r['plan']}/{r['billing']}  click_before={r['clicked_first']}"
                  f"  nearest_attempt={r['attempt_status']}")
        print("\ncheckout_attempts:")
        for r in await con.fetch("""
            select started_at, updated_at, user_id::text = $2 owner, left(user_id::text, 8) uid, plan, billing_period,
                   source, reason, status, stripe_session_id is not null has_session
            from checkout_attempts where started_at >= $1 order by started_at""", T_A, OWNER):
            print(f"  {r['started_at']:%m-%d %H:%M:%S}  {'OWNER' if r['owner'] else r['uid']:<8}  {r['plan']}/{r['billing_period']}"
                  f"  src={r['source']}  reason={r['reason']}  status={r['status']}  stripe_session={r['has_session']}"
                  f"  updated={r['updated_at']:%m-%d %H:%M:%S}")
        print("\ncontrol (a): user-role messages / sessions with one, by class")
        before = T_A - dt.timedelta(days=16)
        for label, lo, hi in (("16 d before T_A", before, T_A), ("since T_A", T_A, dt.datetime.now(dt.timezone.utc))):
            r = await con.fetchrow("""
                select count(*) filter (where s.user_id is null) anon_msgs,
                       count(distinct s.id) filter (where s.user_id is null) anon_sessions,
                       count(*) filter (where s.user_id::text = $3) owner_msgs,
                       count(*) filter (where s.user_id is not null and s.user_id::text <> $3) user_msgs,
                       count(distinct s.user_id) filter (where s.user_id is not null and s.user_id::text <> $3) users
                from messages m join sessions s on s.id = m.session_id
                where m.role = 'user' and m.created_at >= $1 and m.created_at < $2""", lo, hi, OWNER)
            print(f"  {label:<16} anonymous {r['anon_msgs']} msgs in {r['anon_sessions']} sessions | owner {r['owner_msgs']} msgs"
                  f" | non-owner {r['user_msgs']} msgs from {r['users']} users")

        print("\nread (b): the upload_error purchase chain since T_A")
        rows = await con.fetch("""
            select distinct e.user_id from product_events e
            where e.event_name = 'upgrade_click' and e.created_at >= $1 and e.user_id is not null
              and e.user_id::text <> $2 and coalesce(e.source, e.metadata_json->>'source') = 'upload_error'""", T_A, OWNER)
        for row in rows:
            uid = row["user_id"]
            u = await con.fetchrow("select created_at, plan from users where id = $1", uid)
            click = await con.fetchval("""select min(created_at) from product_events where user_id = $1
                and event_name = 'upgrade_click' and created_at >= $2""", uid, T_A)
            if u is None:
                print(f"  user {str(uid)[:8]}: account no longer exists")
                continue
            print(f"  user {str(uid)[:8]}: signed up {u['created_at']:%Y-%m-%d} ({'after' if u['created_at'] >= T_A else 'before'} T_A),"
                  f" plan now {u['plan']}, first click {click:%m-%d %H:%M:%S}")
            for r in await con.fetch("""select created_at, coalesce(source, metadata_json->>'source') src,
                    coalesce(reason, metadata_json->>'reason') reason, plan from product_events
                    where user_id = $1 and event_name = 'limit_hit' order by created_at""", uid):
                print(f"    limit_hit {r['created_at']:%m-%d %H:%M:%S} src={r['src']} reason={r['reason']} plan={r['plan']}")
            for r in await con.fetch("""select started_at, plan, billing_period, status, stripe_session_id is not null s
                    from checkout_attempts where user_id = $1 order by started_at""", uid):
                print(f"    attempt  {r['started_at']:%m-%d %H:%M:%S} offered {r['plan']}/{r['billing_period']} status={r['status']} stripe_session={r['s']}")
            docs = await con.fetchrow("""select count(*) filter (where created_at < $2) before, count(*) filter (where created_at >= $2) after
                    from documents where user_id = $1""", uid, click)
            msgs = await con.fetchval("""select count(*) from messages m join sessions s on s.id = m.session_id
                    where s.user_id = $1 and m.role = 'user' and m.created_at >= $2""", uid, click)
            last = await con.fetchval("select max(created_at) from product_events where user_id = $1", uid)
            print(f"    documents before/after the click: {docs['before']}/{docs['after']}; user messages after: {msgs};"
                  f" last event {last:%m-%d %H:%M}" if last else "")
        if not rows:
            print("  no upload_error upgrade_click since T_A")

        print("\ncheckout_created events:")
        for r in await con.fetch("""
            select created_at, user_id::text = $2 owner, left(user_id::text, 8) uid,
                   coalesce(source, metadata_json->>'source') src, coalesce(reason, metadata_json->>'reason') reason,
                   metadata_json ? 'checkout_attempt_id' subscription
            from product_events where event_name = 'checkout_created' and created_at >= $1 order by created_at""", T_A, OWNER):
            print(f"  {r['created_at']:%m-%d %H:%M:%S}  {'OWNER' if r['owner'] else r['uid']:<8}  src={r['src']}"
                  f"  reason={r['reason']}  kind={'subscription' if r['subscription'] else 'credit pack/other'}")
        await gate_checks(con)
    finally:
        await con.close()


async def gate_checks(con):
    """Fable's amended 2.3 gate (§9.26, 2026-09-22): control (a) proves that messages persist, not that
    nobody tried. A send the backend rejects leaves no `messages` row (the credit check and the API-layer
    402/403 run before `_persist_user_message_and_title`), while `chat_message_sent` is recorded before the
    request goes out."""
    before = T_A - dt.timedelta(days=16)
    print("\ngate 1: chat_message_sent (recorded before the request) — non-owner | owner | anonymous")
    for label, lo, hi in (("16 d before T_A", before, T_A), ("since T_A", T_A, dt.datetime.now(dt.timezone.utc))):
        r = await con.fetchrow("""select
                count(*) filter (where user_id is not null and user_id::text <> $3) sends,
                count(distinct user_id) filter (where user_id is not null and user_id::text <> $3) users,
                count(*) filter (where user_id::text = $3) owner, count(*) filter (where user_id is null) anon
            from product_events where event_name = 'chat_message_sent' and created_at >= $1 and created_at < $2""",
                               lo, hi, OWNER)
        print(f"  {label:<16} non-owner {r['sends']} sends from {r['users']} users | owner {r['owner']} | anonymous {r['anon']}")

    r = await con.fetchrow("""select count(*) sessions, count(distinct s.user_id) users,
            count(*) filter (where exists (select 1 from messages m where m.session_id = s.id and m.role = 'user')) with_msg
        from sessions s where s.created_at >= $1 and s.user_id is not null and s.user_id::text <> $2""", T_A, OWNER)
    print(f"gate 2: non-owner sessions since T_A: {r['sessions']} from {r['users']} users; {r['with_msg']} with a user message,"
          f" {r['sessions'] - r['with_msg']} without")

    print("gate 3: limit_hit / paywall_opened since T_A by reason — non-owner | anonymous")
    rows = await con.fetch("""select event_name, coalesce(reason, metadata_json->>'reason', '?') reason,
            count(*) filter (where user_id is not null and user_id::text <> $2) non_owner,
            count(*) filter (where user_id is null) anon
        from product_events where event_name in ('limit_hit', 'paywall_opened') and created_at >= $1
        group by 1, 2 order by 1, 2""", T_A, OWNER)
    for r in rows:
        print(f"  {r['event_name']:<15} {r['reason']:<32} {r['non_owner']:>3} | {r['anon']:>3}")
    if not rows:
        print("  none")

    r = await con.fetchrow("""with pre as (select id from users where created_at < $1 and id::text <> $2)
        select (select count(*) from pre) pre_users,
          (select count(distinct p.user_id) from product_events p join pre on pre.id = p.user_id where p.created_at >= $1) event,
          (select count(distinct d.user_id) from documents d join pre on pre.id = d.user_id where d.created_at >= $1) document,
          (select count(distinct s.user_id) from sessions s join pre on pre.id = s.user_id where s.created_at >= $1) session,
          (select count(distinct a.user_id) from checkout_attempts a join pre on pre.id = a.user_id where a.started_at >= $1) attempt,
          (select count(*) from pre where
             exists (select 1 from product_events p where p.user_id = pre.id and p.created_at >= $1)
             or exists (select 1 from documents d where d.user_id = pre.id and d.created_at >= $1)
             or exists (select 1 from sessions s where s.user_id = pre.id and s.created_at >= $1)
             or exists (select 1 from checkout_attempts a where a.user_id = pre.id and a.started_at >= $1)) door""", T_A, OWNER)
    print(f"gate 4 (the door): of {r['pre_users']} non-owner users who signed up before T_A, {r['door']} left any authenticated"
          f" trace since T_A (event {r['event']}, document {r['document']}, session {r['session']}, checkout attempt {r['attempt']})")

    r = await con.fetchrow("""select count(*) filter (where stripe_subscription_id = 'pending') pending,
            count(*) filter (where stripe_subscription_id is not null and stripe_subscription_id <> 'pending') other
        from users where lower(coalesce(plan, 'free')) = 'free' and id::text <> $1""", OWNER)
    print(f"residual (Fable, 09-28): free non-owner users with stripe_subscription_id = 'pending': {r['pending']}, other non-null: {r['other']}")

    print("supporting: free monthly allowances granted since 2026-08-01 (non-owner), by month")
    for r in await con.fetch("""select to_char(created_at, 'YYYY-MM') ym, count(*) n, min(delta) lo, max(delta) hi
            from credit_ledger where reason = 'monthly_allowance' and created_at >= '2026-08-01' and user_id::text <> $1
            group by 1 order by 1""", OWNER):
        print(f"  {r['ym']}: {r['n']} grants of {r['lo']}..{r['hi']} credits")
    r = await con.fetchrow("""select count(*) filter (where credits_balance <= 0) zero,
            count(*) filter (where credits_balance between 1 and 14) low,
            count(*) filter (where credits_balance between 15 and 99) mid,
            count(*) filter (where credits_balance >= 100) high
        from users where lower(coalesce(plan, 'free')) = 'free' and id::text <> $1""", OWNER)
    print(f"supporting: free non-owner balances — 0: {r['zero']}, 1-14: {r['low']}, 15-99: {r['mid']}, >=100: {r['high']}")
    print("reading (Fable §9.26): sends = 0 and door > 0 -> behaviour, gate satisfied; sends = 0 and door = 0 -> returning"
          " users never authenticated: read the auth/cookie changes at T_A and 09-21 first; sends > 0 with no messages ->"
          " rejected sends: INSUFFICIENT_CREDITS -> the Free monthly grant, SESSION_LIMIT -> the cap, anything unmatched = P0,"
          " fixed before anything else.")


asyncio.run(main())
