# Batch A — CONSENSUS-SHIP (2026-08-27)

Branch `fix/growth-batch-a`, HEAD `79f1262`. Seven adversarial review rounds:
R1 BLOCK → R2 REVISE → R3 BLOCK → R4 BLOCK → R5 BLOCK → R6 BLOCK → **R7 SHIP**.
Dialogue in `.collab/dialogue/2026-08-2{6,7}-batch-a-codex-r*.md`; fix reports in `.collab/reviews/`.

## What shipped, and why

Origin: the 2026-08-26 top-down growth review. Production had 164 signups, 0 paying customers, and
zero `upgrade_click` at `path=/billing` ever, against 24 billing-page arrivals from 16 users since
9 May — checkout was never broken, it was never invoked.

- **A1/A2** Authenticated upgrade intents call `startCheckout()` and go straight to Stripe.
  `decidePlanAwareBillingAction()` grants that only to a known `free` plan; every other value, including
  an unresolved `undefined`, routes to the confirmed change-plan flow, and a Pro credit shortfall lands
  on credit packs. Failures now surface the real backend message and emit `checkout_failed`.
- **A3** Free accounts get one Domain Mode session, enforced in the backend at both entry points.
  Entitlement lives in add-only `feature_trial_usages`, claimed under a user-row `FOR UPDATE` held to
  commit; owner FKs are `ON DELETE SET NULL` so deleting a session or document cannot restore a slot.
- **A4** Plus 50→100 MB, Pro 100→200 MB — `file_size` is the most-hit limit and produced the only real
  sale in the product's history, yet Plus previously matched Free.

## Cost bound added with the raise, not after it

`MAX_PDF_PAGES` (set to 500 in Railway) and `MAX_PDF_SIZE_MB` both had **no reader anywhere** while
production already held a 696-page document, and upload/parse debits no credits — so page count, the
real driver of embedding and paid-OCR spend, was unbounded and free. Both dead knobs are deleted and
replaced with enforced per-plan caps: Free 750 / Plus 1500 / Pro 3000. 750 sits above the largest
production document, so nothing existing becomes newly rejectable. URL import is now a flat 10 MB
feature for every plan — the plan-derived cap there was selectable by five attacker-controlled bytes,
and URL import has 3 lifetime uses by 2 users, so removing the branch beat hardening it.

## Defects found and fixed (all seven rounds)

1. Plus→Pro upgrade and Pro top-up paths hit an endpoint that rejects existing subscribers.
2. The Domain Mode trial was infinitely resettable — an ordinary message cleared `sessions.domain_mode`.
3. `Content-Type`, then a five-byte `%PDF-` prefix, could select the 200 MB cap.
4. A Pro user over the cap was funnelled toward *Plus*.
5. Extraction could **mint credits**: reconcile never stamped `reconciled_at` and refunds deleted
   unconditionally, so an ambiguous commit refunded already-settled work.
6. The `queued→running` claim could **strand** a predebit permanently.
7. Three of four predebited producers never set a lease, and the watchdog filtered on
   `worker_lease_expires_at IS NOT NULL`, so their lost messages were invisible forever.
8. Parent deletion cascaded away the recovery anchor, orphaning the ledger and the trial slot.

**Defects 5–8 pre-date this batch.** v0.24.0's durable settlement covered chat and Quote Finder and
never covered predebited `DocumentJob` producers; `doc_service.py` had zero references to `DocumentJob`.
Coupling the trial slot to that subsystem is what lit it up.

## Accepted tradeoff

Deletion takes parent `FOR UPDATE` then advisory 948, so a delete can block while a live worker owns the
job lock — bounded by worker hard limits (420/720/600s), with no lock-order deadlock and no
unrecoverable parent. Dormant in practice: extraction and table_scan are dead since 2026-05-08.

## Deferred to a dedicated hardening batch (R7 enumeration rows 15–18)

- database-enforced one-ledger-per-document-job constraint (needs a migration plus legacy validation);
- FK RESTRICT / soft-delete / tombstone so the recovery anchor cannot vanish independently of settlement;
- an audited repair command for contradictory succeeded rows and malformed refs;
- operational alerts: oldest unreconciled document-job ledger, sweep counts, beat liveness, `*.unresolved`;
- product semantics for reparse, input-document deletion, and collection membership changes during
  active work.

## Verification (run by Claude against real Postgres, NOT taken from the agent's self-report)

Codex's sandbox denies local sockets; its integration run errored in scratch-DB provisioning with no
test body executed. Run here:

| Gate | Result |
|---|---|
| `alembic heads` | sole head `20260826_0043` (linear 0040→0041→0042→0043) |
| `ruff check app/ tests/` | clean |
| `SKIP_INTEGRATION= pytest -q` | 935 passed / 3 skipped |
| `SKIP_INTEGRATION= pytest -m integration -q` | 48 passed |
| `npm run build` | compiles, 425 pages |
| `npm run test:unit` | 12/12 |
| `check_version_consistency.py` | OK |

## Not yet done

Not pushed, not deployed, version not bumped. Deployment is backend-first and carries **three** Alembic
migrations — `railway up` on `stable` and a `/health` confirmation must precede the Vercel push.
Batches B (first-run race, parse-failure recovery) and C (Quote Finder hint, demo above the fold) are
not started.
