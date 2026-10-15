# Codex adversarial review r1 — citation `text_snippet` without the section-title prefix (2026-10-15)

You are reviewing a branch of DocTalk (FastAPI backend + Next.js 14 frontend). Repo root is the working directory.
Codex cannot run git, so the full diff against `origin/main` (f987d67a) is pasted below (records under `.collab/` excluded; read them from disk if you need them).

## What the change does

Owner decision 2026-10-11: a citation's `text_snippet` is the cited chunk's own text, never `"{section_title}: " + chunk.text`.
The shared-answer page (`frontend/src/app/shared/[token]/page.tsx`), `ShareAnswerDialog.tsx`, `frontend/src/lib/export.ts` and backend `export_service._format_footnote` print `text_snippet` inside quotation marks, so the prefix misquoted the source in production.

- `chat_service._citation_payload` (100 chars), `documents._brief_ref_payload` (180), `extraction_service._citation_from_chunk` (140; extraction, document diff, question templates) emit chunk text only.
- The chat payload carries `section_title` as its own field for text chunks only (not summary hits, not table hits), and `claim_verifier_service._citation_context` reads it.
- `findSnippetInPage` moves from `TextViewer.tsx` to `frontend/src/lib/snippetMatch.ts`, with a legacy retry after each `": "` in the first 200 chars (fallback needs >= 30 chars) for citations stored before this release.
- The store no longer sets `highlightSnippet` for summary citations.

Design and impact analysis (Fable plan): `.collab/reviews/2026-10-11-citation-snippet-prefix/fable-plan-2026-10-15.md`. Read its sections 3 and 5 first.
Highlight strategies are described in `.claude/rules/frontend.md` ("PDF & Documents"): (1) native PDF bbox, (2) TextViewer snippet match (missing-file PDFs only), (3) converted DOCX/PPTX text-layer match with a uniqueness gate (`lib/convertedEvidence.ts`), (4) inline evidence marks via `lib/textEvidence.ts`.

## Attack these points. For each give BLOCKER / SHOULD-FIX / NIT / OK with file:line evidence.

1. Rebased `TextViewer.tsx` vs main: is `findSnippetInPage` reachable from any evidence format (TXT, MD, URL, XLSX, DOCX/PPTX text view) after the move? Is the `usesEvidence` guard intact and the call site unchanged?
2. Strategy (3) Brief path: `_brief_ref_payload` (180 chars, no `context_text`) -> `citationPassage` -> `uniqueInPageRange` + `findEvidenceRange`. Construct a converted DOCX/PPTX where 180 chars of chunk text occur once in the document but on a LibreOffice page outside the cited extractor range, or where whitespace squeezing lets the uniqueness gate pass on a mid-word cut. Can either produce a drawn box (a wrong mark), or only "Page location only"?
3. Strategy (1): confirm no backend path emits a `(0,0,1,1)` box (`citation_location.py`, `parse_service._normalize_bbox`, extraction, Brief), so the native-PDF snippet branch in `PageWithHighlights.tsx` stays unreachable.
4. Legacy fallback in (2): can a >= 30-char tail after `": "` land on a repeated line in a missing-file PDF's chunk-fallback page text (`get_document_text_content` chunk mode) and highlight the wrong passage? Is 200 the right bound? Should the fallback be dropped?
5. `section_title` field: table citations (`retrieval_service.py` ~192, `chat_service._chunk_info_from_persisted_citation`), any other `_ChunkInfo` source whose `section_title` is a label rather than a heading; prompt-injection posture if the frontend later renders it.
6. Claim verifier parity: table, summary, continuation (`_chunk_info_from_persisted_citation`) and the 900-char `context_text` cut. Where can a verdict flip, and can `_try_repair_rag_answer` (billed) be triggered more often than before?
7. Persisted JSONB and schemas: `messages.citations` JSONB; `PublicAnswerCitation` whitelist; `DocumentBriefSourceRef`; export field lists (`export_service.py`); frontend `mapCitationPayload` / `sse.ts` — does anything reject or leak the new key?
8. Mixed old/new citations in one continued session: `citationSourceKey`, `uniqueCitationIndexes`, export dedup, `insertCitationMarkers` — any duplicated or lost marker, not just a duplicated reference?
9. Compatibility during the backend-first deploy window (old frontend + new backend) and the reverse (Vercel preview frontend + production backend).
10. Docs and copy: any remaining sentence in `.claude/rules/*.md`, `docs/ARCHITECTURE.md`, `frontend/src/**` comments or locale files that still describes the prefix as current.
11. Summary citations' `text_snippet` is internal coverage text on the shared page and exports (pre-existing). Is this release the place to blank it?
12. Anything else you find: tests that do not test what they claim, regressions, missing tests.

End with one line: `VERDICT: SHIP`, `VERDICT: SHIP-WITH-FIXES` (list them) or `VERDICT: BLOCK` (list blockers).
Do not edit files.

## Diff (`git diff origin/main...HEAD -- . ':!.collab'`)

```diff
diff --git a/.claude/rules/backend.md b/.claude/rules/backend.md
index 16433d74..9fb43167 100644
--- a/.claude/rules/backend.md
+++ b/.claude/rules/backend.md
@@ -44,7 +44,7 @@ paths:
 - **OCR trigger = `detect_scanned` (no text layer) OR `detect_low_quality_text` (PDF text layer present but garbled — broken-font cmap, Unicode-aware quality score)**. R2b fix for docs like U13 that have garbage text and so were never detected as "scanned".
 - **OCR language is content-based**: `detect_script_osd` runs `tesseract --psm 0` (OSD) on sample pages → `resolve_ocr_languages(locale, script)` returns a NARROW set (script family, ≤3, **no `eng` for non-Latin** — it injects Latin noise). Never the kitchen-sink set (causes cross-script hallucination); locale only refines within a script family. Adopt a low-quality re-OCR only if it beats the text-layer quality. Persist `parse_version`/`parse_method`/`text_quality`/`ocr_languages` on the doc.
 - **Margin artifacts (parse v3, 2026-10-10)**: `clean_text_blocks` drops a line wholly inside the outer 10% band when it is off-axis to the page's direction or starts with an arXiv identifier (the vertical arXiv stamp, broker licence stamps, watermark hashes); other off-axis text stays content but is never a heading. The direction vote counts only lines outside the band (a long stamp must not outvote a sparse body), falls back to the document's own vote, and always counts PyMuPDF `wmode=1` lines. **Never drop `vertical_writing` (wmode=1) lines**: that is real tategaki, not a rotated stamp. Before this, the stamp was the section title of every chunk of every arXiv paper and prefixed every citation snippet.
-- **Heading rules (parse v4, 2026-10-11)**: heading lines become `section_title` and are REMOVED from chunk text, so a false heading costs both the snippet prefix and retrievable content. An all-caps line needs ≥4 letters, every one a capital — ordinal indicators `ª`/`º` and modifier letters aside (`Nº`; `str.islower()` is true for `º`) — (`O(1)`, `<EOS>`, `100K`, `TTM` are tokens; `str.isupper()` is true for a Chinese line with a Latin acronym, so v3 took 440 such lines in 15 local test PDFs, mostly Chinese body text, out of chunk text — caseless scripts reach headings only through the size rule or a section number), and must not sit in a table row: ≥2 other lines on its row, or 1 in the same half of the page; a row neighbour is at most 3× the line's height (one line in the other half is the opposite column of a two-column page — never reject on one neighbour alone). A numbered line (`3 Model Architecture`, 1–2 digits per level, ≤12 words, title starts with an uppercase or caseless letter — ≥3 letters cased, ≥2 caseless (`2 引言`) — no trailing sentence punctuation, not a date) is a heading at ≥1.1× the median size, unless the line above or below continues it as a same-size paragraph or list (a depressed median lets body list items pass 1.1×; this includes `1 Parent item` over `1.1 Child item` — never exempt different-depth numbers, since a real heading over its subheading has section spacing of more than one font size, which the run test already allows) or it labels a table row (here a lone other-half neighbour narrower than 30% of the page also counts as a cell when it holds a figure — a digit and ≤4 letters, `$100m` — or shares the line's font size; a short text line in the opposite column, `therefore.`, is body text smaller than the heading). LaTeX sets the number as a separate line on the title's baseline, so `_attach_section_numbers` joins the pair first, and only when the joined line passes those same checks against the original lines. Row lookups go through a per-page index (`_PageRows`) with a scan window of 3× the candidate's own height — never a full page scan per candidate, and never a window sized by the page's tallest line (one 1,600pt line made every lookup quadratic). The 1.25× size rule is unchanged and still misfires when chart/table lines pull the line-count median below the body size (broker reports: 40–80% of text classified as headings). The owner chose a separate follow-up design for it (2026-10-11); do not patch it inside these rules.
+- **Heading rules (parse v4, 2026-10-11)**: heading lines become `section_title` and are REMOVED from chunk text, so a false heading costs both the citation's section label and retrievable content. An all-caps line needs ≥4 letters, every one a capital — ordinal indicators `ª`/`º` and modifier letters aside (`Nº`; `str.islower()` is true for `º`) — (`O(1)`, `<EOS>`, `100K`, `TTM` are tokens; `str.isupper()` is true for a Chinese line with a Latin acronym, so v3 took 440 such lines in 15 local test PDFs, mostly Chinese body text, out of chunk text — caseless scripts reach headings only through the size rule or a section number), and must not sit in a table row: ≥2 other lines on its row, or 1 in the same half of the page; a row neighbour is at most 3× the line's height (one line in the other half is the opposite column of a two-column page — never reject on one neighbour alone). A numbered line (`3 Model Architecture`, 1–2 digits per level, ≤12 words, title starts with an uppercase or caseless letter — ≥3 letters cased, ≥2 caseless (`2 引言`) — no trailing sentence punctuation, not a date) is a heading at ≥1.1× the median size, unless the line above or below continues it as a same-size paragraph or list (a depressed median lets body list items pass 1.1×; this includes `1 Parent item` over `1.1 Child item` — never exempt different-depth numbers, since a real heading over its subheading has section spacing of more than one font size, which the run test already allows) or it labels a table row (here a lone other-half neighbour narrower than 30% of the page also counts as a cell when it holds a figure — a digit and ≤4 letters, `$100m` — or shares the line's font size; a short text line in the opposite column, `therefore.`, is body text smaller than the heading). LaTeX sets the number as a separate line on the title's baseline, so `_attach_section_numbers` joins the pair first, and only when the joined line passes those same checks against the original lines. Row lookups go through a per-page index (`_PageRows`) with a scan window of 3× the candidate's own height — never a full page scan per candidate, and never a window sized by the page's tallest line (one 1,600pt line made every lookup quadratic). The 1.25× size rule is unchanged and still misfires when chart/table lines pull the line-count median below the body size (broker reports: 40–80% of text classified as headings). The owner chose a separate follow-up design for it (2026-10-11); do not patch it inside these rules.
 - Backfill stale/low-quality docs with `scripts/find_low_quality_docs.py` (skips `parse_version>=current` unless `--force`; always skips documents whose original file is missing, `--force` included).
 
 ## Verified Quote Pipeline (M2, v0.24.0 — Codex 6-round consensus; do not weaken)
diff --git a/.claude/rules/frontend.md b/.claude/rules/frontend.md
index 0ca49f9d..d1a9e49a 100644
--- a/.claude/rules/frontend.md
+++ b/.claude/rules/frontend.md
@@ -76,7 +76,8 @@ from `LOCALIZED_PATHS`. The fixes are structural, not one-off.
 
 ## PDF & Documents
 - **react-pdf v9 CJK**: After upgrading react-pdf/pdfjs-dist, MUST re-copy `cmaps/`, `standard_fonts/`, `pdf.worker.min.mjs` to `public/`. Worker loaded from same-origin (not CDN) for CSP compliance
-- **bbox coordinates**: Normalized [0,1], top-left origin. Four citation highlight strategies: ① PDF bbox, ② TextViewer text-snippet prefix match (missing-file PDFs only), ③ converted DOCX/PPTX PDF: text-layer match of the focus sentence or the chunk passage, ④ inline evidence marks for MD, DOCX/PPTX text view, XLSX and URL (Markdown) and TXT (plain text; owner decision 2026-10-11) (below). Quote cards reuse the citation jump with chunk-level bboxes and an explicit "highlight location is approximate" label (plan §8.2).
+- **bbox coordinates**: Normalized [0,1], top-left origin. Four citation highlight strategies: ① PDF bbox, ② TextViewer text-snippet match (missing-file PDFs only; `lib/snippetMatch.ts`), ③ converted DOCX/PPTX PDF: text-layer match of the focus sentence or the chunk passage, ④ inline evidence marks for MD, DOCX/PPTX text view, XLSX and URL (Markdown) and TXT (plain text; owner decision 2026-10-11) (below). Quote cards reuse the citation jump with chunk-level bboxes and an explicit "highlight location is approximate" label (plan §8.2).
+- **Citation `text_snippet` is the chunk's own text (owner decision 2026-10-11; 0.36.2)**: never `"{section_title}: " + text` — the shared-answer page, `ShareAnswerDialog`, `lib/export.ts` and the backend exports quote it in quotation marks. Chat (100 chars), Brief source refs (180) and `_citation_from_chunk` (140: extraction, document diff, question templates) all emit chunk text only. The chat payload carries `section_title` as its own field for text chunks only: summary hits ("Map-reduce section summary") and table hits ("Table p.N #k", already in `table_context`) carry an internal label there, not a heading; `claim_verifier_service._citation_context` reads the field, so a heading's words and numbers still count as evidence. Nothing renders `section_title` in the UI yet. Who reads `textSnippet`: ② searches the page for it; ③ gets `citationPassage(...)`, which falls back to it only for citations without `context_text` (Brief refs), still behind the converted uniqueness gate; ④ uses it only when the chunk fetch fails and there is no `context_text`; ① reads `highlightSnippet` only for a `(0,0,1,1)` dummy box, which no backend path emits. Citations stored before the release keep the prefix (chat history, saved extraction/template/diff results), so `lib/snippetMatch.ts` retries after each `": "` in the first 200 characters (extractors cap titles at 200) only when the whole snippet misses, and any fallback needs ≥30 characters (a shorter tail lands on unrelated lines). Summary citations (`retrievalModality === 'summary'`) never set `highlightSnippet`: their snippet is coverage text, not page text.
 - **Non-PDF boxes are slivers, never draw them**: the parse worker gives non-PDF blocks a bbox in points (`(0, 0.1, 1, 1)`), which `_normalize_bbox` turns into a ~0.0016 × 0.0011 box against 612 × 792 (pinned in `backend/tests/test_extractors_office.py`). The converted viewer therefore passes `syntheticBoxes` to `PdfViewer`/`PageWithHighlights`: no boxes, and the candidate is focus, else the chunk passage (`citationPassage`: `context_text` minus its `[page N] ` prefix, cut fragment dropped). The store's `highlightSnippet` and the native PDF path are unchanged.
 - **Strategy ④ (2026-10-11, plan `.collab/plans/2026-10-11-citation-highlight-all-formats.md`)**: `lib/textEvidence.ts` `locateTextEvidence` finds the cited chunk in the raw page text (`Page.content` is the extractor's Markdown, chunk text is the same Markdown split into sentences and rejoined). Rules, all conservative: each sentence must be unique (canonical, word-bounded; Han/Kana/Thai exempt) in the whole document, never only on the cited pages (`citation_location` narrows a chunk to one page, and Quote Finder cards, saved quotes and `?highlight=` links carry no `context_text`), and must lie on a page the chunk may sit on (its `context_text` range plus the cited pages, or the whole document when no range is known: Quote Finder cards and `?highlight=` links carry no `context_text`, and `/api/chunks` serves no `page_end`; browser acceptance P2-2); marks stay on the cited pages; located sentences are never bridged and must keep chunk order; a region needs ≥2 pieces or ≥40 characters; the located pieces must cover ≥30% of the chunk (`MIN_CHUNK_COVERAGE`: on generated fixture corpora, not production citations, every chunk located ≥0.65 and the same chunks cited on pages that do not hold them ≤0.07), else `page`. Glued titles (a title block not classed as a heading is glued onto the first sentence, and a page without a final delimiter is glued onto the next page) are split at a page start only when everything in front of it is accounted for: unique ends of the previous pages, the previous page's literal end (a proper end: a page's whole text is never dropped as its end), and the page's verified title (`section_title` from `/text-content`, or the page's first line without `#` marks, which holds PPTX slide titles and URL headings; compared as the chunker rejoins it). DOCX headings, Markdown headings and XLSX sheet names cannot be verified today (not in the page text, and `/text-content` derives `section_title` from `Chunk.section_title`, which is null exactly when the title was glued). Such an unverified title is dropped only when page text brackets it (browser acceptance P2-1, 2026-10-11): it sits right after the located literal end of the page before (in the same piece, or the previous piece was located through that end) and right before the located start of its page, and it is at most `GLUED_TITLE_MAX` (120) canonical characters and not the whole text of any page; a focus never uses this. Any other unverified text in front of a page start, in particular at the chunk start, is never dropped (it may be content that changes the page sentence's meaning: "The court rejected" + the page's claim): the split is refused and a multi-line piece is located line by line. Serving the extractor's page title would let the chunk's first heading verify too. The focus is `exact` only if unique inside the region; a focus the region does not hold (its sentence was not located, as a Quote Finder quote glued to the chunk's first heading) is emphasised beside the region only when it passes the no-region rule in one piece, touches no region span, occurs once in the chunk text, and both the page (whitespace only between) and the chunk (nothing between) put it right next to the same located piece, so a heading that a phrase elsewhere on the page repeats is never marked (Codex r4 #1); with no region (saved quotes, a chunk that is not on the cited page) it must be unique in the document, and where it begins or ends with a letter or digit the page must have a non-letter there, whatever the script on either side (`AI合同…` inside `本AI合同…` is refused), the PDF matcher's boundary rule (the exemption above is safe only inside a located region). `lib/rehypeMarkRanges.ts` maps the raw offsets onto hast text positions and wraps them in flat `<mark data-dt-evidence="region|exact">` (one `data-dt-evidence-anchor`); table pipes and syntax are never marked; a range that starts or ends inside a reference or escape (`&amp;`, `\*`) renders no mark in that node; otherwise a node whose text differs from its source is aligned character by character, else the range is decoded as micromark decodes it (code text, inline or block, is never decoded) and must occur once in the node, else it renders no mark: a node is never marked wider than its range; code-block text maps through its `code` element after the fence line. The URL article view renders each page's leading heading as its own `<h2>` and only the body as Markdown, so URL evidence goes through `lib/articleEvidence.ts` `articleEvidence` before the status is set: a focus touching the stripped heading makes the result `page` (its region is dropped too), and a region is clipped to the body; the status always names what is rendered. Full chunk text comes from `context_text` when it is under 900 code points, else `/api/chunks/{id}` (cached). The status line reuses `evidence.*` keys and names the marks that rendered, not the ranges that were located (`lib/evidenceStatus.ts` `shownEvidenceStatus`: every `EvidenceMark` and every Markdown body reports its mount in a layout effect, so the label is right before paint): an exact mark → `exact`, region marks only → `region`, no mark → `page`, `loading` until react-markdown has mounted; a range can render nothing (raw HTML, a cut reference, an ambiguous alignment). The page caption and the hide button follow the shown status. TXT runs the same locate → marks → status path but renders each page as plain text (`lib/plainEvidence.ts` `plainEvidenceSegments`, `PlainEvidenceContent` in a `<pre dir="auto">`): `#`, `*`, `&amp;` and HTML are characters, the ranges map one to one onto the stored text, and search matches split around the marks; `tests/text-viewer-txt.test.cjs` holds the five browser-run TXT citations (en and ar). A jump (citation click, `?highlight=` link, `?page=N`) is armed at once but scrolls only after every lazy Markdown page body has mounted (`lib/textJump.ts`): bodies mount in different commits, and a scroll measured while the pages above are spinners lands short (browser acceptance P2-3, `next start` only); an anchor mark that mounts first is recorded and scrolled to then, and the reader scrolling first cancels the jump. A pending jump carries its document, click (nonce), page and citation, and scrolls only while the current state would arm the same jump: a document switch, another click, or a citation changed or cleared while the bodies mount drops it, and a state that arms nothing (the new document's own pages not yet loaded, no target) clears it with the pending and recorded anchors (Codex r4 #2). Shapes are pinned in `tests/text-evidence.test.cjs`, `tests/text-viewer-highlight.test.cjs` and `backend/tests/test_extractors_office.py`; `backend/scripts/make_highlight_fixtures.py --json` dumps real extractor/chunker/payload output for new checks.
 - **DOCX slide view opens the wrong page**: a DOCX extractor page is a heading section or a 3,000-character split, but the slide view jumps to page N of the LibreOffice PDF (PPTX is one slide per page; whether LibreOffice skips hidden slides is unverified). `lib/convertedEvidence.ts` keeps a converted-PDF candidate only when it occurs once in the whole converted document, on the cited page(s), so a wrong page shows "Page location only", never a wrong mark. LibreOffice draws a list bullet (•, ●, ▪, – …) as its own pdf.js text item, a glyph the extractor's paragraph text never has. `isListMarkerItem` accepts only an item made of nothing but marker glyphs; both gates use that same rule: the uniqueness index drops such items (PdfViewer keeps each page's items for it; search text is unchanged), and `PageWithHighlights` reads such a span as spaces of the same length and draws no box for it. This applies only on the converted path, and the citation text is never changed (2026-10-13). Before, every slide's first bullet, whose focus carries the glued slide title, showed "Page location only". A marker inside an item ("Revenue rose – sharply", "12–14", "• Text") stays text: ignoring it there would let text without the character match text with it (Codex r1). The glued title is marked with the sentence: the mark is the citation's own text, and the slide view has no verified title to drop. `pdfEvidence.ts` is unchanged (a native PDF's citation text comes from its own text layer, bullets included). Tests: `tests/converted-evidence.test.cjs`. The jump itself is not relocated; the text view is the accurate DOCX path, so a DOCX opens in the text view (owner decision 2026-10-11; `lib/readerView.ts`, `tests/reader-default-view.test.cjs`): PPTX keeps the slide view, the toggle still switches, and a choice holds only for the document it was made on, so every entry path (chat citation, `?highlight=` link, collection reader, Quote Finder jump) opens a DOCX in text.
diff --git a/backend/app/api/documents.py b/backend/app/api/documents.py
index 1c84683d..4404bc68 100644
--- a/backend/app/api/documents.py
+++ b/backend/app/api/documents.py
@@ -617,14 +617,14 @@ def _brief_chunk_ids(*groups: list[dict]) -> list[uuid.UUID]:
 
 def _brief_ref_payload(chunk) -> dict:
     bboxes = chunk.bboxes if isinstance(chunk.bboxes, list) else []
-    snippet = ((f"{chunk.section_title}: " if chunk.section_title else "") + (chunk.text or ""))[:180]
     return {
         "chunk_id": str(chunk.id),
         "chunk_index": int(chunk.chunk_index),
         "page": int(chunk.page_start),
         "page_end": int(chunk.page_end),
         "bboxes": bboxes,
-        "text_snippet": snippet,
+        # Chunk text only: the reader searches the page for it.
+        "text_snippet": (chunk.text or "")[:180],
     }
 
 
diff --git a/backend/app/services/chat_service.py b/backend/app/services/chat_service.py
index 0b1f2d44..00409ad6 100644
--- a/backend/app/services/chat_service.py
+++ b/backend/app/services/chat_service.py
@@ -271,12 +271,19 @@ def _citation_payload(
     ref_num: int, chunk: "_ChunkInfo", offset: int, claim_text: str = ""
 ) -> Dict[str, Any]:
     is_summary = chunk.retrieval_modality == "summary"
+    # The snippet is quoted on shared answers and exports and is searched for in
+    # the reader's page text, so it is the chunk's own text only. The heading
+    # travels separately: the claim verifier still reads it as evidence. Summary
+    # and table hits carry an internal label there ("Table p.3 #1"), not a heading;
+    # a table's label is already in its table_context.
     citation_data: Dict[str, Any] = {
         "ref_index": ref_num,
         "chunk_id": str(chunk.id),
-        "text_snippet": ((f"{chunk.section_title}: " if chunk.section_title else "") + (chunk.text or ""))[:100],
+        "text_snippet": (chunk.text or "")[:100],
         "offset": offset,
     }
+    if chunk.section_title and not is_summary and not chunk.table_id:
+        citation_data["section_title"] = chunk.section_title
     # Sentence-level focus: when the answer claim near this citation clearly maps
     # to one sentence of the chunk, attach it (verbatim) so the UI can highlight
     # just that sentence instead of the whole chunk. None → keep whole-chunk.
diff --git a/backend/app/services/claim_verifier_service.py b/backend/app/services/claim_verifier_service.py
index cc8f347f..610c37f4 100644
--- a/backend/app/services/claim_verifier_service.py
+++ b/backend/app/services/claim_verifier_service.py
@@ -158,6 +158,7 @@ def _citation_context(citation: dict) -> str:
         citation.get("table_context"),
         citation.get("context_text"),
         citation.get("text_snippet"),
+        citation.get("section_title"),
     ]
     return " ".join(str(part or "") for part in parts)
 
diff --git a/backend/app/services/extraction_service.py b/backend/app/services/extraction_service.py
index 8f7dff1d..d75f7f50 100644
--- a/backend/app/services/extraction_service.py
+++ b/backend/app/services/extraction_service.py
@@ -171,14 +171,12 @@ def _valid_bbox(bb: dict[str, Any]) -> bool:
 def _citation_from_chunk(
     ref_num: int, chunk: Chunk, score: float = 0.0
 ) -> dict[str, Any]:
-    snippet = (
-        (f"{chunk.section_title}: " if chunk.section_title else "") + (chunk.text or "")
-    )[:140]
     return {
         "ref_index": ref_num,
         "chunk_id": str(chunk.id),
         **citation_location(chunk.page_start, chunk.page_end, chunk.bboxes),
-        "text_snippet": snippet,
+        # Chunk text only: the reader searches the page for it.
+        "text_snippet": (chunk.text or "")[:140],
         "offset": 0,
         "confidence_score": round(float(score or 0.0), 3),
         "context_text": (chunk.text or "")[:300],
diff --git a/backend/scripts/make_highlight_fixtures.py b/backend/scripts/make_highlight_fixtures.py
index 61652f3e..1ffcb892 100644
--- a/backend/scripts/make_highlight_fixtures.py
+++ b/backend/scripts/make_highlight_fixtures.py
@@ -219,7 +219,7 @@ def citation_like(chunk) -> dict[str, Any]:
     page_end = chunk.page_end if (chunk.page_end and chunk.page_end != chunk.page_start) else None
     prefix = f"[page {chunk.page_start}{'–' + str(page_end) if page_end else ''}] " if chunk.page_start else ""
     payload: dict[str, Any] = {
-        "text_snippet": ((f"{chunk.section_title}: " if chunk.section_title else "") + text)[:100],
+        "text_snippet": text[:100],
         "context_text": (prefix + text)[:900],
         "claim": claim,
     }
diff --git a/backend/tests/test_citation_snippet_shape.py b/backend/tests/test_citation_snippet_shape.py
new file mode 100644
index 00000000..3d5449d4
--- /dev/null
+++ b/backend/tests/test_citation_snippet_shape.py
@@ -0,0 +1,112 @@
+"""Citation ``text_snippet`` is the cited chunk's own text, never "{section_title}: " + text.
+
+Owner decision 2026-10-11: the shared-answer page and exports print the snippet
+inside quotation marks, and the reader's text matcher searches the page for it,
+so a section-title prefix both misquotes the source and stops the highlight.
+"""
+from __future__ import annotations
+
+import uuid
+from types import SimpleNamespace
+
+from app.api.documents import _brief_ref_payload
+from app.models.tables import Chunk
+from app.services.chat_service import _ChunkInfo, _citation_payload
+from app.services.claim_verifier_service import claim_verifier_service
+from app.services.extraction_service import _citation_from_chunk
+
+TEXT = (
+    "The turbines produce about 900 kilowatts at peak flow in May. A diesel backup "
+    "generator behind the school covers the clinic for up to six days. Power lines run "
+    "on wooden poles along the valley road."
+)
+SECTION = "4.2 Power Grid"
+
+
+def _chat_chunk(**kwargs) -> _ChunkInfo:
+    defaults = dict(id=uuid.uuid4(), page_start=3, page_end=3, bboxes=[], text=TEXT,
+                    section_title=SECTION)
+    defaults.update(kwargs)
+    return _ChunkInfo(**defaults)
+
+
+def test_chat_citation_snippet_is_chunk_text_without_section_prefix() -> None:
+    payload = _citation_payload(1, _chat_chunk(), 0)
+
+    assert payload["text_snippet"] == TEXT[:100]
+    assert not payload["text_snippet"].startswith(SECTION)
+    assert payload["section_title"] == SECTION
+
+
+def test_chat_citation_omits_empty_section_title() -> None:
+    payload = _citation_payload(1, _chat_chunk(section_title=""), 0)
+
+    assert payload["text_snippet"] == TEXT[:100]
+    assert "section_title" not in payload
+
+
+def test_summary_citation_does_not_present_its_internal_label_as_a_section() -> None:
+    payload = _citation_payload(
+        1, _chat_chunk(section_title="Map-reduce section summary", retrieval_modality="summary"), 0
+    )
+
+    assert payload["text_snippet"] == TEXT[:100]
+    assert "section_title" not in payload
+
+
+def test_table_citation_does_not_present_its_table_label_as_a_section() -> None:
+    # retrieval_service labels table hits "Table p.N #k" in section_title; that is
+    # an internal label, and the verifier reads the table through table_context.
+    table_text = "Table p.3 #1 (camelot, confidence 0.90)\n| Site | Output |\n| Selka weir | 900 kW |"
+    payload = _citation_payload(
+        1,
+        _chat_chunk(text=table_text, section_title="Table p.3 #1", table_id=str(uuid.uuid4()),
+                    retrieval_modality="table"),
+        0,
+    )
+
+    assert payload["text_snippet"] == table_text[:100]
+    assert "section_title" not in payload
+    assert payload["table_context"] == table_text
+
+    answer = "The Selka weir site produces 900 kW."
+    payload["offset"] = len(answer)
+    report = claim_verifier_service.verify(answer, [payload], {1}, retrieved_count=1)
+
+    assert report.numeric_mismatch_citation_count == 0
+    assert report.low_overlap_citation_count == 0
+
+
+def test_extraction_diff_and_template_citations_have_no_section_prefix() -> None:
+    chunk = Chunk(id=uuid.uuid4(), document_id=uuid.uuid4(), page_start=3, page_end=3,
+                  section_title=SECTION, text=TEXT, bboxes=[])
+
+    assert _citation_from_chunk(1, chunk)["text_snippet"] == TEXT[:140]
+
+
+def test_brief_source_ref_snippet_has_no_section_prefix() -> None:
+    chunk = SimpleNamespace(id=uuid.uuid4(), chunk_index=0, page_start=3, page_end=3,
+                            bboxes=[], section_title=SECTION, text=TEXT)
+
+    assert _brief_ref_payload(chunk)["text_snippet"] == TEXT[:180]
+
+
+def test_claim_verifier_still_counts_the_section_title_as_evidence() -> None:
+    # The prefix used to put the heading's words and numbers into the verifier's
+    # context. They now arrive as their own field and must still count.
+    # Markers are already stripped from the answer; the citation sits at an offset.
+    answer = "Section 4.2 covers the power grid of the valley."
+    citation = _citation_payload(1, _chat_chunk(), len(answer))
+    citation.pop("context_text")
+    # Shares no words or numbers with the answer: only the heading can support it.
+    citation["text_snippet"] = "Turbines spin beside the Selka weir."
+
+    report = claim_verifier_service.verify(
+        answer,
+        [citation],
+        {1},
+        retrieved_count=1,
+    )
+
+    assert report.numeric_mismatch_citation_count == 0
+    assert report.low_overlap_citation_count == 0
diff --git a/backend/tests/test_extraction_service.py b/backend/tests/test_extraction_service.py
index c8d75f92..d76e0e44 100644
--- a/backend/tests/test_extraction_service.py
+++ b/backend/tests/test_extraction_service.py
@@ -192,7 +192,7 @@ def test_citation_from_chunk_retains_full_range_despite_majority_boxes() -> None
     assert citation["ref_index"] == 7
     assert citation["page"] == 4
     assert citation["confidence_score"] == 0.912
-    assert citation["text_snippet"].startswith("Risk Factors:")
+    assert citation["text_snippet"] == "This is the cited passage."
     assert citation["page_end"] == 5
     assert [bbox["page"] for bbox in citation["bboxes"]] == [4, 5, 5]
 
diff --git a/docs/ARCHITECTURE.md b/docs/ARCHITECTURE.md
index ac6a7d2d..a7672bcb 100644
--- a/docs/ARCHITECTURE.md
+++ b/docs/ARCHITECTURE.md
@@ -981,7 +981,9 @@ belongs to its document, click and citation: a document switch, or a citation
 that changes while the bodies mount, drops it, so it never scrolls another
 target. TXT pages take the same path but render as plain text (`lib/plainEvidence.ts`): Markdown and HTML
 characters stay literal, and the marks sit on the stored text one to one. Only a
-PDF whose stored file is missing still uses the old snippet prefix match.
+PDF whose stored file is missing still uses the older snippet match
+(`lib/snippetMatch.ts`: the citation's `text_snippet`, progressively shorter
+prefixes, searched in the page text).
 
 **PDF Search**: Ctrl+F triggers an in-viewer search bar. Text is extracted via `pdfjs page.getTextContent()`, matches are highlighted using `customTextRenderer` with `<mark>` tags, and prev/next navigation scrolls between matches.
 
diff --git a/frontend/src/components/TextViewer/TextViewer.tsx b/frontend/src/components/TextViewer/TextViewer.tsx
index dcd9da5b..827330aa 100644
--- a/frontend/src/components/TextViewer/TextViewer.tsx
+++ b/frontend/src/components/TextViewer/TextViewer.tsx
@@ -5,6 +5,7 @@ import remarkGfm from 'remark-gfm';
 import type { Options as MarkdownOptions } from 'react-markdown';
 import { Search, ChevronLeft, ChevronRight, X, ExternalLink, Globe2, ListTree, Eye, EyeOff } from 'lucide-react';
 import { PROXY_BASE, getChunkDetail } from '../../lib/api';
+import { findSnippetInPage } from '../../lib/snippetMatch';
 import { useLocale } from '../../i18n';
 import { Spinner } from '../spell';
 import { citationChunkText, citationPageRange, dropTrailingFragment } from '../../lib/citationText';
@@ -138,43 +139,6 @@ function estimateReadableUnits(text: string): number {
   return latinWords + Math.ceil(cjkChars / 2);
 }
 
-/**
- * Find the best matching substring of `snippet` within `pageText`.
- * Returns [startIndex, matchLength] or null if no match found.
- *
- * Strategy: try progressively shorter prefixes of the snippet
- * (since backend truncates at 100 chars). Also strips section title
- * prefix ("Title — ...") if present.
- */
-function findSnippetInPage(pageText: string, snippet: string): [number, number] | null {
-  if (!snippet || !pageText) return null;
-
-  const pageLower = pageText.toLowerCase();
-
-  // Try matching with and without section title prefix
-  const candidates = [snippet];
-  const dashIdx = snippet.indexOf(' — ');
-  if (dashIdx !== -1 && dashIdx < snippet.length - 4) {
-    candidates.push(snippet.slice(dashIdx + 3));
-  }
-
-  for (const candidate of candidates) {
-    const searchText = candidate.toLowerCase().trim();
-    if (searchText.length < 10) continue;
-
-    // Try full text first, then progressively shorter prefixes
-    for (let len = searchText.length; len >= Math.min(30, searchText.length); len -= 5) {
-      const prefix = searchText.slice(0, len);
-      const idx = pageLower.indexOf(prefix);
-      if (idx !== -1) {
-        return [idx, len];
-      }
-    }
-  }
-
-  return null;
-}
-
 /** Find all case-insensitive matches of a query in text */
 function findAllMatches(text: string, query: string): number[] {
   if (!query || query.length < 2) return [];
diff --git a/frontend/src/lib/citationText.ts b/frontend/src/lib/citationText.ts
index a535be8d..c984bc9f 100644
--- a/frontend/src/lib/citationText.ts
+++ b/frontend/src/lib/citationText.ts
@@ -120,7 +120,8 @@ export function uniqueCitationIndexes(citations: Citation[]): Citation[] {
 
 // chat_service._citation_payload sends `context_text = "[page N] " + chunk.text`
 // (or "[page N–M] "), cut at 900 Python code points. `text_snippet` is
-// "{section_title}: " + chunk.text cut at 100, so it rarely matches page text.
+// chunk.text cut at 100, too short to locate a chunk; citations stored before
+// 0.36.2 begin with "{section_title}: ".
 const CONTEXT_PAGE_PREFIX = /^\[page (\d+)(?:–(\d+))?\] /;
 const CONTEXT_TEXT_LIMIT = 900;
 
diff --git a/frontend/src/lib/snippetMatch.ts b/frontend/src/lib/snippetMatch.ts
new file mode 100644
index 00000000..61b38b6b
--- /dev/null
+++ b/frontend/src/lib/snippetMatch.ts
@@ -0,0 +1,48 @@
+// Every extractor caps a section title at 200 characters.
+const LEGACY_TITLE_MAX = 200;
+// The whole snippet is never matched on fewer than 30 characters; a fallback
+// candidate shorter than that could only land on an unrelated line.
+const MIN_FALLBACK_LENGTH = 30;
+
+/**
+ * Find where a citation snippet starts in a page's text.
+ * Returns [startIndex, matchLength] or null if no match found.
+ *
+ * The backend truncates snippets, so progressively shorter prefixes are tried.
+ * Snippets are the chunk's own text, but citations stored before 2026-10-11
+ * (chat history, saved extraction/template/diff results) begin with
+ * "{section_title}: ", which the page text does not contain. When the snippet
+ * itself does not match, the text after each ": " within the first 200
+ * characters is tried, then the text after an older " — " separator. Those
+ * fallbacks need at least 30 characters, like the whole snippet.
+ */
+export function findSnippetInPage(pageText: string, snippet: string): [number, number] | null {
+  if (!snippet || !pageText) return null;
+
+  const pageLower = pageText.toLowerCase();
+
+  const candidates = [snippet];
+  for (let idx = snippet.indexOf(': '); idx !== -1 && idx <= LEGACY_TITLE_MAX; idx = snippet.indexOf(': ', idx + 2)) {
+    candidates.push(snippet.slice(idx + 2));
+  }
+  const dashIdx = snippet.indexOf(' — ');
+  if (dashIdx !== -1 && dashIdx < snippet.length - 4) {
+    candidates.push(snippet.slice(dashIdx + 3));
+  }
+
+  for (const [index, candidate] of candidates.entries()) {
+    const searchText = candidate.toLowerCase().trim();
+    if (searchText.length < (index === 0 ? 10 : MIN_FALLBACK_LENGTH)) continue;
+
+    // Try full text first, then progressively shorter prefixes
+    for (let len = searchText.length; len >= Math.min(30, searchText.length); len -= 5) {
+      const prefix = searchText.slice(0, len);
+      const idx = pageLower.indexOf(prefix);
+      if (idx !== -1) {
+        return [idx, len];
+      }
+    }
+  }
+
+  return null;
+}
diff --git a/frontend/src/store/index.ts b/frontend/src/store/index.ts
index 5cbb3b0d..5ed80713 100644
--- a/frontend/src/store/index.ts
+++ b/frontend/src/store/index.ts
@@ -212,7 +212,8 @@ export const useDocTalkStore = create<DocTalkStore>((set, get) => ({
       highlights: bboxes.filter(box => box.page! >= citation.page && box.page! <= (citation.pageEnd || citation.page)),
       // Chunk snippet stays the reliable fallback (converted-PDF/TextViewer
       // paths depend on it). The focus sentence is layered ON TOP as emphasis.
-      highlightSnippet: citation.textSnippet || null,
+      // A map-reduce summary's snippet is coverage text, not page text.
+      highlightSnippet: citation.retrievalModality === 'summary' ? null : citation.textSnippet || null,
       highlightFocus: citation.focusSnippet || null,
       scrollNonce: state.scrollNonce + 1,
     }));
diff --git a/frontend/tests/citation-state.test.cjs b/frontend/tests/citation-state.test.cjs
index b9583929..be6bdfef 100644
--- a/frontend/tests/citation-state.test.cjs
+++ b/frontend/tests/citation-state.test.cjs
@@ -26,6 +26,12 @@ test('honest page ranges retain both pages and repeated clicks create new naviga
  assert.equal(store.getState().scrollNonce,nonce+1);
  assert.equal(store.getState().citationTarget.messageId,undefined,'quote/tool navigation cannot retain old answer origin');
 });
+test('a map-reduce summary citation is never searched for in the page text',()=>{
+ store.getState().navigateToCitation(citation);
+ assert.equal(store.getState().highlightSnippet,'Source');
+ store.getState().navigateToCitation({...citation,retrievalModality:'summary',textSnippet:'Section group 1 map summary coverage:\n- target sections: Introduction and Background of the Study'});
+ assert.equal(store.getState().highlightSnippet,null,'internal coverage text is not a quote from the page');
+});
 test('clearing a document removes its evidence, focus and citation identity',()=>{
  store.getState().clearDocumentTransientState();
  assert.equal(store.getState().citationTarget,null);assert.equal(store.getState().highlightFocus,null);assert.deepEqual(store.getState().highlights,[]);
diff --git a/frontend/tests/snippet-match.test.cjs b/frontend/tests/snippet-match.test.cjs
new file mode 100644
index 00000000..2bb10d9b
--- /dev/null
+++ b/frontend/tests/snippet-match.test.cjs
@@ -0,0 +1,56 @@
+const test = require('node:test');
+const assert = require('node:assert/strict');
+const fs = require('node:fs');
+const path = require('node:path');
+const Module = require('node:module');
+const ts = require('typescript');
+const filename = path.resolve(__dirname, '../src/lib/snippetMatch.ts');
+const loaded = new Module(filename, module);
+loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
+const { findSnippetInPage } = loaded.exports;
+
+const PAGE = 'Electricity for the valley comes from three run-of-river turbines on the Selka River. '
+  + 'The turbines produce about 900 kilowatts at peak flow in May. Power lines run on wooden poles '
+  + 'along the valley road and are trimmed clear of branches each August.';
+const at = (needle) => PAGE.indexOf(needle);
+
+test('a snippet that is the chunk text matches where the passage starts', () => {
+  const snippet = 'Power lines run on wooden poles along the valley road and are trimmed clear of branches each Augu';
+  assert.deepEqual(findSnippetInPage(PAGE, snippet), [at('Power lines'), snippet.length]);
+});
+
+test('a stored legacy "{section_title}: " snippet still matches the passage, not the title', () => {
+  const match = findSnippetInPage(PAGE, 'Power Grid: Power lines run on wooden poles along the valley road and are trimmed clear of b');
+  assert.equal(match[0], at('Power lines'));
+});
+
+test('a legacy section title that itself contains ": " is skipped too', () => {
+  const match = findSnippetInPage(PAGE, 'Chapter 4: Power Grid: The turbines produce about 900 kilowatts at peak flow in May.');
+  assert.equal(match[0], at('The turbines produce'));
+});
+
+test('a snippet whose own text contains ": " matches whole when the page has it', () => {
+  const page = 'Intro. Note: payment is due within sixty days of the invoice date. Payment is due within sixty days of the invoice date.';
+  const match = findSnippetInPage(page, 'Note: payment is due within sixty days of the invoice date.');
+  assert.deepEqual(match, [page.indexOf('Note:'), 'Note: payment is due within sixty days of the invoice date.'.length]);
+});
+
+test('a short text after a ": " never stands in for a snippet that missed', () => {
+  // The snippet misses on the line break after "If the Buyer"; its own tail
+  // "see Schedule 4." must not jump to the unrelated first line instead.
+  const page = 'Late fees: see Schedule 4.\n\nRemedies\nIf the Buyer\nfails to pay, the Seller may suspend delivery. Late fees: see Schedule 4.';
+  assert.equal(findSnippetInPage(page, 'If the Buyer fails to pay, the Seller may suspend delivery. Late fees: see Schedule 4.'), null);
+  assert.equal(findSnippetInPage(page, 'Remedies: If the Buyer fails to pay, the Seller may suspend delivery. Late fees: see Schedule 4.'), null);
+});
+
+test('the old " — " title separator is still understood', () => {
+  const match = findSnippetInPage(PAGE, 'Power Grid — The turbines produce about 900 kilowatts at peak flow in May.');
+  assert.equal(match[0], at('The turbines produce'));
+});
+
+test('no match, empty input and too-short remainders return null', () => {
+  assert.equal(findSnippetInPage(PAGE, 'Water Supply: The northern reservoir holds 4.2 million litres.'), null);
+  assert.equal(findSnippetInPage(PAGE, ''), null);
+  assert.equal(findSnippetInPage('', 'Power lines run on wooden poles'), null);
+  assert.equal(findSnippetInPage(PAGE, 'A very long section heading: May.'), null);
+});
```
