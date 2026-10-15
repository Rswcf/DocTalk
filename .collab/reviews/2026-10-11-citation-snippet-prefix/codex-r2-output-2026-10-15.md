# Codex r2 (gpt-6-astra), 2026-10-15

Prompt: `codex-r2-prompt-2026-10-15.md` (first run died on a full host disk; this is the rerun). Reviewed HEAD f91887e3. Final answer only.

**BLOCK: r1’s wrong-highlight bug is fixed, but the new identity rule can merge distinct legacy table sources. The verifier change also drops heading evidence from older citations during continuation.**

1. **BLOCKER — #8 misclassifies legacy table citations as text.**

   Both predicates default missing modality to `"text"` without checking `table_id`: `frontend/src/lib/citationText.ts:93`, `backend/app/services/export_service.py:99`. The frontend mapper discards `table_id` entirely (`frontend/src/lib/api.ts:70–85`).

   I reproduced the requested legacy shape with the same reference index, document, anchor chunk and page:
   - Text citation plus table citation without modality → one marker, one source chip, one export reference.
   - Two table citations without modality, with different `table_id` and snippets → the same collapse.
   - Adding explicit `"table"` modality preserves both sources.

   Actual frontend and backend export output:
   ```text
   Output is 900 kW.[^1] More.
   ```
   Only the first source survives; when text comes first, the table reference disappears. `uniqueCitationIndexes` returns `[1,1]`, so its owner logic cannot recover the distinction. `SourcesStrip` removes the second citation before rendering; this is source loss, not a React duplicate-key warning (`citationText.ts:115–120`, `SourcesStrip.tsx:49–52`).

   **Fix:** exclude citations carrying table identity from text deduplication in both implementations. Preserve or infer that identity during frontend mapping. Add shared fixtures for missing-modality table/text and table/table pairs. This is a reproduced input-level regression; I did not inspect production records.

2. **SHOULD-FIX — #6 drops valid heading evidence from pre-release citations.**

   Older citations contain the heading only in `text_snippet`. Their `context_text` contains body text, and they lack the new `section_title`. The new rule therefore discards their heading (`backend/app/services/claim_verifier_service.py:160–162`).

   Reproduction:
   ```text
   Heading: 4.2 Power Grid
   Body: Turbines spin beside the Selka weir. The generator powers local homes.
   Answer: Section 4.2 covers the power grid of the valley.
   ```

   | Citations checked | Before fix | After fix |
   |---|---|---|
   | Legacy citation | pass | warn: numeric mismatch + low overlap |
   | New citation | pass | pass |
   | Legacy + new | pass | warn: same two findings |

   Continuation reloads the heading into `_ChunkInfo` (`chat_service.py:1210`), but merges the original citation dictionaries unchanged and verifies them (`:3272`, `:3302`). A new, correct citation does not cancel the old citation’s failure. This can invoke billed repair (`:3309–3327`).

   **Fix:** hydrate missing heading evidence from the matching stored text chunk into verification-only citation copies. Do not restore arbitrary truncated snippets or guess at colon boundaries.

3. **OK — #4’s blocker is closed.**

   The original colon-tail probe now returns `null`; the unprefixed body returns `[63,91]`. I also compared the transpiled function against main’s implementation embedded in the r1 diff: they match.

   Evidence: `frontend/src/lib/snippetMatch.ts:21–34`, `frontend/tests/snippet-match.test.cjs:22–32`. The missing-file-PDF guard remains intact at `TextViewer.tsx:412`.

4. **OK — #3’s reachable full-page box is now covered.**

   The actual `extract_pages → chunk_document` test passes and produces `(0,0,1,1)` (`backend/tests/test_citation_snippet_shape.py:144–164`). The frontend test accepts the complete passage and rejects the tested mid-word cut and prefixed candidate (`frontend/tests/pdf-evidence.test.cjs:71–78`).

   Brief’s converted-view probes also remain conservative: wrong-page uniqueness returns `false`; a unique 180-character mid-word cut passes uniqueness but returns `null` from `findEvidenceRange`. Wiring remains at `PdfViewer.tsx:135–139`.

5. **OK — #6 fixes the 100-character numeric-cut bug for fresh citations.**

   Both regression tests pass: fabricated `900` is rejected while source value `9000` remains supported (`backend/tests/test_citation_snippet_shape.py:122–141`).

   Fresh text, summary and table payloads derive snippet and context from the same text; their longer contexts retain the snippet’s source content (`chat_service.py:282`, `:301`, `:317`). Summary/table continuation reconstruction does not introduce a new independent snippet source (`:1184–1215`).

   All five production verifier call sites are in `chat_service.py`. Fresh and repaired citations use `_citation_payload`; continuation also passes raw persisted citations, which can lack context. The no-context fallback still works. Brief and extraction citations have no current direct verifier caller.

   **Pre-existing limitation:** the 900-character context cut can itself split `9000` into `900`; I reproduced acceptance of `900` there. This patch fixes the display-snippet cut, not every truncation boundary. The comment saying context fields carry text “in full” is inaccurate (`claim_verifier_service.py:157–158`).

6. **OK — the other #8 identity boundaries hold.**

   Probes preserved separate sources for different `page`, `page_end`, document IDs, and snippets without chunk IDs. Explicit table/summary modalities remain separate. Mixed old/new text citations deduplicate, while another chunk receives its own owner index.

   Evidence: `frontend/src/lib/citationText.ts:94–122`, `backend/app/services/export_service.py:100–106`.

   **Export choice:** first encountered citation wins. For an old citation followed by its new equivalent, both exports retain the old prefixed quotation (`frontend/src/lib/export.ts:29–31`, `export_service.py:106`). Deduplication does not clean historical quotations.

7. **NIT — #10 is corrected; #12 is only partly closed.**

   The matcher thresholds, release cutoff and reachable native path are documented correctly. Regression coverage now addresses #3, #4, #6 and the nominal #8 case.

   However, `frontend/tests/citation-state.test.cjs:29` still claims summaries are “never searched for in the page text.” It proves only that `highlightSnippet` becomes null. I reproduced a 900-character summary context taking the anchor-fetch path and producing `region` (`TextViewer.tsx:374–380`). Rename the test to describe its actual assertion.

8. **OK / deferred — remaining r1 boundaries.**

   The separate heading field and public sharing whitelist remain compatible (`chat_service.py:285–286`, `sharing.py:55–60`). No additional blocker emerged from the reviewed branch.

   **SHOULD-FIX, existing follow-up:** summary coverage and table metadata remain quoted as source text. This remains outside the prefix-release prerequisite, as agreed (`document_brief_service.py:1603–1612`, `frontend/src/app/shared/[token]/page.tsx:120`, `export_service.py:165–168`).

Validation: **378 frontend tests passed; 224 selected backend tests passed; Ruff and TypeScript passed.** No build, browser, LibreOffice or integration acceptance was run. No files were edited.

VERDICT: BLOCK (#1: distinct legacy table sources can collapse into one citation/reference).
