# Round 2 — ratify R2a fixes

You reviewed R2a (SHIP-AFTER-MUSTFIX). All findings addressed; verify + give final
verdict. No git. Updated diff: `.collab/reviews/2026-05-24-replay-r2a-diff.patch`. Read files.

## Fixes applied
- [Must #1] `chat_service.py` page-lookup branch: no-fallback only when
  `query_route.intents == (QueryIntent.PAGE_LOOKUP,)`; else restore semantic fallback.
- [Must #2] `parse_worker.py`: `embedding_service.ensure_collection()` before the Qdrant
  delete; wrapped in try/except → `_set_doc_error(doc, "QDRANT_CLEANUP_FAILED", ...)` + commit
  + return on failure (no stale re-index, no stuck 'parsing'). SoftTimeLimitExceeded re-raised.
- [Should #3a] repair prompt += `_source_location_contract()` + keep-valid-page rule.
- [Should #3b] `_citation_payload` prepends `[page N]`/`[page N–M]` to `context_text`.
- [Should #4] `_location_label` clamps page_end to max_pages; `_source_locator` gates summary
  range by max_pages + collapses section-title whitespace (`re.sub(r"\s+"," ")`).

## Verify
1. Must #1 correct: is `query_route.intents` a tuple where pure page == `(PAGE_LOOKUP,)`? Does the
   restored fallback path set evaluation/plan like the normal branch? Any case where pure page
   SHOULD still fallback?
2. Must #2 correct: ensure_collection idempotent + safe to call here? On failure does it truly
   avoid re-indexing (the `return` exits the whole task)? Is `_set_doc_error` the right helper
   (vs `_set_timeout_error`)? Does returning skip needed cleanup/commit?
3. #3b: does prepending to `context_text` break anything that consumes it (display, snippet,
   other verifier checks)? Could it create FALSE positives (now "page N" always supported even
   when the claim's page is wrong)? Acceptable tradeoff?
4. #4: section whitespace collapse enough vs control chars? page_end clamp interaction with the
   summary branch.
5. Any NEW regression to PAY/U26/U28/U42.

Append "## Round 2 — Ratification" to `.collab/reviews/2026-05-24-replay-r2a-codex-review.md`:
RATIFIED or BLOCKER(list). Short.
