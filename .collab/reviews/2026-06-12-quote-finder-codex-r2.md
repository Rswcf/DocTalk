# Quote Finder + Evidence Board - Codex Round 2 Review

Verdict: REVISE, not block. Round 1's `pages.content` correction is accepted, but the revised D1 is only safe if the user-facing promise is "verbatim against DocTalk's extracted text." The current chunk pipeline is not lossless enough to sell as "verbatim PDF wording" without more work.

## A. Revised D1 attack: chunk-text verification

1. Required change: the sentence splitter can mutate source wording before it reaches `chunks.text`.
   - `ParseService.SENTENCE_DELIMS` includes `.` and `;` at `backend/app/services/parse_service.py:280`.
   - `_split_into_sentences()` splits on every delimiter at `backend/app/services/parse_service.py:893-906`.
   - `chunk_document()` strips each sentence at `backend/app/services/parse_service.py:482-487`, then `_join_text_units()` reconstructs the chunk with newly inferred spaces at `backend/app/services/parse_service.py:765-782`.
   - This changes common academic text: `U.S.` becomes `U. S.`, `e.g.` becomes `e. g.`, `3.14` becomes `3. 14`, and compact legal/section forms can pick up spaces after periods. The LLM will see the mutated string, the verifier will slice the mutated string, and the quote card will display the mutated string. Users will catch this in direct quotations.
   - Fix before D1: chunk display text must be produced from offset-preserving slices of the cleaned block text, not by splitting and rejoining punctuation-delimited fragments. If sentence units remain, carry original whitespace/offsets through the split and add abbreviation/decimal guards.

2. Required change: hard-hyphen dehyphenation can remove real characters.
   - `extract_pages()` emits one line-level block per PyMuPDF line at `backend/app/services/parse_service.py:297-309`.
   - `_extract_line_blocks()` drops a trailing `-` whenever the next line starts with any alnum at `backend/app/services/parse_service.py:855-864`.
   - This is good for discretionary line-break hyphenation, but bad for real hyphenated compounds split at a line break: `cost-\neffective` becomes `costeffective`, not `cost-effective`. That is not a whitespace-only normalization; it changes the quote.
   - Fix before D1: either use PyMuPDF/raw page text for verification/display on new PDFs, or mark line-break hyphen joins in an offset map so the displayed quote can preserve/restore the original hyphen when confidence is low. At minimum add tests for discretionary hyphens and hard hyphenated compounds.

3. Required change: page attribution is not sound for `page_start != page_end` chunks.
   - `Chunk` only persists `text`, `page_start`, `page_end`, and `bboxes` at `backend/app/models/tables.py:140-145`.
   - `chunk_document()` builds one `chunk.text` across selected sentence units and stores only min/max page at `backend/app/services/parse_service.py:519-545`.
   - The verifier can locate an offset inside chunk text, but the stored model has no authoritative offset-to-page map. If a chunk spans pages 10-11, a quote can verify in the chunk while the proposed `page` is wrong. Dedupe by `(normalized quote text, page)` then bakes in the model's claimed page rather than the verified occurrence.
   - Fix before D1: verification must derive page/page_range from the verified slice, not from the LLM emission. Use page-scoped verification when `pages.content` exists; for chunk fallback, build or reconstruct an offset map from the same text units used to make the chunk. Reject or split multi-page matches until this exists.

4. Required change: dedupe by `(normalized quote text, page)` is insufficient.
   - It handles the 50-token overlap case from `backend/app/services/parse_service.py:550-564`, but collapses distinct same-page occurrences and cannot handle multi-page spans.
   - Use `(document_id, normalized_quote_text, verified_page_range, verified_start_offset or bbox signature)` for in-memory result dedupe. For persisted `saved_quotes`, consider a uniqueness guard on user/document/quote/page_range/location only if duplicate saving is not desired.

5. Non-blocking but user-visible: whitespace and content suppression limit the promise.
   - `_normalize_inline_text()` strips NULs, replaces NBSP, collapses repeated spaces, and strips ends at `backend/app/services/parse_service.py:882-891`. That is mostly acceptable for prose, but it is not exact layout text.
   - Header/footer removal drops repeated top/bottom blocks at `backend/app/services/parse_service.py:404-437` and detection runs at `backend/app/services/parse_service.py:944-976`.
   - Headings are removed from content at `backend/app/services/parse_service.py:474-480`.
   - These do not usually misquote body prose, but they mean Quote Finder will miss quotes in headings, recurring page titles, epigraph-like top text, tables, poetry, and code. The UI copy should say "verified extracted text" for old/chunk-fallback documents, and only upgrade to "verified page text" where `pages.content` is actually populated and used.

Bottom line on D1: chunk-text verification is sound as an anti-hallucination gate, but not yet sound as a "verbatim PDF quote" guarantee. The verifier must own page/location derivation, and chunk text must stop mutating abbreviations/numbers/hard hyphens before quote cards display it.

## B. Open questions

1. Credit pricing: use chat-style actual token cost with a conservative predebit, not a non-reconciled flat fee.
   - Chat already prechecks estimated cost at `backend/app/api/chat.py:354-373`, predebits in the service at `backend/app/services/chat_service.py:1218-1231`, and reconciles actual usage at `backend/app/services/chat_service.py:1838-1853`.
   - Extraction reserves a flat 25 credits (`backend/app/services/extraction_service.py:35-39`, `backend/app/api/extractions.py:210-217`) but still reconciles in the worker (`backend/app/services/extraction_service.py:530-556`).
   - Quote Finder is interactive and query-sized, so price it like chat: reserve `balanced` or a quote-search estimate under `reason="quote_search"`, reconcile to actual tokens, refund on system/queue failure, and still charge actual cost for verified-empty results if the model call ran.

2. `FREE_SAVED_QUOTES_LIMIT=20`: acceptable beta default; gate on saved quote count, not board count.
   - Local limits are env/config constants by plan (`backend/app/core/config.py:151-166`) and enforced by counting owned resources, e.g. collections at `backend/app/api/collections.py:117-137` and documents at `backend/app/api/documents.py:216-233`.
   - Add `FREE_SAVED_QUOTES_LIMIT`, `PLUS_SAVED_QUOTES_LIMIT`, `PRO_SAVED_QUOTES_LIMIT` and count active saved quotes per user across documents. Do not count unsaved search results. Board count is the wrong meter unless there is a real board entity.

3. Quote intent in normal chat: yes, route clear direct-quotation intents into the verified pipeline in v1.
   - The retained users already ask through chat. If the verified workflow only lives behind a new button, v1 will miss the proven demand.
   - Keep routing high precision: "direct quote", "verbatim", "exact quotation", "quote with page", "find evidence quote". Generic explanatory questions should stay in normal chat. On verified-pipeline failure, return "no verified quotes found" rather than falling back to unverified quote text.

4. `document_biblio`: separate table, but user edits must be user-scoped.
   - A separate table is cleaner than a nullable JSON column on hot `documents`; `Document` is already a broad ownership/parse/status row at `backend/app/models/tables.py:15-80`.
   - But the plan's `document_id pk` conflicts with "user-editable form" for shared/demo docs because `Document.user_id` is nullable and demo docs are identified by `demo_slug` at `backend/app/models/tables.py:45-70`. One user's edit must not become global metadata for every user.
   - Recommended model: global auto-detected biblio by document plus optional per-user override, or a single `document_biblio` table keyed by `(document_id, user_id)` with a nullable/system row only for detected defaults.

5. Tier-3 thresholds: keep 95 auto / 90 flagged, but add minimum-length and ambiguity guards.
   - LangExtract's looser threshold is not the right benchmark for a paid "verbatim quote" card. `rapidfuzz.partial_ratio_alignment` can over-match short phrases.
   - Auto-accept fuzzy only when score >= 95, length ratio is sane, quote length is at least roughly 8 tokens or 40 characters, and the match is not ambiguous within the searched window. For short quotes, OCR docs, or low `text_quality`, allow exact/normalized only or flag for user confirmation.

## C. Scope challenge

Not needed for first paying users:
- Full DOCX/BibTeX/RIS quote-bank exports in week 3. Useful, but the first paid moment is verified quote discovery, save, jump, and copy.
- Full citeproc-py plus Crossref/OpenLibrary/LLM bibliographic pipeline before launch. Ship a minimal editable citation metadata form and in-text/page copy first; harden CSL/export after usage proves demand.
- Programmatic SEO pages in week 4. They are acquisition work, not first-paying-user activation. The academic demo doc is worth moving earlier because it supports onboarding and manual sales.

Missing or should move earlier:
- Chat-intent routing for direct quote requests.
- Parser fidelity tests for `U.S.`, `e.g.`, decimals, DOI-like text, discretionary hyphens, hard hyphenated compounds, same-page repeated quotes, and page-spanning chunks.
- Verifier telemetry: proposed count, verified count, dropped reason, tier, fuzzy score, no-result rate, save/copy/jump events.
- Honest old-doc vs new-doc trust labels: chunk-fallback documents should not use the same "verified against page text" copy as newly parsed PDFs with populated `pages.content`.
- Page/location derivation from verified offsets, not LLM-provided pages.

## D. Verdict by plan section

Section 1 Product shape: REVISE.
- Required: change "exact source text" and "stored page text" language to distinguish page-text verification from chunk-fallback verification. Quote cards must carry verified page/page_range/location from the verifier.

Section 2 Architecture decisions: REVISE.
- D1 needs the parser/dedupe/page-location changes above.
- D3 reuse is still good.
- D5/D6 are overbuilt for the first paid release; keep interfaces, defer full bibliography/export correctness work.
- D8 should user-scope editable bibliography metadata.

Section 3 Funnel fixes: SHIP.
- These are aligned with activation. Note that current config still defaults `FREE_MAX_FILE_SIZE_MB` to 25 at `backend/app/core/config.py:156`; the plan's 50 MB change needs an explicit config/env update.

Section 4 Acquisition: REVISE.
- Defer SEO tool pages until Quote Finder conversion is proven. Move the academic demo doc/prefilled quote example earlier.

Section 5 Sequencing: REVISE.
- Put parser fidelity fixes, verifier unit tests, and real-query replay before the endpoint is considered done.
- Put chat-intent routing in W2 with the Quote Finder endpoint.
- Defer most W3 export/biblio work behind the core save/copy/jump loop.

Section 6 Known risks / failure modes: REVISE.
- Add risks for chunk-text mutation, hard-hyphen loss, page-spanning chunk attribution, same-page duplicate collapse, user-edited bibliography leakage, and verified-empty paid searches. These are more likely to hurt thesis users than the already-listed JSON adherence risk.

Final call: proceed, but only after tightening D1. The revised plan is directionally right; the current chunk text is a good hallucination filter, not yet a defensible verbatim-quote substrate.
