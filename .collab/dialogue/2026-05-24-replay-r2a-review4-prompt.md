# Round 4 — ratify conservative pure-page detection

Round-3 blocker: `<=2` residue threshold falsely marked short-topic page asks as pure.
Fixed in `backend/app/services/query_router.py` (diff:
`.collab/reviews/2026-05-24-replay-r2a-router-diff.patch`). Read it.

New logic: `_is_pure_page_query` strips page patterns + page number + a generous
multilingual filler (question lead-ins, articles/prepositions, "show me", "content",
document words, Czech `co/je/na/v/dokument*/straň*`, CJK `什么/这/那/在/里/上/文档/文件`),
then is pure ONLY if NO `[0-9A-Za-zÀ-￿]+` token remains. Biased toward "mixed" (a
false-mixed just adds a harmless fallback; a false-pure wrongly suppresses it).

Verified routing:
- MIXED (keeps fallback): "AI on page 12", "Q3 on page 5", "IP on page 9", "税 第12页",
  "requirements on page 12", "show table on page 8"
- PURE (no fallback): "what is on page 350", "page 350", "第350页有什么",
  "what is on page 350 of the document", "co je na straně 350 v dokumentu", "show me page 7"
20 router tests pass.

Confirm the blocker is resolved. Is the residual-token rule sound, or is there still a
realistic SHORT-TOPIC page ask that yields zero tokens (false-pure)? Final R2a verdict:
RATIFIED or BLOCKER. Append "## Round 4" to `.collab/reviews/2026-05-24-replay-r2a-codex-review.md`. Short.
