<!-- Author: Fable 5.1 (planner), 2026-09-27. Executed by Claude on branch fix/missing-original-files (v0.34.0).
Deviations during execution:
- Qdrant already had a volume by the time this ran (fixed 2026-09-27), so §0's "qdrant-v2 still has no volume" is outdated.
- The 2 retired demo rows were NOT deleted (owner decision b): the public demo list now filters to DEMO_DOCS slugs and the old /demo/<slug> links redirect to current samples. Non-destructive; the /demo page itself only ever rendered the three known slugs.
- Counts confirmed from the audit CSV: 109 file references = 102 documents (88 ready, 14 error; 7 also lost the converted PDF).
- Copy kept the cause and date (owner decision a: default kept).
-->

# Plan: documents whose original file is missing (v0.34.0)

## 0. Facts that need correcting first

- **109 is file references, not documents.** 94 + 15 = 109 status rows means the audit counted per key; the 7 `converted_storage_key` docs almost certainly also lost their originals (same wipe). Count distinct `document_id` in the CSV — expect ~102 docs.
- **"Chunks and vectors still exist" holds only for docs never reparsed after 2026-06-19.** `parse_worker.py:337-385` deletes Qdrant vectors, `Chunk`, `Page`, `DocumentElement`, `DocumentBrief` **before** downloading the file (`:389`). Any of the 15 `error` docs with `ERR_CODE:DOWNLOAD_FAILED` are already hollow; the existing DOWNLOAD_FAILED UX (delete + re-upload) is correct for them. Worse: `backend/scripts/find_low_quality_docs.py` reparses `ready` docs with `parse_version < current` — the 94 ready docs were parsed Feb–Jun, so one routine backfill run would hollow all of them. `qdrant-v2` also still has no volume.
- **The 2 demo rows are probably public.** `GET /api/documents/demo` (`documents.py:172`) lists every `demo_slug IS NOT NULL` row; `_ensure_demo_files` skips slugs not in `DEMO_DOCS`. Retired-slug rows with status `ready` sit on the demo page with a dead PDF pane. Verify slugs; delete the rows.
- `missing_files_report.py` was never committed to `backend/scripts/` despite the R2 plan saying so.

## 1. UX (reader only; dashboard unchanged)

PDF doc, original missing: render `TextViewer` (already handles `fileType='pdf'`, labels `doc.page`, supports `highlightSnippet`/`targetPage`, so citation and Quote Finder jumps still land) under a compact amber notice, in place of the PDF pane. Chat, citations, Quote Finder, diff, export, extraction, templates are DB-only and stay untouched. The layout-translate button lives in `PdfToolbar`, which is not mounted in this branch — no entry point to disable. Label the pane "extracted text" — the `text-content` chunk fallback appends spanning chunks to every page in their range, so text visibly duplicates.

Copy (English source; Claude translates to all 11 `frontend/src/i18n/locales/*.json`):
- `doc.fileMissing.title`: "The original PDF is no longer available"
- `doc.fileMissing.body`: "This file was lost in a storage failure in June 2026 and cannot be recovered. Everything DocTalk extracted from it at upload time is still here: you can keep chatting, follow citations and use Quote Finder. Page view, translation and re-processing need the file itself — upload it again as a new document to get them back."
- `doc.fileMissing.extractedText`: "Extracted text"
- `errors.FILE_MISSING.title/body` (generic consumers: reparse/translate errors): "Original file not in storage" / "This document's file is no longer stored, so it cannot be re-processed or translated. Chat and citations still work; upload the file again for a fresh copy." Never say "delete".

Converted PDF missing (DOCX/PPTX): treat as `hasConvertedPdf=false` → toggle disappears, TextViewer shows; reuse the notice.

## 2. Backend contract

- **`GET /file-url`** (`documents.py:719`): after key selection, `await asyncio.to_thread(storage_service.object_exists, key)`; `False` → **410** `{"error":"FILE_MISSING","message":…,"variant":"original"|"converted"}`. 410 (not 404) because the document exists and the loss is permanent; it is distinguishable from `DOCUMENT_NOT_FOUND` on status alone, `shouldRetryLoaderError` already treats it as terminal, and the proxy forwards status verbatim. Wrap stat+presign in one `try`; non-NoSuchKey errors keep the 502 `STORAGE_UNAVAILABLE`. Compute on demand: one HEAD per reader open plus one per 5-min renewal is negligible; no column, no negative cache (would mask a restore).
- **`POST /reparse`** (`:883`): HEAD after the locked SELECT + status check, **before** the `users` lock; missing → `rollback()` + 410 FILE_MISSING, no claim UPDATE, no `.delay()`. Storage error → 503 `STORAGE_UNAVAILABLE_DETAIL`.
- **Layout translation** `_get_owned_ready_pdf` (`layout_translations.py:~140`): same HEAD → 410, before `_raise_layout_translation_limit_error` so no trial is consumed.
- **Worker reorder** (`parse_worker.py`): move the download block (`:388-397`) above the Qdrant delete (`:337`). DOWNLOAD_FAILED then leaves rows/vectors intact for every dispatcher. Add an `object_exists` skip in `find_low_quality_docs.py` before its claim UPDATE.
- Table scan / biblio: fail closed as job errors, zero credits; unguarded by design.

## 3. Frontend wiring

- `useDocumentLoader.ts:146-177`: on `ApiError.code==='FILE_MISSING'` do **not** `setError`; set `missingFile: 'original'|'converted'|null`, leave `pdfUrl` null, `setHasConvertedPdf(false)` for converted, clear the interval.
- `DocumentReaderPageClient.tsx:351`: new branch `fileType==='pdf' && missingFile==='original'` → notice + `TextViewer`. Optional: show Delete in the error card when `reparseErrorCopy` is FILE_MISSING.
- `errorCopy.ts` `CODE_TABLE`: add `FILE_MISSING` (severity `warning`, no CTA or CTA → `/`).
- New `components/PdfViewer/MissingFileNotice.tsx` (zinc/blue palette, ≥12px).

**Deploy window**: with new backend + old frontend, the 410 hits `useDocumentLoader`'s catch → full-page error card hides chat for affected docs. Acceptable at zero active users; push `stable` immediately after `/health` confirms.

## 4. Informing users

Recommend in-app only (the reader notice, shown exactly when relevant); no email (vetoed), no dashboard badge/banner (needs a column + backfill, nobody active to see it). Owner decides: (a) keep or soften the cause/date in the copy; (b) delete the 2 retired demo rows; (c) accept the deploy-window regression.

## 5. Tests

Backend — existing reparse/create tests use `SimpleNamespace` DBs with no storage mock; add `monkeypatch.setattr(..., "object_exists", lambda _k: True)` (autouse fixture) in `test_document_slots.py`, `test_error_taxonomy.py`, `test_layout_translations_api.py`, or Claude will be tempted to weaken the guard. New: `test_error_taxonomy.py` — file-url 410 original / 410 converted / presign not called / other S3Error → 502; `test_document_slots.py` — reparse 410 before claim, `db.execute` not awaited, no `.delay`; `test_layout_translations_api.py` — 410 before trial consumed; `test_parse_worker_batching.py` harness — download raises → no Qdrant `delete`, no `sa_delete`, `error_msg` starts `ERR_CODE:DOWNLOAD_FAILED`.

Frontend — `tests/pdf-recovery.test.cjs` (or new `file-missing.test.cjs`, mirror `document-library.test.cjs` timer stubs + `ApiError` mock with `code`): FILE_MISSING → `error===null`, `missingFile==='original'`, `pdfUrl` null, polling stopped; converted → `hasConvertedPdf=false`. `tests/errorCopy.test.cjs`: FILE_MISSING copy, no "delete". Run `node scripts/check-public-i18n.js` (not wired into lint/build) plus the CLAUDE.md verify set. Minor bump via `scripts/bump_version.py minor` (touches `CHANGELOG.zh.md` too); note in `docs/ARCHITECTURE.md` §10 and `.claude/rules/backend.md`.

### Critical Files for Implementation
- /Users/mayijie/Projects/Code/010_DocTalk/.claude/worktrees/xenodochial-rubin-44d81d/backend/app/api/documents.py
- /Users/mayijie/Projects/Code/010_DocTalk/.claude/worktrees/xenodochial-rubin-44d81d/backend/app/workers/parse_worker.py
- /Users/mayijie/Projects/Code/010_DocTalk/.claude/worktrees/xenodochial-rubin-44d81d/frontend/src/lib/useDocumentLoader.ts
- /Users/mayijie/Projects/Code/010_DocTalk/.claude/worktrees/xenodochial-rubin-44d81d/frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx
- /Users/mayijie/Projects/Code/010_DocTalk/.claude/worktrees/xenodochial-rubin-44d81d/frontend/src/lib/errorCopy.ts
