# Codex adversarial review request — Batch C

Under review: `468b63d` on `fix/growth-batch-c` (branched off the completed Batch A).
Plan: `.collab/plans/2026-08-26-growth-fix-batches.md` §Batch C.

**There is no implementation report.** Your implementation run was killed by a machine restart after
it wrote the code but before the report, so work from `git show 468b63d` and the working tree, not from
a self-report. Treat the commit message as a claim to be checked, not as evidence.

## Attack these

1. **C4 — the demo counter. This is the highest-risk item in the batch.**
   `.claude/rules/frontend.md` "Demo Counter & Session Reuse" was won over six prior Codex rounds; the
   invariants there must survive. Specifically:
   - The atomic reservation before work starts must still bound concurrent requests to five. Can two
     in-flight requests now both release and let a third slip past the cap?
   - Release happens on error, raised generator, and disconnect. Can a slot be released **twice** — an
     error event followed by generator teardown — handing back a message the user did spend?
   - Can a slot leak the other way: a stream that neither reaches `done` nor errors (client vanishes,
     server timeout, cancellation) leaving the reservation held forever?
   - The SSE error now carries a server count for client re-anchor. Does that interact safely with
     `demoAccountingEpoch` and the documentId-keyed reset, or can a late error event overwrite a newer
     count? A late resolve must be dropped, never written.
   - Is the anonymous 5-per-(IP,document)-per-24h semantic preserved exactly, including across the
     session-reuse path?
2. **C1 — the hint.** Confirm the strict auto-route trigger is genuinely unchanged and that no billed
   search can now fire without an explicit user click. Then confirm the hint actually reaches the client:
   does the SSE `done` payload on the CITATION_LOOKUP path carry `quote_finder_hint` /
   `quote_finder_topic`? The FIX3-B comment warns tool-action `done` payloads omit those keys — if
   CITATION_LOOKUP is affected, the change is inert and that is a finding.
3. **C2 — events.** Are the two new events emitted where they claim, and is the anonymous surface
   unchanged? Anonymous `chat_message_sent` is 401 by design; check whether these were added to
   `PUBLIC_EVENTS` and whether that is correct.
4. **C3 — demo layout.** Does it hold at narrow widths, and did the reorder break the
   "Preparing sample / Open sample" states or the locale variants?
5. Anything violating `.claude/rules/*.md`, and any i18n key that is nested rather than flat dotted.

## Verification already run by Claude (docker was down and has been restored)

ruff clean; `SKIP_INTEGRATION= pytest -q` 945 passed / 3 skipped; `SKIP_INTEGRATION= pytest -m
integration -q` 48 passed; `npm run build` compiles; `npm run test:unit` 12 passed.

## Verdict bar

BLOCK only for: losing money, leaking a paid feature, breaking the demo cap in either direction, or
making a billed search fire without a click. Otherwise REVISE or SHIP, and say which plainly.

Write to `.collab/dialogue/2026-08-27-batch-c-codex-r1.md`. You cannot run git.
