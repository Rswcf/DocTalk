# Claude triage of Codex M2 r1 (BLOCK) — 2026-08-02

All 10 findings verified against code before ruling. Fix commits follow; one position is argued rather than fully conceded (#1).

## BLOCKERs

**#1 hard-hyphen fidelity (extracted_text PDFs)** — PARTIALLY CONCEDED, position argued. The mutation is real and pre-dates M2 (M1 r2 finding 5, explicitly accepted then as the M1→M2 boundary with "honest trust labels meanwhile"; §8.1's own text sanctions chunk-fallback rendering under the "verified against extracted text" label). What M2 got WRONG is the UI: the panel headline claims "word-for-word quotes from this document" for ALL kinds. Fix shipped: per-kind honest copy — extracted_text-kind PDF cards carry an explicit caveat ("verified against extracted text; line-break hyphenation may be normalized") and the word-for-word claim renders ONLY for page_text-kind results. Full hyphen-offset mapping or page-text backfill remains the sanctioned fast-follow (backfill script exists: re-parse under B1). If r2 still judges label-honesty insufficient for extracted_text PDFs, the fallback is degrading those cards to a "flagged" (non-auto-shown) presentation — argue it then.

**#2 page attribution from verified slice** — CONCEDED IN FULL (this is §8.1's literal requirement and the r1 repro is damning). Fix: page_text kind verifies per-page (source built per page; match attributed to the matching page; cross-page matches attributed to their actual span via per-page offset ranges); extracted_text kind verifies against the cited chunk first and each neighbor separately, attributing to the matching chunk's page range; ambiguous multi-page attributions are labeled as a range, and bboxes only attach when they belong to the attributed page. Repro case becomes a test.

**#3 quick-mode predebit vs balanced quote engine** — CONCEDED. Fix: strict-intent detection moves before the predebit decision; strict-routed messages pre-check and predebit the balanced estimate (15) regardless of selected mode; insufficient balance → the standard 402 paywall shape (not a silent downgrade). The reconcile-allows-negative shape is pre-existing platform behavior shared with chat; with the correct predebit the practical window closes; a reconcile floor is noted as platform backlog, not M2 scope.

## IMPORTANTs — all conceded, all fixed

**#4** REST: reconcile/usage/telemetry/commit move inside the guarded region — any failure after predebit refunds it; CancelledError handled explicitly. Chat: reconcile-failure-after-persist no longer reaches the generic full-refund — the B5 evidence pattern extends to the failure path (persisted answer ⇒ predebit stands as the charge). Real-Postgres integration tests added for both windows.
**#5** Matcher gains negation/metalinguistic guards (en/zh/es: don't/do not/should not/never/what does X mean/translate…/不要/无需/别/是什么意思/¿qué significa/no + trigger-window). All five r1 probes become negative tests; affirmative forms stay routed.
**#6** Term scan casefolds (fuzzy normalize); candidate expansion scans Page.content where present; QuoteSearchResult + telemetry gain retrieved_count, candidate_pages, no_result, and bounded discarded details; frontend submitted-event fires on submit, not on success.
**#7** Chat-routed topic capped to 300 chars (mirrors REST) before term-split/prompt embedding.

## MINORs

**#8** CONCEDED: `get_document_text_content` page mode requires ALL pages content (aligns with B2's rule); else chunk fallback. Test for mixed docs.
**#9** CONCEDED: `csl_json` required (422 when absent); first-write IntegrityError handled via on-conflict upsert/retry.
**#10** PARKED with ruling: B0's stat→put window can only overwrite with byte-identical seed assets (single source of truth = seed_data files keyed by slug); overwrite is idempotent by construction. A comment now states the assumption; revisit if seeds ever become mutable.

## Cleared surfaces carried forward
No LLM-text-to-card path; no flagged-tier leakage; authz clean; migration/index semantics correct; XSS clean; i18n 33×11 exact; regenerate/continuation behavior sane.
