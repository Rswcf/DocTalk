# Codex adversarial review r3 — citation `text_snippet` without the section-title prefix (2026-10-15)

Round 2 (your output): `.collab/reviews/2026-10-11-citation-snippet-prefix/codex-r2-output-2026-10-15.md` — VERDICT: BLOCK on #1 (legacy table identity), SHOULD-FIX #2 (legacy heading evidence), NIT #7.
The fix commit's diff (f91887e3..133779e7) is below. Whole change against origin/main: commits 16d1ab77, eb7c785e, c871c210, f91887e3, 133779e7.
Python venv with all backend deps: `/private/tmp/claude-501/-Users-mayijie-Projects-Code-010-DocTalk--claude-worktrees-website-seo-audit-0bec36/5c4de203-81b3-4551-bd23-a53fe0c171df/scratchpad/venv/bin/python` (run from `backend/`). Frontend: `cd frontend && npm run test:unit`. Do not run `npm run build`.

## What changed

- #1: a `table_id` marks a table hit in `citationSourceKey` and the export `marker`; the frontend maps `table_id` to `Citation.tableId` in `mapCitationPayload` and `sse.ts`. Two shared fixture cases (table without modality + text; two tables without modality).
- #2: `_citation_context` skips `text_snippet` only when `table_context` or `context_text` minus its `[page N] ` / `[page N–M] ` prefix starts with it (a literal check; no guess at a title boundary). A stored pre-0.36.2 snippet keeps counting, exactly as on main. Test covers legacy alone, fresh alone, and both.
- #7: test renamed. The `"in full"` comment you flagged is rewritten.
- Not changed (you rated them pre-existing / follow-up): the 900-char `context_text` cut splitting a number; summary coverage text and table method/confidence labels quoted on shares/exports; first-encountered citation wins the export quotation.

## Attack

1. Verify #1 and #2 close; rerun your r2 probes (legacy table shapes, the 4.2 Power Grid continuation).
2. `tableId` mapping: anywhere a Citation is built without the mappers (Quote Finder cards `Quotes/utils.ts`, artifact citations `mapArtifactPayload`, `?highlight=` links, collection pages, shared page types) where the key could now differ from before for the same source? Anything that serializes Citation objects and could now leak `tableId` (share snapshots, exports, analytics)?
3. `_citation_context` startswith rule: any fresh citation whose snippet is NOT a prefix of its context body (leading/trailing whitespace, `\r\n`, NUL stripping, Unicode normalization, the frontend/backend 900-char cut, page prefix variants, summary/table payloads, `_chunk_info_from_persisted_citation` text swaps) so the cut snippet still counts — and is that worse than main?
4. Whole branch: any remaining BLOCKER.

For each: BLOCKER / SHOULD-FIX / NIT / OK with file:line evidence. Do not edit files.
End with one line: `VERDICT: SHIP`, `VERDICT: SHIP-WITH-FIXES` (list them) or `VERDICT: BLOCK` (list blockers).

## Fix diff (`git diff f91887e3..133779e7 -- . ':!.collab'`)

```diff
diff --git a/.claude/rules/frontend.md b/.claude/rules/frontend.md
index 09883f54..92dae5bb 100644
--- a/.claude/rules/frontend.md
+++ b/.claude/rules/frontend.md
@@ -77,7 +77,7 @@ from `LOCALIZED_PATHS`. The fixes are structural, not one-off.
 ## PDF & Documents
 - **react-pdf v9 CJK**: After upgrading react-pdf/pdfjs-dist, MUST re-copy `cmaps/`, `standard_fonts/`, `pdf.worker.min.mjs` to `public/`. Worker loaded from same-origin (not CDN) for CSP compliance
 - **bbox coordinates**: Normalized [0,1], top-left origin. Four citation highlight strategies: ① PDF bbox, ② TextViewer text-snippet match (missing-file PDFs only; `lib/snippetMatch.ts`), ③ converted DOCX/PPTX PDF: text-layer match of the focus sentence or the chunk passage, ④ inline evidence marks for MD, DOCX/PPTX text view, XLSX and URL (Markdown) and TXT (plain text; owner decision 2026-10-11) (below). Quote cards reuse the citation jump with chunk-level bboxes and an explicit "highlight location is approximate" label (plan §8.2).
-- **Citation `text_snippet` is the chunk's own text (owner decision 2026-10-11; 0.36.2)**: never `"{section_title}: " + text` — the shared-answer page, `ShareAnswerDialog`, `lib/export.ts` and the backend exports quote it in quotation marks. Chat (100 chars), Brief source refs (180) and `_citation_from_chunk` (140: extraction, document diff, question templates) all emit chunk text only. The chat payload carries `section_title` as its own field for text chunks only: summary hits ("Map-reduce section summary") and table hits ("Table p.N #k", already in `table_context`) carry an internal label there, not a heading; `claim_verifier_service._citation_context` reads the field, so a heading's words and numbers still count as evidence. Nothing renders `section_title` in the UI yet. Who reads `textSnippet`: ② searches the page for it; ③ gets `citationPassage(...)`, which falls back to it only for citations without `context_text` (Brief refs), still behind the converted uniqueness gate; ④ uses it only when the chunk fetch fails and there is no `context_text`; ① reads `highlightSnippet` when a native block's box is `(0,0,1,1)` (`_normalize_bbox` clamps a block that covers or overflows its page; reachable, pinned in `backend/tests/test_citation_snippet_shape.py`), through `findEvidenceRange` (whole, word-bounded, unique), so a cut or prefixed snippet stays page-only. Citations stored before 0.36.2 keep the prefix (chat history, saved extraction/template/diff results), and ② does not match them (the reader shows the page). Never guess where a stored title ends: a title can contain `": "`, and a tail cut at a `": "` matched an earlier, unrelated line (Codex r1 #4, 2026-10-15). The claim verifier reads `text_snippet` only when a citation has neither `table_context` nor `context_text`: the snippet's cut can split a number (`9000` → `900`) into evidence the source never had. Source identity (`citationSourceKey`, `export_service._prepare_export` `marker`) leaves the snippet out for text hits that have a chunk id, so a continued answer that cites one chunk in both shapes at one offset gets one marker; table and summary hits keep the snippet (they share an anchor chunk with other sources; `backend/tests/fixtures/export_citations.json` holds both cases for both implementations). Summary citations (`retrievalModality === 'summary'`) never set `highlightSnippet` in the store: their snippet is coverage text, not page text (④ can still fetch a summary's anchor chunk when its `context_text` reaches 900; pre-existing).
+- **Citation `text_snippet` is the chunk's own text (owner decision 2026-10-11; 0.36.2)**: never `"{section_title}: " + text` — the shared-answer page, `ShareAnswerDialog`, `lib/export.ts` and the backend exports quote it in quotation marks. Chat (100 chars), Brief source refs (180) and `_citation_from_chunk` (140: extraction, document diff, question templates) all emit chunk text only. The chat payload carries `section_title` as its own field for text chunks only: summary hits ("Map-reduce section summary") and table hits ("Table p.N #k", already in `table_context`) carry an internal label there, not a heading; `claim_verifier_service._citation_context` reads the field, so a heading's words and numbers still count as evidence. Nothing renders `section_title` in the UI yet. Who reads `textSnippet`: ② searches the page for it; ③ gets `citationPassage(...)`, which falls back to it only for citations without `context_text` (Brief refs), still behind the converted uniqueness gate; ④ uses it only when the chunk fetch fails and there is no `context_text`; ① reads `highlightSnippet` when a native block's box is `(0,0,1,1)` (`_normalize_bbox` clamps a block that covers or overflows its page; reachable, pinned in `backend/tests/test_citation_snippet_shape.py`), through `findEvidenceRange` (whole, word-bounded, unique), so a cut or prefixed snippet stays page-only. Citations stored before 0.36.2 keep the prefix (chat history, saved extraction/template/diff results), and ② does not match them (the reader shows the page). Never guess where a stored title ends: a title can contain `": "`, and a tail cut at a `": "` matched an earlier, unrelated line (Codex r1 #4, 2026-10-15). The claim verifier skips `text_snippet` when `table_context` or `context_text` (minus its `[page N] ` prefix) starts with it: such a snippet adds only its cut, which can split a number (`9000` → `900`) into evidence the source never had. Any other snippet still counts, in particular a stored pre-0.36.2 citation, whose prefix is its only copy of the heading (continuation re-verifies stored citations; Codex r2 #2). Source identity (`citationSourceKey`, `export_service._prepare_export` `marker`) leaves the snippet out for text hits that have a chunk id and no table id, so a continued answer that cites one chunk in both shapes at one offset gets one marker; table and summary hits keep the snippet (they share an anchor chunk with other sources). A `table_id` marks a table hit even where a stored record has no `retrieval_modality`, so the frontend maps it (`Citation.tableId`; Codex r2 #1). `backend/tests/fixtures/export_citations.json` holds these cases for both implementations. Summary citations (`retrievalModality === 'summary'`) never set `highlightSnippet` in the store: their snippet is coverage text, not page text (④ can still fetch a summary's anchor chunk when its `context_text` reaches 900; pre-existing).
 - **Non-PDF boxes are slivers, never draw them**: the parse worker gives non-PDF blocks a bbox in points (`(0, 0.1, 1, 1)`), which `_normalize_bbox` turns into a ~0.0016 × 0.0011 box against 612 × 792 (pinned in `backend/tests/test_extractors_office.py`). The converted viewer therefore passes `syntheticBoxes` to `PdfViewer`/`PageWithHighlights`: no boxes, and the candidate is focus, else the chunk passage (`citationPassage`: `context_text` minus its `[page N] ` prefix, cut fragment dropped). The store's `highlightSnippet` and the native PDF path are unchanged.
 - **Strategy ④ (2026-10-11, plan `.collab/plans/2026-10-11-citation-highlight-all-formats.md`)**: `lib/textEvidence.ts` `locateTextEvidence` finds the cited chunk in the raw page text (`Page.content` is the extractor's Markdown, chunk text is the same Markdown split into sentences and rejoined). Rules, all conservative: each sentence must be unique (canonical, word-bounded; Han/Kana/Thai exempt) in the whole document, never only on the cited pages (`citation_location` narrows a chunk to one page, and Quote Finder cards, saved quotes and `?highlight=` links carry no `context_text`), and must lie on a page the chunk may sit on (its `context_text` range plus the cited pages, or the whole document when no range is known: Quote Finder cards and `?highlight=` links carry no `context_text`, and `/api/chunks` serves no `page_end`; browser acceptance P2-2); marks stay on the cited pages; located sentences are never bridged and must keep chunk order; a region needs ≥2 pieces or ≥40 characters; the located pieces must cover ≥30% of the chunk (`MIN_CHUNK_COVERAGE`: on generated fixture corpora, not production citations, every chunk located ≥0.65 and the same chunks cited on pages that do not hold them ≤0.07), else `page`. Glued titles (a title block not classed as a heading is glued onto the first sentence, and a page without a final delimiter is glued onto the next page) are split at a page start only when everything in front of it is accounted for: unique ends of the previous pages, the previous page's literal end (a proper end: a page's whole text is never dropped as its end), and the page's verified title (`section_title` from `/text-content`, or the page's first line without `#` marks, which holds PPTX slide titles and URL headings; compared as the chunker rejoins it). DOCX headings, Markdown headings and XLSX sheet names cannot be verified today (not in the page text, and `/text-content` derives `section_title` from `Chunk.section_title`, which is null exactly when the title was glued). Such an unverified title is dropped only when page text brackets it (browser acceptance P2-1, 2026-10-11): it sits right after the located literal end of the page before (in the same piece, or the previous piece was located through that end) and right before the located start of its page, and it is at most `GLUED_TITLE_MAX` (120) canonical characters and not the whole text of any page; a focus never uses this. Any other unverified text in front of a page start, in particular at the chunk start, is never dropped (it may be content that changes the page sentence's meaning: "The court rejected" + the page's claim): the split is refused and a multi-line piece is located line by line. Serving the extractor's page title would let the chunk's first heading verify too. The focus is `exact` only if unique inside the region; a focus the region does not hold (its sentence was not located, as a Quote Finder quote glued to the chunk's first heading) is emphasised beside the region only when it passes the no-region rule in one piece, touches no region span, occurs once in the chunk text, and both the page (whitespace only between) and the chunk (nothing between) put it right next to the same located piece, so a heading that a phrase elsewhere on the page repeats is never marked (Codex r4 #1); with no region (saved quotes, a chunk that is not on the cited page) it must be unique in the document, and where it begins or ends with a letter or digit the page must have a non-letter there, whatever the script on either side (`AI合同…` inside `本AI合同…` is refused), the PDF matcher's boundary rule (the exemption above is safe only inside a located region). `lib/rehypeMarkRanges.ts` maps the raw offsets onto hast text positions and wraps them in flat `<mark data-dt-evidence="region|exact">` (one `data-dt-evidence-anchor`); table pipes and syntax are never marked; a range that starts or ends inside a reference or escape (`&amp;`, `\*`) renders no mark in that node; otherwise a node whose text differs from its source is aligned character by character, else the range is decoded as micromark decodes it (code text, inline or block, is never decoded) and must occur once in the node, else it renders no mark: a node is never marked wider than its range; code-block text maps through its `code` element after the fence line. The URL article view renders each page's leading heading as its own `<h2>` and only the body as Markdown, so URL evidence goes through `lib/articleEvidence.ts` `articleEvidence` before the status is set: a focus touching the stripped heading makes the result `page` (its region is dropped too), and a region is clipped to the body; the status always names what is rendered. Full chunk text comes from `context_text` when it is under 900 code points, else `/api/chunks/{id}` (cached). The status line reuses `evidence.*` keys and names the marks that rendered, not the ranges that were located (`lib/evidenceStatus.ts` `shownEvidenceStatus`: every `EvidenceMark` and every Markdown body reports its mount in a layout effect, so the label is right before paint): an exact mark → `exact`, region marks only → `region`, no mark → `page`, `loading` until react-markdown has mounted; a range can render nothing (raw HTML, a cut reference, an ambiguous alignment). The page caption and the hide button follow the shown status. TXT runs the same locate → marks → status path but renders each page as plain text (`lib/plainEvidence.ts` `plainEvidenceSegments`, `PlainEvidenceContent` in a `<pre dir="auto">`): `#`, `*`, `&amp;` and HTML are characters, the ranges map one to one onto the stored text, and search matches split around the marks; `tests/text-viewer-txt.test.cjs` holds the five browser-run TXT citations (en and ar). A jump (citation click, `?highlight=` link, `?page=N`) is armed at once but scrolls only after every lazy Markdown page body has mounted (`lib/textJump.ts`): bodies mount in different commits, and a scroll measured while the pages above are spinners lands short (browser acceptance P2-3, `next start` only); an anchor mark that mounts first is recorded and scrolled to then, and the reader scrolling first cancels the jump. A pending jump carries its document, click (nonce), page and citation, and scrolls only while the current state would arm the same jump: a document switch, another click, or a citation changed or cleared while the bodies mount drops it, and a state that arms nothing (the new document's own pages not yet loaded, no target) clears it with the pending and recorded anchors (Codex r4 #2). Shapes are pinned in `tests/text-evidence.test.cjs`, `tests/text-viewer-highlight.test.cjs` and `backend/tests/test_extractors_office.py`; `backend/scripts/make_highlight_fixtures.py --json` dumps real extractor/chunker/payload output for new checks.
 - **DOCX slide view opens the wrong page**: a DOCX extractor page is a heading section or a 3,000-character split, but the slide view jumps to page N of the LibreOffice PDF (PPTX is one slide per page; whether LibreOffice skips hidden slides is unverified). `lib/convertedEvidence.ts` keeps a converted-PDF candidate only when it occurs once in the whole converted document, on the cited page(s), so a wrong page shows "Page location only", never a wrong mark. LibreOffice draws a list bullet (•, ●, ▪, – …) as its own pdf.js text item, a glyph the extractor's paragraph text never has. `isListMarkerItem` accepts only an item made of nothing but marker glyphs; both gates use that same rule: the uniqueness index drops such items (PdfViewer keeps each page's items for it; search text is unchanged), and `PageWithHighlights` reads such a span as spaces of the same length and draws no box for it. This applies only on the converted path, and the citation text is never changed (2026-10-13). Before, every slide's first bullet, whose focus carries the glued slide title, showed "Page location only". A marker inside an item ("Revenue rose – sharply", "12–14", "• Text") stays text: ignoring it there would let text without the character match text with it (Codex r1). The glued title is marked with the sentence: the mark is the citation's own text, and the slide view has no verified title to drop. `pdfEvidence.ts` is unchanged (a native PDF's citation text comes from its own text layer, bullets included). Tests: `tests/converted-evidence.test.cjs`. The jump itself is not relocated; the text view is the accurate DOCX path, so a DOCX opens in the text view (owner decision 2026-10-11; `lib/readerView.ts`, `tests/reader-default-view.test.cjs`): PPTX keeps the slide view, the toggle still switches, and a choice holds only for the document it was made on, so every entry path (chat citation, `?highlight=` link, collection reader, Quote Finder jump) opens a DOCX in text.
diff --git a/backend/app/services/claim_verifier_service.py b/backend/app/services/claim_verifier_service.py
index 70e71e09..b3ff58ed 100644
--- a/backend/app/services/claim_verifier_service.py
+++ b/backend/app/services/claim_verifier_service.py
@@ -11,6 +11,8 @@ _NUMBER_RE = re.compile(r"\b\d+(?:[.,]\d+)*(?:%|x|X)?\b")
 _CJK_RE = re.compile(r"[\u4e00-\u9fff]")
 _BULLET_OR_HEADING_RE = re.compile(r"^\s*(?:#{1,6}\s+|\*\*[^*]+\*\*:?\s*$)")
 _NUMBERED_LIST_PREFIX_RE = re.compile(r"^\s*\d{1,3}[.)]\s+")
+# chat_service._citation_payload prefixes context_text with the cited page(s).
+_CONTEXT_PAGE_PREFIX_RE = re.compile(r"^\[page \d+(?:–\d+)?\] ")
 _GENERIC_WORDS = {
     "about",
     "also",
@@ -154,13 +156,20 @@ def _unit_for_offset(units: list[ClaimUnit], offset: int) -> ClaimUnit | None:
 
 
 def _citation_context(citation: dict) -> str:
-    # The snippet is the start of the same chunk text that table_context and
-    # context_text carry in full. Read it only when neither is present: its cut
-    # can split a number ("9000" -> "900") into evidence the source never had.
-    full = [citation.get("table_context"), citation.get("context_text")]
-    snippet = None if any(str(part or "").strip() for part in full) else citation.get("text_snippet")
-    parts = [*full, snippet, citation.get("section_title")]
-    return " ".join(str(part or "") for part in parts)
+    # Since 0.36.2 the snippet is the start of the chunk text that table_context
+    # and context_text carry too, cut at 100 characters: as evidence it adds only
+    # its cut, which can split a number ("9000" -> "900") into evidence the
+    # source never had. So it is skipped when one of them starts with it. Any
+    # other snippet still counts: a citation without those fields, or one stored
+    # before 0.36.2, whose "{section_title}: " prefix is its only copy of the
+    # heading (no section_title field).
+    full = [str(citation.get("table_context") or ""), str(citation.get("context_text") or "")]
+    snippet = str(citation.get("text_snippet") or "")
+    bodies = (full[0], _CONTEXT_PAGE_PREFIX_RE.sub("", full[1], count=1))
+    if snippet and any(body.startswith(snippet) for body in bodies):
+        snippet = ""
+    parts = [*full, snippet, str(citation.get("section_title") or "")]
+    return " ".join(parts)
 
 
 def _safe_int(value: object, default: int = 0) -> int:
diff --git a/backend/app/services/export_service.py b/backend/app/services/export_service.py
index 4b06a052..f18e7f5c 100644
--- a/backend/app/services/export_service.py
+++ b/backend/app/services/export_service.py
@@ -95,8 +95,13 @@ def _prepare_export(messages: List[Any], *, markdown: bool = False) -> tuple[lis
         def marker(c):
             # Same identity as the frontend's citationSourceKey: a text hit is
             # its chunk (its snippet lost the section-title prefix in 0.36.2);
-            # table and summary hits share an anchor chunk and keep the snippet.
-            text_hit = bool(c.get("chunk_id")) and str(c.get("retrieval_modality") or "text") == "text"
+            # table and summary hits share an anchor chunk and keep the snippet
+            # (a table_id marks a table hit even where a record has no modality).
+            text_hit = (
+                bool(c.get("chunk_id"))
+                and not c.get("table_id")
+                and str(c.get("retrieval_modality") or "text") == "text"
+            )
             key = tuple(str(c.get(field) or "") for field in (
                 "ref_index", "document_id", "document_filename", "chunk_id",
                 "page", "page_end",
diff --git a/backend/tests/fixtures/export_citations.json b/backend/tests/fixtures/export_citations.json
index 98830bb2..7101c058 100644
--- a/backend/tests/fixtures/export_citations.json
+++ b/backend/tests/fixtures/export_citations.json
@@ -451,5 +451,76 @@
       "plant.pdf",
       "plant.pdf"
     ]
+  },
+  {
+    "name": "a table hit stored without retrieval_modality is still not merged with a text hit",
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
+  },
+  {
+    "name": "two tables on one anchor chunk stored without retrieval_modality stay two sources",
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
+            "table_id": "t1",
+            "text_snippet": "Table p.3 #1 (camelot, confidence 0.90)"
+          },
+          {
+            "ref_index": 1,
+            "offset": 17,
+            "page": 3,
+            "chunk_id": "anchor",
+            "document_filename": "plant.pdf",
+            "table_id": "t2",
+            "text_snippet": "Table p.3 #2 (camelot, confidence 0.88)"
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
index 2ef2a01a..df7158fc 100644
--- a/backend/tests/test_citation_snippet_shape.py
+++ b/backend/tests/test_citation_snippet_shape.py
@@ -162,3 +162,23 @@ def test_a_native_pdf_block_covering_its_page_gets_the_full_page_box() -> None:
     for citation in (_citation_from_chunk(1, stored), _brief_ref_payload(stored)):
         assert citation["bboxes"] == [{"page": 1, "x": 0.0, "y": 0.0, "w": 1.0, "h": 1.0}]
         assert chunk.text.startswith(citation["text_snippet"])
+
+
+def test_verifier_still_reads_the_heading_in_a_citation_stored_before_0_36_2() -> None:
+    # Codex r2 #2: a stored citation carries its heading only in the snippet's
+    # "{section_title}: " prefix; continuation re-verifies it. It must still count.
+    answer = "Section 4.2 covers the power grid of the valley."
+    body = "Turbines spin beside the Selka weir. The generator powers local homes."
+    legacy = {
+        "ref_index": 1,
+        "chunk_id": str(uuid.uuid4()),
+        "offset": len(answer),
+        "text_snippet": f"{SECTION}: {body}"[:100],
+        "context_text": f"[page 3] {body}",
+    }
+    fresh = _citation_payload(1, _chat_chunk(text=body), len(answer))
+
+    for citations in ([legacy], [fresh], [legacy, fresh]):
+        report = claim_verifier_service.verify(answer, citations, {1}, retrieved_count=1)
+        assert report.numeric_mismatch_citation_count == 0
+        assert report.low_overlap_citation_count == 0
diff --git a/frontend/src/lib/api.ts b/frontend/src/lib/api.ts
index d9cb8214..820a5de9 100644
--- a/frontend/src/lib/api.ts
+++ b/frontend/src/lib/api.ts
@@ -82,6 +82,7 @@ export function mapCitationPayload(c: any): Citation {
     confidenceScore: typeof c.confidence_score === 'number' ? c.confidence_score : (typeof c.confidenceScore === 'number' ? c.confidenceScore : undefined),
     contextText: typeof c.context_text === 'string' ? c.context_text : (typeof c.contextText === 'string' ? c.contextText : undefined),
     retrievalModality: typeof c.retrieval_modality === 'string' ? c.retrieval_modality : (typeof c.retrievalModality === 'string' ? c.retrievalModality : undefined),
+    ...(typeof (c.table_id ?? c.tableId) === 'string' && (c.table_id ?? c.tableId) ? { tableId: c.table_id ?? c.tableId } : {}),
   };
 }
 
diff --git a/frontend/src/lib/citationText.ts b/frontend/src/lib/citationText.ts
index 206df244..8f70a9cc 100644
--- a/frontend/src/lib/citationText.ts
+++ b/frontend/src/lib/citationText.ts
@@ -89,8 +89,9 @@ export function citationSourceKey(citation: Citation): string {
   // A text hit is its chunk: the snippet is that chunk's text, and its shape
   // changed in 0.36.2 (no "{section_title}: " prefix), so a continued answer
   // can cite one chunk in both shapes at one offset. Table and summary hits
-  // share an anchor chunk with other sources and keep the snippet in the key.
-  const textHit = Boolean(citation.chunkId) && (citation.retrievalModality ?? 'text') === 'text';
+  // share an anchor chunk with other sources and keep the snippet in the key;
+  // a table id marks a table hit even where an older record has no modality.
+  const textHit = Boolean(citation.chunkId) && !citation.tableId && (citation.retrievalModality ?? 'text') === 'text';
   return JSON.stringify([
     citation.refIndex, citation.documentId, citation.documentFilename, citation.chunkId,
     citation.page, citation.pageEnd, textHit ? null : citation.textSnippet,
diff --git a/frontend/src/lib/sse.ts b/frontend/src/lib/sse.ts
index d26816fc..9de5266a 100644
--- a/frontend/src/lib/sse.ts
+++ b/frontend/src/lib/sse.ts
@@ -18,6 +18,7 @@ type CitationEventPayload = CitationPayload & {
   confidence_score?: number;
   context_text?: string;
   retrieval_modality?: string;
+  table_id?: string;
 };
 type ErrorPayload = { code: string; message: string; status?: number };
 type DonePayload = {
@@ -97,6 +98,7 @@ async function _processSSEStream(
                 confidenceScore: typeof p.confidence_score === 'number' ? p.confidence_score : undefined,
                 contextText: typeof p.context_text === 'string' ? p.context_text : undefined,
                 retrievalModality: typeof p.retrieval_modality === 'string' ? p.retrieval_modality : undefined,
+                ...(typeof p.table_id === 'string' && p.table_id ? { tableId: p.table_id } : {}),
               };
               onCitation(c);
               break; }
diff --git a/frontend/src/types/index.ts b/frontend/src/types/index.ts
index 1c7d2bab..632d75c9 100644
--- a/frontend/src/types/index.ts
+++ b/frontend/src/types/index.ts
@@ -23,6 +23,7 @@ export interface Citation {
   confidenceScore?: number; // Qdrant similarity score 0.0-1.0
   contextText?: string; // extended context (~300 chars) for hover preview
   retrievalModality?: string; // text/table/summary
+  tableId?: string; // table hits: the table this citation points at (older records may lack retrievalModality)
 }
 
 export interface ChatArtifactDownload {
diff --git a/frontend/tests/citation-state.test.cjs b/frontend/tests/citation-state.test.cjs
index be6bdfef..52680505 100644
--- a/frontend/tests/citation-state.test.cjs
+++ b/frontend/tests/citation-state.test.cjs
@@ -26,7 +26,7 @@ test('honest page ranges retain both pages and repeated clicks create new naviga
  assert.equal(store.getState().scrollNonce,nonce+1);
  assert.equal(store.getState().citationTarget.messageId,undefined,'quote/tool navigation cannot retain old answer origin');
 });
-test('a map-reduce summary citation is never searched for in the page text',()=>{
+test('a map-reduce summary citation never sets highlightSnippet (its snippet is coverage text)',()=>{
  store.getState().navigateToCitation(citation);
  assert.equal(store.getState().highlightSnippet,'Source');
  store.getState().navigateToCitation({...citation,retrievalModality:'summary',textSnippet:'Section group 1 map summary coverage:\n- target sections: Introduction and Background of the Study'});
```
