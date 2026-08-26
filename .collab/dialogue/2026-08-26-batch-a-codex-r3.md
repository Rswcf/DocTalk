# Batch A adversarial review — Codex R3

Commit under review: `0781f88` (`fix/growth-batch-a`)  
Review date: 2026-08-26  
Verdict: **BLOCK**

Four of the five R2 findings are substantively closed. R2 F1 is closed only in
appearance: an attacker no longer chooses the larger cap with `Content-Type`,
but can choose it with the first five response bytes. I also found one
batch-wide credit-settlement blocker in the extraction failure path now coupled
to trial release. None of the R2 fixes is worse than the bug it replaced, but
the extraction repair is built on a refund path that violates the repository's
durable-settlement rule.

Per the request, I did not invoke Git.

## Findings

1. **[BLOCKER — successful extraction can be refunded / credits can be minted] Extraction still bypasses the durable settlement marker on an ambiguous final commit.**

   Files: `backend/app/services/extraction_service.py:483-513`,
   `backend/app/services/extraction_service.py:573-628`,
   `backend/app/models/tables.py:440-444`, `.claude/rules/backend.md:14`.

   `_reconcile_sync()` updates the balance and ledger delta but never locks the
   ledger or stamps `reconciled_at`. `_refund_predebit_sync()` then performs an
   unconditional `DELETE` by ledger id. The broad `except` around the success
   transaction also catches `db.commit()` failures.

   A concrete ambiguous-commit schedule is therefore unsafe:

   1. The database commits the reconciled ledger, `succeeded` job, usage row,
      and `ExtractionResult`, but the worker observes a connection error instead
      of the commit acknowledgement.
   2. The `except` branch rolls back locally, reloads the now-succeeded job, and
      unconditionally deletes the already-settled ledger.
   3. It restores the full 25-credit predebit and rewrites the job to `failed`.
      The committed result remains present. If actual cost was below 25, the
      user's resulting balance is above the pre-request balance by
      `25 - actual_cost`; otherwise the result is still undercharged by 25.
   4. Trial release correctly refuses to delete the slot because the result row
      exists, so the slot invariant survives, but the money invariant does not.

   This is the exact failure class prohibited by the rule that every reconcile
   stamps `reconciled_at`, every refund is
   `DELETE ... WHERE reconciled_at IS NULL RETURNING`, and all final-commit
   exceptions use the marker resolver. The 863-test suite has durable-settlement
   coverage for chat/Quote Finder, but repository search found no equivalent
   extraction test.

   **Required fix:** give the synchronous extraction path the same marker
   protocol: lock and stamp the ledger on every reconcile (including equal
   cost), condition every refund on `reconciled_at IS NULL`, and resolve a final
   commit exception in a fresh session. If settlement already landed, do not
   refund or overwrite the succeeded job. If the conditional refund wins, mark
   the undelivered job failed and release its trial row in that same transaction.
   Resolver failure must leave the predebit standing and log an unresolved
   settlement, never fall through to a blind refund. Add an integration test for
   “commit landed, acknowledgement lost.”

2. **[HIGH — the advertised 10 MB non-PDF read cap is still bypassable] Five attacker-controlled bytes select the plan cap, and decoded chunks can overshoot either cap before the check runs.**

   Files: `backend/app/services/extractors/url_extractor.py:92-154`,
   `backend/app/services/extractors/url_extractor.py:230-238`,
   `backend/app/services/file_validation.py:7-29`,
   `.claude/rules/backend.md:21`, `docs/ARCHITECTURE.md:142`.

   The sniff prefix itself is bounded: `file_magic_length("pdf")` is exactly
   five bytes and `prefix` never grows beyond it. The classification is not
   strong enough to support the stated resource guarantee. Once the first five
   bytes are `%PDF-`, `is_pdf` remains true for the whole response. A body made
   of `%PDF-` plus arbitrary data can therefore be read and retained up to the
   authenticated plan cap (200 MB for Pro), pass the fetcher's second identical
   prefix check, and only fail when PyMuPDF receives the fully buffered body.
   The old hostile-header selector has been replaced by an equally cheap
   hostile-prefix selector.

   A non-magic response can also exceed 10 MB before the defensive check sees
   it. The loop increments and tests `total` only after `response.iter_bytes()`
   has yielded a complete decoded chunk. In HTTPX 0.28.1, `iter_bytes()` first
   calls the content decoder on a raw chunk, then yields its output. A gzip,
   deflate, Brotli, or Zstandard expansion can therefore allocate/yield well
   beyond the cap in one step. `Content-Length` commonly describes the
   compressed body and does not close this. A focused fake-response probe
   confirmed that one 30-byte non-PDF chunk is fully read before a 10-byte cap
   rejects it, while a 150-byte `%PDF-`+garbage response is returned under a
   200-byte PDF cap.

   Redirect behavior is closed: redirect bodies are not read, redirect headers
   do not select a cap, and the final response is independently sniffed. A
   content-type change anywhere in the chain has no effect.

   **Required decision/fix:** a strict “no invalid/non-PDF response can be read
   beyond 10 MB” promise cannot coexist with allowing arbitrary PDFs above
   10 MB based only on attacker-controlled early bytes. Either cap every URL
   response at 10 MB, or explicitly define the larger class as a “PDF-magic
   candidate” and document that it receives the plan cap. In the latter case,
   remove the memory-DoS edge by reading bounded raw chunks, enforcing both raw
   and safely decoded output limits, spooling candidates instead of retaining a
   chunk list plus a joined copy, and validating the complete PDF before
   persistence. The current rule/architecture wording is not accurate.

## R2 findings 1–5 re-audit

1. **R2 F1 — not closed.** Header misclassification is fixed, generic-content
   real PDFs work, the sniff window is bounded, and redirects are safe. The
   independent non-PDF read cap is still selectable away with `%PDF-`, and
   decoded-chunk overshoot is unbounded until HTTPX yields; see finding 2.
2. **R2 F2 — closed for trial ownership.** Claim and release both serialize on
   `users.id FOR UPDATE`, so release-versus-claim cannot lose or double-spend a
   slot. Release is an atomic conditional `DELETE ... RETURNING`, repeated
   release is a no-op, and the queue and worker paths perform balance refund,
   job terminalization, and release before one commit. A commit failure rolls
   all three back rather than committing only a refund or only a release. Chat
   intentionally has no release: its session survives an answer/credit failure
   and remains the same reusable owner, while deletion does not reset the
   entitlement. That asymmetry is defensible. The adjacent extraction money
   settlement defect is finding 1, not a slot-race failure.
3. **R2 F3 — closed.** Backend `FILE_TOO_LARGE` details derive `plan` from the
   authenticated database user and the error mapper uses that detail. The local
   upload precheck does use the cached client profile, but authenticated
   `undefined` is deliberately normalized to Free, so it shows a Free → Plus
   path rather than hiding it. The click keeps `currentPlan=undefined` and is
   routed to `/billing`, not directly to subscription creation; `/subscribe`
   separately locks the server user and rejects an existing subscription. The
   remaining at-most-60-second cached-plan UI staleness is not authoritative
   gating and does not recreate the R2 Pro → Plus downgrade funnel.
4. **R2 F4 — closed.** `pdf.needs_pass` rejects PDFs that actually require an
   open password before storage/insert. With PyMuPDF 1.26.5, an owner-password
   protected PDF whose user/open password is empty reports `needs_pass=0` and
   `count_document_pages()` returns one page; a both-password-protected PDF
   reports `needs_pass=1` and returns `PDF_PASSWORD_PROTECTED`. Both-empty also
   remains accepted. The common empty-open-password case is not regressed.
5. **R2 F5 — closed.** The three affected keys are corrected in all 11 locale
   JSON files, homepage/multi-format structured data and fallbacks agree, the
   DOCX/PPTX/XLSX articles are plan-specific, and the voice guide is corrected.
   Remaining 500-page strings describe competitors or non-limit examples;
   standalone 50 MB strings are explicitly Free or the separate layout-
   translation cap.

## Batch-wide checks

- R1's direct-CTA/second-subscription and Checkout-attempt findings remain
  closed. The server-side active-subscription guard and durable attempt state
  are still present; no current caller can make client profile state
  authoritative for billing.
- Domain Mode has one entitlement source, both backend entry points use it,
  and the release eligibility query prevents a delivered result from freeing a
  slot. I found no paid-feature double-spend in trial accounting.
- Direct upload and URL page/password preflight still happen before MinIO and
  `documents` insertion. No page-cap or password rejection consumes a document
  slot.
- `.claude/rules/frontend.md` accurately describes current Domain Mode
  ownership and release behavior. `.claude/rules/backend.md` is inaccurate for
  URL non-PDF reads (finding 2), and its durable-settlement rule is violated by
  extraction billing (finding 1). I found no new violation of the MinIO async,
  API proxy, i18n key-shape, palette, demo accounting, or Quote Finder rules.

## Verification performed

- Relied on Claude's supplied green results: single Alembic head, Ruff, 863
  backend tests, 38 integration tests, Next build, and 12 frontend unit tests.
- `cd backend && ../.venv312/bin/python -m pytest tests/test_url_extractor.py tests/test_document_limits.py tests/test_domain_mode_access.py tests/test_extractions_api.py -q`
  — **45 passed**.
- Probed HTTPX 0.28.1's real `iter_bytes()` implementation and the URL reader's
  one-chunk and magic-prefixed behavior as described in finding 2.
- Generated AES-256 PDFs for empty/non-empty owner and user password
  combinations and called the real `count_document_pages()` as described in R2
  F4.

