"""Pricing research (2026-09-22): where do DocTalk users stop, relative to the free quota and the walls?

The owner's hypothesis: a user's need is met inside the free allowance in one to three uses, they leave, and so
nobody ever needs to pay. "Nobody hits INSUFFICIENT_CREDITS" is consistent with that, so it cannot decide it.
This script prints the reads that can (sections 1-6 Claude's; 7-13 added from Fable's plan §3.1, 01-plan-fable.md):

   1. every non-owner user in one bucket at their last activity (paid > hit a wall > real work, no wall >
      light use, no wall > uploaded, never chatted > never started), all time and since June;
   2. which walls fired, by reason; `upload_limit` split into the 3-document cap and the rest;
   3. how episodic real work is (first-to-last message span, active days);
   4. a hard-trial counterfactual: a wall at user message N+1 — who it stops, who had clicked a citation first,
      who would have met it on day one;
   5. documents per user; 6. credits spent against the ~800 of month one;
   7. wall timing and what followed: before or after the first message / first citation click, and whether the
      user kept going after it; demo vs own for walls that record it;
   8. counterfactuals by document (a 1- or 2-document trial) and by time (activity after day 7 / day 14);
   9. the hypothesis cell as counts: real-work users by own vs demo-only x cited vs not x span < 1 day vs longer;
  10. the other free caps: Pro-model answers (20 a month) and the 3-document cap;
  11. job size: pages of own documents, real-work users vs everyone else;
  12. first-session depth, and "one session, >= 3 messages, never again";
  13. a sample of the owner's hypothesis population.

READ-ONLY (the session sets default_transaction_read_only); prints counts, medians and 8-character user-id
prefixes only; no filenames, no message text, no emails.

    DATABASE_URL="$(railway variables --service Postgres --json | python3 -c 'import json,sys; print(json.load(sys.stdin)["DATABASE_PUBLIC_URL"])')" python3.12 .collab/reviews/2026-09-22-pricing-research/free_quota_at_churn.py | tee .collab/reviews/2026-09-22-pricing-research/free-quota-at-churn.txt
"""
import asyncio
import datetime as dt
import os
import re
from collections import Counter, defaultdict

import asyncpg

OWNER = "c142f3af-6e6b-488d-ba57-d91aa3e57cc7"
T_A = dt.datetime(2026, 9, 7, 0, 22, 30, tzinfo=dt.timezone.utc)  # v0.29.0: the 750-page cap exists from here
ERA = dt.datetime(2026, 6, 1, tzinfo=dt.timezone.utc)  # the product changed a lot before June; both views print
DAY = dt.timedelta(days=1)
WALL_EVENTS = ("limit_hit", "paywall_opened")

Q_USERS = "select id, created_at, plan from users where id::text <> $1"
# Demo documents are the seeded ones (demo_slug set); a session on a collection has no document = own work.
Q_DOCS = """select user_id, created_at, page_count from documents
            where demo_slug is null and user_id is not null and user_id::text <> $1"""
Q_SESSIONS = "select user_id, id from sessions where user_id is not null and user_id::text <> $1"
Q_MSGS = """select s.user_id, m.created_at, m.session_id, coalesce(d.demo_slug is not null, false) is_demo
            from messages m join sessions s on s.id = m.session_id left join documents d on d.id = s.document_id
            where m.role = 'user' and s.user_id is not null and s.user_id::text <> $1
            order by m.created_at, m.id"""
Q_EVENTS = """select user_id, event_name, created_at, coalesce(reason, metadata_json->>'reason') reason,
                     metadata_json->>'is_demo' is_demo
              from product_events
              where user_id is not null and user_id::text <> $1
                and event_name in ('limit_hit', 'paywall_opened', 'citation_clicked', 'upgrade_click', 'checkout_created')
              order by created_at"""
Q_LEDGER = "select user_id, created_at, delta, reason, ref_type, ref_id from credit_ledger where user_id::text <> $1"

ORDER = ["paid", "hit a wall", "real work, no wall", "light use, no wall", "uploaded, never chatted", "never started"]


class U:
    def __init__(self, row):
        self.id, self.signup, self.plan = row["id"], row["created_at"], row["plan"]
        self.uid = str(self.id)[:8]
        self.docs, self.sessions, self.msgs, self.cites, self.walls = [], set(), [], [], []
        self.upgrades = self.checkouts = 0
        self.spent, self.paid_ledger, self.balanced = 0, False, []

    @property
    def paid(self):
        return self.paid_ledger or (self.plan or "free") != "free"

    @property
    def n_msgs(self):
        return len(self.msgs)

    @property
    def n_demo(self):
        return sum(1 for m in self.msgs if m[2])

    @property
    def days(self):
        return len({m[0].date() for m in self.msgs})

    @property
    def span(self):
        return self.msgs[-1][0] - self.msgs[0][0] if self.msgs else None

    @property
    def real_work(self):
        return self.n_msgs >= 3 or bool(self.cites)

    def bucket(self):
        if self.paid:
            return "paid"
        if self.walls:
            return "hit a wall"
        if self.real_work:
            return "real work, no wall"
        if self.msgs:
            return "light use, no wall"
        if self.docs:
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


def span_label(span):
    if span is None:
        return "no messages"
    for limit, label in ((dt.timedelta(minutes=10), "<10 min"), (dt.timedelta(hours=1), "<1 h"),
                         (DAY, "<1 day"), (7 * DAY, "<7 days")):
        if span < limit:
            return label
    return ">=7 days"


def wall_reason(user, wall):
    """`upload_limit` is a catch-all (DashboardPageClient.tsx:334): before T_A only the document cap existed;
    after it, >= 3 own documents created before the event marks the cap (a lower bound: deleted documents vanish)."""
    _, reason, _ = wall
    if reason != "upload_limit":
        return reason or "(none)"
    if wall[0] < T_A or sum(1 for d in user.docs if d[0] < wall[0]) >= 3:
        return "upload_limit: 3-document cap"
    return "upload_limit: page cap or unknown"


def print_buckets(title, users):
    print(f"\n{title}: {len(users)} users")
    print(f"  {'bucket':<26}{'users':>6}{'own docs':>9}{'med msgs':>9}{'med days':>9}{'med spent':>10}"
          f"{'demo-only':>10}{'upgrade clicks':>15}")
    for name in ORDER:
        group = [u for u in users if u.bucket() == name]
        demo_only = sum(1 for u in group if u.msgs and u.n_msgs == u.n_demo)
        print(f"  {name:<26}{len(group):>6}{sum(1 for u in group if u.docs):>9}"
              f"{str(median([u.n_msgs for u in group])):>9}{str(median([u.days for u in group])):>9}"
              f"{str(median([u.spent for u in group])):>10}{demo_only:>10}{sum(u.upgrades for u in group):>15}")


async def load(con):
    users = {r["id"]: U(r) for r in await con.fetch(Q_USERS, OWNER)}
    for r in await con.fetch(Q_DOCS, OWNER):
        if r["user_id"] in users:
            users[r["user_id"]].docs.append((r["created_at"], r["page_count"]))
    for r in await con.fetch(Q_SESSIONS, OWNER):
        if r["user_id"] in users:
            users[r["user_id"]].sessions.add(r["id"])
    for r in await con.fetch(Q_MSGS, OWNER):
        if r["user_id"] in users:
            users[r["user_id"]].msgs.append((r["created_at"], r["session_id"], r["is_demo"]))
    for r in await con.fetch(Q_EVENTS, OWNER):
        u = users.get(r["user_id"])
        if u is None:
            continue
        if r["event_name"] in WALL_EVENTS:
            u.walls.append((r["created_at"], r["reason"], r["is_demo"]))
        elif r["event_name"] == "citation_clicked":
            u.cites.append(r["created_at"])
        elif r["event_name"] == "upgrade_click":
            u.upgrades += 1
        else:
            u.checkouts += 1
    for r in await con.fetch(Q_LEDGER, OWNER):
        u = users.get(r["user_id"])
        if u is None:
            continue
        if r["delta"] < 0:
            u.spent -= r["delta"]
        if r["reason"] in ("purchase", "plan_upgrade_supplement") or (r["ref_type"] or "").startswith("stripe"):
            u.paid_ledger = True
        if r["reason"] == "chat" and r["ref_type"] == "mode" and r["ref_id"] == "balanced":
            u.balanced.append(r["created_at"])
    for u in users.values():
        u.docs.sort()
        u.balanced.sort()
    return list(users.values())


def report(users):
    print("Pricing research — free quota at churn (owner excluded; buckets are exclusive, first match wins)")
    print_buckets("1a. All non-owner users", users)
    print_buckets(f"1b. Signed up since {ERA:%Y-%m-%d}", [u for u in users if u.signup >= ERA])

    print("\n2. Walls fired (users per reason; a user can have several)")
    reasons = Counter()
    for u in users:
        for reason in {wall_reason(u, w) for w in u.walls}:
            reasons[reason] += 1
    for reason, n in reasons.most_common():
        print(f"  {reason:<40}{n:>4}")
    print(f"  users with an upgrade_click: {sum(1 for u in users if u.upgrades)}; with a checkout_created: "
          f"{sum(1 for u in users if u.checkouts)}; paid: {sum(1 for u in users if u.paid)}")

    worked = [u for u in users if u.real_work]
    print(f"\n3. How episodic is real work? (users with >= 3 messages or a citation click: {len(worked)})")
    spans = Counter(span_label(u.span) for u in worked)
    for label in ("<10 min", "<1 h", "<1 day", "<7 days", ">=7 days", "no messages"):
        print(f"  first-to-last message {label:<12}{spans.get(label, 0):>4}")
    for days in (1, 2, 3):
        print(f"  active on {days} day(s): {sum(1 for u in worked if u.days == days)}")
    print(f"  active on >= 4 days: {sum(1 for u in worked if u.days >= 4)}")

    print("\n4. Hard-trial counterfactual: a wall at user message N+1 (demo and own messages both count)")
    print(f"  {'N':>4}{'stopped':>9}{'cited before the wall':>23}{'on day one':>12}")
    for n in (3, 5, 10, 20, 50):
        stopped = [u for u in users if u.n_msgs > n]
        cited = sum(1 for u in stopped if any(c < u.msgs[n][0] for c in u.cites))
        day_one = sum(1 for u in stopped if u.msgs[n][0].date() == u.msgs[0][0].date())
        print(f"  {n:>4}{len(stopped):>9}{cited:>23}{day_one:>12}")

    print("\n5. Own documents per user")
    for n in (0, 1, 2):
        print(f"  {n}: {sum(1 for u in users if len(u.docs) == n)}")
    print(f"  >= 3 (the Free cap): {sum(1 for u in users if len(u.docs) >= 3)}")

    chatted = [u.spent for u in users if u.msgs]
    print(f"\n6. Credits spent, lifetime, users with >= 1 message (n = {len(chatted)}; month one grants ~800)")
    print(f"  p50 {pct(chatted, .5)}  p75 {pct(chatted, .75)}  p90 {pct(chatted, .9)}  "
          f"p95 {pct(chatted, .95)}  max {max(chatted) if chatted else '-'}")
    for limit in (25, 50, 100, 200, 300, 500, 800):
        print(f"  spent > {limit:<4}: {sum(1 for s in chatted if s > limit)}")

    walled = [u for u in users if u.walls]
    print(f"\n7. Wall timing and what followed (users with >= 1 wall event: {len(walled)})")
    rows = Counter()
    for u in walled:
        first = u.walls[0][0]
        rows["first wall before the first message, or no messages" if not u.msgs or first < u.msgs[0][0]
                else "first wall after the first message"] += 1
        rows["no citation click ever" if not u.cites else
             ("first wall before first citation click" if first < u.cites[0] else "first wall after first citation click")] += 1
        rows["kept going after the first wall (>= 1 later message)" if any(m[0] > first for m in u.msgs)
             else "stopped at the first wall (0 later messages)"] += 1
    for label, n in sorted(rows.items()):
        print(f"  {label:<56}{n:>4}")
    print("  walls by demo flag (events; the flag exists only where the client sends it):")
    flags = Counter((wall_reason(u, w), {"true": "demo", "false": "own"}.get(w[2], "not recorded"))
                    for u in walled for w in u.walls)
    for (reason, flag), n in sorted(flags.items()):
        print(f"    {reason:<40}{flag:<14}{n:>4}")

    print("\n8a. Document-trial counterfactual (own documents)")
    print(f"  a 1-document trial would have stopped: {sum(1 for u in users if len(u.docs) >= 2)}")
    print(f"  a 2-document trial would have stopped: {sum(1 for u in users if len(u.docs) >= 3)}")
    print("8b. Time-trial counterfactual (any user message or own upload after day N from first activity)")
    for n in (7, 14):
        late = 0
        for u in users:
            stamps = [m[0] for m in u.msgs] + [d[0] for d in u.docs]
            if stamps and max(stamps) > min(stamps) + n * DAY:
                late += 1
        print(f"  active after day {n}: {late}")

    print(f"\n9. The hypothesis cell: real-work users ({len(worked)}) by surface x citation x span, "
          "count and median credits spent")
    cells = defaultdict(list)
    for u in worked:
        surface = "own document" if u.n_msgs > u.n_demo else ("demo only" if u.msgs else "no messages")
        cited = "cited" if u.cites else "never cited"
        span = "span < 1 day" if u.span is not None and u.span < DAY else "span >= 1 day"
        cells[(surface, cited, span)].append(u.spent)
    for key in sorted(cells):
        print(f"  {' · '.join(key):<48}{len(cells[key]):>4}   median spent {median(cells[key])}")
    print("  (the owner's population is own document · cited · span < 1 day; activation failure is 'never cited')")

    print("\n10. The other free caps")
    for code in ("PRO_MODE_LIMIT_REACHED", "BALANCED_MODE_LIMIT_REACHED", "upload_limit: 3-document cap",
                 "INSUFFICIENT_CREDITS", "DOMAIN_MODE_REQUIRES_PLUS"):
        print(f"  users who met {code}: {sum(1 for u in users if any(wall_reason(u, w) == code for w in u.walls))}")
    counts = [len(u.balanced) for u in users if u.balanced]
    print(f"  users with >= 1 Pro-model answer: {len(counts)}; median {median(counts)}, max {max(counts) if counts else '-'}")
    reached = 0
    for u in users:
        times = u.balanced
        if any(sum(1 for t in times[i:] if t < times[i] + 30 * DAY) >= 20 for i in range(len(times))):
            reached += 1
    print(f"  users with >= 20 Pro-model answers inside any 30 days (the Free cap): {reached}")

    print("\n11. Job size: pages of own documents")
    worked_ids = {u.id for u in worked}
    for label, group in (("real-work users", [u for u in users if u.id in worked_ids]),
                         ("everyone else", [u for u in users if u.id not in worked_ids])):
        pages = [d[1] for u in group for d in u.docs if d[1] is not None]
        print(f"  {label:<16} documents {len(pages):>4}   p50 {pct(pages, .5)}   p90 {pct(pages, .9)}")
    firsts = [u.docs[0][1] for u in worked if u.docs and u.docs[0][1] is not None]
    print(f"  real-work users whose first own document is > 100 pages: {sum(1 for p in firsts if p > 100)} of {len(firsts)}")

    print("\n12. First-session depth")
    first_session = []
    one_and_done = 0
    for u in users:
        if not u.msgs:
            continue
        first_sid = u.msgs[0][1]
        first_session.append(sum(1 for m in u.msgs if m[1] == first_sid))
        if len({m[1] for m in u.msgs}) == 1 and u.n_msgs >= 3:
            one_and_done += 1
    print(f"  user messages in the first session: median {median(first_session)}, p75 {pct(first_session, .75)}"
          f" (n = {len(first_session)})")
    print(f"  whole lifetime = one session with >= 3 messages ('one job, done' signature): {one_and_done}")

    print("\n13. 'Real work, no wall' users (the owner's hypothesis population), newest first, max 15")
    sample = sorted((u for u in users if u.bucket() == "real work, no wall"), key=lambda u: u.signup, reverse=True)
    for u in sample[:15]:
        largest = max((d[1] for d in u.docs if d[1] is not None), default="-")
        print(f"  {u.uid}  signup {u.signup:%Y-%m-%d}  msgs {u.n_msgs} (demo {u.n_demo})  days {u.days}  "
              f"cites {len(u.cites)}  own docs {len(u.docs)}  sessions {len(u.sessions)}  largest doc {largest} pages  "
              f"spent {u.spent}  span {span_label(u.span)}")


async def main():
    con = await asyncpg.connect(re.sub(r"^postgres(?:ql)?(?:\+\w+)?://", "postgresql://", os.environ["DATABASE_URL"]))
    try:
        await con.execute("set default_transaction_read_only = on")
        report(await load(con))
    finally:
        await con.close()


if __name__ == "__main__":
    asyncio.run(main())
