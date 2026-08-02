# Adversarial Review Request — Quote Finder M2 batch

You are the adversarial reviewer. Try to BREAK this batch: verification-guarantee bypasses, billing holes, chat-path regressions, injection, migration/data hazards. Cite file:line, classify BLOCKER / IMPORTANT / MINOR / NOTE, end with CONSENSUS-SHIP / REVISE / BLOCK.

## Scope

15 commits `1f093be..6ba49e2` on main:
```
git log --oneline 1f093be..6ba49e2
git diff 1f093be..6ba49e2
```
Plan: `.collab/plans/2026-08-02-quote-finder-m2-impl.md`. Parent LOCKED consensus (yours, r1+r2, 2026-06-12): `.collab/plans/2026-06-12-quote-finder-evidence-board.md` §8 — M2 must honor §8.1 (substrate preconditions), §8.2 (approximate highlight), §8.3 (retrieval expansion + telemetry), §8.4 (billing/caps/routing/biblio), §8.5 (M2 milestone scope). Internal wave reviews already ran (3 waves + fix rounds; trail in `.superpowers/sdd/2026-08-02-quote-finder-m2-impl/`): find what they missed.

## What shipped

Backend: B0 demo self-heal now stats MinIO objects and re-uploads seed files (2026-08-02 storage-loss incident hardening); B1 forward-only per-page PDF text into `pages.content`; B2 `quote_source_service` (page_text when complete else chunk±neighbors, honest trust labels); B3 `quote_search_service` (2× retrieval + deterministic candidate expansion → balanced-model JSON proposals with abstention + data-boundary prompt → verify_quote gate → §8.1 dedup → cards; display = server slice ONLY); B4 `POST /api/documents/{id}/quote-search` (authed, predebit-15/reconcile reason="quote_search", UsageRecord message_id=None, `quote_search_completed` telemetry, charge-actual-on-empty); B5 strict verbatim-intent chat routing (separate \b-anchored en/zh/es matcher; quote_search artifact via ChatArtifact.to_payload; honest empty; cancellation-safe settle with evidence-derived has_answer); B6 `document_biblio` (partial unique indexes for (document_id,user_id) with NULL system row) + `format_apa_intext`.
Frontend: Quote Finder panel (authed; sign-in CTA anon), biblio form, chat quote-card artifact rendering (discarded_count from server, fallback for pre-change persisted messages), 33 i18n keys ×11 locales.

## Known/accepted (challenge if wrong; don't re-litigate silently)

1. `extracted_text`-kind dedup omits the offset/bbox signature component (§8.1 literal deviation): per-chunk verification corpora make offsets incomparable across chunks; same-text-same-page dupes on chunk-fallback docs collapse to one card; self-heals as docs re-parse under B1. (Wave reviewer accepted; flagged for you explicitly.)
2. Chat-routed searches bill through the chat message's own ledger row (no separate quote_search row) — deliberate, no double-charge; REST路径 bills its own row.
3. `_refund_predebit` restores the full predebit without checking reconciled delta — pre-existing shape shared with chat_service; the persist-after-reconcile alternative was REJECTED for this exact reason (re-review verified).
4. BiblioUpdateRequest's `csl_json` defaults to {} — a body without the key silently stores empty (integration-found nit; judge severity).
5. Biblio system-row seeding is crude (filename/PyMuPDF heuristics) — by design, always user-editable, no Crossref in M2.
6. Academic demo seed doc + M3 (saved quotes/Evidence Board/caps/replay gate) + exports/citeproc are explicitly deferred.

## Attack surfaces (minimum set)

1. **The guarantee**: any path where LLM-emitted text reaches a rendered card (REST, chat artifact, persisted message metadata, i18n interpolation)? Any way `verify_quote` gets a source narrower/different from what's displayed? Flagged-tier leakage?
2. **Billing**: concurrent quote-searches; failure between debit and reconcile on BOTH the REST and chat paths; the B5 cancellation settle (progress.message_id evidence) — race it; predebit refund vs charge-on-empty edges; can anon/demo trigger any billed path?
3. **Prompt injection**: document text instructing the model to fabricate quotes/refs; oversized topics; topic strings that break the JSON prompt.
4. **B1 behavior change**: `get_document_text_content` now returns page text for new PDFs — TextViewer/citation-highlight/summary paths that assumed chunk-concat; mixed-content docs (partial pages).
5. **B5 chat regression**: non-strict/anon/demo byte-identical? Strict matcher false positives in en/zh/es beyond the fixed ones; interaction with continuation/regenerate on a quote-answer message.
6. **Migration**: partial-index uniqueness actually enforcing one system + one user row; upgrade on a busy prod table; entrypoint auto-migration safety.
7. **B0**: can the re-upload path fight the reseed path or clobber a newer object?
8. **Frontend**: XSS via display_text/topic echo; state leaks across documents in the panel; PaywallModal/auth flows; i18n key coverage truth (33×11).

## Verification already performed (audit, don't repeat)

Backend 636 passed/8 skipped + ruff clean at HEAD; build clean. Live E2E on dev stack: upload → 15/15 pages content (B1); REST search → verified cards all page_text kind, single ledger row -15 reconciled, UsageRecord message_id=None, telemetry with §8.3 counts; verified-empty topic → 0 cards charged actual (-14); strict-intent chat SSE → token+artifact(status succeeded, discarded_count)+done, no second ledger row; biblio GET system-seed → PUT user row (correct-shape body persists; wrong-shape silently empties — item 4); anon browser → toolbar CTA → auth modal.

Report: markdown to stdout, severity-ranked, file:line cited, verdict line at end.
