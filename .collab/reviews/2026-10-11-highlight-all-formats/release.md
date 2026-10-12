# Citation highlighting in every text format: release record (2026-10-12)

**Result:** released to production as stable `8927e588` (frontend only). Owner sign-off 2026-10-12 ("签字，发布").

## What ships
- Inline evidence marks (`<mark data-dt-evidence="exact|region">`) for Markdown, DOCX and PPTX text view, XLSX, URL articles and TXT. The status line names the marks that rendered (`lib/evidenceStatus.ts`).
- DOCX opens in the text view by default; PPTX keeps the slide view (owner decision 2026-10-11).
- TXT moved from the text_snippet prefix match onto the evidence path, rendered as plain text (owner decision 2026-10-11). The prefix match remains only for PDFs whose stored file is missing.
- Plan: `.collab/plans/2026-10-11-citation-highlight-all-formats.md`. Rules: `.claude/rules/frontend.md` (PDF & Documents, strategy ④).

## Review and acceptance
| Gate | Result | Record |
|---|---|---|
| Codex r1 | SHIP-WITH-FIXES (4) | `codex-r1.md` |
| Codex r2 | SHIP-WITH-FIXES (3) | `codex-r2.md` |
| Codex r3 | SHIP | `codex-r3.md` |
| Codex r4 (P2 fixes, TXT, DOCX view) | SHIP-WITH-FIXES (3) | `codex-r4.md` |
| Codex r5 | SHIP | `codex-r5.md` |
| Browser acceptance r1 (c3b65d73) | 0 wrong marks; P2-1..P2-5 found | `../2026-10-11-highlight-golden/report.md` |
| Browser acceptance r2 (3df77e01) | 0 wrong, 0/284 frames over-labelled; c/d/f blocked by a local disk-full incident | `../2026-10-11-highlight-golden/report-r2.md` |
| Browser acceptance r2b (8927e588) | 66 jumps, 488 marks, 0 wrong; 0/331 frames over-labelled; QF cards, deep-link scroll, pending-jump guard pass | same file, "Round 2b" |
| Release checks (8927e588) | test:unit 350/350, lint, build | — |

Not verified in a browser: the DOCX default view (the toggle needs a converted PDF, and the local stack has no LibreOffice); covered by `tests/reader-default-view.test.cjs` and checked on production after release. Slide view untested.

## Branches and SHAs
- Development: `feat/highlight-all-formats-r1` (`427501d6..56a1d73e`, from main). Codex and acceptance records cite these SHAs.
- Release: `release/highlight-all-formats-2` = origin/stable `d3b2b7ef` + the same 27 commits cherry-picked (patch-ids equal), tip `8927e588`. Main merges the release branch, so stable stays an ancestor of main.
- backend/app, version.json, infra: no change. backend/ gains `scripts/make_highlight_fixtures.py` and `tests/test_extractors_office.py` only.

| Development | Release | Subject |
|---|---|---|
| 8ddf01ec | fbc53e76 | Highlight step 0: chunk passage from context_text, synthetic boxes off the PDF path |
| 607ac218 | 04d3dc41 | Highlight: locate cited chunks in non-PDF page text (textEvidence) |
| dfccadf4 | 78899228 | Highlight: rehypeMarkRanges plugin marks source ranges in rendered Markdown |
| e559d2d6 | 25260131 | Highlight: inline citation evidence in the Markdown text view |
| 936ff0df | 062c2a2a | Highlight tests: pin the non-PDF extractor and chunker shapes |
| e7e4243d | d12cb4f1 | Highlight: mark code blocks; move the anchor when its range renders nothing |
| 4e75dce0 | c0013cb0 | Highlight: locate page ends before glued titles; require chunk coverage |
| 43746e4c | 73045e6b | Highlight: trust converted DOCX/PPTX text only when unique in the document |
| 5dadeb2a | 15d66008 | Docs: non-PDF citation highlighting (strategy 4) and the DOCX slide-view caveat |
| 8e159463 | 22891987 | Docs: state that the coverage evidence comes from fixture corpora |
| 4f55db29 | d76e9424 | Highlight: check uniqueness over the whole document, mark only the cited pages |
| a3f597f3 | 515378a4 | Highlight: drop a glued title only when it is the page's verified title |
| 42c8856c | b6eb6109 | Highlight: a focus without a chunk region needs real boundaries in CJK/Thai |
| 0848d07c | 286e0416 | Highlight: an unalignable range renders no mark, never its whole text node |
| 8a7260ad | 839e93f8 | Highlight: a lone focus needs a non-letter at each lettered edge, any script |
| 675c434f | 80423660 | Highlight: guard reference and escape cuts on both mapping paths |
| b8cb923f | d6327b7a | Highlight: URL article status names the marks the article view renders |
| c3b65d73 | be58ee84 | Highlight: the text-view status names the marks that rendered |
| 8049749a | 2bc84284 | Highlight: a title bracketed by two pages' text is dropped, not refused |
| 78a135f6 | c37521b0 | Highlight: a chunk with no known page range is searched in the whole document |
| a94d0bc6 | 492de1ac | Highlight: a verified quote the region does not hold is exact on its own |
| a40bdedc | 911149d7 | Reader: a DOCX opens in the text view |
| 2618f494 | 0ad3ad45 | Highlight: a text-view jump scrolls only once every page body has mounted |
| e3488cde | 3df77e01 | Highlight: TXT takes the evidence path, rendered as plain text |
| 1ccd82c6 | be7bdd4f | Highlight: a whole page is never dropped as a page end or a glued title |
| 1a3fb451 | 67cf5ec7 | Highlight: a focus beside the region must be the chunk's own occurrence |
| 56a1d73e | 8927e588 | Highlight: a pending text-view jump belongs to its document and citation |
