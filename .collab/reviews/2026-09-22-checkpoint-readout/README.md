# Checkpoint readout, 2026-09-22 (overdue 09-21 checkpoint)

The overdue checkpoint of `.collab/plans/2026-09-03-backlog-decision.md` §8.6. It is the first slice of Fable's
unfinished outline (`.collab/plans/2026-09-22-next-strategy-DRAFT.md`), which feeds the 2026-09-28 decision.
Claude could not run it: Claude Code's auto-mode classifier denied production reads, both via `railway ssh` and
via the database's public URL. The owner runs it, or allows it.

`readout_0922.py` is read-only. Its session runs with `default_transaction_read_only = on`. It prints counts and
8-character user-id prefixes only.
- Part 1 runs `backend/scripts/observation_window.py` unchanged. The production image has no `scripts/`
  directory, so it runs locally against the public database URL, as §8.6 specifies.
- Part 2 hand-runs the amendments that were specified but never applied:
  - §9.8: the refined defect trigger, the active-user denominator and refreshed intent rates;
  - §9.11/§9.13: day-2 anchored on the first active day, both capped and uncapped;
  - §9.18.6: the purchase chain by limit reason, split at T_copy; the day-4 "ever capped" flag; Quote Finder
    among citation clickers;
  - §9.11: the historical returner read.
- Part 2 also runs the additions from Fable's strategy plan (`.collab/plans/2026-09-22-next-strategy.md` §2.0):
  - the purchase-by-limit chain split by surface: `demo`, `own`, `no-doc`, or `unknown`. A demo session wall routes
    to Stripe, so a checkout on the demo surface is not the purchase wall falling. `unknown` counts as
    demo-contaminated;
  - anonymous demo sessions per day and per demo document;
  - `share_created`, all time;
  - non-owner signups per day since T_A.

The SQL was syntax-checked against the migrated local `doctalk_test` database. Every section executes, but that
database is empty, so the classification logic has not run on real rows.

Run from the repository root (needs the logged-in Railway CLI and `python3.12` with asyncpg):

    DATABASE_URL="$(railway variables --service Postgres --json | python3 -c 'import json,sys; print(json.load(sys.stdin)["DATABASE_PUBLIC_URL"])')" python3.12 .collab/reviews/2026-09-22-checkpoint-readout/readout_0922.py | tee readout-0922.txt

Append the raw output, with no interpretation, to the DRAFT under "Readout 2026-09-22". The reading is Fable's.
