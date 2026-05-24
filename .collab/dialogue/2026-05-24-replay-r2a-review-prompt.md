# Adversarial review — Remediation R2a implementation

Review the R2a implementation against the ratified consensus
`.collab/plans/2026-05-24-replay-r2-CONSENSUS.md`. Be adversarial; you cannot run git.
Diff: `.collab/reviews/2026-05-24-replay-r2a-diff.patch`. Read the actual files.

## What changed
- `backend/app/services/chat_service.py`:
  - SYSTEM_PROMPT_META_RULE rewritten to Role/Data Boundary (spotlighting).
  - New helpers `_location_label`, `_source_locator`, `_source_location_contract`,
    `_output_terminology_contract` (near `_citation_contract`).
  - `chat_stream`: collection load now fetches file_type/page_count; numbered_chunks
    prepend a `(source: …)` label; page-lookup miss → `retrieved=[]`/`page_lookup_miss`
    (no semantic fallback); custom instructions subordinate; global append of
    source-location + terminology contracts before the domain_mode persist.
  - `continue_stream`: same source label (adapted from _ChunkInfo) + subordinate custom
    instructions + global contracts append.
  - `_try_repair_rag_answer`: appends terminology contract.
- `backend/app/workers/parse_worker.py`: delete Qdrant points by document_id (wait=True)
  AFTER deleting Pages/Chunks, BEFORE re-index.
- `backend/app/api/documents.py`: `reparse` accepts optional `locale`, passes to worker.
- `backend/Dockerfile` + `config.OCR_LANGUAGES` + `parse_service._LOCALE_TESSERACT`: add Urdu (urd).
- `backend/tests/test_replay_r2_helpers.py`: 8 unit tests.

## Scrutinize specifically
1. **Regression risk to PAY/U26/U28/U28/U42** (cases that already pass): does adding the
   source label or the global contracts change retrieval or break existing citation
   behavior? Token budget of the source line across 8–24 excerpts.
2. **Page-lookup no-fallback**: is `retrieved=[]` handled gracefully downstream (prompt
   build, citation parser, RAG verification, credits/reconcile, event gating)? Any path
   that assumes non-empty retrieved? Could a legitimate "page N + topic" query now wrongly
   get nothing? Is `query_route.primary_intent == PAGE_LOOKUP` only set for PURE page asks?
3. **Worker Qdrant delete**: correct filter/type (`str(doc.id)`)? `wait=True` truly blocks?
   If Qdrant raises, does the task fail+retry (not leave half-state)? Does it run on FIRST
   parse too (empty delete = harmless)? Any interaction with the existing collection-exists
   bootstrap at line ~418?
4. **Spotlighting meta-rule**: does the new text actually stop the U14 false-refusal while
   still resisting injection from retrieved URL content? Any branch that DOESN'T include
   SYSTEM_PROMPT_META_RULE now? Could "narrow refusal only" cause it to answer off-document
   junk it shouldn't?
5. **_source_locator correctness**: summary modality range labeling; section truncation;
   collection per-chunk file_type lookup when chunk_doc_id missing.
6. **continue_stream adapter**: `_ChunkInfo.page_start/page_end/section_title/retrieval_modality`
   exist + map correctly to the dict `_source_locator` expects?
7. Anything that will make the re-replay NOT flip U21 (page cites) / U14 (keyword) / terminology.

## Output
Write to `.collab/reviews/2026-05-24-replay-r2a-codex-review.md`: numbered findings tagged
[Must-fix]/[Should-fix]/[Nit] with file:line, + verdict SHIP / SHIP-AFTER-MUSTFIX / NEEDS-REWORK.
