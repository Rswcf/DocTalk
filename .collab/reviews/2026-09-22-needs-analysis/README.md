# Needs analysis: does DocTalk meet what users came for? (2026-09-22)

## Why this analysis

The owner asked, on 2026-09-22, for every historical user conversation to be read and handed to Fable 5.1. Two
questions come with it:

- **Was the product meeting users' needs?** The suspicion is that it was not, and that this — more than price —
  explains the near-zero return rate.
- **What follows for pricing and the system?** The findings should feed a combined strategy: how to design
  pricing, and whether the system's capabilities need to be raised. It builds on
  `../2026-09-22-pricing-research/`.

## How the data is handled

- **Claude cannot read production.** The auto-mode classifier denied the export ("Production Reads"). The owner
  runs `export_qa.py` once.
- **The export is read-only.** Its session runs with `default_transaction_read_only`.
- **What it contains:**
  - every non-owner user's sessions and messages, in full text;
  - the documents' metadata;
  - wall, citation, checkout and feedback events;
  - credit ledger and model usage per user;
  - anonymous demo sessions.
- **What it leaves out:** no emails, names, filenames, storage keys or URLs. Users and documents appear as
  8-character id prefixes.
- **The repository is public, so the output stays outside it.** The script refuses to write inside any git
  checkout. Only aggregated findings with paraphrased examples are committed here. The raw export and any
  verbatim user text never are.

## Run (repository root; logged-in Railway CLI; `python3.12` with asyncpg)

    DATABASE_URL="$(railway variables --service Postgres --json | python3 -c 'import json,sys; print(json.load(sys.stdin)["DATABASE_PUBLIC_URL"])')" python3.12 .collab/reviews/2026-09-22-needs-analysis/export_qa.py /private/tmp/claude-501/-Users-mayijie-Projects-Code-010-DocTalk--claude-worktrees-frontend-design-review-c26fcb/aab7c07b-c115-4ec3-8823-4a2e6b93fa8e/scratchpad/qa-corpus

It prints one line of counts when it finishes. The output folder sits in Claude's session scratch space under
`/private/tmp`, so it is private to this machine and temporary.
