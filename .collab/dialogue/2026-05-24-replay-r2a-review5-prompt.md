# Round 5 — ratify acronym-aware pure-page detection

Round-4 blocker: IGNORECASE filler strip erased all-caps acronyms colliding with
lowercase filler (US/IN/DE/LA/CO ~ us/in/de/la/co) → false-pure.

Fixed in `backend/app/services/query_router.py` (full diff vs main:
`.collab/reviews/2026-05-24-replay-r2a-router-diff.patch`). Read it.

New `_strip_filler_keep_acronyms` is the `re.sub` repl for `_PAGE_LOOKUP_FILLER`:
it preserves a matched filler word IFF it is `token.isascii() and token.isalpha()
and token.isupper() and len>=2` (all-caps Latin acronym); otherwise strips to " ".
Title-case ("What") and lowercase still strip; CJK filler (never ASCII) still strips.
Then pure IFF no `[0-9A-Za-zÀ-￿]+` token remains.

Verified routing:
- MIXED (keeps fallback): US/IN/DE/LA/CO/IP on page 12, AI on page 12, Q3 on page 5,
  税 第12页, requirements on page 12
- PURE (no fallback): "what is on page 350", "page 350", "第350页有什么",
  "what is on page 350 of the document", "show me page 7", "What is on page 5",
  "co je na straně 350 v dokumentu"
20 router tests pass (acronym repros added as regressions).

Final R2a verdict: RATIFIED or BLOCKER. If BLOCKER, give a CONCRETE repro query +
expected routing — not a hypothetical. Append "## Round 5" to
`.collab/reviews/2026-05-24-replay-r2a-codex-review.md`. Short.
