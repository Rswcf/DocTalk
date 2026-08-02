# Codex M2 r2 — verify the r1 fix wave + adjudicate two rulings

Your r1 (final section of `.collab/reviews/2026-08-02-quote-finder-m2-codex-r1.md`) verdicted BLOCK: 3 BLOCKER / 4 IMPORTANT / 3 MINOR. Triage + rulings: `.collab/dialogue/2026-08-02-m2-codex-r1-triage.md`. Fix commits since your r1 head (`6ba49e2`):

```
git log --oneline 6ba49e2..e5b7c01
git diff 6ba49e2..e5b7c01
```

Mapping: #1 → a869326 (frontend per-kind honest copy: word-for-word claim gated to page_text kind, extracted_text caveat ×11 locales, weakest-kind headline) — the ARGUED position (full hyphen mapping/backfill = sanctioned fast-follow per M1-r2's accepted boundary; fallback = degrade extracted_text PDF cards to flagged if you reject the label argument). #2 → a869326's backend half (per-page/per-chunk attribution from the verified slice; your page-2 repro is a regression test). #3 → ad4c44d (strict-detect before predebit; balanced 15 regardless of mode; 402 on insufficient). #4 → 3c3bfee (REST guarded region + chat persisted-answer⇒predebit-stands + real-Postgres tests). #5 → d4d740f (negation/metalinguistic guards; your five probes = negative tests). #6 → 1852535 (casefold, Page.content scan, full telemetry incl. discarded details; REST response intentionally exposes only user-facing counts — telemetry carries the §8.3 set) + 8c5f1c8 (submit-time event). #7 → d44e882 (topic cap 300). #8 → cc9e8e5. #9 → 21dd6b5. #10 → ae5dbf5 (PARKED ruling: idempotent immutable seeds — adjudicate). Plus e5b7c01 (integration tests isolated to a scratch doctalk_test DB after a shared-dev-DB wipe incident; conftest derivation intercepts both env and .env paths, triple-snapshot proof in the wave report).

Task: verdict each r1 finding ADDRESSED / NOT ADDRESSED (probe the fixes adversarially — especially #2's attribution edge cases and #4's cancellation/failure windows), adjudicate the #1 argued position and #10 parked ruling, flag NEW breakage in the fix commits only. Settled clean surfaces stay settled.

Evidence since r1 (audit, don't repeat): 679 unit pass/10 skip + 7 integration pass (scratch DB) + ruff clean + build clean at HEAD; live dev E2E at fix HEAD: verified card p5-5 with bbox-page consistency, sloppy proposal honestly flagged (90.96 below_auto), telemetry event carries retrieved_count/candidate_pages/no_result/discarded details.

Report: per-finding verdicts, two adjudications, new-breakage section, overall verdict: CONSENSUS-SHIP / REVISE / BLOCK.
