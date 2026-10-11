<!-- Fable 5.1 plan, 2026-10-11. Owner decision 2026-10-11: "先改文案，再补功能" (restrict highlight copy to PDF/TXT now; build highlighting for MD/DOCX/PPTX/XLSX/URL, then widen the copy). -->

# Plan: highlight the cited passage for every input format

All paths below are under `/Users/mayijie/Projects/Code/010_DocTalk/.claude/worktrees/website-seo-audit-0bec36/`.

## Conclusion

Ship **frontend-only**. Two defects explain most of F21 and are step 0 for any strategy:

1. **Snippet shape mismatch.** `backend/app/services/chat_service.py:277` has emitted `text_snippet = "{section_title}: " + chunk.text` since f2ee5e6b (2026-02-07); `frontend/src/components/TextViewer/TextViewer.tsx:97` strips ` — `, a separator the backend never produced. Where the synthetic title block is classified as a heading, the snippet starts with `Title: ` and the first `indexOf` fails. Where it is not (`parse_service.py:765`: the 18pt title beats the median only when titled pages are a strict minority, so XLSX and URL never qualify), `section_title` is `None` and the title is **prepended into chunk text**, which the page text lacks — the match fails the same way. Either shape means no caption, only a page scroll (the F21 "caption" sighting may have been the sticky page header at `TextViewer.tsx:380`).
2. **Synthetic bboxes are slivers, not full-page.** `backend/app/workers/parse_worker.py:502` passes `(0.0, 0.1, 1.0, 1.0)` in points into `_normalize_bbox` (`parse_service.py:964`) with 612×792 → ≈`{x:0, y:0.00013, w:0.0016, h:0.0011}`. `validEvidenceBox` (`frontend/src/lib/pdfEvidence.ts:8`) accepts it; the dummy test `w===1&&h===1` at `frontend/src/components/PDFViewer/PageWithHighlights.tsx:66` never fires, so strategy ③ is dead and the sliver "region" gates out exact matches via `evidenceOverlap`. DOCX/PPTX default to this slide view (`DocumentReaderPageClient.tsx:50,175`). Derived from code, not from a stored row.

Then build inline highlighting as a **rehype plugin keyed on source offsets of the page's raw markdown**, reuse the PDF evidence vocabulary (`evidence.exact|region|page`), and keep the caption whenever no unique match exists.

## 1. Current paths

- **Parse.** `backend/app/services/extractors/base.py:18` routes docx/pptx/xlsx/txt/md; URL HTML via `url_extractor.py:422` (heading blocks stay in page text, `:370-407`). Each `ExtractedPage` → one 18pt title block + one 12pt body block (`parse_worker.py:486-512`); `Page.content` = raw extracted markdown (`:483,667`); chunks via shared `chunk_document` (`parse_service.py:456`), text = `_normalize_inline_text` + sentence split/rejoin (`:912-953, :794`) — same markdown, whitespace-drifted. DOCX/PPTX also get a LibreOffice PDF (`parse_worker.py:639`, `conversion_service.py:21`).
- **Citation payload.** `_citation_payload` (`chat_service.py:270-310`): `chunk_id`, `text_snippet` (100 chars), `focus_snippet` (`citation_focus_service.py:69`), `page/page_end/bboxes` via `citation_location.py:10` (may narrow to one page), `context_text = "[page N] " + chunk.text[:900]`. SSE → `frontend/src/lib/sse.ts:84-100`; restore → `mapCitationPayload` (`frontend/src/lib/api.ts:70`, keeps `context_text`). Click: `ChatPanel.tsx:80` → `handleCitationClick` (`DocumentReaderPageClient.tsx:452`) → `navigateToCitation` (`frontend/src/store/index.ts:204`): `highlightSnippet=textSnippet`, `highlightFocus=focusSnippet`.
- **Render.** PDF: `PdfViewer` → `PageWithHighlights` (bbox regions + text-layer `findEvidenceRange`, status `.dt-evidence-status`, `PdfViewer.tsx:489`). MD/XLSX/URL/missing-file → `TextViewer`: TXT `PlainTextContent` span (`:594`); markdown `MarkdownContent` caption only (`:748`); `highlightFocus` not passed (`:405,438`). Quote Finder jump: `frontend/src/components/Quotes/utils.ts:15` sets `focusSnippet=displayText`, chunk bboxes, "approximate" label (`:90`).

## 2. Options

| | Accuracy on real content | Cost | PDF/TXT risk | RTL/CJK | Perf | A11y |
|---|---|---|---|---|---|---|
| **A. Rehype plugin, source-offset marks (recommended)** | Exact: chunk text and `Page.content` are the same markdown (table pipes, `# `, `**Speaker Notes:**`); cells map via hast `position` (verified: `mdast-util-to-hast/lib/state.js:337` copies position; react-markdown 10.1 runs `rehypePlugins` before `toJsxRuntime`, `lib/index.js:272,348`) | ~400 LOC + tests | None if `pdfEvidence.ts` only gains an `export` | `<mark>` inside `dir="auto"`; CJK needs boundary exemption | Cited page only; must memoize (react-markdown re-parses each render; TextViewer is un-virtualized) | Real `<mark>`, `role="status"`, reduced-motion scroll |
| B. Post-render DOM ranges + CSS Custom Highlight API | Needle needs markdown syntax stripped (lossy for tables); wrapping fights React | Similar | None | OK | Reflow per render | Not in a11y tree; Firefox <140 none |
| C. Server char offsets per chunk | Migration + reparse of all docs; legacy still needs client matching | Backend-first deploy | Low | — | — | — |
| D. Convert XLSX/MD/URL to PDF too | Loses notes/structure; no LibreOffice in CI | High | — | — | — | — |

## 3. Tasks (Opus implementer)

1. **Step 0.** In `navigateToCitation` (`store/index.ts:204`) derive `highlightSnippet` from `contextText` minus `^\[page \d+(–\d+)?\] ` when present, else `textSnippet` with a `^<section_title>: ` strip (fall back to first `": "`); keep ` — `. Pass `highlightFocus` and `citation` into `TextViewer` (reader `:405,438`). Add `syntheticBoxes` prop to `PdfViewer`/`PageWithHighlights`, set when `fileType !== 'pdf'`: `highlights=[]`, candidate = focus ?? snippet. PDF path byte-identical; `tests/pdf-evidence.test.cjs`, `pdf-navigation.test.cjs`, `citation-state.test.cjs` (add a strip case) stay green.
2. **`frontend/src/lib/textEvidence.ts` (new).** `export` `canonicalize` in place in `pdfEvidence.ts` (one word; do not move it — `pdf-evidence.test.cjs` transpiles that single file and cannot resolve a `.ts` import). `locateTextEvidence(pages, citation, chunkText) → {kind, ranges:[{page,start,end,emphasis}]}`: sentence-split chunk text (port of `_split_into_sentences`), locate each uniquely in canonical page text over `[page..pageEnd]`; mark **each located sentence** as its own range (never bridge across an unlocated one); region requires ≥2 located sentences or ≥40 canonical chars; first sentence may drop leading tokens (title prefix); focus → `emphasis` only if unique within the located ranges (or page when none). Ambiguous/short → no range. Exempt Han/Kana/Thai neighbours from the letter-boundary rule. Chunk text: `contextText`; `getChunkDetail` (`api.ts`) only if ≥900 chars or missing, cached `Map<chunkId,Promise>`; saved-quote fake ids 404 → focus only.
3. **`rehypeMarkRanges` plugin** (`unist-util-visit`; add it to `package.json` explicitly). Per text node with `position`: `value.length === end−start` → slice exactly; else canonical-search the range text in `value`; else wrap whole node as region. Emit `<mark data-dt-evidence="region|exact" data-dt-evidence-anchor>`. `React.memo(MarkdownContent)`, stable empty plugin array for other pages, `useMemo` per ranges.
4. **Scroll/UI.** Marks render inside `<Suspense>` (`TextViewer.tsx:755`); the rAF scroll at `:255` runs before they exist. Signal mount (callback ref on the anchor keyed by `scrollNonce`) and scroll then; page-start stays the immediate fallback. Replace the caption with a `.dt-evidence-status` line (`role="status"`, `evidence.exact|region|page`; keys exist in en, spot-checked zh/ar) so the mobile focus hook (reader `:461`) works; caption remains for `page`. `globals.css` styles on `--highlight-*` tokens, `motion-reduce` transitions.
5. **Tests.** `tests/text-evidence.test.cjs` with a shared `tests/_load-ts.cjs` require hook (`Module._extensions['.ts']` + `transpileModule`): pipes, `# ` heading, title drop, escapes/entities, repeated passage → null, CJK, Arabic, whitespace drift, narrowed page. `tests/text-viewer-highlight.test.cjs`: `await import()` unified/remark-parse/remark-gfm/remark-rehype (ESM-only), run plugin, assert marks in a GFM cell. Structural: reader passes `highlightFocus`; `syntheticBoxes` gated on fileType. Backend: `tests/test_extractors_office.py` generating DOCX (heading+table), PPTX (title+notes+table), XLSX (2 sheets) with python-docx/pptx/openpyxl (in `backend/requirements.txt`, not in local python; commit no binaries); `backend/scripts/make_highlight_fixtures.py` writes the same files for manual runs. MD: `docs/ARCHITECTURE.md`; TXT: any; PDF: `backend/seed_data/`; URL: Wikipedia — **requires `fix/url-import-root-classes` (da2617e), not in main** (`merge-base` check); until deployed use a non-Wikipedia article.
6. **Acceptance (5 fixed questions per format, fresh parse).** PDF 5/5 status unchanged; TXT 5/5 unchanged. MD, DOCX text view, XLSX, URL: highlight on the cited passage ≥4/5, zero wrong-passage highlights, status truthful 5/5. DOCX/PPTX slide view: exact ≥3/5 (speaker notes and table rows excluded — not in the LibreOffice text layer; manual only, no LibreOffice in CI); text view ≥4/5. One Arabic and one zh document: no crash, highlight or honest `page`. 375 px, reduced motion, `npm run build`, `npm run test:unit`.
7. **Docs/copy.** Update `.claude/rules/frontend.md` "PDF & Documents" (strategy ④, sliver note), `docs/ARCHITECTURE.md:883`, the I25 comment; widen the 12 `en.json` strings qualified in a700d1b8 plus 10 locales only after acceptance.

## 4. Backend change?

None required; everything needed is on the wire or in `/api/chunks/{id}`. Optional later (backend-first deploy): emit `bboxes: []` for non-PDF chunks; add `page_end` to `chunks.py:59`.

## 5. Gates

No Fable gate: additive, frontend-only, no billing/security surface. Codex: r1 adversarial on false-positive highlights (uniqueness, title drop, escape mapping, CJK boundary); r2 on PDF regression, RTL (`reader-rtl-panels.test.cjs` pins `dir="ltr"` — leave it), a11y, perf; r3 only if r2 blocks.

**Unverified:** stored bbox values (derived, no fitz locally); which "Page N" the F21 tester saw; `evidence.*` keys in the other 8 locales; LibreOffice text-layer fidelity for tables.

### Critical Files for Implementation
- `/Users/mayijie/Projects/Code/010_DocTalk/.claude/worktrees/website-seo-audit-0bec36/frontend/src/components/TextViewer/TextViewer.tsx`
- `/Users/mayijie/Projects/Code/010_DocTalk/.claude/worktrees/website-seo-audit-0bec36/frontend/src/lib/textEvidence.ts` (new)
- `/Users/mayijie/Projects/Code/010_DocTalk/.claude/worktrees/website-seo-audit-0bec36/frontend/src/store/index.ts`
- `/Users/mayijie/Projects/Code/010_DocTalk/.claude/worktrees/website-seo-audit-0bec36/frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx`
- `/Users/mayijie/Projects/Code/010_DocTalk/.claude/worktrees/website-seo-audit-0bec36/frontend/src/components/PDFViewer/PageWithHighlights.tsx`
