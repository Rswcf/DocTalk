# Codex adversarial review request — Batch A (revenue unblock)

Commit under review: `580ad19` on branch `fix/growth-batch-a`.
Plan: `.collab/plans/2026-08-26-growth-fix-batches.md` (§Batch A).
Implementation report: `.collab/reviews/2026-08-26-batch-a-impl-report.md`.

Review `git show 580ad19` adversarially. This batch touches **billing and plan gating**, so the bar is
"could this lose money, leak a paid feature, or double-charge", not "is it tidy".

## Context you need

Production evidence that motivated the change (owner account excluded):
- `upgrade_click` with `metadata_json->>'path'='/billing'`: zero rows ever, against 24 billing-page
  arrivals from 16 distinct users since 9 May 2026. Live Stripe: 5 checkout sessions and 4 customers
  total, newest 6–7 May. Stripe config is healthy. So checkout was never broken — never invoked.
- `domain_mode_selector` drove 11 of the 17 users who ever clicked upgrade; `sessions.domain_mode` is
  NULL on all 263 sessions ever created.
- `FREE_MAX_FILE_SIZE_MB` and `PLUS_MAX_FILE_SIZE_MB` were both 50.

## Specific things I want attacked

1. **`backend/app/services/domain_mode_access.py` — the free-trial gate.**
   - Is there a TOCTOU race? Two concurrent chat requests on two fresh sessions could both pass the
     count check before either persists `domain_mode`. How bad is that, and is it worth a lock?
   - Semantics: one qualifying session appears to grant *unlimited* domain-mode messages within that
     session. Intended ("one free session"), or a hole?
   - The chat count uses `ChatSession.domain_mode IS NOT NULL` and the extraction count uses
     `DocumentJob.input_scope->>'domain_mode' IS NOT NULL` with a status filter. Can a user reset
     either counter — deleting a session, a failed/cancelled job, a job that never persisted scope?
   - Read the control flow carefully: `if consumed >= TRIALS: raise` then a second check
     `if consumed + consumed_extractions < TRIALS: return` then fall through to `raise`. Is that
     correct for TRIALS=1 and for TRIALS>1?
   - Are both call sites (`api/chat.py:395`, `api/extractions.py:188`) actually before any billing or
     side effect? Is there a third entry point that sets domain_mode and is now ungated?

2. **`frontend/src/lib/billing.ts` — `startCheckout`.**
   - The `upgrade_click` → `createSubscription` ordering must stay unconditional with no gate between
     them (that property is what made the funnel diagnosis provable). Confirm it survives.
   - Failure path: it fires `checkout_failed` and rethrows. Can a partial failure leave the backend's
     `stripe_subscription_id='pending'` sentinel set while the UI reports failure, and does the
     existing 10-minute `PENDING_SUBSCRIPTION_TTL` + `_recover_pending_subscription` recovery cover it?
   - Double-submit: can a user click twice and create two Stripe Checkout Sessions?
   - Does any caller now invoke `startCheckout` for an anonymous/unauthenticated user? That must still
     navigate to `/billing` instead.

3. **`A4` limit raise.** `MAX_PDF_SIZE_MB` was reported as unused; verify independently that nothing
   clamps the per-plan values, and that the raise is consistently reflected in backend enforcement,
   frontend copy, the pricing table, and all 11 locales. Flag any surface still claiming 50 MB for Plus.

4. **i18n.** New keys must exist in all 11 locales with flat dotted keys (a nested key breaks
   `next build` without failing tsc/eslint). Note: `useCasesFinance.faq.q6.*` is missing from the 10
   non-English files but that is pre-existing and deliberately `isEnglish`-gated — not part of this batch.

5. Anything in `.claude/rules/backend.md` or `.claude/rules/frontend.md` this batch violates —
   especially the credits/settlement invariants and the demo counter contract, which this batch should
   not have touched at all.

## Verification already run by Claude (reproduce if you doubt it)

- `ruff check app/ tests/` — clean
- `pytest -q` — 821 passed, 31 skipped
- `SKIP_INTEGRATION= pytest -m integration -q` — 28 passed
- `npm run build` — passes (425 pages)
- `npm run test:unit` — 1 passed
- `python3 scripts/check_version_consistency.py` — OK

## Output

Write your review to `.collab/dialogue/2026-08-26-batch-a-codex-r1.md`. Give a verdict of
BLOCK / REVISE / SHIP with numbered findings, each with file:line and a concrete fix. If you find
nothing that would lose money or leak a paid feature, say so plainly rather than inventing findings.
You cannot run git — do not try.
