# Listicle corrections (2026-10-14)

Source: Fable ruling 2026-10-14, Q1 (`.collab/dialogue/2026-10-14-fable-readout-rulings.md`).
`best-ai-pdf-tools-2026.md` and `chatpdf-alternatives-2026.md` were frozen until the 11-07 read; Fable
unfroze them for fact corrections only. `best-ai-tools-academic-research-2026.md` and
`ai-pdf-readers-page-number-citations-2026.md` stay frozen and are not touched.

## What changed

Every row of `.collab/reviews/2026-10-10-step5-page-citations/vendor-evidence.md` §3 for the two files,
plus `.collab/reviews/2026-10-12-highlight-claims-all-formats/claims.md` §D Q1/Q2:

- AskYourPDF: Word and URL = Yes, PowerPoint = — (the chat page lists none), Chrome extension / Zotero
  plugin and click-to-check page citations are vendor-sourced (footnote ¹ dropped there).
- PDF.ai: PDF only and "with cited sources", from its FAQ (¹ dropped).
- Humata: "Highlights citations" quoted, with no claim about what or where.
- Gemini Notebook: selecting a citation jumps to the quote.
- ChatDOC: page numbers that jump to the source; the free limits cite the homepage table (10 October 2026)
  and say that ChatDOC's guide and FAQ give 2 files per 24 hours and 20 pages.
- DocTalk: "exact passage" → "cited passage" next to the highlight verb (§D Q1, Q2).
- The check-date sentences name the 10 October recheck; `updated: "2026-10-14"`.

Unchanged per the ruling: title, frontmatter description, headings, tool order, Short answer, Verdict.
No correction notice; `actions-log.md` is the record.

## Executor decisions (Codex agreed)

- chatpdf-alternatives lines 25 and 190 are the equivalents of best-ai-pdf-tools lines 34 and 171; the
  same second-check-date rule was applied there.
- Footnote ¹ stays on the three Humata format cells: no Humata vendor page states formats (§2.10).
- "Exact passage / page" in the Short answer and Verdict (best-ai-pdf-tools :14, :216; chatpdf-alternatives
  :14, :216) and in :29 / :199 is not edited: the ruling locks Short answer and Verdict, claims.md rule 3
  applies to changed sentences, and Codex found none false enough to override the lock.
- The executor reopened every vendor page quoted here on 2026-10-14; all quotes were still present.

## Reviews

- Codex r1 (gpt-5.5): SHIP-WITH-FIXES, two SHOULD, both applied: the Humata table cell now quotes
  "Highlights citations" (unspecified); the ChatDOC free-tier cell and the free-tier FAQ answer carry the
  vendor's own contradiction.
- Codex r2: **SHIP**, no findings.

## Checks

- `npm run test:unit` 363/363, `npm run build` 426/426 (before the r1 fixes; the fixes are text only and
  were re-tested with `test:unit`).
