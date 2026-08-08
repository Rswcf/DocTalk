# CONSENSUS-SHIP: parse persistence batching + recovery lifecycle (2026-08-08)

Six Codex rounds (r1–r6) on the parse-performance incident fix. Final verdict at
r6: **SHIP — CONSENSUS-SHIP** (zero findings at any severity).

Commits: f4d1953 (batching) → 4356f0a (r1) → 0dc96b5 (r2) → 6dc2488 (r3) →
4bcf5b3 (r4) → 74dcef8 (r5). Version 0.28.1.

## Incident (why this exists)

2026-08-08: 10-page PDF parsed in 190s; 220/289-page docs died at the 540s soft
limit inside element persistence. Root cause was OPERATIONAL — backend was
rescheduled to europe-west4 on 2026-05-23 while Postgres/Redis/Qdrant/MinIO
stayed in us-west2 (~150ms/RTT; fixed same day by pinning backend +
retainpdf-sidecar back to us-west2 via multiRegionConfig → 0.7ms). The code made
latency multiplicative: one INSERT round trip per ORM row.

## What shipped (cumulative)

- Batched executemany persistence for pages/elements/chunks (500/batch); tuple
  chunk loading + single per-batch vector_id UPDATE in embedding.
- Soft-limit honesty: chained-soft-limit unwrap (full __cause__/__context__
  graph) in every persist handler, the embedding handler, AND the outer generic
  handler; only the FINAL retry attempt writes terminal state (PARSE_TIMEOUT /
  PARSE_FAILED) via a fresh session; failed status writes re-raise for autoretry.
- Recovery lifecycle: age-gated (45 min > visibility_timeout 40 min) atomic-claim
  watchdog (beat, 30 min) replaces blind startup re-dispatch; per-document
  advisory-lock serialization (pg_try_advisory_lock(947, hashtext(doc_id)) on a
  dedicated autocommit connection, invalidate() on unlock failure) + terminal-
  status stale-message rejection.
- Locale durability: documents.parse_requested_locale (migration 20260808_0039),
  OWNED BY DISPATCHERS — written atomically with every transition to 'parsing'
  before publish (upload/ingest/layout constructors, reparse atomic claim which
  also expresses intentional NULL reset, backfill script claim). Worker reads
  only; message locale argument ignored.
- find_low_quality_docs.py --enqueue claims via conditional UPDATE (was a silent
  no-op against the terminal-status guard).

## Accepted trade-offs (argued, Codex agreed in r5)

- Pre-deploy queued messages carrying a locale for NULL-column docs parse with
  defaults (prod parse queue verified empty before deploy).
- A duplicate that serializes behind a NON-terminal run re-parses idempotently
  (acts as the retry).

Tests: 818 non-integration + 28 integration (real-Postgres batching round-trip,
advisory-lock semantics, watchdog claim exactly-once), ruff clean.
