# Round 3 — ratify the pure-page blocker fix

Your round-2 BLOCKER: the router emitted (PAGE_LOOKUP,) for page+topic queries
("requirements on page 12"), so the no-fallback gate still suppressed semantic
retrieval. Fix applied in `backend/app/services/query_router.py` (diff:
`.collab/reviews/2026-05-24-replay-r2a-router-diff.patch`). Read it.

Fix: `_is_pure_page_query(text, page_ref)` strips page patterns + the page number +
multilingual filler; "pure" only if ≤2 chars of meaningful residue. The short-circuit
now requires `pure_page`; the general path appends LOCAL_QA when `has_page_lookup and
not pure_page`, so page+topic → intents=(PAGE_LOOKUP, LOCAL_QA, …). The chat gate
`intents == (PAGE_LOOKUP,)` therefore only matches a truly pure "what is on page N".

Verified routing:
- pure (no fallback): "what is on page 350", "page 350", "第350页有什么" → (PAGE_LOOKUP,)
- mixed (keeps fallback): "requirements on page 12", "does page 12 mention requirements",
  "concepto de cohesión en la página 14" → (PAGE_LOOKUP, LOCAL_QA);
  "show table on page 8" → (PAGE_LOOKUP, TABLE_QUERY, LOCAL_QA)
19 existing router tests pass + a new pure/mixed test.

Confirm: does this fully resolve the blocker? Any page+topic phrasing still wrongly
classified pure (false ≤2-char residue)? Any pure phrasing now wrongly mixed (harmless
but note)? Final verdict for R2a: RATIFIED or BLOCKER. Append "## Round 3" to
`.collab/reviews/2026-05-24-replay-r2a-codex-review.md`. Short.
