"""Run free_quota_at_churn.py's report() on the owner-run export instead of a live database read.
Same definitions; differences are listed in the header it prints."""
import datetime as dt, importlib.util, json, os, sys
spec = importlib.util.spec_from_file_location('fq', '.collab/reviews/2026-09-22-pricing-research/free_quota_at_churn.py')
fq = importlib.util.module_from_spec(spec); spec.loader.exec_module(fq)
users_json = json.load(open(os.path.join(sys.argv[1], 'users.json'), encoding='utf-8'))
P = lambda s: dt.datetime.fromisoformat(s) if s else None
users = []
for j in users_json:
    u = fq.U({'id': j['uid'], 'created_at': P(j['signup']), 'plan': j['plan']})
    u.uid = j['uid']
    u.docs = sorted((P(d['created']), d['pages']) for d in j['documents'])
    for s in j['sessions']:
        u.sessions.add(s['sid'])
        for m in s['messages']:
            if m['role'] == 'user':
                u.msgs.append((P(m['t']), s['sid'], bool(s['demo'])))
    u.msgs.sort(key=lambda m: m[0])
    for e in j['events']:
        t = P(e['t'])
        if e['event'] in fq.WALL_EVENTS:
            flag = e.get('is_demo')
            u.walls.append((t, e['reason'], None if flag is None else str(flag).lower()))
        elif e['event'] == 'citation_clicked':
            u.cites.append(t)
        elif e['event'] == 'upgrade_click':
            u.upgrades += 1
        elif e['event'] == 'checkout_created':
            u.checkouts += 1
        elif e['event'] == 'checkout_completed':
            u.paid_ledger = True
    u.walls.sort(key=lambda w: w[0]); u.cites.sort()
    ledger = j.get('ledger') or {}
    u.spent = -sum(v for v in ledger.values() if v < 0)
    if any(k in ledger for k in ('purchase', 'plan_upgrade_supplement')):
        u.paid_ledger = True
    pro_calls = sum(v['calls'] for k, v in (j.get('usage') or {}).items() if 'pro' in k or 'mistral' in k)
    u.balanced = [u.signup] * pro_calls  # timestamps are not in the export; see header
    users.append(u)
print('Computed from the owner-run export (export_qa.py, 2026-09-22T12:48Z), not a live read. Differences from a')
print('live run: credits spent = net negative ledger by reason; "paid" also counts a checkout_completed event;')
print('Pro-model answers are counted from usage_records (v4-pro + legacy mistral) without timestamps, so the')
print('20-in-30-days line in section 10 counts users with >= 20 such calls in total (an upper bound).')
print()
fq.report(users)
