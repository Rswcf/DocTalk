# Batch C adversarial review — Codex R3

Revision under review: `b718493` (`fix/growth-batch-c`)  
Base: `fix/growth-batch-a` (`9394801`)  
Review date: 2026-08-27  
Verdict: **SHIP**

## Findings

None.

## 1. C4 revert is complete and clean

I compared the two commit trees without Git. The product-code delta against
Batch A contains C1, C2, and C3 only. The additional non-product files are the
review history, the deferral plan, and the retained 20-line anonymous-gate
regression test.

The principal C4 surfaces are byte-identical to Batch A:

- `backend/app/core/rate_limit.py`
- `backend/app/api/chat.py`
- `frontend/src/lib/useChatStream.ts`
- `frontend/src/store/index.ts`
- `backend/tests/test_demo_limits.py`
- `backend/tests/test_error_taxonomy.py`

`ChatPanel.tsx` is also identical to Batch A. The remaining Batch-A-to-Batch-C
changes in `MessageBubble.tsx`, `sse.ts`, and `types/index.ts` are C1 chip/hint
comments and types only; there is no reservation, release, Stop/EOF re-anchor,
or failed-bubble residue. Searches found no orphaned reservation type, attempt
ID, owner, dead import, or release-semantics test. The sole surviving frontend
test file contains only the anonymous Quote Finder sign-in-gate regression.

The four `reanchorDemoCounter()` calls at `useChatStream.ts:431`, `:439`,
`:469`, and `:485` are exactly the pre-existing regenerate/continue SSE-error
and thrown-fetch failure paths. There is no Send, Stop, or clean-EOF call site.
The accepted Batch A behavior therefore holds again: a failed anonymous demo
answer remains consumed. Per the review instruction, that status quo is not a
finding.

## 2. C1 survived the split

The live path is intact:

1. Ordinary citation wording such as “Where does the paper discuss climate
   risk?” resolves to `CITATION_LOOKUP`, stays on the RAG answer path, and gets
   `quote_finder_hint=True` plus the bounded topic.
2. The normal RAG `done` event includes `quote_finder_hint` and
   `quote_finder_topic`.
3. `sse.ts` maps both fields, `useChatStream.ts` installs them on the assistant
   message, and `MessageBubble.tsx` renders the chip after streaming ends.

The focused end-to-end routing test exercises both guarded strict wording and
ordinary citation-lookup wording, asserts the fields on `done`, and proves the
quote-search service was not called. A chip click only opens and prefills the
panel; `searchDocumentQuotes()` remains reachable only from the panel form's
explicit submit handler. No billed search fires from hint receipt, rendering,
or panel opening.

## 3. R1/R2 dispositions for C1, C2, and C3 still hold

- **C1: pass.** The broadened hint is live and remains click-gated.
- **C2: pass.** The two new funnel events remain authenticated-only. Strict
  chat routing records its funnel stages inside the existing successful
  terminal transaction and still performs one quote search using the chat
  ledger; it adds no second debit or search.
- **C3: pass.** Its post-split delta is only the intended relocation of the
  sample-document section ahead of “What you will test.” The responsive card
  behavior and loading/ready predicates are unchanged, and all referenced
  strings remain non-empty in all 11 locales.
- **R1 finding 3 remains closed.** `handleTryQuoteFinder()` checks
  `isLoggedIn`, opens auth, and returns before private analytics or panel
  state. The retained frontend regression test verifies that ordering.

I found no paid-feature leak, no new demo-cap change in either direction, and
no billed search without an explicit user submit.

## 4. Deferral specification

The follow-up specification is faithful to the two blocked designs and is
implementable without re-deriving the failure model. It records the R1
double-decrement schedule, all four R2 orphan schedules, and the client
convergence race. It then supplies the missing architecture: stable attempt
and ownership IDs, origin-bound storage, explicit pending/committed/released
transitions, ambiguous-Redis-result handling, Redis and memory expiry rules,
ownership before body iteration, shielded cleanup, attempt-scoped client
reconciliation, adversarial tests, and rollout observability.

That is sufficient direction for a separate counter-integrity batch while
keeping C1/C2/C3 independent here.

## 5. Verification

Claude's supplied full gates were accepted: ruff clean; 942 passed / 3 skipped
non-integration tests; 48 integration tests passed; frontend production build
compiled; 13 frontend unit tests passed.

I additionally ran the focused C1/C2 backend suites (`test_action_planner.py`,
`test_events_api.py`, and `test_quote_intent_routing.py`): **99 passed**. I
reran the complete frontend unit suite: **13 passed**, including the retained
anonymous sign-in-gate regression. The reviewed source files matched the
`b718493` blobs. I used no Git commands.

## 6. Verdict

**SHIP. Batch C has reached consensus.** C4 is cleanly deferred; C1, C2, and
C3 retain their prior passing dispositions; and no condition in the supplied
BLOCK bar is present.
