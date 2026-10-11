# Adversarial review r1 — citation `text_snippet` without the section-title prefix

You are reviewing a small change in the DocTalk repo (FastAPI backend + Next.js frontend). Read
`CLAUDE.md`, `.claude/rules/backend.md` and `.claude/rules/frontend.md` first. Review the diff of the branch
against `main` (`git diff main...HEAD`), not the whole repo. Be adversarial: look for regressions, not style.

## Owner decision (2026-10-11)

Citation `text_snippet` must be the chunk's own text, never `"{section_title}: " + chunk.text`. The shared
answer page and exports print the snippet inside quotation marks, and the reader's TextViewer searches the
page text for it, so the prefix misquotes the source and stops the match.

## What changed

1. `backend/app/services/chat_service.py` `_citation_payload`: `text_snippet = chunk.text[:100]`. New
   field `section_title` (only when the chunk has one and is not a map-reduce summary).
2. `backend/app/services/claim_verifier_service.py` `_citation_context`: also reads `section_title`, so the
   verifier's evidence (lexical overlap + numeric subset check) is unchanged from when the prefix was inside
   `text_snippet`.
3. `backend/app/api/documents.py` `_brief_ref_payload`: `text_snippet = chunk.text[:180]`.
4. `backend/app/services/extraction_service.py` `_citation_from_chunk` (used by extraction, document diff and
   question templates): `text_snippet = chunk.text[:140]`.
5. `frontend/src/lib/snippetMatch.ts` (new; moved out of `TextViewer.tsx`): `findSnippetInPage` keeps its
   old behaviour and adds a legacy fallback: if the snippet does not match, retry with the text after each
   `": "` within the first 200 characters, then after `" — "`; a fallback candidate needs ≥30 characters.
   Stored citations (chat history, saved job results, shared snapshots) still carry the prefix.
6. `frontend/src/store/index.ts` `navigateToCitation`: no `highlightSnippet` for `retrievalModality ===
   'summary'` (that snippet is internal coverage text, which the old prefix happened to keep unmatched).
7. Tests: `backend/tests/test_citation_snippet_shape.py` (new), `test_extraction_service.py` (assertion),
   `frontend/tests/snippet-match.test.cjs` (new), `frontend/tests/citation-state.test.cjs` (summary case).

A Claude subagent already reviewed this (`review-r1-claude-subagent.md`); its two SHOULD-FIX findings are
fixed. Do not just re-check those: look for what it missed.

## Questions to answer, each with file:line evidence

1. Is there any other place that builds a citation/snippet with the section title in front (grep widely:
   `section_title`, `": "`, f-strings, `.join`)? Any place that relies on the snippet starting with the title
   (dedup keys, `citationSourceKey`, tests, exports, sharing digests)?
2. Claim verifier parity: can a citation now produce a different verdict than before for the same chunk and
   answer? Consider table chunks (`section_title` = first line of table context), summary chunks, persisted
   citations replayed on continuation/regenerate, and the `context_text` truncation at 900 chars.
3. Does adding `section_title` to the persisted citation JSON break anything: the shared-answer snapshot
   digest (`backend/app/api/sharing.py`), export, `ChatRequest`/message schemas, frontend `mapCitationPayload`
   / `sse.ts`, size limits?
4. Legacy fallback false positives: construct inputs where the `": "` fallback highlights the WRONG passage
   (or a passage outside the cited chunk) when the old matcher returned null. Is the risk larger than the
   existing prefix-shortening loop already carries? Is 200 the right bound?
5. Is the converted-PDF path (`frontend/src/components/PdfViewer/PageWithHighlights.tsx:66`) affected?
6. Anything in the backend rules (credits/settlement, verified-quote pipeline) touched indirectly?

Output: numbered findings, each tagged BLOCKER / SHOULD-FIX / NIT / OK, with evidence. End with a one-line
verdict: "approve", "approve with fixes", or "block".
