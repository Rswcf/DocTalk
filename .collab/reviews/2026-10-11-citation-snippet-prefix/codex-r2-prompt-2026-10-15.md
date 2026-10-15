# Codex adversarial review r2 — citation `text_snippet` without the section-title prefix (2026-10-15)

Round 1 (your output): `.collab/reviews/2026-10-11-citation-snippet-prefix/codex-r1-output-2026-10-15.md` — VERDICT: BLOCK on #4, SHOULD-FIX #3, #6, #8, #10, #12.
Codex cannot run git, so the fix commit's diff (c871c210..f91887e3) is pasted below. The full branch is in the working directory; the whole change against origin/main is `git diff origin/main...HEAD` (16d1ab77, eb7c785e, c871c210, f91887e3).
A Python 3.12 venv with every backend dependency (rapidfuzz included) is at `/private/tmp/claude-501/-Users-mayijie-Projects-Code-010-DocTalk--claude-worktrees-website-seo-audit-0bec36/5c4de203-81b3-4551-bd23-a53fe0c171df/scratchpad/venv/bin/python`; run backend tests from `backend/` with it. Frontend tests: `cd frontend && npm run test:unit`.

## What changed in response

- #4 BLOCKER: the legacy `": "` retry is dropped. `frontend/src/lib/snippetMatch.ts` is main's `findSnippetInPage` moved unchanged (same candidates: snippet and the old `" — "` split; same thresholds). Stored prefixed citations on missing-file PDFs show the page, as on main today. Your repro is a test.
- #6: `_citation_context` reads `text_snippet` only when `table_context` and `context_text` are both empty. Tests both directions (900 vs 9000).
- #8: `citationSourceKey` (frontend) and `export_service` `marker` (backend) drop the snippet from the identity of text hits that carry a chunk id; table and summary hits keep it. Two shared fixture cases in `backend/tests/fixtures/export_citations.json` (run by both suites).
- #3: rules corrected; backend test reproduces the (0,0,1,1) box via `extract_pages → chunk_document`; frontend test pins `findEvidenceRange` on that path (whole, bounded, unique; cut or prefixed snippet → null).
- #10/#12: docstrings and rules corrected.
- #5 (labels such as XLSX sheet names / URL titles in `section_title`), #11 (summary coverage text quoted on shares/exports) and the table method/confidence label in table snippets: recorded as follow-ups, not changed here (you agreed #11 is not a prerequisite).

## Attack

1. Verify each fix closes its finding; reproduce your r1 probes against the new code.
2. #8 fix: can the new identity merge two genuinely different sources? Consider: text hits with the same chunk id but different `page`/`page_end` (citation_location narrowing), collection answers across documents, legacy citations without chunk id, citations whose `retrieval_modality` is missing but which are table hits (`table_id` set, e.g. persisted before modality was stored), SourcesStrip React keys, `uniqueCitationIndexes` owner logic, export footnote choice (which snippet a merged reference quotes).
3. #6 fix: any citation that has `context_text` but where the snippet carried evidence that `context_text` lacks (summary, table, continuation via `_chunk_info_from_persisted_citation`, the 900-char cut, Brief/extraction citations if the verifier ever sees them)? Does any caller of `claim_verifier_service.verify` pass citations without `context_text`?
4. Anything the fix commit broke or any remaining BLOCKER in the whole branch.

For each: BLOCKER / SHOULD-FIX / NIT / OK with file:line evidence. Do not edit files.
End with one line: `VERDICT: SHIP`, `VERDICT: SHIP-WITH-FIXES` (list them) or `VERDICT: BLOCK` (list blockers).

## Fix diff (`git diff c871c210..f91887e3 -- . ':!.collab'`)

```diff
diff --git a/.claude/rules/frontend.md b/.claude/rules/frontend.md
index d1a9e49a..09883f54 100644
--- a/.claude/rules/frontend.md
+++ b/.claude/rules/frontend.md
@@ -77,7 +77,7 @@ from `LOCALIZED_PATHS`. The fixes are structural, not one-off.
 ## PDF & Documents
 - **react-pdf v9 CJK**: After upgrading react-pdf/pdfjs-dist, MUST re-copy `cmaps/`, `standard_fonts/`, `pdf.worker.min.mjs` to `public/`. Worker loaded from same-origin (not CDN) for CSP compliance
 - **bbox coordinates**: Normalized [0,1], top-left origin. Four citation highlight strategies: ① PDF bbox, ② TextViewer text-snippet match (missing-file PDFs only; `lib/snippetMatch.ts`), ③ converted DOCX/PPTX PDF: text-layer match of the focus sentence or the chunk passage, ④ inline evidence marks for MD, DOCX/PPTX text view, XLSX and URL (Markdown) and TXT (plain text; owner decision 2026-10-11) (below). Quote cards reuse the citation jump with chunk-level bboxes and an explicit "highlight location is approximate" label (plan §8.2).
-- **Citation `text_snippet` is the chunk's own text (owner decision 2026-10-11; 0.36.2)**: never `"{section_title}: " + text` — the shared-answer page, `ShareAnswerDialog`, `lib/export.ts` and the backend exports quote it in quotation marks. Chat (100 chars), Brief source refs (180) and `_citation_from_chunk` (140: extraction, document diff, question templates) all emit chunk text only. The chat payload carries `section_title` as its own field for text chunks only: summary hits ("Map-reduce section summary") and table hits ("Table p.N #k", already in `table_context`) carry an internal label there, not a heading; `claim_verifier_service._citation_context` reads the field, so a heading's words and numbers still count as evidence. Nothing renders `section_title` in the UI yet. Who reads `textSnippet`: ② searches the page for it; ③ gets `citationPassage(...)`, which falls back to it only for citations without `context_text` (Brief refs), still behind the converted uniqueness gate; ④ uses it only when the chunk fetch fails and there is no `context_text`; ① reads `highlightSnippet` only for a `(0,0,1,1)` dummy box, which no backend path emits. Citations stored before the release keep the prefix (chat history, saved extraction/template/diff results), so `lib/snippetMatch.ts` retries after each `": "` in the first 200 characters (extractors cap titles at 200) only when the whole snippet misses, and any fallback needs ≥30 characters (a shorter tail lands on unrelated lines). Summary citations (`retrievalModality === 'summary'`) never set `highlightSnippet`: their snippet is coverage text, not page text.
+- **Citation `text_snippet` is the chunk's own text (owner decision 2026-10-11; 0.36.2)**: never `"{section_title}: " + text` — the shared-answer page, `ShareAnswerDialog`, `lib/export.ts` and the backend exports quote it in quotation marks. Chat (100 chars), Brief source refs (180) and `_citation_from_chunk` (140: extraction, document diff, question templates) all emit chunk text only. The chat payload carries `section_title` as its own field for text chunks only: summary hits ("Map-reduce section summary") and table hits ("Table p.N #k", already in `table_context`) carry an internal label there, not a heading; `claim_verifier_service._citation_context` reads the field, so a heading's words and numbers still count as evidence. Nothing renders `section_title` in the UI yet. Who reads `textSnippet`: ② searches the page for it; ③ gets `citationPassage(...)`, which falls back to it only for citations without `context_text` (Brief refs), still behind the converted uniqueness gate; ④ uses it only when the chunk fetch fails and there is no `context_text`; ① reads `highlightSnippet` when a native block's box is `(0,0,1,1)` (`_normalize_bbox` clamps a block that covers or overflows its page; reachable, pinned in `backend/tests/test_citation_snippet_shape.py`), through `findEvidenceRange` (whole, word-bounded, unique), so a cut or prefixed snippet stays page-only. Citations stored before 0.36.2 keep the prefix (chat history, saved extraction/template/diff results), and ② does not match them (the reader shows the page). Never guess where a stored title ends: a title can contain `": "`, and a tail cut at a `": "` matched an earlier, unrelated line (Codex r1 #4, 2026-10-15). The claim verifier reads `text_snippet` only when a citation has neither `table_context` nor `context_text`: the snippet's cut can split a number (`9000` → `900`) into evidence the source never had. Source identity (`citationSourceKey`, `export_service._prepare_export` `marker`) leaves the snippet out for text hits that have a chunk id, so a continued answer that cites one chunk in both shapes at one offset gets one marker; table and summary hits keep the snippet (they share an anchor chunk with other sources; `backend/tests/fixtures/export_citations.json` holds both cases for both implementations). Summary citations (`retrievalModality === 'summary'`) never set `highlightSnippet` in the store: their snippet is coverage text, not page text (④ can still fetch a summary's anchor chunk when its `context_text` reaches 900; pre-existing).
 - **Non-PDF boxes are slivers, never draw them**: the parse worker gives non-PDF blocks a bbox in points (`(0, 0.1, 1, 1)`), which `_normalize_bbox` turns into a ~0.0016 × 0.0011 box against 612 × 792 (pinned in `backend/tests/test_extractors_office.py`). The converted viewer therefore passes `syntheticBoxes` to `PdfViewer`/`PageWithHighlights`: no boxes, and the candidate is focus, else the chunk passage (`citationPassage`: `context_text` minus its `[page N] ` prefix, cut fragment dropped). The store's `highlightSnippet` and the native PDF path are unchanged.
 - **Strategy ④ (2026-10-11, plan `.collab/plans/2026-10-11-citation-highlight-all-formats.md`)**: `lib/textEvidence.ts` `locateTextEvidence` finds the cited chunk in the raw page text (`Page.content` is the extractor's Markdown, chunk text is the same Markdown split into sentences and rejoined). Rules, all conservative: each sentence must be unique (canonical, word-bounded; Han/Kana/Thai exempt) in the whole document, never only on the cited pages (`citation_location` narrows a chunk to one page, and Quote Finder cards, saved quotes and `?highlight=` links carry no `context_text`), and must lie on a page the chunk may sit on (its `context_text` range plus the cited pages, or the whole document when no range is known: Quote Finder cards and `?highlight=` links carry no `context_text`, and `/api/chunks` serves no `page_end`; browser acceptance P2-2); marks stay on the cited pages; located sentences are never bridged and must keep chunk order; a region needs ≥2 pieces or ≥40 characters; the located pieces must cover ≥30% of the chunk (`MIN_CHUNK_COVERAGE`: on generated fixture corpora, not production citations, every chunk located ≥0.65 and the same chunks cited on pages that do not hold them ≤0.07), else `page`. Glued titles (a title block not classed as a heading is glued onto the first sentence, and a page without a final delimiter is glued onto the next page) are split at a page start only when everything in front of it is accounted for: unique ends of the previous pages, the previous page's literal end (a proper end: a page's whole text is never dropped as its end), and the page's verified title (`section_title` from `/text-content`, or the page's first line without `#` marks, which holds PPTX slide titles and URL headings; compared as the chunker rejoins it). DOCX headings, Markdown headings and XLSX sheet names cannot be verified today (not in the page text, and `/text-content` derives `section_title` from `Chunk.section_title`, which is null exactly when the title was glued). Such an unverified title is dropped only when page text brackets it (browser acceptance P2-1, 2026-10-11): it sits right after the located literal end of the page before (in the same piece, or the previous piece was located through that end) and right before the located start of its page, and it is at most `GLUED_TITLE_MAX` (120) canonical characters and not the whole text of any page; a focus never uses this. Any other unverified text in front of a page start, in particular at the chunk start, is never dropped (it may be content that changes the page sentence's meaning: "The court rejected" + the page's claim): the split is refused and a multi-line piece is located line by line. Serving the extractor's page title would let the chunk's first heading verify too. The focus is `exact` only if unique inside the region; a focus the region does not hold (its sentence was not located, as a Quote Finder quote glued to the chunk's first heading) is emphasised beside the region only when it passes the no-region rule in one piece, touches no region span, occurs once in the chunk text, and both the page (whitespace only between) and the chunk (nothing between) put it right next to the same located piece, so a heading that a phrase elsewhere on the page repeats is never marked (Codex r4 #1); with no region (saved quotes, a chunk that is not on the cited page) it must be unique in the document, and where it begins or ends with a letter or digit the page must have a non-letter there, whatever the script on either side (`AI合同…` inside `本AI合同…` is refused), the PDF matcher's boundary rule (the exemption above is safe only inside a located region). `lib/rehypeMarkRanges.ts` maps the raw offsets onto hast text positions and wraps them in flat `<mark data-dt-evidence="region|exact">` (one `data-dt-evidence-anchor`); table pipes and syntax are never marked; a range that starts or ends inside a reference or escape (`&amp;`, `\*`) renders no mark in that node; otherwise a node whose text differs from its source is aligned character by character, else the range is decoded as micromark decodes it (code text, inline or block, is never decoded) and must occur once in the node, else it renders no mark: a node is never marked wider than its range; code-block text maps through its `code` element after the fence line. The URL article view renders each page's leading heading as its own `<h2>` and only the body as Markdown, so URL evidence goes through `lib/articleEvidence.ts` `articleEvidence` before the status is set: a focus touching the stripped heading makes the result `page` (its region is dropped too), and a region is clipped to the body; the status always names what is rendered. Full chunk text comes from `context_text` when it is under 900 code points, else `/api/chunks/{id}` (cached). The status line reuses `evidence.*` keys and names the marks that rendered, not the ranges that were located (`lib/evidenceStatus.ts` `shownEvidenceStatus`: every `EvidenceMark` and every Markdown body reports its mount in a layout effect, so the label is right before paint): an exact mark → `exact`, region marks only → `region`, no mark → `page`, `loading` until react-markdown has mounted; a range can render nothing (raw HTML, a cut reference, an ambiguous alignment). The page caption and the hide button follow the shown status. TXT runs the same locate → marks → status path but renders each page as plain text (`lib/plainEvidence.ts` `plainEvidenceSegments`, `PlainEvidenceContent` in a `<pre dir="auto">`): `#`, `*`, `&amp;` and HTML are characters, the ranges map one to one onto the stored text, and search matches split around the marks; `tests/text-viewer-txt.test.cjs` holds the five browser-run TXT citations (en and ar). A jump (citation click, `?highlight=` link, `?page=N`) is armed at once but scrolls only after every lazy Markdown page body has mounted (`lib/textJump.ts`): bodies mount in different commits, and a scroll measured while the pages above are spinners lands short (browser acceptance P2-3, `next start` only); an anchor mark that mounts first is recorded and scrolled to then, and the reader scrolling first cancels the jump. A pending jump carries its document, click (nonce), page and citation, and scrolls only while the current state would arm the same jump: a document switch, another click, or a citation changed or cleared while the bodies mount drops it, and a state that arms nothing (the new document's own pages not yet loaded, no target) clears it with the pending and recorded anchors (Codex r4 #2). Shapes are pinned in `tests/text-evidence.test.cjs`, `tests/text-viewer-highlight.test.cjs` and `backend/tests/test_extractors_office.py`; `backend/scripts/make_highlight_fixtures.py --json` dumps real extractor/chunker/payload output for new checks.
 - **DOCX slide view opens the wrong page**: a DOCX extractor page is a heading section or a 3,000-character split, but the slide view jumps to page N of the LibreOffice PDF (PPTX is one slide per page; whether LibreOffice skips hidden slides is unverified). `lib/convertedEvidence.ts` keeps a converted-PDF candidate only when it occurs once in the whole converted document, on the cited page(s), so a wrong page shows "Page location only", never a wrong mark. LibreOffice draws a list bullet (•, ●, ▪, – …) as its own pdf.js text item, a glyph the extractor's paragraph text never has. `isListMarkerItem` accepts only an item made of nothing but marker glyphs; both gates use that same rule: the uniqueness index drops such items (PdfViewer keeps each page's items for it; search text is unchanged), and `PageWithHighlights` reads such a span as spaces of the same length and draws no box for it. This applies only on the converted path, and the citation text is never changed (2026-10-13). Before, every slide's first bullet, whose focus carries the glued slide title, showed "Page location only". A marker inside an item ("Revenue rose – sharply", "12–14", "• Text") stays text: ignoring it there would let text without the character match text with it (Codex r1). The glued title is marked with the sentence: the mark is the citation's own text, and the slide view has no verified title to drop. `pdfEvidence.ts` is unchanged (a native PDF's citation text comes from its own text layer, bullets included). Tests: `tests/converted-evidence.test.cjs`. The jump itself is not relocated; the text view is the accurate DOCX path, so a DOCX opens in the text view (owner decision 2026-10-11; `lib/readerView.ts`, `tests/reader-default-view.test.cjs`): PPTX keeps the slide view, the toggle still switches, and a choice holds only for the document it was made on, so every entry path (chat citation, `?highlight=` link, collection reader, Quote Finder jump) opens a DOCX in text.
diff --git a/backend/app/services/claim_verifier_service.py b/backend/app/services/claim_verifier_service.py
index 610c37f4..70e71e09 100644
--- a/backend/app/services/claim_verifier_service.py
+++ b/backend/app/services/claim_verifier_service.py
@@ -154,12 +154,12 @@ def _unit_for_offset(units: list[ClaimUnit], offset: int) -> ClaimUnit | None:
 
 
 def _citation_context(citation: dict) -> str:
-    parts = [
-        citation.get("table_context"),
-        citation.get("context_text"),
-        citation.get("text_snippet"),
-        citation.get("section_title"),
-    ]
+    # The snippet is the start of the same chunk text that table_context and
+    # context_text carry in full. Read it only when neither is present: its cut
+    # can split a number ("9000" -> "900") into evidence the source never had.
+    full = [citation.get("table_context"), citation.get("context_text")]
+    snippet = None if any(str(part or "").strip() for part in full) else citation.get("text_snippet")
+    parts = [*full, snippet, citation.get("section_title")]
     return " ".join(str(part or "") for part in parts)
 
 
diff --git a/backend/app/services/export_service.py b/backend/app/services/export_service.py
index c1954f3c..4b06a052 100644
--- a/backend/app/services/export_service.py
+++ b/backend/app/services/export_service.py
@@ -93,10 +93,14 @@ def _prepare_export(messages: List[Any], *, markdown: bool = False) -> tuple[lis
         source_ids: dict[tuple, int] = {}
 
         def marker(c):
+            # Same identity as the frontend's citationSourceKey: a text hit is
+            # its chunk (its snippet lost the section-title prefix in 0.36.2);
+            # table and summary hits share an anchor chunk and keep the snippet.
+            text_hit = bool(c.get("chunk_id")) and str(c.get("retrieval_modality") or "text") == "text"
             key = tuple(str(c.get(field) or "") for field in (
                 "ref_index", "document_id", "document_filename", "chunk_id",
-                "page", "page_end", "text_snippet",
-            ))
+                "page", "page_end",
+            )) + ("" if text_hit else str(c.get("text_snippet") or ""),)
             if key not in source_ids:
                 source_ids[key] = len(references) + 1
                 references.append({**c, "ref_index": source_ids[key]})
diff --git a/backend/tests/fixtures/export_citations.json b/backend/tests/fixtures/export_citations.json
index 7c893af1..98830bb2 100644
--- a/backend/tests/fixtures/export_citations.json
+++ b/backend/tests/fixtures/export_citations.json
@@ -382,5 +382,74 @@
       "one.pdf",
       "two.pdf"
     ]
+  },
+  {
+    "name": "continued across 0.36.2: one chunk cited with and without the section-title prefix",
+    "messages": [
+      {
+        "role": "assistant",
+        "content": "Lines run on poles. More.",
+        "citations": [
+          {
+            "ref_index": 1,
+            "offset": 19,
+            "page": 3,
+            "chunk_id": "grid",
+            "document_filename": "grid.pdf",
+            "text_snippet": "Power Grid: Power lines run on wooden poles"
+          },
+          {
+            "ref_index": 1,
+            "offset": 19,
+            "page": 3,
+            "chunk_id": "grid",
+            "document_filename": "grid.pdf",
+            "text_snippet": "Power lines run on wooden poles"
+          }
+        ]
+      }
+    ],
+    "answers": [
+      "Lines run on poles.[^1] More."
+    ],
+    "sources": [
+      "grid.pdf"
+    ]
+  },
+  {
+    "name": "a table hit and a text hit on one anchor chunk stay two sources",
+    "messages": [
+      {
+        "role": "assistant",
+        "content": "Output is 900 kW. More.",
+        "citations": [
+          {
+            "ref_index": 1,
+            "offset": 17,
+            "page": 3,
+            "chunk_id": "anchor",
+            "document_filename": "plant.pdf",
+            "text_snippet": "The plant reports its output by site."
+          },
+          {
+            "ref_index": 1,
+            "offset": 17,
+            "page": 3,
+            "chunk_id": "anchor",
+            "document_filename": "plant.pdf",
+            "retrieval_modality": "table",
+            "table_id": "t1",
+            "text_snippet": "Table p.3 #1 (camelot, confidence 0.90)"
+          }
+        ]
+      }
+    ],
+    "answers": [
+      "Output is 900 kW.[^1][^2] More."
+    ],
+    "sources": [
+      "plant.pdf",
+      "plant.pdf"
+    ]
   }
 ]
diff --git a/backend/tests/test_citation_snippet_shape.py b/backend/tests/test_citation_snippet_shape.py
index 3d5449d4..2ef2a01a 100644
--- a/backend/tests/test_citation_snippet_shape.py
+++ b/backend/tests/test_citation_snippet_shape.py
@@ -110,3 +110,55 @@ def test_claim_verifier_still_counts_the_section_title_as_evidence() -> None:
 
     assert report.numeric_mismatch_citation_count == 0
     assert report.low_overlap_citation_count == 0
+
+
+# Ends with "...was" padded so that the 100-character snippet cut falls inside "9000".
+CUT_TEXT = (
+    "The turbines supply the school and clinic. Their total rated generating output was".ljust(97)
+    + "9000 kilowatts."
+)
+
+
+def test_verifier_does_not_read_a_number_split_by_the_snippet_cut() -> None:
+    # Codex r1 #6 (2026-10-15): text_snippet = chunk.text[:100] ends in "900" here.
+    # context_text holds the whole number, so "900 kW" must not pass as supported.
+    answer = "The turbine output is 900 kilowatts."
+    citation = _citation_payload(1, _chat_chunk(text=CUT_TEXT, section_title=""), len(answer))
+    assert citation["text_snippet"].endswith("900")
+
+    report = claim_verifier_service.verify(answer, [citation], {1}, retrieved_count=1)
+
+    assert report.numeric_mismatch_citation_count == 1
+
+
+def test_verifier_still_supports_the_whole_number_from_context_text() -> None:
+    answer = "The turbine output is 9000 kilowatts."
+    citation = _citation_payload(1, _chat_chunk(text=CUT_TEXT, section_title=""), len(answer))
+
+    report = claim_verifier_service.verify(answer, [citation], {1}, retrieved_count=1)
+
+    assert report.numeric_mismatch_citation_count == 0
+    assert report.low_overlap_citation_count == 0
+
+
+def test_a_native_pdf_block_covering_its_page_gets_the_full_page_box() -> None:
+    # Codex r1 #3 (2026-10-15): _normalize_bbox clamps to the page, so a block that
+    # covers its page is (0,0,1,1), the box PageWithHighlights reads as "no box" and
+    # answers with a text match of the citation's snippet. That path is reachable.
+    import fitz
+
+    from app.services.parse_service import ParseService
+
+    pdf = fitz.open()
+    page = pdf.new_page(width=228.97998046875, height=13.739999771118164)
+    page.insert_text((0, 10.75), "The turbines produce electricity for the entire valley.", fontsize=10)
+    service = ParseService()
+    chunk = service.chunk_document(service.extract_pages(pdf.tobytes()))[0]
+
+    assert {"x": 0.0, "y": 0.0, "w": 1.0, "h": 1.0}.items() <= chunk.bboxes[0].items()
+    stored = SimpleNamespace(id=uuid.uuid4(), document_id=uuid.uuid4(), chunk_index=0, page_start=chunk.page_start,
+                             page_end=chunk.page_end, bboxes=chunk.bboxes, text=chunk.text,
+                             section_title=chunk.section_title)
+    for citation in (_citation_from_chunk(1, stored), _brief_ref_payload(stored)):
+        assert citation["bboxes"] == [{"page": 1, "x": 0.0, "y": 0.0, "w": 1.0, "h": 1.0}]
+        assert chunk.text.startswith(citation["text_snippet"])
diff --git a/frontend/src/lib/citationText.ts b/frontend/src/lib/citationText.ts
index c984bc9f..206df244 100644
--- a/frontend/src/lib/citationText.ts
+++ b/frontend/src/lib/citationText.ts
@@ -86,9 +86,14 @@ export function insertCitationMarkers(
 }
 
 export function citationSourceKey(citation: Citation): string {
+  // A text hit is its chunk: the snippet is that chunk's text, and its shape
+  // changed in 0.36.2 (no "{section_title}: " prefix), so a continued answer
+  // can cite one chunk in both shapes at one offset. Table and summary hits
+  // share an anchor chunk with other sources and keep the snippet in the key.
+  const textHit = Boolean(citation.chunkId) && (citation.retrievalModality ?? 'text') === 'text';
   return JSON.stringify([
     citation.refIndex, citation.documentId, citation.documentFilename, citation.chunkId,
-    citation.page, citation.pageEnd, citation.textSnippet,
+    citation.page, citation.pageEnd, textHit ? null : citation.textSnippet,
   ]);
 }
 
diff --git a/frontend/src/lib/snippetMatch.ts b/frontend/src/lib/snippetMatch.ts
index 61b38b6b..0b9eaaa0 100644
--- a/frontend/src/lib/snippetMatch.ts
+++ b/frontend/src/lib/snippetMatch.ts
@@ -1,20 +1,17 @@
-// Every extractor caps a section title at 200 characters.
-const LEGACY_TITLE_MAX = 200;
-// The whole snippet is never matched on fewer than 30 characters; a fallback
-// candidate shorter than that could only land on an unrelated line.
-const MIN_FALLBACK_LENGTH = 30;
-
 /**
  * Find where a citation snippet starts in a page's text.
  * Returns [startIndex, matchLength] or null if no match found.
  *
- * The backend truncates snippets, so progressively shorter prefixes are tried.
- * Snippets are the chunk's own text, but citations stored before 2026-10-11
- * (chat history, saved extraction/template/diff results) begin with
- * "{section_title}: ", which the page text does not contain. When the snippet
- * itself does not match, the text after each ": " within the first 200
- * characters is tried, then the text after an older " — " separator. Those
- * fallbacks need at least 30 characters, like the whole snippet.
+ * The backend truncates snippets, so progressively shorter prefixes are tried,
+ * down to 30 characters (or the whole snippet when it is shorter; a snippet
+ * under 10 characters is never matched). The text after an old " — " title
+ * separator is tried too.
+ *
+ * Snippets are the chunk's own text since 0.36.2. Citations stored before
+ * begin with "{section_title}: ", which the page text does not contain; they
+ * are not matched (the reader shows the page). Guessing where such a title ends
+ * is unsafe: a title can itself contain ": ", and a tail cut at any ": " can
+ * land on an earlier, unrelated line (Codex r1, 2026-10-15).
  */
 export function findSnippetInPage(pageText: string, snippet: string): [number, number] | null {
   if (!snippet || !pageText) return null;
@@ -22,17 +19,14 @@ export function findSnippetInPage(pageText: string, snippet: string): [number, n
   const pageLower = pageText.toLowerCase();
 
   const candidates = [snippet];
-  for (let idx = snippet.indexOf(': '); idx !== -1 && idx <= LEGACY_TITLE_MAX; idx = snippet.indexOf(': ', idx + 2)) {
-    candidates.push(snippet.slice(idx + 2));
-  }
   const dashIdx = snippet.indexOf(' — ');
   if (dashIdx !== -1 && dashIdx < snippet.length - 4) {
     candidates.push(snippet.slice(dashIdx + 3));
   }
 
-  for (const [index, candidate] of candidates.entries()) {
+  for (const candidate of candidates) {
     const searchText = candidate.toLowerCase().trim();
-    if (searchText.length < (index === 0 ? 10 : MIN_FALLBACK_LENGTH)) continue;
+    if (searchText.length < 10) continue;
 
     // Try full text first, then progressively shorter prefixes
     for (let len = searchText.length; len >= Math.min(30, searchText.length); len -= 5) {
diff --git a/frontend/tests/pdf-evidence.test.cjs b/frontend/tests/pdf-evidence.test.cjs
index bfd1d2d1..3a9b06a2 100644
--- a/frontend/tests/pdf-evidence.test.cjs
+++ b/frontend/tests/pdf-evidence.test.cjs
@@ -68,3 +68,12 @@ test('coarse table markers join at the outer margin, without broadening match re
  assert.deepEqual(regions,before);
  assert.equal(findEvidenceRange([run('Uncited gap.',.42,.3,.03)],'Uncited gap.',regions),null);
 });
+test('a native page whose one block covers the page searches the chunk snippet, whole and unique only',()=>{
+ // _normalize_bbox clamps a block that covers or overflows its page to (0,0,1,1);
+ // PageWithHighlights then matches highlightSnippet (chunk text since 0.36.2).
+ const runs=[run('The turbines produce about 900 kilowatts at peak flow in May.'),run('Power lines run on wooden poles.',.1,.13)];
+ assert.ok(findEvidenceRange(runs,'The turbines produce about 900 kilowatts at peak flow in May.',[]));
+ assert.equal(findEvidenceRange(runs,'The turbines produce about 900 kilowatts at peak fl',[]),null);
+ assert.equal(findEvidenceRange(runs,'4.2 Power Grid: The turbines produce about 900 kilowatts',[]),null);
+ assert.equal(groupEvidenceRegions([{x:0,y:0,w:1,h:1,page:1}]).length,0);
+});
diff --git a/frontend/tests/snippet-match.test.cjs b/frontend/tests/snippet-match.test.cjs
index 2bb10d9b..95a2616d 100644
--- a/frontend/tests/snippet-match.test.cjs
+++ b/frontend/tests/snippet-match.test.cjs
@@ -19,14 +19,17 @@ test('a snippet that is the chunk text matches where the passage starts', () =>
   assert.deepEqual(findSnippetInPage(PAGE, snippet), [at('Power lines'), snippet.length]);
 });
 
-test('a stored legacy "{section_title}: " snippet still matches the passage, not the title', () => {
-  const match = findSnippetInPage(PAGE, 'Power Grid: Power lines run on wooden poles along the valley road and are trimmed clear of b');
-  assert.equal(match[0], at('Power lines'));
-});
-
-test('a legacy section title that itself contains ": " is skipped too', () => {
-  const match = findSnippetInPage(PAGE, 'Chapter 4: Power Grid: The turbines produce about 900 kilowatts at peak flow in May.');
-  assert.equal(match[0], at('The turbines produce'));
+test('a stored legacy "{section_title}: " snippet is not guessed at', () => {
+  // Citations stored before 0.36.2 keep the title prefix. Cutting at a ": "
+  // can pick a tail that sits on an earlier, unrelated line (Codex r1 #4,
+  // 2026-10-15): this exact case matched [9, 52] while the chunk starts at 63.
+  const tail = 'Payment is due within sixty days of the invoice date.';
+  const body = 'The Seller requires immediate notice. ' + tail;
+  const page = 'Billing: ' + tail + '\n' + body;
+  assert.equal(findSnippetInPage(page, ('Terms: ' + tail + ': ' + body).slice(0, 100)), null);
+  assert.equal(findSnippetInPage(PAGE, 'Power Grid: Power lines run on wooden poles along the valley road and are trimmed clear of b'), null);
+  // The same chunk, cited as 0.36.2 sends it, lands on the chunk.
+  assert.deepEqual(findSnippetInPage(page, body.slice(0, 100)), [page.indexOf(body), body.length]);
 });
 
 test('a snippet whose own text contains ": " matches whole when the page has it', () => {
@@ -48,7 +51,7 @@ test('the old " — " title separator is still understood', () => {
   assert.equal(match[0], at('The turbines produce'));
 });
 
-test('no match, empty input and too-short remainders return null', () => {
+test('no match and empty input return null', () => {
   assert.equal(findSnippetInPage(PAGE, 'Water Supply: The northern reservoir holds 4.2 million litres.'), null);
   assert.equal(findSnippetInPage(PAGE, ''), null);
   assert.equal(findSnippetInPage('', 'Power lines run on wooden poles'), null);
```

Note: the host disk is nearly full (about 1.7 GB free). Do not run `npm run build` or anything that writes large files; unit tests are fine.
