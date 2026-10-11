# arXiv margin stamp in citation snippets — Codex review record

Date: 2026-10-10. Branch: `fix/arxiv-margin-stamp-section-title` (base `main` c29c1ab8).
Reviewer: Codex `gpt-5.5`, adversarial, read-only instructions, 4 rounds. Final verdict: **SHIP**.

## Problem

Every SSE `citation` snippet of the production demo doc "Attention Is All You Need"
(`182c1d7b-29df-4600-add2-420384c725a4`) started with `arXiv:1706.03762v7 [cs.CL] 2 Aug 2023:`.
`chat_service.py:277` prefixes the snippet with `chunk.section_title`. The stamp is a vertical
20pt line in the left margin of page 1 (PyMuPDF `dir` (0,-1), bbox x 11–38 of 612). It passed the
heading font-size rule (> median × 1.25). The public `GET /api/documents/<id>/text-content` showed it
as the section title of all 15 pages: the doc was parsed on 2026-02-18 (`parse_version` NULL) and
nothing ever re-parsed it.

`section_title` does not feed the embeddings (the worker embeds `chunk.text`). It feeds the
citation snippet (`chat_service.py:277`, `documents.py:620`), lexical retrieval
(`retrieval_service.py` ilike + `_lexical_score`), the prompt's source-locator line
(`chat_service._source_locator`), extraction / diff / summary prompts, element metadata and the
text-content page titles.

## Commits

| Commit | Content |
|---|---|
| 3b26be0a | Parse v3: record line direction; drop off-axis text wholly in the outer 10% band; off-axis text is never a heading; arXiv-ID regex guard |
| 0b079233 | `refresh_stale_demo_parses`: re-parse ready demo rows below the current version in place (startup + 30-min beat) |
| 8a13eabb | r1 fixes |
| f6cc00d4 | r2 fixes |
| 41e27a16 | r3 fix |
| 7f8a8ac2 | `.claude/rules/backend.md` invariants |

## Rounds

**r1 — SHIP-WITH-FIXES (both commits).**
- MAJOR (parse): a long vertical margin stamp could win the character-weighted direction vote on a
  sparse page; the stamp then stayed in the chunks and the body became off-axis.
  Fix 8a13eabb: only lines outside the band vote.
- MAJOR (demo seed): the automatic re-parse adds a path for a healthy demo doc to reach `error`;
  startup then deleted the row and re-created it under a new uuid (breaks `/d/<id>`, drops
  sessions). Fix 8a13eabb: an errored demo row is re-parsed in place (`_reparse_in_place`).

**r2 — SHIP-WITH-FIXES.** r1 findings CLOSED.
- MAJOR: a page with no text outside the band fell back to left-to-right, emptying a tategaki page
  whose only lines sit in the band. Fix f6cc00d4: fallback = the document's interior vote, else
  every line's vote.
- MINOR: OCR can lose a stamp's direction. Fix f6cc00d4: an arXiv-ID line wholly in the band is
  dropped; an in-body arXiv reference stays.

**r3 — SHIP-WITH-FIXES.** r2 MINOR CLOSED; r2 MAJOR open for a mixed document (horizontal page 1,
tategaki page 2 entirely in the band). Codex suggested a line-count heuristic; that would also keep
two-line licence stamps (stamp + hash). Fix 41e27a16: PyMuPDF `wmode=1` (a vertical CMap, verified
on a hand-built PDF) marks real vertical writing; such lines always vote and are never dropped.

**r4 — SHIP.** r3 MAJOR CLOSED. Residual MINOR, judged not realistic enough to block: vertical text
typeset with `wmode=0` that lies wholly in the band of a mixed-orientation document is still dropped.

## Evidence

- Old vs new parser over 53 local PDFs (owner's research corpus plus the 3 seed PDFs): 19 change.
  Dropped margin text: the arXiv stamp, broker licence stamps ("For the exclusive use of …"), hex
  watermark hashes, a WeChat watermark, and rotated chart tick labels inside the outer band.
  Output identical across r2, r3 and r4 fixes.
- Seed PDF after the fix: no chunk carries the stamp in its title or text; page-1 chunks are titled
  "Attention Is All You Need".
- Tests at 41e27a16: `test_parse_service.py` 29 passed; unit suite 1145 passed / 138 skipped;
  integration suite (local Docker, `SKIP_INTEGRATION=0`) 138 passed. Mutation checks: regex guard,
  rotation swap, `wmode` rule, claim status predicate, presence check and commit-before-delay order
  each fail at least one test when removed.

## Out of scope (flagged)

- The all-caps heading rule still turns table cells into section titles (`)V`, `O(1)`, `300K`,
  `WSJ 23 F1`) on pages 4–12 of the attention paper.
- `seed_demo_documents`' vector-loss branch deletes the row, then reaches the final `else` and skips
  re-creation until the next startup, which creates it under a new uuid.
