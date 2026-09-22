"""§8.6 defect trigger follow-up (2026-09-22): the readout printed
"DEFECT: checkout_failed fired" (5 rows since T_A). The frontend emits it when createSubscription() throws
(`frontend/src/lib/billing.ts:63`) with only {plan, period, source, reason}, so the error itself is not in the
event. This lists every checkout_failed, checkout_created and checkout_attempts row since T_A. For each row it
shows whether the user is the owner and what the nearest attempt looked like. READ-ONLY; prints 8-character
user-id prefixes and no PII.

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
        print("\ncheckout_created events:")
        for r in await con.fetch("""
            select created_at, user_id::text = $2 owner, left(user_id::text, 8) uid,
                   coalesce(source, metadata_json->>'source') src
            from product_events where event_name = 'checkout_created' and created_at >= $1 order by created_at""", T_A, OWNER):
            print(f"  {r['created_at']:%m-%d %H:%M:%S}  {'OWNER' if r['owner'] else r['uid']:<8}  src={r['src']}")
    finally:
        await con.close()


asyncio.run(main())
