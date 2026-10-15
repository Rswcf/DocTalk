# Codex r1 (gpt-6-astra), 2026-10-15

Prompt: `codex-r1-prompt-2026-10-15.md`. Reviewed HEAD c871c210. Final answer only (the full transcript, about 0.5 MB of tool output, is not kept).

**BLOCK: the new colon fallback can highlight the wrong chunk.** I also reproduced duplicate markers during continuation and disproved the plan’s “native branch unreachable” and “repairs can only decrease” assumptions.

1. **OK — TextViewer move and guard.**  
   TXT, MD, URL, XLSX, and DOCX/PPTX text views still bypass `findSnippetInPage`. Format selection remains at `frontend/src/components/TextViewer/TextViewer.tsx:123` and `:178–183`; the guard and call remain at `:412–418`. The supplied diff changes only the import and removes the local implementation.

2. **OK — Brief’s converted-PDF path rejects both requested attacks.**  
   `_brief_ref_payload` supplies 180 characters without context (`backend/app/api/documents.py:618–627`), which `citationPassage` returns unchanged (`frontend/src/lib/citationText.ts:165–168`).

   Matcher-level probes produced:
   - Unique occurrence on page 2, cited range page 1: `uniqueInPageRange → false`.
   - A 180-character cut ending `Internationa`, followed by `l` in the document: uniqueness passed, but `findEvidenceRange → null`.

   The gates are wired at `frontend/src/components/PdfViewer/PdfViewer.tsx:135–139`; the boundary rejection is at `frontend/src/lib/pdfEvidence.ts:75–78`. Converted viewers discard synthetic boxes at `PdfViewer.tsx:90`, so these cases produce page-only evidence, without a drawn passage box. These were synthetic text-layer probes, not LibreOffice/browser acceptance.

3. **SHOULD-FIX — “No backend path emits `(0,0,1,1)`” is false.**  
   I generated an in-memory PDF sized **228.97998046875 × 13.739999771118164 points**, containing one 10-point line at `(0,10.75)`. Actual `extract_pages → chunk_document` returned:

   ```json
   {"page":1,"x":0.0,"y":0.0,"w":1.0,"h":1.0}
   ```

   `_normalize_bbox` permits this (`backend/app/services/parse_service.py:1356–1373`); `citation_location` preserves it (`backend/app/services/citation_location.py:28–43`). Both extraction and Brief payload probes retained it.

   Consequently, `frontend/src/components/PdfViewer/PageWithHighlights.tsx:73` **is reachable**. This establishes a real geometry case, not a newly demonstrated wrong mark. Correct the documentation and add native-path coverage instead of claiming the snippet change cannot affect it.

4. **BLOCKER — legacy colon fallback selects an earlier, unrelated passage.**  
   This reproduction uses precisely the chunk-mode page construction at `backend/app/api/documents.py:859–869`:

   ```js
   const tail = 'Payment is due within sixty days of the invoice date.';
   const body = 'The Seller requires immediate notice. ' + tail;
   const page = 'Billing: ' + tail + '\n' + body;
   const snippet = ('Terms: ' + tail + ': ' + body).slice(0, 100);
   findSnippetInPage(page, snippet); // [9, 52]; cited chunk starts at 63
   ```

   Without the new colon fallback, the result is `null`. With it, an intermediate title suffix wins before the actual body candidate. The returned range becomes an amber citation highlight at `frontend/src/components/TextViewer/TextViewer.tsx:932–940`.

   Cause: every colon creates a candidate, shortened candidates use first-match `indexOf`, and no uniqueness check exists (`frontend/src/lib/snippetMatch.ts:25–42`). Thirty characters do not establish identity. The 200-character bound provides no protection for ordinary 100/140/180-character snippets; it also counts UTF-16 units while Python truncation counts code points.

   **Drop the new colon-guessing fallback for this release**, or replace it with verified prefix removal and unambiguous passage matching. Raising either threshold does not fix the underlying ambiguity.

5. **OK — separate `section_title`, with a terminology qualification.**  
   Current table retrieval supplies `table_id` alongside its internal label (`backend/app/services/retrieval_service.py:180–193`), and table continuation retains that identity (`backend/app/services/chat_service.py:1201–1215`). The exclusion at `:285–286` therefore works. Summary labels are excluded too.

   Other values can be structural source labels: XLSX sheet names and URL fallback titles, rather than literal body headings (`backend/app/services/extractors/xlsx_extractor.py:52`; `url_extractor.py:404`). No additional synthetic `_ChunkInfo` label source was found.

   Frontend mappers currently discard the new field. Future rendering must treat it as untrusted document text. `_source_locator`’s whitespace collapse (`chat_service.py:620–642`) is formatting, not a general prompt-injection defense.

6. **SHOULD-FIX — verifier parity does not hold; additional billed repairs are possible.**  
   `_citation_context` combines independently truncated strings (`backend/app/services/claim_verifier_service.py:156–163`). Numeric matching then treats truncated numbers as evidence (`:114–119`, `:216–218`).

   I reproduced both directions:
   - Removing the summary label changed an answer mentioning “map-reduce” from **pass → warn**.
   - Moving a snippet cut away from `900` inside source value `9000` changed **pass → warn**.
   - Moving the new cut *onto* that partial number changed **warn → pass**, incorrectly accepting an answer claiming 900 kW.

   The last case used ordinary source text ending:

   > “…The reported total rated generating output was around 9000 kilowatts.”

   Its new 100-character snippet ends at `900`; full `context_text` contains `9000`.

   Ordinary table evidence remains available through `table_context`. Text continuation reloads `chunk.section_title`; summary continuation restores coverage text (`chat_service.py:1184–1215`). Evidence beyond the 900-character context cut remains unavailable unless another field carries it.

   A non-pass result invokes repair at `chat_service.py:2542–2544` and `:3309–3311`; repair tokens enter accounting at `:2559–2562` and `:3326–3329`. Correct the plan’s “fewer repairs, not more” claim and add both-direction regression tests. Truncated display snippets should not supply artificial numeric evidence when fuller context exists.

7. **OK — storage, schemas, and public field boundaries.**  
   JSONB and `List[dict]` accept the additive key (`backend/app/models/tables.py:322`; `backend/app/schemas/chat.py:33`). Brief does not receive the new field.

   Answer sharing explicitly whitelists fields (`backend/app/api/sharing.py:55–60`, `:85–101`); conversation sharing also filters them (`:455–460`). Export reference dictionaries retain extra fields internally, but `_format_footnote` never renders `section_title` (`backend/app/services/export_service.py:156–164`). Frontend restore and SSE mappings ignore it (`frontend/src/lib/api.ts:70–85`; `sse.ts:86–100`). No new public-key leak or rejection found.

8. **SHOULD-FIX — duplicate markers are possible, not merely duplicate references.**  
   Distinct-offset old/new citations retain both markers and receive separate reference numbers. However, identical source citations at the **same offset** render `[1][2]` in both frontend and backend export probes.

   This is reachable when an old answer ends with `[1]` and continuation starts with `[1]`: the parser starts at the existing answer length (`backend/app/services/chat_service.py:3138–3139`), emits the citation without advancing that offset (`:1343–1348`), and concatenates citation lists (`:3272`).

   Because snippet text participates in source identity, prefix removal defeats same-offset dedup (`frontend/src/lib/citationText.ts:78–92`; `backend/app/services/export_service.py:95–104`, `:145–148`). No marker loss was demonstrated. Handle this migration duplicate without collapsing distinct table/summary sources that share an anchor chunk.

9. **OK — wire compatibility in both deployment directions.**  
   Old frontend + new backend accepts plain snippets and ignores the additional field. New frontend + old backend accepts existing prefixed payloads. Both rely on unchanged mapper fields (`frontend/src/lib/api.ts:70–85`; `sse.ts:86–100`). No migration or coordinated schema switch is required. This protocol assessment does not excuse blocker 4.

10. **NIT — prefix documentation is mostly corrected, but several claims need tightening.**  
    No remaining current-tense section-prefix contract was found in the requested rules, architecture text, frontend comments, or locales. “Prefix match” at `TextViewer.tsx:853` describes progressively shortened snippet matching.

    Remaining inaccuracies:
    - `snippetMatch.ts:3–4` says whole snippets require 30 characters; `:35` permits 10.
    - `snippetMatch.ts:12` uses the decision date, October 11, as the legacy cutoff; use the release version.
    - `.claude/rules/frontend.md:80` incorrectly declares the native snippet path unreachable.

11. **SHOULD-FIX, pre-existing follow-up — summary coverage is still presented as quoted source.**  
    Summary retrieval substitutes generated coverage text (`backend/app/services/document_brief_service.py:1603–1612`), and `_citation_payload` copies it into the snippet (`chat_service.py:282`). Shared pages and exports still quote it (`frontend/src/app/shared/[token]/page.tsx:120`; `backend/app/services/export_service.py:164`).

    I would **not make blanket blanking a prerequisite for this prefix release**. Follow up with explicit summary presentation at sharing/export boundaries while retaining verifier context. Table snippets have a related pre-existing issue: generated method/confidence labels remain in their quoted text (`retrieval_service.py:184–186`).

12. **SHOULD-FIX — tests omit the adversarial cases; one test overstates its coverage.**  
    `frontend/tests/snippet-match.test.cjs:38–43` covers only short rejected tails, not repeated long tails or intermediate title candidates.

    `frontend/tests/citation-state.test.cjs:29–33` proves only that the store clears `highlightSnippet`. It does not prove summaries are never searched. A 900-character summary context can trigger an anchor-chunk fetch (`TextViewer.tsx:374–380`); my probe then produced a `region` highlight. This behavior predates the patch.

    Add coverage for findings 3, 4, 6, and 8. The heading-only verifier test itself is meaningful: it removes context and supplies a non-overlapping snippet (`backend/tests/test_citation_snippet_shape.py:94–112`).

Validation: **101 frontend tests passed; TypeScript and Ruff passed.** The backend subset produced **127 passes and 10 failures caused by missing `rapidfuzz`**; that dependency also blocked collection of the new snippet-shape suite. No build, browser, or LibreOffice acceptance was performed. No files were edited.

VERDICT: BLOCK (4: the new colon fallback produces a wrong-passage highlight).
