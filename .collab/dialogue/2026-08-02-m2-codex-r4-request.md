# Codex M2 r4 — scoped verification of the r3 fix wave

Your r3 (`.collab/reviews/2026-08-02-quote-finder-m2-codex-r3.md`, verdict section at the tail) left #4 and #5/NB#1 open with explicit prescriptions. Three commits since your r3 head (`46af8fa`, excluding the two docs commits):

```
git log --oneline 46af8fa..40d2aa1
git diff 46af8fa..40d2aa1
```

- `45a7534` (#4 — YOUR prescription implemented): `credit_ledger.reconciled_at` (add-only migration); `reconcile_credits` takes `SELECT...FOR UPDATE` then ALWAYS stamps, including the equal-cost no-op path; every refund is one atomic conditional `DELETE ... WHERE reconciled_at IS NULL`; ALL final-commit exceptions (not just CancelledError) on both paths route through the same resolver; settled is marked before the resolver runs so resolver failure can never fall through to blind settlement; the outer setup handler gained the missing not-settled guard. Real-Postgres tests reproduce your deterministic "balance 106" schedule via a genuine two-connection asyncio.gather race, stable across repeats; the conditional DELETE and the FOR UPDATE were each mutation-tested and reproduced your exact bug.
- `0ccd4a5` (#5/NB#1 — POLICY CHANGE, adjudicate): the distance heuristic is GONE. Deterministic-safe rule: auto-route ONLY on strict trigger + ZERO negation/metalinguistic tokens anywhere in the message. Trigger + any such token ⇒ ordinary RAG runs and the SSE done event carries `quote_finder_hint`/`quote_finder_topic`. Rationale: your r3 probes prove lexical scope resolution is unwinnable (coordination, clause boundaries, negated metalinguistic verbs); losses are asymmetric — a false positive bills the user for a wrong answer, a false negative costs one click on a visible chip. This means your r2 affirmative-with-negation probes ("give me a direct quote, without paraphrasing") now deliberately get the CHIP instead of auto-routing — that is the intended tradeoff, not a regression. All 15 of your r1+r2+r3 probes are parametrized tests under this policy.
- `40d2aa1` (chip): non-blocking "Try Quote Finder" chip on hinted turns; opens the panel with topic prefilled, never auto-submits (billed); live-only (not persisted; deliberate); collection chat excluded; ×11 locales.

Task: verdict #4 and #5/NB#1 ADDRESSED / NOT ADDRESSED; adjudicate the routing POLICY (accept/reject the asymmetric-loss rationale — if rejected, name a deterministic alternative that survives your own r3 probe classes); probe FIX3-A's locking/conditional-delete adversarially; flag NEW breakage in these three commits only. Everything settled in r1-r3 stays settled.

Evidence (audit, don't repeat): 723 unit pass/18 skip, 15 integration pass (isolated scratch DB, dev DB untouched), ruff + build clean at `40d2aa1`.

Report: verdicts + policy adjudication + new-breakage + overall verdict: CONSENSUS-SHIP / REVISE / BLOCK.
